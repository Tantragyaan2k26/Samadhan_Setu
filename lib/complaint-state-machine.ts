import { ComplaintStatus, ComplaintEvent } from './types';

// Legal state transitions per Section 5.2 of Master Plan
const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['TRIAGED', 'ASSIGNED', 'REJECTED'],
  TRIAGED: ['ASSIGNED', 'MERGED', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS', 'ESCALATED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED_PENDING', 'ESCALATED', 'REJECTED'],
  RESOLVED_PENDING: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'ESCALATED'],
  ESCALATED: ['ASSIGNED', 'IN_PROGRESS'],
  CLOSED: ['REOPENED'], // Reversible by citizen within 30 days
  REJECTED: ['REOPENED'], // Citizen appeal
  MERGED: []
};

export interface TransitionResult {
  allowed: boolean;
  error?: string;
  nextStatus?: ComplaintStatus;
  event?: Omit<ComplaintEvent, 'id' | 'complaintId' | 'createdAt'>;
}

export function validateAndTransition(
  currentStatus: ComplaintStatus,
  targetStatus: ComplaintStatus,
  actor: { type: 'CITIZEN' | 'OFFICER' | 'SYSTEM' | 'AI'; name?: string },
  reason?: string,
  notes?: string
): TransitionResult {
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      error: `Illegal state transition from ${currentStatus} to ${targetStatus}. Allowed: [${allowedNext.join(', ')}]`
    };
  }

  return {
    allowed: true,
    nextStatus: targetStatus,
    event: {
      actorType: actor.type,
      actorName: actor.name,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reason,
      notes
    }
  };
}
