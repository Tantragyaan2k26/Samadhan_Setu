import { describe, it, expect } from 'vitest';
import { calculateSlaDeadlines, canSendReminder } from '../lib/sla-engine';
import { Complaint } from '../lib/types';

describe('SLA Engine & Escalation Calculator', () => {
  it('should calculate standard SLA deadlines for normal category', () => {
    const base = new Date('2026-10-01T10:00:00Z');
    const sla = calculateSlaDeadlines('cat-water-leak', 'NORMAL', 1, base);

    expect(sla.responseDueAt.getTime()).toBeGreaterThan(base.getTime());
    expect(sla.resolutionDueAt.getTime()).toBeGreaterThan(sla.responseDueAt.getTime());
  });

  it('should calculate accelerated emergency SLA deadline (24 hours resolution)', () => {
    const base = new Date('2026-10-01T10:00:00Z');
    const sla = calculateSlaDeadlines('cat-road-damage', 'EMERGENCY', 1, base);

    const diffHours = (sla.resolutionDueAt.getTime() - base.getTime()) / (3600 * 1000);
    expect(diffHours).toBe(24);
  });

  it('should enforce 48 hours cooldown for citizen reminders', () => {
    const recentDate = new Date(Date.now() - 5 * 3600 * 1000).toISOString(); // 5 hours ago
    const mockComplaint: Partial<Complaint> = {
      lastRemindedAt: recentDate
    };

    const check = canSendReminder(mockComplaint as Complaint);
    expect(check.allowed).toBe(false);
    expect(check.waitHours).toBeGreaterThan(0);
  });

  it('should allow reminder when more than 48 hours have passed', () => {
    const oldDate = new Date(Date.now() - 50 * 3600 * 1000).toISOString(); // 50 hours ago
    const mockComplaint: Partial<Complaint> = {
      lastRemindedAt: oldDate
    };

    const check = canSendReminder(mockComplaint as Complaint);
    expect(check.allowed).toBe(true);
  });
});
