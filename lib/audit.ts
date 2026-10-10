import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'> | typeof prisma;
// Fail-safe policy: audit errors propagate. Transactional callers roll back the mutation;
// authentication callers do not issue a session if the audit write fails.
export async function writeAudit(client: AuditClient, input: {
  action: string; entityType: string; entityId?: string; actorId?: string; actorRole?: string; ipAddress?: string; details?: Record<string, unknown>;
}) {
  await client.auditLog.create({ data: {
    action: input.action, entityType: input.entityType, entityId: input.entityId,
    actorId: input.actorId, actorRole: input.actorRole, ipAddress: input.ipAddress,
    details: input.details ? JSON.stringify(input.details) : undefined
  } });
}
