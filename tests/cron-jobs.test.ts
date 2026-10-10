import { describe, expect, it, vi } from 'vitest';
import { isValidCronAuthorization } from '../lib/cron-auth';
import { cleanupExpiredRecords } from '../lib/cron-cleanup';

describe('cron authorization', () => {
  const token = 'cron-test-token-that-is-longer-than-thirty-two';

  it('uses equal-length timing-safe bearer token validation and rejects short tokens', () => {
    expect(isValidCronAuthorization(`Bearer ${token}`, token)).toBe(true);
    expect(isValidCronAuthorization(`Bearer ${token.slice(0, -1)}`, token)).toBe(false);
    expect(isValidCronAuthorization('Bearer too-short', token)).toBe(false);
    expect(isValidCronAuthorization(token, token)).toBe(false);
    expect(isValidCronAuthorization(`Bearer ${token}`, 'short')).toBe(false);
    expect(isValidCronAuthorization(null, token)).toBe(false);
  });
});

describe('expired record cleanup', () => {
  it('deletes only expired rows by each model’s schema expiry field', async () => {
    const tx = {
      otpChallenge: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      authSession: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      idempotencyRecord: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) }
    };
    const now = new Date('2026-10-09T00:00:00Z');
    await expect(cleanupExpiredRecords(tx as never, now)).resolves.toEqual({ otpChallenges: 2, sessions: 3, idempotencyRecords: 4 });
    expect(tx.otpChallenge.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
    expect(tx.idempotencyRecord.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
  });
});
