import { prisma } from './prisma';
import { assignOfficerForLevel } from './escalation';
import { calculateSlaDeadlines } from './sla-engine';
import { writeAudit } from './audit';

type Candidate = { id: string };

/** Escalate breached, assigned complaints once; null deadlines are intentionally not treated as breached. */
export async function escalateBreachedComplaints(limit = 100) {
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const now = new Date();
  return prisma.$transaction(async tx => {
    const candidates = await tx.$queryRaw<Candidate[]>`
      SELECT "id"
      FROM "Complaint"
      WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS', 'REOPENED')
        AND "slaDueAt" IS NOT NULL AND "slaDueAt" < ${now}
        AND "escalationLevel" < 4
      ORDER BY "slaDueAt" ASC, "createdAt" ASC
      LIMIT ${boundedLimit}
      FOR UPDATE SKIP LOCKED
    `;
    let escalated = 0;
    for (const candidate of candidates) {
      const complaint = await tx.complaint.findUnique({ where: { id: candidate.id } });
      if (!complaint || !complaint.slaDueAt || !Number.isFinite(complaint.slaDueAt.getTime())) continue;
      if (!['ASSIGNED', 'IN_PROGRESS', 'REOPENED'].includes(complaint.status) || complaint.escalationLevel >= 4 || complaint.slaDueAt >= now) continue;

      const nextLevel = complaint.escalationLevel + 1;
      const sla = calculateSlaDeadlines(complaint.categoryId || undefined, complaint.urgency as 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY', nextLevel, now);
      const changed = await tx.complaint.updateMany({
        where: { id: complaint.id, status: complaint.status, escalationLevel: complaint.escalationLevel, slaDueAt: complaint.slaDueAt },
        data: { status: 'ESCALATED', escalationLevel: nextLevel, slaDueAt: sla.resolutionDueAt, updatedAt: now }
      });
      if (changed.count !== 1) continue;

      await tx.complaintEvent.create({
        data: {
          complaintId: complaint.id, actorType: 'SYSTEM', actorName: 'SLA Scheduler',
          fromStatus: complaint.status, toStatus: 'ESCALATED',
          reason: `SLA deadline breached; automatically escalated to level ${nextLevel}`
        }
      });
      await assignOfficerForLevel(tx, { ...complaint, status: 'ESCALATED', escalationLevel: nextLevel }, nextLevel);
      await tx.outboxEvent.create({
        data: {
          eventType: 'COMPLAINT_ESCALATED',
          payload: JSON.stringify({ ticketNo: complaint.ticketNo, phone: complaint.citizenPhone, level: nextLevel, source: 'SLA' })
        }
      });
      await writeAudit(tx, { action: 'COMPLAINT_SLA_ESCALATED', entityType: 'Complaint', entityId: complaint.id, actorRole: 'SYSTEM', details: { fromLevel: complaint.escalationLevel, toLevel: nextLevel, source: 'SLA' } });
      escalated++;
    }
    return { checked: candidates.length, escalated };
  }, { timeout: 60_000 });
}
