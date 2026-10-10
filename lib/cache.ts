import { getRedis } from './redis';

interface CacheItem<T> { value: T; expiresAt: number }
const memCache = new Map<string, CacheItem<unknown>>();
const prefix = 'samadhan:cache:';

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (redis) {
      try {
        if (redis.status === 'wait') await redis.connect();
        const value = await redis.get(`${prefix}${key}`);
        if (value !== null) return JSON.parse(value) as T;
      } catch (error) {
        console.warn(JSON.stringify({ level: 'WARN', message: 'cache_read_failed', error: error instanceof Error ? error.message : 'unknown' }));
      }
    }
    const item = memCache.get(key);
    if (!item || item.expiresAt <= Date.now()) { memCache.delete(key); return null; }
    return item.value as T;
  },

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    const redis = getRedis();
    if (redis) {
      try {
        if (redis.status === 'wait') await redis.connect();
        await redis.set(`${prefix}${key}`, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (error) {
        console.warn(JSON.stringify({ level: 'WARN', message: 'cache_write_failed', error: error instanceof Error ? error.message : 'unknown' }));
      }
    }
    memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  async invalidate(key: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
      try {
        if (redis.status === 'wait') await redis.connect();
        await redis.del(`${prefix}${key}`);
      } catch (error) {
        console.warn(JSON.stringify({ level: 'WARN', message: 'cache_invalidation_failed', error: error instanceof Error ? error.message : 'unknown' }));
      }
    }
    memCache.delete(key);
  }
};
