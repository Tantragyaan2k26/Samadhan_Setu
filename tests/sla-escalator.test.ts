import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    complaint: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    officerProfile: { findMany: vi.fn() },
    complaintEvent: { create: vi.fn() },
    outboxEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() }
  }
}));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
import { escalateBreachedComplaints } from '../lib/sla-escalator';

describe('SLA escalator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async callback => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'complaint-1' }]);
    mocks.tx.complaint.findUnique.mockResolvedValue({
      id: 'complaint-1', ticketNo: 'UK-2026-000123', citizenPhone: '+919876543210',
      status: 'IN_PROGRESS', escalationLevel: 1, slaDueAt: new Date(Date.now() - 3600000),
      categoryId: 'cat-water-leak', urgency: 'NORMAL', departmentId: 'dept-jal', districtId: 'dist-ddn'
    });
    mocks.tx.complaint.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.complaint.update.mockResolvedValue({});
    mocks.tx.officerProfile.findMany.mockResolvedValue([]);
    mocks.tx.complaintEvent.create.mockResolvedValue({});
    mocks.tx.outboxEvent.create.mockResolvedValue({});
  });

  it('escalates one breached complaint, resets its deadline, assigns, and writes event/outbox atomically', async () => {
    await expect(escalateBreachedComplaints()).resolves.toEqual({ checked: 1, escalated: 1 });
    const update = mocks.tx.complaint.updateMany.mock.calls[0][0];
    expect(update.where).toMatchObject({ id: 'complaint-1', status: 'IN_PROGRESS', escalationLevel: 1 });
    expect(update.data).toMatchObject({ status: 'ESCALATED', escalationLevel: 2 });
    expect(update.data.slaDueAt.getTime()).toBeGreaterThan(Date.now());
    expect(mocks.tx.complaintEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorType: 'SYSTEM', toStatus: 'ESCALATED' }) }));
    expect(mocks.tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'COMPLAINT_ESCALATED' }) }));
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'COMPLAINT_SLA_ESCALATED', actorRole: 'SYSTEM' }) }));
    expect(mocks.tx.complaint.update).toHaveBeenCalledWith(expect.objectContaining({ data: { assignedOfficerId: null, assignedOfficerName: null } }));
  });

  it('does not process a complaint with a null SLA deadline or one already at level four', async () => {
    mocks.tx.$queryRaw.mockResolvedValue([]);
    await expect(escalateBreachedComplaints()).resolves.toEqual({ checked: 0, escalated: 0 });
    expect(mocks.tx.complaint.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('uses a conditional update so concurrent schedulers cannot apply the same escalation twice', async () => {
    mocks.tx.complaint.updateMany.mockResolvedValue({ count: 0 });
    await expect(escalateBreachedComplaints()).resolves.toEqual({ checked: 1, escalated: 0 });
    expect(mocks.tx.complaintEvent.create).not.toHaveBeenCalled();
    expect(mocks.tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
