import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { calculateSlaDeadlines } from '@/lib/sla-engine';
import { assignOfficerForLevel } from '@/lib/escalation';
import { writeAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';

const feedbackSchema = z.object({ rating: z.number().int().min(1).max(5), resolved: z.boolean(), comment: z.string().trim().max(2000).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  const session = await getAuthSession(req);
  if (!session || session.role !== 'CITIZEN') return NextResponse.json({ type: 'unauthorized', title: 'Sign in to send feedback', status: 401 }, { status: 401 });
  const parsed = feedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ type: 'validation_error', title: 'Rating from 1 to 5 and a resolution response are required', status: 400 }, { status: 400 });
  const complaint = await prisma.complaint.findFirst({ where: { ticketNo: { equals: ticket, mode: 'insensitive' } } });
  if (!complaint || complaint.citizenId !== session.userId) return NextResponse.json({ type: 'not_found', title: 'Submission not found', status: 404 }, { status: 404 });
  if (complaint.status !== 'RESOLVED_PENDING') return NextResponse.json({ type: 'conflict', title: 'Feedback can be submitted after an officer proposes a resolution', status: 409 }, { status: 409 });

  const { rating, resolved, comment } = parsed.data;
  const reopen = rating <= 2 || !resolved;
  const targetStatus = reopen ? 'REOPENED' : 'CLOSED';
  const nextLevel = reopen ? Math.min(4, complaint.escalationLevel + 1) : complaint.escalationLevel;
  const slaDueAt = reopen
    ? calculateSlaDeadlines(complaint.categoryId || undefined, complaint.urgency as 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY', nextLevel).resolutionDueAt
    : complaint.slaDueAt;
  try {
    await prisma.$transaction(async tx => {
      await tx.feedback.upsert({
        where: { complaintId: complaint.id },
        create: { complaintId: complaint.id, userId: session.userId, rating, resolved, comment },
        update: { userId: session.userId, rating, resolved, comment, createdAt: new Date() }
      });
      const changed = await tx.complaint.updateMany({ where: { id: complaint.id, status: 'RESOLVED_PENDING', escalationLevel: complaint.escalationLevel }, data: { status: targetStatus, escalationLevel: nextLevel, slaDueAt, updatedAt: new Date() } });
      if (changed.count !== 1) throw new Error('This submission changed while feedback was being saved. Reload and try again.');
      await tx.complaintEvent.create({
        data: { complaintId: complaint.id, actorType: 'CITIZEN', actorName: session.name || 'Citizen', fromStatus: 'RESOLVED_PENDING', toStatus: targetStatus, reason: reopen ? `Citizen rejected proposed resolution (${rating}/5)` : `Citizen accepted proposed resolution (${rating}/5)`, notes: comment }
      });
      if (reopen) await assignOfficerForLevel(tx, { ...complaint, status: targetStatus, escalationLevel: nextLevel }, nextLevel);
      await tx.outboxEvent.create({ data: {
        eventType: reopen ? 'COMPLAINT_REOPENED' : 'COMPLAINT_CLOSED',
        payload: JSON.stringify({ ticketNo: complaint.ticketNo, phone: complaint.citizenPhone, escalationLevel: nextLevel, rating })
      } });
      await writeAudit(tx, { action: reopen ? 'COMPLAINT_REOPENED' : 'COMPLAINT_CLOSED', entityType: 'Complaint', entityId: complaint.id, actorId: session.userId, actorRole: session.role, ipAddress: getClientIp(req.headers), details: { fromStatus: complaint.status, toStatus: targetStatus, rating } });
    });
    await cache.invalidate('public:stats:v1');
    return NextResponse.json({ success: true, status: targetStatus, escalationLevel: nextLevel, message: reopen ? 'Your feedback has been recorded and the submission reopened for review.' : 'Thank you. The submission has been closed.' });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('This submission changed')) return NextResponse.json({ type: 'conflict', title: error.message, status: 409 }, { status: 409 });
    console.error(JSON.stringify({ level: 'ERROR', message: 'complaint_feedback_failed', requestId: req.headers.get('x-request-id'), error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not save feedback', status: 500 }, { status: 500 });
  }
}
