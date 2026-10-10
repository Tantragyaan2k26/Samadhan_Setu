import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  AUTH_SESSION_SECRET: z.string().min(32).optional(),
  SESSION_COOKIE_NAME: z.string().default('samadhan_session'),
  SESSION_EXPIRY_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  OTP_LOCAL_DELIVERY: z.enum(['true', 'false']).default('false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  METRICS_BEARER_TOKEN: z.string().min(32).optional(),
  CRON_BEARER_TOKEN: z.string().min(32).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-1.5-flash'),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  ATTACHMENT_CDN_HOST: z.string().refine(value => {
    try { const parsed = new URL(`https://${value}`); return parsed.hostname === value.toLowerCase() && !parsed.port && parsed.pathname === '/'; }
    catch { return false; }
  }).optional(),
  DEMO_OFFICER_PASSWORD: z.string().min(12).optional()
});

// Treat empty strings (e.g. KEY="" in .env) as "not set" so optional URL/email vars don't fail validation.
const rawEnv = Object.fromEntries(Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]));
export const env = schema.parse(rawEnv);

export function assertProductionConfig() {
  // Runtime secrets are injected by the orchestrator; a production bundle build must not need them.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (env.NODE_ENV !== 'production') return;
  const missing = [
    ['DATABASE_URL', env.DATABASE_URL],
    ['REDIS_URL', env.REDIS_URL],
    ['AUTH_SESSION_SECRET', env.AUTH_SESSION_SECRET],
    ['TWILIO_ACCOUNT_SID', env.TWILIO_ACCOUNT_SID],
    ['TWILIO_AUTH_TOKEN', env.TWILIO_AUTH_TOKEN],
    ['TWILIO_VERIFY_SERVICE_SID', env.TWILIO_VERIFY_SERVICE_SID],
    ['SMTP_HOST', env.SMTP_HOST],
    ['SMTP_USER', env.SMTP_USER],
    ['SMTP_PASSWORD', env.SMTP_PASSWORD],
    ['SMTP_FROM', env.SMTP_FROM],
    ['SENTRY_DSN', env.SENTRY_DSN],
    ['NEXT_PUBLIC_SENTRY_DSN', env.NEXT_PUBLIC_SENTRY_DSN],
    ['METRICS_BEARER_TOKEN', env.METRICS_BEARER_TOKEN],
    ['CRON_BEARER_TOKEN', env.CRON_BEARER_TOKEN],
    ['ATTACHMENT_CDN_HOST', env.ATTACHMENT_CDN_HOST]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (!env.TWILIO_PHONE_NUMBER && !env.TWILIO_MESSAGING_SERVICE_SID) {
    missing.push('TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID');
  }
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
  if (env.OTP_LOCAL_DELIVERY === 'true') throw new Error('OTP_LOCAL_DELIVERY must be false in production');
}
