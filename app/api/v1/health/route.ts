import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  const [database, redis] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    (async () => {
      const client = getRedis();
      if (!client) throw new Error('Redis is not configured');
      if (client.status === 'wait') await client.connect();
      return client.ping();
    })()
  ]);
  const checks = {
    database: database.status === 'fulfilled' ? 'up' : 'down',
    redis: redis.status === 'fulfilled' ? 'up' : 'down'
  };
  const healthy = checks.database === 'up' && checks.redis === 'up';
  if (!healthy) console.error(JSON.stringify({ level: 'ERROR', message: 'readiness_check_failed', database: checks.database, redis: checks.redis }));
  return NextResponse.json({ status: healthy ? 'healthy' : 'unavailable', timestamp: new Date().toISOString(), service: 'samadhan-setu', version: process.env.APP_VERSION || 'development', checks, latencyMs: Date.now() - started }, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' }
  });
}
