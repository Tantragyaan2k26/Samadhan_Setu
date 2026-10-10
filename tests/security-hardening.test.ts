import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), auditCreate: vi.fn(), compare: vi.fn(), hash: vi.fn()
}));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique }, auditLog: { create: mocks.auditCreate } } }));
vi.mock('bcryptjs', () => ({ compare: mocks.compare, hash: mocks.hash }));
vi.mock('@/lib/redis', () => ({ getRedis: () => null }));

describe('security hardening helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.set(process.env, 'NODE_ENV', 'test');
    delete process.env.REDIS_URL;
    mocks.findUnique.mockResolvedValue(null);
    mocks.auditCreate.mockResolvedValue({});
    mocks.hash.mockResolvedValue('$2a$12$dummyhash');
    mocks.compare.mockResolvedValue(false);
  });
  afterEach(() => vi.resetModules());

  it('uses a bcrypt dummy hash for nonexistent staff users and returns the generic error', async () => {
    const { staffLogin } = await import('@/lib/auth');
    await expect(staffLogin('missing@example.test', 'wrong-password', '192.0.2.5')).resolves.toEqual({ success: false, message: 'Invalid email or password' });
    expect(mocks.compare).toHaveBeenCalledWith('wrong-password', expect.stringMatching(/^\$2b\$12\$/));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'STAFF_LOGIN_FAILURE', ipAddress: '192.0.2.5' }) }));
  });

  it('locks an email after five attempts and shares the limit across concurrent calls', async () => {
    const { staffLogin } = await import('@/lib/auth');
    const results = await Promise.all(Array.from({ length: 8 }, () => staffLogin('locked@example.test', 'wrong', '192.0.2.8')));
    expect(results.every(result => result.success === false && result.message === 'Invalid email or password')).toBe(true);
    expect(mocks.compare).toHaveBeenCalledTimes(8);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(8);
  });

  it('does not let a correct password bypass a lockout after five failures', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'officer-1', email: 'locked-valid@example.test', role: 'OFFICER', isActive: true, passwordHash: 'stored-hash', officer: null });
    const { staffLogin } = await import('@/lib/auth');
    for (let i = 0; i < 5; i++) await staffLogin('locked-valid@example.test', 'wrong', '192.0.2.9');
    mocks.compare.mockResolvedValue(true);
    const result = await staffLogin('locked-valid@example.test', 'correct', '192.0.2.9');
    expect(result).toEqual({ success: false, message: 'Invalid email or password' });
    expect(mocks.compare).toHaveBeenLastCalledWith('correct', 'stored-hash');
  });

  it('limits attempts by IP across different email addresses', async () => {
    mocks.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) => ({ id: where.email, email: where.email, role: 'OFFICER', isActive: true, passwordHash: 'stored-hash', officer: null }));
    mocks.compare.mockResolvedValue(true);
    const { staffLogin } = await import('@/lib/auth');
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => staffLogin(`person${i}@example.test`, 'correct', '192.0.2.10')));
    expect(mocks.compare).toHaveBeenCalledTimes(12);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(12);
    expect(results.filter(result => result.success)).toHaveLength(10);
    expect(results.filter(result => !result.success)).toHaveLength(2);
  });

  it('masks PII only for oversight roles, including nested citizen and timeline data', async () => {
    const { maskForRole } = await import('@/lib/pii');
    const complaint = { citizenPhone: '+919876543210', citizenName: 'Aarushi', citizen: { phone: '+919876543210', name: 'Aarushi' }, events: [{ actorType: 'CITIZEN', actorName: 'Aarushi' }] };
    const masked = maskForRole(complaint, { role: 'AUDITOR' } as never);
    expect(masked.citizenPhone).toBe('+9XXXX3210');
    expect(masked.citizenName).toBe('A***');
    expect(masked.citizen?.phone).toBe(masked.citizenPhone);
    expect(masked.events?.[0].actorName).toBe('A***');
    expect(maskForRole(complaint, { role: 'SUPER_ADMIN' } as never)).toBe(complaint);
  });

  it('writes an audit row with structured details and no implicit secrets', async () => {
    const { writeAudit } = await import('@/lib/audit');
    const client = { auditLog: { create: vi.fn().mockResolvedValue({}) } };
    await writeAudit(client as never, { action: 'STAFF_LOGIN_FAILURE', entityType: 'User', ipAddress: 'unknown', details: { attemptedIdentityHash: 'opaque-hash' } });
    expect(client.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'STAFF_LOGIN_FAILURE', ipAddress: 'unknown', details: '{"attemptedIdentityHash":"opaque-hash"}' }) });
  });

  it('fails closed when a required login audit write fails', async () => {
    mocks.auditCreate.mockRejectedValueOnce(new Error('database unavailable'));
    const { staffLogin } = await import('@/lib/auth');
    await expect(staffLogin('missing-audit@example.test', 'wrong', '192.0.2.12')).rejects.toThrow('database unavailable');
  });

  it('sets a per-request CSP nonce and removes broad connect permissions', async () => {
    const { proxy } = await import('../proxy');
    const { NextRequest } = await import('next/server');
    const response = await proxy(new NextRequest('http://localhost/about'));
    const csp = response.headers.get('content-security-policy') || '';
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('https: wss:');
    expect(response.headers.get('x-middleware-request-x-nonce')).toBeTruthy();
  });
});

describe('proxy IP and attachment URL policies', () => {
  it('selects the client IP to the left of the configured trusted proxy hops and rejects malformed chains', async () => {
    Reflect.set(process.env, 'TRUSTED_PROXY_HOPS', '2');
    Reflect.set(process.env, 'TRUST_PROXY', 'false');
    vi.resetModules();
    const { getClientIp } = await import('@/lib/client-ip');
    expect(getClientIp(new Headers({ 'x-forwarded-for': '198.51.100.3, 203.0.113.4, 203.0.113.5' }))).toBe('198.51.100.3');
    expect(getClientIp(new Headers({ 'x-forwarded-for': '198.51.100.3, not-an-ip, 203.0.113.5' }))).toBe('unknown');
  });

  it('only accepts exact configured attachment hosts and HTTPS in production', async () => {
    Reflect.set(process.env, 'ATTACHMENT_CDN_HOST', 'uploads.example.test');
    vi.resetModules();
    const { isAllowedAttachmentUrl } = await import('@/lib/attachment-url');
    expect(isAllowedAttachmentUrl('https://uploads.example.test/a.png', true)).toBe(true);
    expect(isAllowedAttachmentUrl('https://uploads.example.test.attacker.test/a.png', true)).toBe(false);
    expect(isAllowedAttachmentUrl('https://user@uploads.example.test/a.png', true)).toBe(false);
    expect(isAllowedAttachmentUrl('http://uploads.example.test/a.png', true)).toBe(false);
    expect(isAllowedAttachmentUrl('https://uploads.example.test:8443/a.png', true)).toBe(false);
  });
});
