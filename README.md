# Samadhan Setu

Samadhan Setu is a Next.js 16 App Router application for citizen grievance filing, tracking, officer processing, escalation, and the Apuni Sarkar certificate referral demo. PostgreSQL through Prisma is the source of truth for complaints, identities, OTP challenges, sessions, notifications, audit records, and queued outbox events. Redis provides shared rate limiting and cache support. The bilingual classifier uses Gemini only when `GEMINI_API_KEY` is configured; otherwise, or on provider timeout/error/invalid output, it uses a conservative keyword classifier and leaves unmatched reports unclassified for manual triage.

## Architecture

| Path | Purpose |
|---|---|
| `app/` | App Router pages and `app/api/v1` API route handlers. |
| `components/` | Shared UI components. |
| `lib/` | Authentication/session, Prisma, validation, classification, workflows, rate limiting, cache, notifications, outbox and SLA workers. |
| `prisma/schema.prisma` | PostgreSQL schema and Prisma client definition. |
| `prisma/migrations/` | Additive database migration history; do not edit applied migrations. |
| `prisma/seed.ts` | Idempotent reference data and environment-gated demo/bootstrap account seeding. |
| `prisma/seed-data.ts` | Static development demo fixtures consumed by seed/test code, not API handlers. |
| `tests/` | Vitest unit, mocked route-handler, and opt-in PostgreSQL integration tests. |
| `infra/k8s/` | Kubernetes web deployment, migration Job, CronJobs, and placeholder secret example. |
| `docs/` | Additional project and operations documentation. |
| `.github/workflows/ci.yml` | CI dependency install, database services, Prisma, lint, type, tests, and build. |

## Setup

Use Node.js 20 or newer and npm. Start PostgreSQL and Redis locally, then create an ignored `.env` from `.env.example` and set local-only credentials and a random session secret.

```sh
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run dev
```

The seed command loads district, department, and category reference data. Development demo officers and complaint/application fixtures are loaded only when `NODE_ENV=development`. `DEMO_OFFICER_PASSWORD` sets the shared password for the seeded officer accounts; if unset, seeding generates and prints a one-time random password. Demo officer email addresses and profiles are listed in `lib/seed-officers.ts` and `prisma/seed-data.ts`. Never use demo accounts in production.

## Authentication and OTP

Citizens request a login code through `/api/v1/auth/otp/request` and verify it at `/api/v1/auth/otp/verify`. Production phone verification uses Twilio Verify; email OTP delivery uses the configured SMTP transport. In development, `OTP_LOCAL_DELIVERY=true` enables a random, per-request code in the development response. `/dev/messages` displays persisted complaint notifications; it is not an OTP inbox. There is no universal OTP or fixed authentication bypass. Staff use the officer console login backed by seeded/managed user password hashes and the session cookie. Staff passwords are not set by application defaults.

`/dev/messages` and its API return persisted `Notification` rows and are disabled outside development. The view is not an SMS provider console. OTP local-delivery details are development-only.

## Complaint and AI behavior

Complaint filing requires a citizen session and an `Idempotency-Key`. The route validates ownership and attachments, classifies the description on the server, caps client urgency at `HIGH`, uses the higher of client and classifier urgency, stores bilingual summaries/confidence, routes confident cases to an eligible officer, and leaves confidence below 0.5 in `SUBMITTED` for manual triage. Database constraints and the transaction-protected idempotency record prevent duplicate submissions and retain the original response for retries.

The classifier accepts only strict JSON with a valid category code and bounded confidence, with a three-second Gemini deadline. Provider details are not returned to callers. `POST /api/v1/ai/suggest` requires a session, uses the shared rate limiter, and checks Prisma for an open complaint in the same district/category created within 14 days. Complaint detail and officer routes apply their route-specific authorization; oversight responses mask citizen name and phone.

The Bridge is a local simulation: delayed `ApplicationRef` records are seeded in PostgreSQL and the bridge UI searches those records. Referral creates a Samadhan Setu complaint and workflow events. It does not call Apuni Sarkar/e-District or any government production service.

## Outbox, SLA, and scheduled work

Workflow routes write `OutboxEvent` records in the same database transaction as complaint changes. `POST /api/v1/cron/outbox` processes pending notifications and persists delivery attempts/results; in development local delivery creates `Notification` rows instead of sending SMS. `POST /api/v1/cron/sla` escalates overdue eligible complaints and records reassignment/events. `POST /api/v1/cron/cleanup` removes expired OTP, session, and idempotency records. All cron routes require `Authorization: Bearer <CRON_BEARER_TOKEN>`; use a random token of at least 32 characters and store it in a secret manager/Kubernetes Secret. Kubernetes CronJobs are provided under `infra/k8s/`.

## Environment variables

| Variable | Required/use |
|---|---|
| `NODE_ENV` | Runtime mode; production configuration checks run in production. |
| `PORT` | Optional Next.js server listening port (standard framework setting). |
| `DATABASE_URL` | PostgreSQL URL; required in production. |
| `REDIS_URL` | Redis URL; required in production for shared rate limiting/cache. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional legacy config; current shared limiter uses `REDIS_URL`. |
| `AUTH_SESSION_SECRET` | Random session hashing secret, at least 32 characters; required in production. |
| `SESSION_COOKIE_NAME`, `SESSION_EXPIRY_DAYS` | Optional session cookie name and lifetime (1–30 days). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify credentials; required in production. |
| `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` | SMS sender; one is required in production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email OTP transport; required in production. |
| `OTP_LOCAL_DELIVERY` | Set `true` only for development local OTP delivery; production rejects it. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional AI provider key/model; keyword fallback is used without a key or on any provider failure. |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error`. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Observability; required by current production config. |
| `METRICS_BEARER_TOKEN`, `CRON_BEARER_TOKEN` | Random tokens of at least 32 characters; required in production. |
| `TRUSTED_PROXY_HOPS`, `TRUST_PROXY` | Client IP/proxy trust configuration; set to match the deployment path. |
| `ATTACHMENT_CDN_HOST` | Allowed attachment host; required in production. |
| `DEMO_OFFICER_PASSWORD` | Optional seed-only development demo officer password. |

The production seed additionally requires `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (at least 14 characters), with optional `BOOTSTRAP_ADMIN_NAME`; these are consumed by `prisma/seed.ts`, not the runtime environment parser. Do not commit `.env`, database URLs, provider credentials, bootstrap passwords, or bearer tokens.

## Tests and operations

```sh
npm run db:generate
npx --no-install prisma validate
npm run lint
npx --no-install tsc --noEmit
npm test
npm run build
```

PostgreSQL integration tests are enabled only when `TEST_DATABASE_URL` is set to a dedicated database whose name includes `test`. Apply the repository migrations to that database before running them. Never point test configuration at production data.

```sh
# Set DATABASE_URL to a disposable local test database before migration/test commands.
npm run db:migrate
$env:TEST_DATABASE_URL = $env:DATABASE_URL
npm test
```

For deployment, build the standalone Docker image, apply the Kubernetes migration Job and wait for it to complete, then roll out the web Deployment. Keep migration execution serialized between releases. See `infra/k8s/README.md` for the exact image and deployment steps. Local Compose starts the migration service before the web service.

## API conventions

Validation failures and other API errors use a Problem Details style JSON object (`type`, `title`, `status`, with route-specific extension fields where needed). Existing success response envelopes are kept stable. Workflow mutations use Prisma transactions for state changes, audit/event records, and outbox records. Existing migration files are immutable: add a new migration for schema changes.

The Prisma `Role`, `ComplaintStatus`, and `UrgencyLevel` enums are retained for compatibility with the initial migration history, although current model columns use strings. `Notification` and `AuditLog` are actively used persistence models and must remain.
