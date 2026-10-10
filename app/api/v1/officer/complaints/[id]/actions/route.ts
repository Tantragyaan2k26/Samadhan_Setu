import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateAndTransition } from '@/lib/complaint-state-machine';
import { ComplaintStatus } from '@/lib/types';
import { cache } from '@/lib/cache';
import { isAllowedAttachmentUrl } from '@/lib/attachment-url';
import { writeAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';

const inputSchema = z.object({
  action: z.enum(['accept', 'start', 'resolve', 'reject']),
  notes: z.string().trim().max(4000).optional(),
  proofUrl: z.string().url().refine(value => isAllowedAttachmentUrl(value), 'Proof URL must use the configured secure CDN host').optional()
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session || !['OFFICER', 'DEPT_ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return NextResponse.json({ type: 'unauthorized', title: 'An authorized staff account is required', status: 401 }, { status: 401 });
  }
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ type: 'validation_error', title: 'Invalid action', status: 400 }, { status: 400 });
  const { action, notes, proofUrl } = parsed.data;
  if ((action === 'resolve' || action === 'reject') && (!notes || notes.length < 5)) {
    return NextResponse.json({ type: 'validation_error', title: 'Detailed remarks are required for resolution or rejection', status: 400 }, { status: 400 });
  }
  const complaint = await prisma.complaint.findFirst({ where: { OR: [{ id }, { ticketNo: { equals: id, mode: 'insensitive' } }] } });
  if (!complaint) return NextResponse.json({ type: 'not_found', title: 'Submission not found', status: 404 }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN') {
    if (session.departmentId && session.departmentId !== complaint.departmentId) return NextResponse.json({ type: 'forbidden', title: 'This submission belongs to another department', status: 403 }, { status: 403 });
    if (session.districtId && session.districtId !== complaint.districtId) return NextResponse.json({ type: 'forbidden', title: 'This submission belongs to another district', status: 403 }, { status: 403 });
    if (session.role === 'OFFICER') {
      const profile = await prisma.officerProfile.findUnique({ where: { userId: session.userId } });
      if (!profile || !profile.isActive || profile.level < complaint.escalationLevel || complaint.assignedOfficerId !== profile.id) {
        return NextResponse.json({ type: 'forbidden', title: 'This submission is not assigned to your account or level', status: 403 }, { status: 403 });
      }
    }
  }
  const nextStatus = ({ accept: 'ASSIGNED', start: 'IN_PROGRESS', resolve: 'RESOLVED_PENDING', reject: 'REJECTED' } as Record<typeof action, ComplaintStatus>)[action];
  const actorName = session.name || session.email || 'Authorized officer';
  const transition = validateAndTransition(complaint.status as ComplaintStatus, nextStatus, { type: 'OFFICER', name: actorName }, `Officer action: ${action.toUpperCase()}`, notes);
  if (!transition.allowed) return NextResponse.json({ type: 'conflict', title: transition.error, status: 409 }, { status: 409 });
  const now = new Date();
  try {
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.complaint.updateMany({ where: { id: complaint.id, status: complaint.status }, data: { status: nextStatus, updatedAt: now } });
      if (changed.count !== 1) throw new Error('This submission changed while the action was being saved. Reload and try again.');
      if (transition.event) await tx.complaintEvent.create({ data: { complaintId: complaint.id, ...transition.event } });
      if (proofUrl) await tx.attachment.create({ data: { complaintId: complaint.id, url: proofUrl, fileName: 'resolution-proof', mimeType: 'image/jpeg', fileSize: 0 } });
      if (nextStatus === 'RESOLVED_PENDING') {
        await tx.outboxEvent.create({ data: { eventType: 'COMPLAINT_RESOLVED_PENDING', payload: JSON.stringify({ ticketNo: complaint.ticketNo, phone: complaint.citizenPhone, officerName: actorName, notes }) } });
      }
      await writeAudit(tx, { action: 'OFFICER_COMPLAINT_ACTION', entityType: 'Complaint', entityId: complaint.id, actorId: session.userId, actorRole: session.role, ipAddress: getClientIp(req.headers), details: { action, fromStatus: complaint.status, toStatus: nextStatus } });
      return tx.complaint.findUniqueOrThrow({ where: { id: complaint.id }, include: { events: { orderBy: { createdAt: 'asc' } }, attachments: true, feedback: true } });
    });
    await cache.invalidate('public:stats:v1');
    return NextResponse.json({ success: true, complaint: updated });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('This submission changed')) return NextResponse.json({ type: 'conflict', title: error.message, status: 409 }, { status: 409 });
    console.error(JSON.stringify({ level: 'ERROR', message: 'officer_action_failed', requestId: req.headers.get('x-request-id'), error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not save this action', status: 500 }, { status: 500 });
  }
}
