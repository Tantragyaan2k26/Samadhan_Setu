# Samadhan Setu

Samadhan Setu is a bilingual (Hindi/English) grievance redressal and e-services bridge for Uttarakhand. It uses Next.js 16 App Router for UI and API routes, Prisma with PostgreSQL for durable data, Redis for distributed rate limiting, and a transactional outbox for downstream notifications.

## Architecture map

- `app/` — App Router pages, layouts, and versioned API routes.
- `components/` — Shared React UI components.
- `lib/` — Auth/session, environment validation, Prisma/Redis clients, complaint workflow, taxonomy, SLA, cache, and notification providers.
- `prisma/` — Prisma schema, migrations, and seed script.
- `tests/` — Vitest unit and API integration tests.
- `infra/` — Kubernetes deployment/autoscaling and k6 load test.
- `.github/workflows/` — CI workflow for install, tests, and build.
- `public/` — Static assets.

## Commands

Useful verification commands:

- `npm run lint`
- `npm test`
- `npm run build` (includes the TypeScript check)
- `npm run db:generate`
- `npx --no-install prisma validate`

The last local verification run passed lint (with warnings), all 66 runnable tests, and the production build. Eight PostgreSQL integration tests were skipped because a dedicated test database was not configured. Production server startup and external integrations require deployment environment variables; do not treat a successful build as proof those services are configured.

## Observed conventions

- API errors generally use an RFC 9457-style JSON shape with `type`, `title`, and `status`; successful payloads are route-specific.
- Auth uses `getAuthSession` and database-backed sessions with an HTTP-only cookie. Route handlers enforce role and ownership checks.
- Mutations that update complaint state, write timeline events, or enqueue notifications use a Prisma transaction. `OutboxEvent` is written with the mutation.
- Request payloads are validated with Zod `safeParse` before database writes.
- User-facing messages and UI labels include both Hindi and English; preserve that pattern.

## Rules for future tasks

- Run `npm test` and `npm run build` before finishing and report any environment blocker.
- Never edit an existing file under `prisma/migrations/`; add a new migration instead.
- Never commit secrets or real credentials.
- Keep API response shapes backward compatible.
- Add tests for every behavior change.
