import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => attempt > 5 ? null : Math.min(attempt * 200, 1000)
    });
    globalForRedis.redis.on('error', (error) => console.error(JSON.stringify({
      level: 'ERROR', message: 'redis_connection_error', error: error.message
    })));
  }
  return globalForRedis.redis;
}
