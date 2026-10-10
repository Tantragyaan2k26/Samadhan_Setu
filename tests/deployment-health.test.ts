import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRedis: vi.fn(),
  queryRaw: vi.fn(),
  ping: vi.fn(),
  connect: vi.fn(),
  multi: {
    incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), exec: vi.fn()
  }
}));
vi.mock('@/lib/redis', () => ({ getRedis: mocks.getRedis }));
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: mocks.queryRaw } }));
vi.mock('@/lib/env', () => ({ env: { NODE_ENV: 'production' } }));

describe('shared Redis rate limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.multi.incr.mockReturnValue(mocks.multi);
    mocks.multi.expire.mockReturnValue(mocks.multi);
    mocks.multi.ttl.mockReturnValue(mocks.multi);
    mocks.multi.exec.mockResolvedValue([[null, 3], [null, 1], [null, 57]]);
    mocks.getRedis.mockReturnValue({ status: 'ready', connect: mocks.connect, multi: () => mocks.multi, ping: mocks.ping });
  });

  it('uses Redis atomic INCR/EXPIRE/TTL across replicas', async () => {
    const { checkSharedRateLimit } = await import('../lib/rate-limiter');
    await expect(checkSharedRateLimit('api:ip:path', { limit: 5, windowMs: 60_000 })).resolves.toEqual({ allowed: true, remaining: 2, resetInMs: 57_000 });
    expect(mocks.multi.incr).toHaveBeenCalledWith('api:ip:path');
    expect(mocks.multi.expire).toHaveBeenCalledWith('api:ip:path', 60, 'NX');
    expect(mocks.multi.ttl).toHaveBeenCalledWith('api:ip:path');
    expect(mocks.multi.exec).toHaveBeenCalledOnce();
  });

  it('fails closed in production when the Redis backend is unavailable', async () => {
    mocks.getRedis.mockReturnValue(null);
    const { checkSharedRateLimit } = await import('../lib/rate-limiter');
    await expect(checkSharedRateLimit('api:ip:path', { limit: 5, windowMs: 60_000 })).rejects.toThrow('REDIS_URL is required');
  });
});

describe('health endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mocks.ping.mockResolvedValue('PONG');
    mocks.connect.mockResolvedValue(undefined);
    mocks.getRedis.mockReturnValue({ status: 'ready', connect: mocks.connect, ping: mocks.ping });
  });

  it('keeps liveness independent of database and Redis', async () => {
    const { GET } = await import('../app/api/v1/health/live/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(mocks.ping).not.toHaveBeenCalled();
  });

  it('returns unavailable from readiness when a dependency fails', async () => {
    mocks.ping.mockRejectedValue(new Error('redis down'));
    const { GET } = await import('../app/api/v1/health/ready/route');
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: 'unavailable', checks: { database: 'up', redis: 'down' } });
  });
});
