import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  ...({ sendDefaultPii: false } as object), // not in @sentry 11 typings; beforeSend below also strips PII
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.05),
  beforeSend(event) {
    if (event.user) delete event.user;
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }
      if (event.request.url) event.request.url = event.request.url.split('?')[0];
    }
    return event;
  }
});
