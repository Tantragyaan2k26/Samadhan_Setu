# Kubernetes deployment

The web image and migration image are separate targets. The web image uses Next.js standalone output; the migrator image contains the repository-pinned Prisma CLI and the same migration directory. The migration Job is never part of application startup.

Configure `samadhan-secrets` through the cluster's approved secret manager. `secret.example.yaml` contains placeholders and must not be applied. The web Deployment reads every secret required by `assertProductionConfig`; `ATTACHMENT_CDN_HOST` is a non-secret application setting. Configure the exact `TRUSTED_PROXY_HOPS` value in the Deployment once the ingress/proxy chain is known.

Build and push both images from the same commit. Supply the public Sentry DSN used by the browser bundle as a build argument; do not supply runtime secrets as build arguments.

```sh
export IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
export MIGRATOR_IMAGE_TAG="${IMAGE_TAG}-migrator"
docker build --build-arg NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" -t "ghcr.io/uk-gov/samadhan-setu:${IMAGE_TAG}" .
docker build --target migrator -t "ghcr.io/uk-gov/samadhan-setu:${MIGRATOR_IMAGE_TAG}" .
docker push "ghcr.io/uk-gov/samadhan-setu:${IMAGE_TAG}"
docker push "ghcr.io/uk-gov/samadhan-setu:${MIGRATOR_IMAGE_TAG}"
```

Serialize releases for this database. Apply exactly one migration Job, wait for success, and only then apply the Deployment; never roll out the web image after a failed migration.

```sh
kubectl delete job samadhan-setu-migrate -n civic-apps --ignore-not-found
envsubst < infra/k8s/migrate-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete job/samadhan-setu-migrate -n civic-apps --timeout=10m
envsubst < infra/k8s/deployment.yaml | kubectl apply -f -
kubectl rollout status deployment/samadhan-setu-web -n civic-apps --timeout=10m
```

`IMAGE_TAG` and `MIGRATOR_IMAGE_TAG` must be set before `envsubst`. CronJobs use the same Secret's `cron-bearer-token` and remain scheduled independently of a release.
