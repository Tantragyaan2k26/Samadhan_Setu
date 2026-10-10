import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateSlaDeadlines } from '@/lib/sla-engine';
import { assignOfficerForLevel } from '@/lib/escalation';
import { writeAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';

export async function POST(req: NextRequest, { params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  const session = await getAuthSession(req);
  if (!session || session.role !== 'CITIZEN') return NextResponse.json({ type: 'unauthorized', title: 'Sign in to remind the assigned officer', status: 401 }, { status: 401 });
  const complaint = await prisma.complaint.findFirst({ where: { ticketNo: { equals: ticket, mode: 'insensitive' } } });
  if (!complaint || complaint.citizenId !== session.userId) return NextResponse.json({ type: 'not_found', title: 'Submission not found', status: 404 }, { status: 404 });
  const now = new Date();
  if (complaint.lastRemindedAt && now.getTime() - complaint.lastRemindedAt.getTime() < 48 * 60 * 60 * 1000) {
    const waitHours = Math.ceil((48 * 60 * 60 * 1000 - (now.getTime() - complaint.lastRemindedAt.getTime())) / 3600000);
    return NextResponse.json({ type: 'rate_limited', title: `You can send another reminder in ${waitHours} hours`, waitHours, status: 429 }, { status: 429 });
  }
  const nextCount = complaint.remindersCount + 1;
  const autoEscalated = nextCount >= 3 && complaint.escalationLevel < 4;
  const nextLevel = autoEscalated ? complaint.escalationLevel + 1 : complaint.escalationLevel;
  const status = autoEscalated ? 'ESCALATED' : complaint.status;
  const slaDueAt = autoEscalated
    ? calculateSlaDeadlines(complaint.categoryId || undefined, complaint.urgency as 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY', nextLevel, now).resolutionDueAt
    : complaint.slaDueAt;
  try {
    await prisma.$transaction(async tx => {
      const changed = await tx.complaint.updateMany({
        where: { id: complaint.id, remindersCount: complaint.remindersCount, lastRemindedAt: complaint.lastRemindedAt, escalationLevel: complaint.escalationLevel, status: complaint.status },
        data: { remindersCount: nextCount, lastRemindedAt: now, status, escalationLevel: nextLevel, slaDueAt, updatedAt: now }
      });
      if (changed.count !== 1) throw new Error('A reminder was just sent. Reload and try again later.');
      await tx.complaintEvent.create({ data: { complaintId: complaint.id, actorType: 'CITIZEN', actorName: session.name || 'Citizen', fromStatus: complaint.status, toStatus: status, reason: `Citizen sent reminder ${nextCount}`, notes: autoEscalated ? `Automatically escalated to Level ${nextLevel} after three reminders` : undefined } });
      if (autoEscalated) await assignOfficerForLevel(tx, { ...complaint, status, escalationLevel: nextLevel }, nextLevel);
      await tx.outboxEvent.create({ data: { eventType: 'COMPLAINT_REMINDER', payload: JSON.stringify({ ticketNo: complaint.ticketNo, phone: complaint.citizenPhone, count: nextCount, autoEscalated, level: nextLevel }) } });
      await writeAudit(tx, { action: autoEscalated ? 'COMPLAINT_ESCALATED' : 'COMPLAINT_REMINDER', entityType: 'Complaint', entityId: complaint.id, actorId: session.userId, actorRole: session.role, ipAddress: getClientIp(req.headers), details: { reminderCount: nextCount, fromLevel: complaint.escalationLevel, toLevel: nextLevel } });
    });
    return NextResponse.json({ success: true, remindersCount: nextCount, autoEscalated, newLevel: nextLevel });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A reminder')) return NextResponse.json({ type: 'rate_limited', title: error.message, status: 429 }, { status: 429 });
    console.error(JSON.stringify({ level: 'ERROR', message: 'complaint_reminder_failed', requestId: req.headers.get('x-request-id') }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not send reminder', status: 500 }, { status: 500 });
  }
}
