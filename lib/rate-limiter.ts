// Sliding window in-memory & Redis-ready rate limiter
import { env } from './env';
import { getRedis } from './redis';
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  limit: number;       // Max requests
  windowMs: number;    // Time window in milliseconds
}

export interface AtomicRateLimitBackend {
  consume(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetInMs: number }>;
}

export function createRateLimiter(backend: AtomicRateLimitBackend) {
  return (identifier: string, options: RateLimitOptions): Promise<{ allowed: boolean; remaining: number; resetInMs: number }> =>
    backend.consume(identifier, options.limit, Math.max(1, Math.ceil(options.windowMs / 1000)));
}

const redisBackend: AtomicRateLimitBackend = {
  async consume(identifier, limit, windowSeconds) {
    const redis = getRedis();
    if (!redis) throw new Error('REDIS_URL is required for the shared rate limiter');
    if (redis.status === 'wait') await redis.connect();
    const results = await redis.multi()
      .incr(identifier)
      .expire(identifier, windowSeconds, 'NX')
      .ttl(identifier)
      .exec();
    if (!results || results.some(result => result?.[0])) throw new Error('Redis rate-limit transaction failed');
    const count = Number(results[0]?.[1]);
    const ttl = Number(results[2]?.[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl) || ttl < 0) throw new Error('Redis returned an invalid rate-limit result');
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetInMs: ttl * 1000 };
  }
};

const sharedRateLimiter = createRateLimiter(redisBackend);

/** Atomic across app replicas in production. In-memory behavior is development/test only. */
export async function checkSharedRateLimit(identifier: string, options: RateLimitOptions) {
  try {
    return await sharedRateLimiter(identifier, options);
  } catch (error) {
    if (env.NODE_ENV === 'production') throw error;
    return checkRateLimit(identifier, options);
  }
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 60, windowMs: 60 * 1000 }
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // Window expired or new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs
    });
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetInMs: options.windowMs
    };
  }

  if (record.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: record.resetAt - now
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: options.limit - record.count,
    resetInMs: record.resetAt - now
  };
}
