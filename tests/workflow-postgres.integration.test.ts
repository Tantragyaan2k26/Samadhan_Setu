import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const postgresDescribe = testDatabaseUrl ? describe : describe.skip;

postgresDescribe('PostgreSQL workflow concurrency (TEST_DATABASE_URL only)', () => {
  let db: import('@prisma/client').PrismaClient;
  let createComplaint: typeof import('../app/api/v1/complaints/route').POST;
  let escalateComplaint: typeof import('../app/api/v1/complaints/[ticket]/escalate/route').POST;
  let createSession: typeof import('../lib/auth').createSession;
  let userId = '';
  let citizenPhone = '';
  let sessionCookie = '';
  const idempotencyKeys: string[] = [];
  const ticketNumbers: string[] = [];

  beforeAll(async () => {
    const parsedUrl = new URL(testDatabaseUrl!);
    if (!/(^|[_-])test([_-]|$)/i.test(parsedUrl.pathname)) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name clearly includes "test".');
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.REDIS_URL = '';
    Reflect.set(process.env, 'NODE_ENV', 'test');
    process.env.AUTH_SESSION_SECRET ||= 'test-only-session-secret-that-is-long-enough';
    process.env.OTP_LOCAL_DELIVERY = 'true';
    process.env.GEMINI_API_KEY = '';
    for (const name of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID', 'TWILIO_PHONE_NUMBER', 'TWILIO_MESSAGING_SERVICE_SID', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']) process.env[name] = '';
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient({ datasourceUrl: testDatabaseUrl });
    await db.$queryRaw`SELECT 1`;
    // Confirms that the additive ticket sequence migration is installed before endpoint tests.
    await db.$queryRaw`SELECT last_value FROM "Complaint_ticket_no_seq"`;
    const phone = String(Math.floor(1000000000 + Math.random() * 8999999999));
    citizenPhone = `+91${phone}`;
    const user = await db.user.create({ data: { phone: citizenPhone, role: 'CITIZEN', phoneVerifiedAt: new Date() } });
    userId = user.id;
    const auth = await import('../lib/auth');
    createSession = auth.createSession;
    const response = (await import('next/server')).NextResponse.next();
    await createSession(response, { userId, phone: citizenPhone, role: 'CITIZEN' });
    sessionCookie = response.cookies.get('samadhan_session')!.value;
    createComplaint = (await import('../app/api/v1/complaints/route')).POST;
    escalateComplaint = (await import('../app/api/v1/complaints/[ticket]/escalate/route')).POST;
  }, 30000);

  afterAll(async () => {
    if (!db) return;
    if (userId) {
      const created = await db.complaint.findMany({ where: { citizenId: userId }, select: { ticketNo: true } });
      ticketNumbers.push(...created.map(item => item.ticketNo));
      for (const ticketNo of new Set(ticketNumbers)) {
        await db.outboxEvent.deleteMany({ where: { payload: { contains: ticketNo } } });
      }
      await db.complaint.deleteMany({ where: { citizenId: userId } });
      await db.otpChallenge.deleteMany({ where: { destination: citizenPhone } });
      await db.user.delete({ where: { id: userId } });
    }
    if (idempotencyKeys.length) await db.idempotencyRecord.deleteMany({ where: { key: { in: idempotencyKeys } } });
    await db.$disconnect();
  }, 30000);

  function request(key: string, description = 'A broken water pipe needs urgent repair') {
    return new NextRequest('http://localhost/api/v1/complaints', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key, cookie: `samadhan_session=${sessionCookie}` },
      body: JSON.stringify({ description, citizenPhone, language: 'en' })
    });
  }

  async function makeEscalationCase(status: string, escalationLevel: number, slaDueAt: Date) {
    const ticketNo = `UK-${new Date().getFullYear()}-CASE-${randomUUID()}`;
    const complaint = await db.complaint.create({ data: {
      ticketNo, citizenId: userId, citizenPhone, title: 'Workflow escalation test',
      description: 'Test complaint for escalation concurrency checks', status, escalationLevel, urgency: 'NORMAL',
      slaDueAt
    } });
    ticketNumbers.push(complaint.ticketNo);
    return complaint;
  }

  function escalationRequest() {
    return new NextRequest('http://localhost/api/v1/complaints/test/escalate', {
      method: 'POST', headers: { cookie: `samadhan_session=${sessionCookie}` }
    });
  }

  it('replays sequential identical requests and conflicts on different payloads', async () => {
    const key = `workflow-test-${randomUUID()}`;
    idempotencyKeys.push(key);
    const first = await createComplaint(request(key));
    const firstBody = await first.json();
    const retry = await createComplaint(request(key));
    expect(first.status).toBe(201);
    expect(firstBody.ticketNo).toMatch(/^UK-\d{4}-\d{6,}$/);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(firstBody);
    ticketNumbers.push(firstBody.ticketNo);
    const changed = await createComplaint(request(key, 'A different complaint payload for conflict'));
    expect(changed.status).toBe(409);
    expect(await db.complaint.count({ where: { citizenId: userId } })).toBe(1);
  });

  it('runs OTP request and verification handlers for invalid, valid, and expired codes', async () => {
    const { POST: requestOtp } = await import('../app/api/v1/auth/otp/request/route');
    const { POST: verifyOtp } = await import('../app/api/v1/auth/otp/verify/route');
    const request = () => new NextRequest('http://localhost/api/v1/auth/otp/request', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: citizenPhone })
    });
    const delivered = await requestOtp(request());
    expect(delivered.status).toBe(200);
    const deliveredBody = await delivered.json();
    expect(deliveredBody.developmentCode).toMatch(/^\d{6}$/);
    const verify = (code: string) => new NextRequest('http://localhost/api/v1/auth/otp/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: citizenPhone, code })
    });
    expect((await verifyOtp(verify('000000'))).status).toBe(401);
    expect((await verifyOtp(verify(deliveredBody.developmentCode))).status).toBe(200);

    await db.otpChallenge.create({ data: {
      destination: citizenPhone, channel: 'SMS', purpose: 'LOGIN', codeHash: 'expired-test-hash',
      expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() + 1000)
    } });
    const expired = await verifyOtp(verify('123456'));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({ type: 'unauthorized', status: 401 });
  });

  it('creates exactly one complaint for concurrent identical requests and two for different keys', async () => {
    const baseline = await db.complaint.count({ where: { citizenId: userId } });
    const sameKey = `workflow-test-${randomUUID()}`;
    idempotencyKeys.push(sameKey);
    const same = await Promise.all([createComplaint(request(sameKey)), createComplaint(request(sameKey))]);
    expect(same.map(response => response.status).sort()).toEqual([201, 201]);
    const sameBodies = await Promise.all(same.map(response => response.json()));
    expect(sameBodies[0].ticketNo).toBe(sameBodies[1].ticketNo);
    expect(sameBodies[0].ticketNo).toMatch(/^UK-\d{4}-\d{6,}$/);
    ticketNumbers.push(sameBodies[0].ticketNo);
    expect(await db.complaint.count({ where: { citizenId: userId } })).toBe(baseline + 1);

    const keys = [`workflow-test-${randomUUID()}`, `workflow-test-${randomUUID()}`];
    idempotencyKeys.push(...keys);
    const different = await Promise.all(keys.map(key => createComplaint(request(key, 'Another valid description for concurrent submissions'))));
    expect(different.map(response => response.status)).toEqual([201, 201]);
    const differentBodies = await Promise.all(different.map(response => response.json()));
    ticketNumbers.push(...differentBodies.map(body => body.ticketNo));
    expect(new Set(differentBodies.map(body => body.ticketNo)).size).toBe(2);
    expect(await db.complaint.count({ where: { citizenId: userId } })).toBe(baseline + 3);
  });

  it('persists a low-confidence complaint for manual triage and caps client emergency urgency', async () => {
    const key = `workflow-test-${randomUUID()}`;
    idempotencyKeys.push(key);
    const response = await createComplaint(new NextRequest('http://localhost/api/v1/complaints', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key, cookie: `samadhan_session=${sessionCookie}` },
      body: JSON.stringify({ description: 'A request about an uncommon community issue', citizenPhone, language: 'en', urgency: 'EMERGENCY' })
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    const saved = await db.complaint.findUniqueOrThrow({ where: { ticketNo: body.ticketNo } });
    ticketNumbers.push(body.ticketNo);
    expect(saved.urgency).toBe('HIGH');
    expect(saved.aiConfidence).toBeLessThan(0.5);
    expect(saved.aiSummaryEn).toBeTruthy();
    expect(saved.aiSummaryHi).toBeTruthy();
    expect(saved.status).toBe('SUBMITTED');
    expect(saved.assignedOfficerId).toBeNull();
  });

  it('rolls back an idempotency record when its transaction fails', async () => {
    const key = `workflow-test-${randomUUID()}`;
    idempotencyKeys.push(key);
    await expect(db.$transaction(async tx => {
      await tx.idempotencyRecord.create({ data: { key, requestHash: 'rollback', response: '{}', expiresAt: new Date(Date.now() + 60000) } });
      throw new Error('force test rollback');
    })).rejects.toThrow('force test rollback');
    expect(await db.idempotencyRecord.findUnique({ where: { key } })).toBeNull();
  });

  it('allows the REOPENED exception, refreshes SLA, enforces the level cap, and applies concurrent escalation once', async () => {
    const reopened = await makeEscalationCase('REOPENED', 1, new Date(Date.now() + 3600000));
    const reopenedResponse = await escalateComplaint(escalationRequest(), { params: Promise.resolve({ ticket: reopened.ticketNo }) });
    expect(reopenedResponse.status).toBe(200);
    const reopenedAfter = await db.complaint.findUniqueOrThrow({ where: { id: reopened.id } });
    expect(reopenedAfter.escalationLevel).toBe(2);
    expect(reopenedAfter.slaDueAt!.getTime()).toBeGreaterThan(Date.now());

    const capped = await makeEscalationCase('ASSIGNED', 4, new Date(Date.now() - 1000));
    const cappedResponse = await escalateComplaint(escalationRequest(), { params: Promise.resolve({ ticket: capped.ticketNo }) });
    expect(cappedResponse.status).toBe(409);

    const concurrent = await makeEscalationCase('ASSIGNED', 1, new Date(Date.now() - 1000));
    const responses = await Promise.all([
      escalateComplaint(escalationRequest(), { params: Promise.resolve({ ticket: concurrent.ticketNo }) }),
      escalateComplaint(escalationRequest(), { params: Promise.resolve({ ticket: concurrent.ticketNo }) })
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const final = await db.complaint.findUniqueOrThrow({ where: { id: concurrent.id } });
    expect(final.escalationLevel).toBe(2);
    expect(final.slaDueAt!.getTime()).toBeGreaterThan(Date.now());
  });
});
