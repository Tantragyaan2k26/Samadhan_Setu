import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  ...({ sendDefaultPii: false } as object), // not in @sentry 11 typings; beforeSend below also strips PII
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || (process.env.NODE_ENV === 'production' ? 0.1 : 0)),
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
