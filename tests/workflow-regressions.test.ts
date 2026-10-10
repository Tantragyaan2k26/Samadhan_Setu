import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assignOfficerForLevel, escalationAllowed } from '../lib/escalation';
import { decodeStoredResponse, encodeStoredResponse, isIdempotencyKeyConflict } from '../lib/idempotency';
import { nextTicketNo } from '../lib/ticket-number';
import { calculateSlaDeadlines } from '../lib/sla-engine';
import { validateAndTransition } from '../lib/complaint-state-machine';
import { developmentSeedOfficers } from '../lib/seed-officers';
import { store } from '../prisma/seed-data';

const mocks = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  prisma: { $transaction: vi.fn() },
  tx: {
    complaint: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    officerProfile: { findUnique: vi.fn(), findMany: vi.fn() },
    complaintEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() }
  },
  getAuthSession: vi.fn()
}));
vi.mock('@/lib/auth', () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
import { POST as assignComplaint } from '../app/api/v1/officer/complaints/[id]/assign/route';

describe('escalation assignment helper', () => {
  const complaint = { id: 'c-1', departmentId: 'dept-a', districtId: 'district-a', status: 'ESCALATED', escalationLevel: 3 };
  const officer = (id: string, districtId: string | null, level = 3) => ({
    id, districtId, level, isActive: true, designation: `Officer ${id}`,
    user: { name: `Name ${id}`, role: 'OFFICER', isActive: true }
  });

  it('prefers the same district and records the selected level in the same transaction', async () => {
    const tx = { officerProfile: { findMany: vi.fn().mockResolvedValue([officer('other-district', 'district-b', 3), officer('local', 'district-a', 4)]) }, complaint: { update: vi.fn() }, complaintEvent: { create: vi.fn() }, auditLog: { create: vi.fn() } };
    const result = await assignOfficerForLevel(tx as never, complaint as never, 3);
    expect(result.officer?.id).toBe('local');
    expect(tx.complaint.update).toHaveBeenCalledWith({ where: { id: 'c-1' }, data: { assignedOfficerId: 'local', assignedOfficerName: 'Name local' } });
    expect(tx.complaintEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: expect.stringContaining('level 3') }) }));
  });

  it('falls back across districts and clears stale assignment when none qualify', async () => {
    const fallbackTx = { officerProfile: { findMany: vi.fn().mockResolvedValue([officer('fallback', 'district-b')]) }, complaint: { update: vi.fn() }, complaintEvent: { create: vi.fn() }, auditLog: { create: vi.fn() } };
    expect((await assignOfficerForLevel(fallbackTx as never, complaint as never, 3)).officer?.id).toBe('fallback');
    const emptyTx = { officerProfile: { findMany: vi.fn().mockResolvedValue([]) }, complaint: { update: vi.fn() }, complaintEvent: { create: vi.fn() }, auditLog: { create: vi.fn() } };
    await assignOfficerForLevel(emptyTx as never, complaint as never, 3);
    expect(emptyTx.complaint.update).toHaveBeenCalledWith({ where: { id: 'c-1' }, data: { assignedOfficerId: null, assignedOfficerName: null } });
    expect(emptyTx.complaintEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: expect.stringContaining('no eligible active officer') }) }));
  });
});

describe('escalation and ticket utilities', () => {
  const now = new Date('2026-10-09T00:00:00Z');
  it('allows overdue deadlines, rejects future/missing/invalid deadlines, and permits REOPENED cases', () => {
    expect(escalationAllowed({ status: 'ASSIGNED', slaDueAt: new Date(now.getTime() - 1) }, now).allowed).toBe(true);
    expect(escalationAllowed({ status: 'ASSIGNED', slaDueAt: new Date(now.getTime() + 1) }, now)).toEqual({ allowed: false, reason: 'deadline_pending' });
    expect(escalationAllowed({ status: 'ASSIGNED', slaDueAt: null }, now)).toEqual({ allowed: false, reason: 'deadline_missing' });
    expect(escalationAllowed({ status: 'ASSIGNED', slaDueAt: new Date(NaN) }, now).allowed).toBe(false);
    expect(escalationAllowed({ status: 'REOPENED', slaDueAt: null }, now).allowed).toBe(true);
  });

  it('formats a sequence value with a current year prefix and minimum six-digit padding', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ value: BigInt(123) }]) };
    await expect(nextTicketNo(tx as never, 2027)).resolves.toBe('UK-2027-000123');
  });

  it('recalculates a shorter resolution deadline at the higher escalation level', () => {
    const base = new Date('2026-10-09T00:00:00Z');
    const initial = calculateSlaDeadlines('cat-water-leak', 'NORMAL', 1, base);
    const escalated = calculateSlaDeadlines('cat-water-leak', 'NORMAL', 2, base);
    expect(escalated.resolutionDueAt.getTime()).toBeLessThan(initial.resolutionDueAt.getTime());
    expect(escalated.resolutionDueAt.getTime()).toBeGreaterThan(base.getTime());
  });

  it('stores response status/body and distinguishes idempotency conflicts from other unique conflicts', () => {
    const stored = encodeStoredResponse(201, { success: true, ticketNo: 'UK-2026-000123' });
    expect(decodeStoredResponse(stored)).toEqual({ status: 201, body: { success: true, ticketNo: 'UK-2026-000123' } });
    expect(decodeStoredResponse('{"success":true}')).toEqual({ status: 200, body: { success: true } });
    expect(isIdempotencyKeyConflict({ code: 'P2002', meta: { target: ['key'] } })).toBe(true);
    expect(isIdempotencyKeyConflict({ code: 'P2002', meta: { target: ['ticketNo'] } })).toBe(false);
  });

  it('permits workflow-consistent direct assignment transitions', () => {
    for (const status of ['SUBMITTED', 'TRIAGED'] as const) {
      expect(validateAndTransition(status, 'ASSIGNED', { type: 'SYSTEM' }).allowed).toBe(true);
    }
  });

  it('seeds level 3 and 4 officers as active officer-role seed profiles', () => {
    const officers = developmentSeedOfficers(store.officers);
    expect(officers.find(item => item.level === 3)?.role).toBe('OFFICER');
    expect(officers.find(item => item.id === 'off-4')?.role).toBe('OFFICER');
    expect([1, 2, 3, 4].every(level => officers.some(item => item.departmentId === 'dept-jal' && item.level >= level && item.role === 'OFFICER'))).toBe(true);
  });
});

describe('manual complaint assignment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { userId: 'admin-1', role: 'SUPER_ADMIN', name: 'Admin' };
    mocks.getAuthSession.mockImplementation(async () => mocks.session);
    mocks.prisma.$transaction.mockImplementation(async callback => callback(mocks.tx));
    mocks.tx.complaint.findUnique.mockResolvedValue({ id: 'c-1', status: 'SUBMITTED', departmentId: 'dept-a', districtId: 'district-a', escalationLevel: 1 });
    mocks.tx.complaint.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.complaint.findUniqueOrThrow.mockResolvedValue({ id: 'c-1', status: 'ASSIGNED', assignedOfficerId: 'officer-1' });
    mocks.tx.officerProfile.findUnique.mockResolvedValue({ id: 'officer-1', departmentId: 'dept-a', districtId: 'district-a', level: 1, isActive: true, designation: 'Engineer', user: { name: 'Engineer One', role: 'OFFICER', isActive: true } });
  });

  const request = () => new NextRequest('http://localhost/api/v1/officer/complaints/c-1/assign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ officerId: 'officer-1' }) });

  it('rejects roles without assignment authority before opening a transaction', async () => {
    mocks.session = { userId: 'viewer-1', role: 'CMO_VIEWER' };
    const response = await assignComplaint(request(), { params: Promise.resolve({ id: 'c-1' }) });
    expect(response.status).toBe(403);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('assigns in-scope officer and records the status event transactionally', async () => {
    const response = await assignComplaint(request(), { params: Promise.resolve({ id: 'c-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.tx.complaint.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ASSIGNED', assignedOfficerId: 'officer-1', assignedOfficerName: 'Engineer One' } }));
    expect(mocks.tx.complaintEvent.create).toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'COMPLAINT_ASSIGNED', actorId: 'admin-1' }) }));
  });

  it('rejects cross-department and below-level officers without writes', async () => {
    mocks.tx.officerProfile.findUnique.mockResolvedValueOnce({ id: 'officer-1', departmentId: 'dept-b', districtId: 'district-a', level: 4, isActive: true, designation: 'Engineer', user: { name: 'Engineer One', role: 'OFFICER', isActive: true } });
    expect((await assignComplaint(request(), { params: Promise.resolve({ id: 'c-1' }) })).status).toBe(400);
    expect(mocks.tx.complaint.updateMany).not.toHaveBeenCalled();
    mocks.tx.complaint.findUnique.mockResolvedValueOnce({ id: 'c-1', status: 'ESCALATED', departmentId: 'dept-a', districtId: 'district-a', escalationLevel: 3 });
    mocks.tx.officerProfile.findUnique.mockResolvedValueOnce({ id: 'officer-1', departmentId: 'dept-a', districtId: 'district-a', level: 2, isActive: true, designation: 'Engineer', user: { name: 'Engineer One', role: 'OFFICER', isActive: true } });
    expect((await assignComplaint(request(), { params: Promise.resolve({ id: 'c-1' }) })).status).toBe(400);
    expect(mocks.tx.complaint.updateMany).not.toHaveBeenCalled();
  });
});
