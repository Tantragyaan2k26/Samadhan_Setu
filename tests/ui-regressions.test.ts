import { describe, expect, it } from 'vitest';
import { getComplaintSourceChannel, getStableRequestKey } from '../lib/complaint-form';
import { formatPublicCount, parsePublicStats } from '../lib/public-stats';

describe('citizen-facing regression helpers', () => {
  it('accepts live API statistics and preserves legitimate zero values', () => {
    expect(parsePublicStats({ metrics: {
      totalGrievances: 0,
      resolvedCount: 0,
      resolutionRatePercent: 0,
      avgResolutionDays: 0,
      escalatedCount: 0,
      citizenSatisfactionScore: null
    } })).toEqual({
      totalGrievances: 0,
      resolvedCount: 0,
      resolutionRatePercent: 0,
      avgResolutionDays: 0,
      escalatedCount: 0,
      citizenSatisfactionScore: null
    });
  });

  it('rejects incomplete statistics rather than showing made-up figures', () => {
    expect(parsePublicStats({ metrics: { totalGrievances: 18_454 } })).toBeNull();
    expect(parsePublicStats(null)).toBeNull();
    expect(parsePublicStats({ metrics: {
      totalGrievances: -1,
      resolvedCount: 0,
      resolutionRatePercent: 0,
      avgResolutionDays: 0,
      escalatedCount: 0,
      citizenSatisfactionScore: null
    } })).toBeNull();
    expect(formatPublicCount(undefined)).toBe('—');
    expect(formatPublicCount(18_454)).toBe('18,454');
  });

  it('reuses an idempotency key for retries and rotates it when the submission changes', () => {
    const original = { fingerprint: '{"description":"road"}', key: 'key-1' };
    expect(getStableRequestKey(original, original.fingerprint, 'key-2')).toBe(original);
    expect(getStableRequestKey(original, '{"description":"water"}', 'key-2')).toEqual({
      fingerprint: '{"description":"water"}',
      key: 'key-2'
    });
  });

  it('keeps voice submissions identified as voice after recording has stopped', () => {
    expect(getComplaintSourceChannel(true)).toBe('VOICE');
    expect(getComplaintSourceChannel(false)).toBe('WEB');
  });
});
