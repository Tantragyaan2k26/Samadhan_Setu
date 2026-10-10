# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NEXT_TELEMETRY_DISABLED=1

# The Prisma schema is present before npm install hooks or the pinned Prisma CLI runs.
FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/samadhan_setu_build
RUN npm ci
RUN npm run db:generate

# Build this target separately for the one-off Kubernetes migration Job.
FROM dependencies AS migrator
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs
USER nextjs
CMD ["npm", "run", "db:migrate"]

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json /app/package-lock.json ./
COPY . .
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/samadhan_setu_build
RUN npm run db:generate
RUN npm run build
# Next standalone has already traced the production runtime dependencies into .next/standalone.
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
