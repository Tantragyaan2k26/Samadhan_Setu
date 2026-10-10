import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { sendSms } from './notifications/providers';

type OutboxRow = { id: string; eventType: string; payload: string; attempts: number };
type EventContent = { title: string; body: string; ticketNo?: string };
type EventPayload = Record<string, unknown>;

function value(payload: EventPayload, key: string, fallback = '') {
  const item = payload[key];
  return item === null || item === undefined ? fallback : String(item);
}

export function notificationContent(eventType: string, payload: EventPayload): EventContent {
  const ticketNo = value(payload, 'ticketNo');
  const level = value(payload, 'level', value(payload, 'escalationLevel'));
  switch (eventType) {
    case 'COMPLAINT_SUBMITTED':
      return { title: 'शिकायत दर्ज हुई', body: `आपकी शिकायत ${ticketNo} दर्ज हो गई है। समाधान की स्थिति SMS से साझा की जाएगी।`, ticketNo };
    case 'COMPLAINT_REMINDER':
      return { title: 'शिकायत अनुस्मारक', body: `शिकायत ${ticketNo} के लिए आपका अनुस्मारक दर्ज हुआ। वर्तमान स्तर ${level || '1'} है।`, ticketNo };
    case 'COMPLAINT_ESCALATED':
      return { title: 'शिकायत उच्च स्तर पर भेजी गई', body: `शिकायत ${ticketNo} को स्तर ${level || '2'} पर भेजा गया है।`, ticketNo };
    case 'COMPLAINT_RESOLVED_PENDING':
      return { title: 'समाधान प्रस्ताव प्राप्त हुआ', body: `शिकायत ${ticketNo} पर ${value(payload, 'officerName', 'अधिकारी')} ने समाधान प्रस्ताव दिया है। कृपया स्थिति की पुष्टि करें।`, ticketNo };
    case 'COMPLAINT_REOPENED':
      return { title: 'शिकायत फिर से खोली गई', body: `आपकी शिकायत ${ticketNo} समीक्षा के लिए फिर से खोली गई है।`, ticketNo };
    case 'COMPLAINT_CLOSED':
      return { title: 'शिकायत बंद हुई', body: `आपकी शिकायत ${ticketNo} बंद कर दी गई है। प्रतिक्रिया देने के लिए धन्यवाद।`, ticketNo };
    case 'BRIDGE_APPLICATION_REFERRED':
      return { title: 'आवेदन पर शिकायत दर्ज हुई', body: `आवेदन ${value(payload, 'applicationNo')} के विलंब पर शिकायत ${ticketNo} दर्ज हुई है।`, ticketNo };
    default:
      throw new Error(`Unsupported outbox event type: ${eventType}`);
  }
}

export function outboxBackoffMs(attempt: number) {
  return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 24 * 60 * 60 * 1000);
}

async function processEvent(tx: Prisma.TransactionClient, event: OutboxRow, now: Date) {
  let payload: EventPayload;
  let content: EventContent;
  let recipient: string;
  try {
    payload = JSON.parse(event.payload) as EventPayload;
    content = notificationContent(event.eventType, payload);
    recipient = value(payload, 'phone');
    if (!recipient) throw new Error('Outbox event has no recipient phone number');
  } catch (error) {
    return markFailed(tx, event, now, error);
  }

  const previous = await tx.notification.findUnique({ where: { id: event.id } });
  if (previous && ['SENT', 'DELIVERED'].includes(previous.status)) {
    await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'SENT', processedAt: previous.createdAt, lastError: null } });
    return 'sent' as const;
  }

  const localDelivery = process.env.NODE_ENV === 'development' && process.env.OTP_LOCAL_DELIVERY === 'true';
  try {
    if (!localDelivery) await sendSms(recipient, content.body);
  } catch (error) {
    await tx.notification.upsert({
      where: { id: event.id },
      create: { id: event.id, recipient, channel: 'SMS', templateKey: event.eventType, title: content.title, body: content.body, status: 'FAILED', ticketNo: content.ticketNo },
      update: { recipient, channel: 'SMS', templateKey: event.eventType, title: content.title, body: content.body, status: 'FAILED', ticketNo: content.ticketNo }
    });
    return markFailed(tx, event, now, error);
  }

  await tx.notification.upsert({
    where: { id: event.id },
    create: { id: event.id, recipient, channel: 'SMS', templateKey: event.eventType, title: content.title, body: content.body, status: localDelivery ? 'DELIVERED' : 'SENT', ticketNo: content.ticketNo },
    update: { recipient, channel: 'SMS', templateKey: event.eventType, title: content.title, body: content.body, status: localDelivery ? 'DELIVERED' : 'SENT', ticketNo: content.ticketNo }
  });
  await tx.outboxEvent.update({ where: { id: event.id }, data: { status: 'SENT', processedAt: now, lastError: null } });
  return 'sent' as const;
}

async function markFailed(tx: Prisma.TransactionClient, event: OutboxRow, now: Date, error: unknown) {
  const attempts = event.attempts + 1;
  const message = (error instanceof Error ? error.message : 'Notification delivery failed').slice(0, 1000);
  await tx.outboxEvent.update({
    where: { id: event.id },
    data: {
      attempts,
      status: attempts >= 5 ? 'FAILED' : 'PENDING',
      lastError: message,
      availableAt: new Date(now.getTime() + outboxBackoffMs(attempts))
    }
  });
  return attempts >= 5 ? 'failed' as const : 'retried' as const;
}

export async function processOutbox(limit = 50) {
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const now = new Date();
  return prisma.$transaction(async tx => {
    const events = await tx.$queryRaw<OutboxRow[]>`
      SELECT "id", "eventType", "payload", "attempts"
      FROM "OutboxEvent"
      WHERE "status" = 'PENDING' AND "availableAt" <= ${now}
      ORDER BY "availableAt" ASC, "createdAt" ASC
      LIMIT ${boundedLimit}
      FOR UPDATE SKIP LOCKED
    `;
    const result = { processed: events.length, sent: 0, retried: 0, failed: 0 };
    for (const event of events) {
      const status = await processEvent(tx, event, now);
      result[status]++;
    }
    return result;
  }, { timeout: 60_000 });
}
