import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { calculateSlaDeadlines } from '@/lib/sla-engine';
import { cache } from '@/lib/cache';
import { nextTicketNo } from '@/lib/ticket-number';
import { decodeStoredResponse, encodeStoredResponse, isIdempotencyKeyConflict } from '@/lib/idempotency';
import { isAllowedAttachmentUrl } from '@/lib/attachment-url';
import { maskForRole } from '@/lib/pii';
import { writeAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';
import { classifyComplaint } from '@/lib/ai-classifier';

const complaintInput = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().min(8).max(10000),
  submissionType: z.enum(['GRIEVANCE', 'DEMAND', 'SUGGESTION']).default('GRIEVANCE'),
  citizenPhone: z.string().trim().min(10).max(20),
  citizenName: z.string().trim().max(120).optional(),
  language: z.enum(['hi', 'en']).default('hi'),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  districtId: z.string().optional(),
  villageOrTehsil: z.string().trim().max(160).optional(),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).default('NORMAL'),
  sourceChannel: z.enum(['WEB', 'VOICE', 'WHATSAPP', 'BRIDGE']).default('WEB'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  attachments: z.array(z.object({
    url: z.string().url(), fileName: z.string().max(200),
    mimeType: z.string().max(100).default('image/jpeg'), fileSize: z.number().int().nonnegative().max(5 * 1024 * 1024).default(0)
  }).refine(item => isAllowedAttachmentUrl(item.url), 'Attachment URL must use the configured secure CDN host')).max(5).default([])
});

function canonicalPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? `+${digits}` : `+91${digits.slice(-10)}`;
}

const publicSelect = {
  events: { orderBy: { createdAt: 'asc' as const } },
  attachments: true,
  feedback: true
};

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ type: 'unauthorized', title: 'Sign in to view complaints', status: 401 }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const isStaff = ['OFFICER', 'DEPT_ADMIN', 'CMO_VIEWER', 'AUDITOR', 'SUPER_ADMIN'].includes(session.role);
  if (!isStaff && searchParams.has('phone') && canonicalPhone(searchParams.get('phone')!) !== session.phone) {
    return NextResponse.json({ type: 'forbidden', title: 'You can only view your own complaints', status: 403 }, { status: 403 });
  }
  const where: Record<string, unknown> = {};
  if (!isStaff) where.citizenId = session.userId;
  if (searchParams.has('districtId')) where.districtId = searchParams.get('districtId');
  if (searchParams.has('status')) where.status = searchParams.get('status');
  if (searchParams.has('departmentId')) where.departmentId = searchParams.get('departmentId');
  if (session.role === 'OFFICER' || session.role === 'DEPT_ADMIN') {
    if (session.departmentId) where.departmentId = session.departmentId;
    if (session.districtId) where.districtId = session.districtId;
  }
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 25)));
  const [complaints, total] = await prisma.$transaction([
    prisma.complaint.findMany({ where, include: publicSelect, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.complaint.count({ where })
  ]);
  return NextResponse.json({ complaints: complaints.map(complaint => maskForRole(complaint, session)), total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session || session.role !== 'CITIZEN') return NextResponse.json({ type: 'unauthorized', title: 'Verify your phone or email before filing', status: 401 }, { status: 401 });
  const parsed = complaintInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ type: 'validation_error', title: parsed.error.issues[0]?.message || 'Invalid complaint data', status: 400 }, { status: 400 });
  const body = parsed.data;
  if (session.phone && canonicalPhone(body.citizenPhone) !== session.phone) {
    return NextResponse.json({ type: 'forbidden', title: 'Use the verified phone number on your account', status: 403 }, { status: 403 });
  }
  if (session.email && !session.phone) {
    return NextResponse.json({ type: 'validation_error', title: 'A verified mobile number is required to file a complaint', status: 400 }, { status: 400 });
  }

  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json({ type: 'validation_error', title: 'A valid Idempotency-Key header is required', status: 400 }, { status: 400 });
  }
  const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing && existing.expiresAt > new Date()) {
    if (existing.requestHash !== requestHash) return NextResponse.json({ type: 'conflict', title: 'This idempotency key was used for a different request', status: 409 }, { status: 409 });
    const replay = decodeStoredResponse(existing.response);
    return NextResponse.json(replay.body, { status: replay.status });
  }

  if (body.departmentId && !await prisma.department.findUnique({ where: { id: body.departmentId }, select: { id: true } })) {
    return NextResponse.json({ type: 'validation_error', title: 'Choose a valid department', status: 400 }, { status: 400 });
  }
  if (body.categoryId && !await prisma.category.findUnique({ where: { id: body.categoryId }, select: { id: true } })) {
    return NextResponse.json({ type: 'validation_error', title: 'Choose a valid category', status: 400 }, { status: 400 });
  }
  if (body.districtId && !await prisma.district.findUnique({ where: { id: body.districtId }, select: { id: true } })) {
    return NextResponse.json({ type: 'validation_error', title: 'Choose a valid district', status: 400 }, { status: 400 });
  }

  const availableCategories = await prisma.category.findMany({ include: { department: { select: { code: true } } } });
  const classification = await classifyComplaint(body.description, availableCategories);
  const categoryId = classification.categoryId || body.categoryId;
  const category = categoryId ? await prisma.category.findUnique({ where: { id: categoryId } }) : null;
  const departmentId = category?.departmentId || (classification.confidence >= 0.5 ? classification.departmentId : undefined);
  const urgencyRank = { LOW: 0, NORMAL: 1, HIGH: 2, EMERGENCY: 3 } as const;
  const clientUrgency = body.urgency === 'EMERGENCY' ? 'HIGH' : body.urgency;
  const urgency = urgencyRank[clientUrgency] > urgencyRank[classification.urgency] ? clientUrgency : classification.urgency;
  const needsManualTriage = classification.confidence < 0.5;
  const sla = calculateSlaDeadlines(category?.id, urgency, 1);
  const officer = departmentId && !needsManualTriage ? await prisma.officerProfile.findFirst({
    where: { departmentId, level: 1, isActive: true, ...(body.districtId ? { districtId: body.districtId } : {}) },
    include: { user: true }, orderBy: { user: { name: 'asc' } }
  }) : null;
  const now = new Date();
  const initialStatus = officer ? 'ASSIGNED' : 'SUBMITTED';
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Expired keys may be reused. Deletion and replacement remain atomic with complaint creation.
      await tx.idempotencyRecord.deleteMany({ where: { key: idempotencyKey, expiresAt: { lte: now } } });
      const ticketNo = await nextTicketNo(tx, now.getFullYear());
      const complaint = await tx.complaint.create({
        data: {
          ticketNo,
          citizenId: session.userId,
          citizenPhone: canonicalPhone(body.citizenPhone),
          citizenName: body.citizenName || session.name,
          title: body.title || body.description.slice(0, 120),
          description: body.description,
          submissionType: body.submissionType,
          language: body.language,
          departmentId,
          categoryId: category?.id,
          districtId: body.districtId,
          villageOrTehsil: body.villageOrTehsil,
          latitude: body.latitude,
          longitude: body.longitude,
          status: initialStatus,
          urgency,
          escalationLevel: 1,
          assignedOfficerId: officer?.id,
          assignedOfficerName: officer?.designation,
          slaDueAt: sla.resolutionDueAt,
          aiSummaryEn: classification.summaryEn,
          aiSummaryHi: classification.summaryHi,
          aiConfidence: classification.confidence,
          sourceChannel: body.sourceChannel,
          createdAt: now,
          updatedAt: now,
          events: { create: [
            { actorType: 'CITIZEN', actorName: session.name || 'Citizen', toStatus: 'SUBMITTED', reason: `Submitted ${body.submissionType.toLowerCase()} through ${body.sourceChannel.toLowerCase()}${needsManualTriage ? '; queued for manual triage due to low classification confidence' : ''}` },
            ...(officer ? [{ actorType: 'SYSTEM', actorName: 'Samadhan Setu', fromStatus: 'SUBMITTED', toStatus: 'ASSIGNED', reason: 'Routed to the Level 1 department officer' }] : [])
          ] },
          attachments: { create: body.attachments.map(item => ({ url: item.url, fileName: item.fileName, mimeType: item.mimeType, fileSize: item.fileSize })) }
        }, include: publicSelect
      });
      const responseData = { success: true, ticketNo, complaint, sla: { resolutionDueAt: sla.resolutionDueAt.toISOString(), hoursRemaining: sla.hoursRemaining } };
      await tx.idempotencyRecord.create({
        data: { key: idempotencyKey, requestHash, response: encodeStoredResponse(201, responseData), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
      });
      await tx.outboxEvent.create({ data: { eventType: 'COMPLAINT_SUBMITTED', payload: JSON.stringify({ ticketNo, phone: canonicalPhone(body.citizenPhone), name: body.citizenName || session.name, submissionType: body.submissionType }) } });
      if (officer) await writeAudit(tx, { action: 'COMPLAINT_ASSIGNED', entityType: 'Complaint', entityId: complaint.id, actorId: session.userId, actorRole: 'CITIZEN', ipAddress: getClientIp(req.headers), details: { officerId: officer.id, source: 'initial-routing' } });
      return responseData;
    });
    await cache.invalidate('public:stats:v1');
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isIdempotencyKeyConflict(error)) {
      // The failed transaction has rolled back before this bounded, out-of-transaction lookup.
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          const winner = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
          if (winner && winner.expiresAt > new Date()) {
            if (winner.requestHash !== requestHash) return NextResponse.json({ type: 'conflict', title: 'This idempotency key was used for a different request', status: 409 }, { status: 409 });
            const replay = decodeStoredResponse(winner.response);
            return NextResponse.json(replay.body, { status: replay.status });
          }
          if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
        }
      } catch {
        // A transient read failure follows the same controlled retry response below.
      }
      return NextResponse.json({ type: 'conflict', title: 'An equivalent request is still being processed. Retry with the same idempotency key.', status: 409 }, { status: 409 });
    }
    if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ type: 'conflict', title: 'A conflicting record already exists', status: 409 }, { status: 409 });
    console.error(JSON.stringify({ level: 'ERROR', message: 'complaint_create_failed', requestId: req.headers.get('x-request-id'), error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not file the submission. Please try again.', status: 500 }, { status: 500 });
  }
}
