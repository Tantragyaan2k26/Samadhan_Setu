import { UrgencyLevel, Complaint } from './types';
import { CATEGORIES } from './taxonomy';

export interface SlaCalculation {
  responseDueAt: Date;
  resolutionDueAt: Date;
  isBreached: boolean;
  hoursRemaining: number;
}

export function calculateSlaDeadlines(
  categoryId?: string,
  urgency: UrgencyLevel = 'NORMAL',
  escalationLevel: number = 1,
  baseDate: Date = new Date()
): SlaCalculation {
  const category = CATEGORIES.find(c => c.id === categoryId);
  let baseResponseHours = category ? category.slaResponseHours : 48;
  let baseResolutionHours = category ? category.slaResolutionHours : 168;

  // Modifiers based on urgency
  if (urgency === 'EMERGENCY') {
    baseResponseHours = 4;
    baseResolutionHours = 24;
  } else if (urgency === 'HIGH') {
    baseResponseHours = Math.round(baseResponseHours * 0.5);
    baseResolutionHours = Math.round(baseResolutionHours * 0.6);
  } else if (urgency === 'LOW') {
    baseResponseHours = Math.round(baseResponseHours * 1.5);
    baseResolutionHours = Math.round(baseResolutionHours * 1.3);
  }

  // Modifiers for escalation level: higher levels have halved resolution target
  if (escalationLevel > 1) {
    baseResolutionHours = Math.round(baseResolutionHours / escalationLevel);
  }

  const responseDueAt = new Date(baseDate.getTime() + baseResponseHours * 3600 * 1000);
  const resolutionDueAt = new Date(baseDate.getTime() + baseResolutionHours * 3600 * 1000);

  const now = new Date();
  const diffMs = resolutionDueAt.getTime() - now.getTime();
  const hoursRemaining = Math.round(diffMs / (3600 * 1000));
  const isBreached = hoursRemaining <= 0;

  return {
    responseDueAt,
    resolutionDueAt,
    isBreached,
    hoursRemaining
  };
}

export function canSendReminder(complaint: Complaint): { allowed: boolean; waitHours?: number } {
  if (!complaint.lastRemindedAt) {
    return { allowed: true };
  }

  const lastReminder = new Date(complaint.lastRemindedAt).getTime();
  const now = Date.now();
  const cooldownMs = 48 * 3600 * 1000; // 48 hours cooldown per §5.3

  if (now - lastReminder < cooldownMs) {
    const remainingHours = Math.ceil((cooldownMs - (now - lastReminder)) / (3600 * 1000));
    return { allowed: false, waitHours: remainingHours };
  }

  return { allowed: true };
}
