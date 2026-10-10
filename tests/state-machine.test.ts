import { describe, it, expect } from 'vitest';
import { validateAndTransition } from '../lib/complaint-state-machine';

describe('Complaint State Machine', () => {
  it('should allow valid transition from SUBMITTED to TRIAGED', () => {
    const res = validateAndTransition(
      'SUBMITTED',
      'TRIAGED',
      { type: 'AI', name: 'Samadhan AI Engine' },
      'Auto-triage completed'
    );
    expect(res.allowed).toBe(true);
    expect(res.nextStatus).toBe('TRIAGED');
    expect(res.event?.fromStatus).toBe('SUBMITTED');
    expect(res.event?.toStatus).toBe('TRIAGED');
  });

  it('should allow valid transition from IN_PROGRESS to RESOLVED_PENDING with officer remarks', () => {
    const res = validateAndTransition(
      'IN_PROGRESS',
      'RESOLVED_PENDING',
      { type: 'OFFICER', name: 'JE Rajesh Negi' },
      'Pipeline repaired on site',
      'Water supply restored to Ward 4'
    );
    expect(res.allowed).toBe(true);
    expect(res.nextStatus).toBe('RESOLVED_PENDING');
  });

  it('should reject illegal direct transition from SUBMITTED to CLOSED', () => {
    const res = validateAndTransition(
      'SUBMITTED',
      'CLOSED',
      { type: 'OFFICER' }
    );
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('Illegal state transition');
  });

  it('should allow reopening from RESOLVED_PENDING to REOPENED on citizen dissatisfaction', () => {
    const res = validateAndTransition(
      'RESOLVED_PENDING',
      'REOPENED',
      { type: 'CITIZEN', name: 'Kavita Bisht' },
      'Citizen dissatisfied with resolution'
    );
    expect(res.allowed).toBe(true);
    expect(res.nextStatus).toBe('REOPENED');
  });
});
