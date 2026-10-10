import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  sendSms: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    outboxEvent: { update: vi.fn() },
    notification: { findUnique: vi.fn(), upsert: vi.fn() }
  }
}));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('../lib/notifications/providers', () => ({ sendSms: mocks.sendSms }));
import { notificationContent, outboxBackoffMs, processOutbox } from '../lib/outbox-worker';

describe('outbox worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.set(process.env, 'NODE_ENV', 'development');
    process.env.OTP_LOCAL_DELIVERY = 'true';
    mocks.transaction.mockImplementation(async callback => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValue([{
      id: 'event-1', eventType: 'COMPLAINT_SUBMITTED',
      payload: JSON.stringify({ ticketNo: 'UK-2026-000123', phone: '+919876543210' }), attempts: 0
    }]);
    mocks.tx.notification.findUnique.mockResolvedValue(null);
    mocks.tx.notification.upsert.mockResolvedValue({});
    mocks.tx.outboxEvent.update.mockResolvedValue({});
    mocks.sendSms.mockResolvedValue({ provider: 'twilio', reference: 'sid' });
  });

  it('uses Hindi templates for every supported event type', () => {
    const payload = { ticketNo: 'UK-2026-000123', phone: '+919876543210', level: 2, applicationNo: 'APP-1' };
    for (const type of ['COMPLAINT_SUBMITTED', 'COMPLAINT_REMINDER', 'COMPLAINT_ESCALATED', 'COMPLAINT_RESOLVED_PENDING', 'COMPLAINT_REOPENED', 'COMPLAINT_CLOSED', 'BRIDGE_APPLICATION_REFERRED']) {
      expect(notificationContent(type, payload).body).toMatch(/[\u0900-\u097F]/);
    }
  });

  it('writes local Notification instead of calling Twilio and marks the event sent', async () => {
    await expect(processOutbox()).resolves.toEqual({ processed: 1, sent: 1, retried: 0, failed: 0 });
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.tx.notification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'event-1' }, create: expect.objectContaining({ id: 'event-1', status: 'DELIVERED' })
    }));
    expect(mocks.tx.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }));
  });

  it('uses the Twilio provider outside local delivery and retries failed attempts with backoff', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'production');
    process.env.OTP_LOCAL_DELIVERY = 'false';
    mocks.sendSms.mockRejectedValue(new Error('Twilio unavailable'));
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'event-1', eventType: 'COMPLAINT_SUBMITTED', payload: JSON.stringify({ ticketNo: 'UK-1', phone: '+919876543210' }), attempts: 1 }]);
    await expect(processOutbox()).resolves.toMatchObject({ retried: 1, failed: 0 });
    expect(mocks.sendSms).toHaveBeenCalledWith('+919876543210', expect.stringContaining('UK-1'));
    const failedUpdate = mocks.tx.outboxEvent.update.mock.calls[0][0];
    expect(failedUpdate.data).toMatchObject({ attempts: 2, status: 'PENDING', lastError: 'Twilio unavailable' });
    expect(failedUpdate.data.availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('marks the fifth failed attempt permanently failed', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'production');
    process.env.OTP_LOCAL_DELIVERY = 'false';
    mocks.sendSms.mockRejectedValue(new Error('delivery failure'));
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'event-1', eventType: 'COMPLAINT_SUBMITTED', payload: JSON.stringify({ ticketNo: 'UK-1', phone: '+919876543210' }), attempts: 4 }]);
    await expect(processOutbox()).resolves.toMatchObject({ failed: 1, retried: 0 });
    expect(mocks.tx.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attempts: 5, status: 'FAILED' }) }));
  });

  it('uses bounded exponential retry delays', () => {
    expect(outboxBackoffMs(1)).toBe(60_000);
    expect(outboxBackoffMs(2)).toBe(120_000);
    expect(outboxBackoffMs(5)).toBe(960_000);
  });

  it('does not resend an event whose deterministic notification record is already sent', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'production');
    process.env.OTP_LOCAL_DELIVERY = 'false';
    mocks.tx.notification.findUnique.mockResolvedValue({ id: 'event-1', status: 'SENT', createdAt: new Date() });
    await processOutbox();
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.tx.notification.upsert).not.toHaveBeenCalled();
  });
});
