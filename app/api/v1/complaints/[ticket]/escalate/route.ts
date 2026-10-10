import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateSlaDeadlines } from '@/lib/sla-engine';
import { assignOfficerForLevel, escalationAllowed } from '@/lib/escalation';
import { writeAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';

export async function POST(req: NextRequest, { params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  const session = await getAuthSession(req);
  if (!session || session.role !== 'CITIZEN') return NextResponse.json({ type: 'unauthorized', title: 'Sign in to request escalation', status: 401 }, { status: 401 });
  const complaint = await prisma.complaint.findFirst({ where: { ticketNo: { equals: ticket, mode: 'insensitive' } } });
  if (!complaint || complaint.citizenId !== session.userId) return NextResponse.json({ type: 'not_found', title: 'Submission not found', status: 404 }, { status: 404 });
  if (complaint.escalationLevel >= 4) return NextResponse.json({ type: 'conflict', title: 'This submission is already at the highest escalation level', status: 409 }, { status: 409 });
  const eligibility = escalationAllowed(complaint);
  if (!eligibility.allowed) {
    if (eligibility.reason === 'deadline_missing') {
      return NextResponse.json({ type: 'conflict', title: 'This submission has no valid resolution deadline and cannot be escalated yet', status: 409 }, { status: 409 });
    }
    return NextResponse.json({ type: 'conflict', title: 'You can request escalation after the resolution deadline', status: 409 }, { status: 409 });
  }
  const level = complaint.escalationLevel + 1;
  const now = new Date();
  const sla = calculateSlaDeadlines(complaint.categoryId || undefined, complaint.urgency as 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY', level, now);
  try {
    await prisma.$transaction(async tx => {
      const changed = await tx.complaint.updateMany({
        where: { id: complaint.id, escalationLevel: complaint.escalationLevel, status: complaint.status, slaDueAt: complaint.slaDueAt },
        data: { escalationLevel: level, status: 'ESCALATED', slaDueAt: sla.resolutionDueAt, updatedAt: now }
      });
      if (changed.count !== 1) throw new Error('This submission changed while escalation was being saved. Reload and try again.');
      await tx.complaintEvent.create({ data: { complaintId: complaint.id, actorType: 'CITIZEN', actorName: session.name || 'Citizen', fromStatus: complaint.status, toStatus: 'ESCALATED', reason: `Citizen requested escalation from Level ${complaint.escalationLevel} to Level ${level}` } });
      await assignOfficerForLevel(tx, { ...complaint, status: 'ESCALATED', escalationLevel: level }, level);
      await tx.outboxEvent.create({ data: { eventType: 'COMPLAINT_ESCALATED', payload: JSON.stringify({ ticketNo: complaint.ticketNo, phone: complaint.citizenPhone, level }) } });
      await writeAudit(tx, { action: 'COMPLAINT_ESCALATED', entityType: 'Complaint', entityId: complaint.id, actorId: session.userId, actorRole: session.role, ipAddress: getClientIp(req.headers), details: { fromLevel: complaint.escalationLevel, toLevel: level } });
    });
    return NextResponse.json({ success: true, newLevel: level, status: 'ESCALATED' });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('This submission changed')) return NextResponse.json({ type: 'conflict', title: error.message, status: 409 }, { status: 409 });
    console.error(JSON.stringify({ level: 'ERROR', message: 'complaint_escalation_failed', requestId: req.headers.get('x-request-id') }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not escalate submission', status: 500 }, { status: 500 });
  }
}
