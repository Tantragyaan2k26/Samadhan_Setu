import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV,
  ...({ sendDefaultPii: false } as object), // not in @sentry 11 typings; beforeSend below also strips PII
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || (process.env.NODE_ENV === 'production' ? 0.1 : 0))
});
