import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ apiKey: '' as string | undefined, model: 'gemini-test' }));
vi.mock('../lib/env', () => ({ env: { get GEMINI_API_KEY() { return config.apiKey; }, get GEMINI_MODEL() { return config.model; } } }));

const categories = [{ id: 'db-cat-water', code: 'WATER', departmentId: 'db-dept', nameEn: 'Water supply', nameHi: 'पेयजल', keywords: 'पानी,water' }];
const successPayload = (overrides: Record<string, unknown> = {}) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ categoryCode: 'WATER', urgency: 'HIGH', confidence: 0.91, summaryEn: 'Water supply interruption', summaryHi: 'पेयजल बाधित', isEmergency: false, ...overrides }) }] } }] });

beforeEach(() => { config.apiKey = ''; vi.restoreAllMocks(); });

describe('Gemini classifier and conservative fallback', () => {
  it('uses the keyword fallback when no provider key is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { classifyComplaint } = await import('../lib/ai-classifier');
    const result = await classifyComplaint('पानी की आपूर्ति बंद है');
    expect(result.categoryCode).toBe('WATER_SUPPLY_ISSUE');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts validated JSON and maps only to the supplied database category', async () => {
    config.apiKey = 'server-only-test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(successPayload()), { status: 200 }));
    const { classifyComplaint } = await import('../lib/ai-classifier');
    const result = await classifyComplaint('पानी की आपूर्ति बंद है', categories);
    expect(result.categoryId).toBe('db-cat-water');
    expect(result.departmentId).toBe('db-dept');
    expect(result.confidence).toBe(0.91);
  });

  it.each([
    ['malformed JSON', 'not-json'],
    ['out-of-range confidence', JSON.stringify({ categoryCode: 'WATER', urgency: 'HIGH', confidence: 1.4, summaryEn: 'Summary', summaryHi: 'सार', isEmergency: false })],
    ['unknown category', JSON.stringify({ categoryCode: 'REMOVED_CATEGORY', urgency: 'HIGH', confidence: 0.9, summaryEn: 'Summary', summaryHi: 'सार', isEmergency: false })]
  ])('falls back safely for %s', async (_label, raw) => {
    config.apiKey = 'server-only-test-key';
    const text = String(raw);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 }));
    const { classifyComplaint } = await import('../lib/ai-classifier');
    const result = await classifyComplaint('पानी की आपूर्ति बंद है', categories);
    expect(result.categoryId).toBe('db-cat-water');
    expect(result.confidence).toBeLessThan(1);
  });

  it('falls back on provider timeout/failure without surfacing provider details', async () => {
    config.apiKey = 'server-only-test-key';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('provider secret detail', 'AbortError'));
    const { classifyComplaint } = await import('../lib/ai-classifier');
    const result = await classifyComplaint('पानी की आपूर्ति बंद है', categories);
    expect(result.categoryId).toBe('db-cat-water');
    expect(JSON.stringify(result)).not.toContain('provider secret detail');
  });

  it('aborts the Gemini request after three seconds and uses the keyword fallback', async () => {
    config.apiKey = 'server-only-test-key';
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const { classifyComplaint } = await import('../lib/ai-classifier');
    const pending = classifyComplaint('पानी की आपूर्ति बंद है', categories);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toMatchObject({ categoryId: 'db-cat-water', confidence: 0.72 });
    vi.useRealTimers();
  });

  it('does not treat ambiguous standalone Hindi words as emergency and leaves unmatched text unclassified', async () => {
    const { classifyComplaint } = await import('../lib/ai-classifier');
    const ambiguous = await classifyComplaint('आग');
    const ambiguousSeverity = await classifyComplaint('गंभीर');
    const unmatched = await classifyComplaint('कुछ भी समझ नहीं आ रहा');
    expect(ambiguous.isEmergency).toBe(false);
    expect(ambiguousSeverity.isEmergency).toBe(false);
    expect(unmatched.categoryId).toBeUndefined();
    expect(unmatched.confidence).toBeLessThan(0.5);
  });
});
