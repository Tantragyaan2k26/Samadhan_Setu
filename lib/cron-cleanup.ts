import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export async function cleanupExpiredRecords(tx: Prisma.TransactionClient, now = new Date()) {
  const [otpChallenges, sessions, idempotencyRecords] = await Promise.all([
    tx.otpChallenge.deleteMany({ where: { expiresAt: { lt: now } } }),
    tx.authSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    tx.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: now } } })
  ]);
  return { otpChallenges: otpChallenges.count, sessions: sessions.count, idempotencyRecords: idempotencyRecords.count };
}

export function cleanupExpiredData(now = new Date()) {
  return prisma.$transaction(tx => cleanupExpiredRecords(tx, now));
}
