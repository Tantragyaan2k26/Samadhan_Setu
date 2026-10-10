import type { Complaint as PrismaComplaint, Prisma } from '@prisma/client';
import { writeAudit } from './audit';

export type EscalationComplaint = Pick<PrismaComplaint, 'id' | 'departmentId' | 'districtId' | 'status' | 'escalationLevel'>;

/** Assign the best active officer for the target escalation level, and audit the decision. */
export async function assignOfficerForLevel(
  tx: Prisma.TransactionClient,
  complaint: EscalationComplaint,
  level: number
) {
  const candidates = complaint.departmentId
    ? await tx.officerProfile.findMany({
        where: {
          departmentId: complaint.departmentId,
          level: { gte: level },
          isActive: true,
          user: { isActive: true, role: 'OFFICER' }
        },
        include: { user: true },
        orderBy: [{ level: 'asc' }, { user: { name: 'asc' } }, { id: 'asc' }]
      })
    : [];

  const officer = candidates.find(candidate => candidate.districtId === complaint.districtId)
    ?? candidates.find(candidate => !complaint.districtId || !candidate.districtId)
    ?? candidates[0]
    ?? null;
  const assignedOfficerName = officer ? (officer.user.name || officer.designation) : null;

  await tx.complaint.update({
    where: { id: complaint.id },
    data: { assignedOfficerId: officer?.id ?? null, assignedOfficerName }
  });
  await writeAudit(tx, { action: 'COMPLAINT_OFFICER_REASSIGNED', entityType: 'Complaint', entityId: complaint.id, actorRole: 'SYSTEM', details: { officerId: officer?.id ?? null, escalationLevel: level } });
  await tx.complaintEvent.create({
    data: {
      complaintId: complaint.id,
      actorType: 'SYSTEM',
      actorName: 'Samadhan Setu',
      fromStatus: complaint.status,
      toStatus: complaint.status,
      reason: officer
        ? `Escalation level ${level}: assigned to ${assignedOfficerName} (officer level ${officer.level})`
        : `Escalation level ${level}: no eligible active officer is available in department ${complaint.departmentId || '(unassigned)'}`,
      notes: officer
        ? `Selected officer profile ${officer.id}; district ${officer.districtId || 'not specified'}`
        : 'Complaint remains unassigned until an eligible officer is available.'
    }
  });

  return { officer, assignedOfficerName };
}

export function escalationAllowed(
  complaint: { status: string; slaDueAt: Date | null },
  now = new Date()
): { allowed: boolean; reason?: 'deadline_pending' | 'deadline_missing' } {
  // A missing or malformed deadline is blocked to avoid unlimited rapid escalation;
  // only an explicit REOPENED state preserves the existing immediate-escalation exception.
  if (complaint.status === 'REOPENED') return { allowed: true };
  if (!complaint.slaDueAt || !Number.isFinite(complaint.slaDueAt.getTime())) {
    return { allowed: false, reason: 'deadline_missing' };
  }
  if (complaint.slaDueAt.getTime() > now.getTime()) return { allowed: false, reason: 'deadline_pending' };
  return { allowed: true };
}
