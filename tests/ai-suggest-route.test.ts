import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  session: null as null | { userId: string; role: string },
  rateLimit: vi.fn(),
  districtFind: vi.fn(),
  categoryFind: vi.fn(),
  complaintFind: vi.fn(),
  classify: vi.fn()
}));
vi.mock('@/lib/auth', () => ({ getAuthSession: vi.fn(async () => mocks.session) }));
vi.mock('@/lib/rate-limiter', () => ({ checkSharedRateLimit: mocks.rateLimit }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  district: { findUnique: mocks.districtFind },
  category: { findMany: mocks.categoryFind },
  complaint: { findFirst: mocks.complaintFind }
} }));
vi.mock('@/lib/ai-classifier', () => ({ classifyComplaint: mocks.classify }));
import { POST } from '../app/api/v1/ai/suggest/route';

const request = (body: unknown) => new NextRequest('http://localhost/api/v1/ai/suggest', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
});

describe('AI suggestion route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { userId: 'citizen-1', role: 'CITIZEN' };
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetInMs: 60000 });
    mocks.districtFind.mockResolvedValue({ id: 'district-1' });
    mocks.categoryFind.mockResolvedValue([]);
    mocks.classify.mockResolvedValue({ categoryId: 'category-1', urgency: 'NORMAL', confidence: 0.8 });
    mocks.complaintFind.mockResolvedValue({ ticketNo: 'UK-2026-000123', title: 'Water concern', supportersCount: 2, createdAt: new Date() });
  });

  it('requires a session before querying complaint data', async () => {
    mocks.session = null;
    const response = await POST(request({ text: 'Water supply interruption', districtId: 'district-1' }));
    expect(response.status).toBe(401);
    expect(mocks.complaintFind).not.toHaveBeenCalled();
    expect(mocks.categoryFind).not.toHaveBeenCalled();
  });

  it('rejects authenticated staff roles without querying complaints', async () => {
    mocks.session = { userId: 'officer-1', role: 'OFFICER' };
    const response = await POST(request({ text: 'Water supply interruption', districtId: 'district-1' }));
    expect(response.status).toBe(403);
    expect(mocks.complaintFind).not.toHaveBeenCalled();
  });

  it('validates before complaint queries and applies shared rate limits', async () => {
    const invalid = await POST(request({ text: 'short', districtId: 'district-1' }));
    expect(invalid.status).toBe(400);
    expect(mocks.complaintFind).not.toHaveBeenCalled();
    expect(mocks.rateLimit).toHaveBeenCalledWith('ai-suggest:citizen-1', { limit: 20, windowMs: 60000 });
  });

  it('uses Prisma duplicate criteria for same district/category in the last fourteen days', async () => {
    const response = await POST(request({ text: 'Water supply interruption in my area', districtId: 'district-1' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, duplicateMatch: { ticketNo: 'UK-2026-000123' } });
    expect(mocks.complaintFind).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      districtId: 'district-1', categoryId: 'category-1', status: { not: 'CLOSED' }, createdAt: { gte: expect.any(Date) }
    }) }));
  });
});
