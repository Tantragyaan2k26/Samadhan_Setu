import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../lib/rate-limiter';
import { generateSignedUploadUrl } from '../lib/storage';
import { store } from '../prisma/seed-data';
import { maskForRole } from '../lib/pii';

describe('Comprehensive API & System Integration Tests', () => {
  it('Rate Limiting: should throttle excessive requests on single IP', () => {
    const ip = '192.168.1.100';
    const opts = { limit: 3, windowMs: 10000 };

    expect(checkRateLimit(ip, opts).allowed).toBe(true);
    expect(checkRateLimit(ip, opts).allowed).toBe(true);
    expect(checkRateLimit(ip, opts).allowed).toBe(true);
    // 4th request must be throttled
    expect(checkRateLimit(ip, opts).allowed).toBe(false);
  });

  it('Storage: should generate signed upload URL for valid images and reject oversized files', () => {
    const valid = generateSignedUploadUrl('broken_road.jpg', 'image/jpeg', 200000);
    expect(valid.success).toBe(true);
    expect(valid.result?.uploadUrl).toBeDefined();

    const oversized = generateSignedUploadUrl('huge_video.mp4', 'video/mp4', 10 * 1024 * 1024);
    expect(oversized.success).toBe(false);
    expect(oversized.error).toBeDefined();
  });

  it('RBAC & DPDP: should mask citizen PII for unauthorized public viewers', () => {
    const complaint = store.complaints[0];
    const masked = maskForRole(complaint as unknown as { citizenPhone: string; citizenName: string | null }, { role: 'AUDITOR' });

    expect(masked.citizenPhone).toContain('XXXX');
    expect(masked.citizenPhone).not.toBe(complaint.citizenPhone);
  });
});
