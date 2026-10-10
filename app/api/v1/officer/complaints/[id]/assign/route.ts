import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateAndTransition } from '@/lib/complaint-state-machine';
import { ComplaintStatus } from '@/lib/types';
import { writeAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';

const assignmentSchema = z.object({ officerId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(req);
  if (!session || !['DEPT_ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return NextResponse.json({ type: 'forbidden', title: 'Only department administrators may assign complaints', status: 403 }, { status: 403 });
  }
  const parsed = assignmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ type: 'validation_error', title: 'A valid officerId is required', status: 400 }, { status: 400 });
  const { id } = await params;

  try {
    const complaint = await prisma.$transaction(async tx => {
      const current = await tx.complaint.findUnique({ where: { id } });
      if (!current) throw Object.assign(new Error('Submission not found'), { kind: 'not_found' });
      if (session.role === 'DEPT_ADMIN' && (!session.departmentId || session.departmentId !== current.departmentId)) {
        throw Object.assign(new Error('You may assign submissions only in your department'), { kind: 'forbidden' });
      }
      if (session.role === 'DEPT_ADMIN' && session.districtId && session.districtId !== current.districtId) {
        throw Object.assign(new Error('You may assign submissions only in your district'), { kind: 'forbidden' });
      }
      const officer = await tx.officerProfile.findUnique({ where: { id: parsed.data.officerId }, include: { user: true } });
      if (!officer) throw Object.assign(new Error('Officer not found'), { kind: 'not_found' });
      if (!officer.isActive || !officer.user.isActive || officer.user.role !== 'OFFICER') {
        throw Object.assign(new Error('Choose an active officer account'), { kind: 'validation_error' });
      }
      if (!current.departmentId || officer.departmentId !== current.departmentId) {
        throw Object.assign(new Error('The officer must belong to the submission department'), { kind: 'validation_error' });
      }
      if (current.districtId && officer.districtId !== current.districtId) {
        throw Object.assign(new Error('The officer must belong to the submission district'), { kind: 'validation_error' });
      }
      if (officer.level < current.escalationLevel) {
        throw Object.assign(new Error('The officer level is below the submission escalation level'), { kind: 'validation_error' });
      }
      const transition = validateAndTransition(
        current.status as ComplaintStatus,
        'ASSIGNED',
        { type: 'SYSTEM', name: session.name || session.role },
        `Manually assigned to ${officer.user.name || officer.designation}`
      );
      if (!transition.allowed) throw Object.assign(new Error(transition.error || 'This submission cannot be assigned from its current state'), { kind: 'conflict' });

      const assignedOfficerName = officer.user.name || officer.designation;
      const changed = await tx.complaint.updateMany({
        where: { id: current.id, status: current.status, escalationLevel: current.escalationLevel, updatedAt: current.updatedAt },
        data: { status: 'ASSIGNED', assignedOfficerId: officer.id, assignedOfficerName }
      });
      if (changed.count !== 1) throw Object.assign(new Error('This submission changed while assignment was being saved. Reload and try again.'), { kind: 'conflict' });
      await tx.complaintEvent.create({
        data: {
          complaintId: current.id, actorType: 'SYSTEM', actorName: `${session.role}: ${session.name || session.userId}`,
          fromStatus: current.status, toStatus: 'ASSIGNED', reason: `Manually assigned to ${assignedOfficerName}`,
          notes: `Officer profile ${officer.id}, level ${officer.level}`
        }
      });
      await writeAudit(tx, { action: 'COMPLAINT_ASSIGNED', entityType: 'Complaint', entityId: current.id, actorId: session.userId, actorRole: session.role, ipAddress: getClientIp(req.headers), details: { officerId: officer.id, fromStatus: current.status, toStatus: 'ASSIGNED' } });
      return tx.complaint.findUniqueOrThrow({
        where: { id: current.id },
        include: { events: { orderBy: { createdAt: 'asc' } }, attachments: true, feedback: true }
      });
    });
    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    const typed = error as Error & { kind?: string };
    if (typed.kind) {
      const status = typed.kind === 'not_found' ? 404 : typed.kind === 'forbidden' ? 403 : typed.kind === 'conflict' ? 409 : 400;
      return NextResponse.json({ type: typed.kind, title: typed.message, status }, { status });
    }
    console.error(JSON.stringify({ level: 'ERROR', message: 'complaint_assignment_failed', requestId: req.headers.get('x-request-id'), error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not assign submission', status: 500 }, { status: 500 });
  }
}
