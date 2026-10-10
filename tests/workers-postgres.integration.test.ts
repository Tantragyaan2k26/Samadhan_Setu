import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const postgresDescribe = testDatabaseUrl ? describe : describe.skip;

postgresDescribe('PostgreSQL worker locking (TEST_DATABASE_URL only)', () => {
  let db: import('@prisma/client').PrismaClient;
  let processOutbox: typeof import('../lib/outbox-worker').processOutbox;
  let escalateBreachedComplaints: typeof import('../lib/sla-escalator').escalateBreachedComplaints;

  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!/(^|[_-])test([_-]|$)/i.test(url.pathname)) throw new Error('TEST_DATABASE_URL must point to a database whose name clearly includes "test".');
    process.env.DATABASE_URL = testDatabaseUrl!;
    Reflect.set(process.env, 'NODE_ENV', 'development');
    process.env.OTP_LOCAL_DELIVERY = 'true';
    process.env.REDIS_URL = '';
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient({ datasourceUrl: testDatabaseUrl });
    await db.$queryRaw`SELECT 1`;
    processOutbox = (await import('../lib/outbox-worker')).processOutbox;
    escalateBreachedComplaints = (await import('../lib/sla-escalator')).escalateBreachedComplaints;
  }, 30000);

  afterAll(async () => { if (db) await db.$disconnect(); });

  it('two concurrent outbox workers produce one notification for a locked event', async () => {
    const id = randomUUID();
    const oldDate = new Date('2000-01-01T00:00:00Z');
    await db.outboxEvent.create({
      data: { id, eventType: 'COMPLAINT_SUBMITTED', payload: JSON.stringify({ ticketNo: 'WORKER-TEST', phone: '+919876543210' }), availableAt: oldDate, createdAt: oldDate }
    });
    try {
      await Promise.all([processOutbox(1), processOutbox(1)]);
      expect(await db.outboxEvent.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'SENT' });
      expect(await db.notification.count({ where: { id } })).toBe(1);
    } finally {
      await db.notification.deleteMany({ where: { id } });
      await db.outboxEvent.deleteMany({ where: { id } });
    }
  }, 30000);

  it('two concurrent SLA schedulers escalate a breached complaint once and reset its deadline', async () => {
    const id = randomUUID();
    const ticketNo = `WORKER-${id}`;
    const oldDate = new Date('2000-01-01T00:00:00Z');
    const complaint = await db.complaint.create({
      data: {
        ticketNo, citizenPhone: '+919876543210', title: 'SLA worker test', description: 'A test complaint used only for a scheduler integration test.',
        status: 'ASSIGNED', escalationLevel: 1, urgency: 'NORMAL', slaDueAt: oldDate, createdAt: oldDate
      }
    });
    try {
      await Promise.all([escalateBreachedComplaints(1), escalateBreachedComplaints(1)]);
      const saved = await db.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
      expect(saved.status).toBe('ESCALATED');
      expect(saved.escalationLevel).toBe(2);
      expect(saved.slaDueAt!.getTime()).toBeGreaterThan(Date.now());
      expect(await db.complaintEvent.count({ where: { complaintId: complaint.id, toStatus: 'ESCALATED' } })).toBe(1);
      expect(await db.outboxEvent.count({ where: { payload: { contains: ticketNo }, eventType: 'COMPLAINT_ESCALATED' } })).toBe(1);
    } finally {
      await db.outboxEvent.deleteMany({ where: { payload: { contains: ticketNo } } });
      await db.complaint.delete({ where: { id: complaint.id } });
    }
  }, 30000);
});
