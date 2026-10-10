import { z } from 'zod';
import { CATEGORIES, DEPARTMENTS } from './taxonomy';
import { UrgencyLevel } from './types';
import { env } from './env';

export interface ClassifierCategory {
  id: string;
  code: string;
  departmentId: string;
  nameEn: string;
  nameHi: string;
  departmentCode?: string;
  keywords?: string | string[] | null;
}

export interface AiSuggestionResult {
  language: 'hi' | 'en';
  summaryEn: string;
  summaryHi: string;
  categoryId?: string;
  categoryCode?: string;
  departmentId?: string;
  departmentCode?: string;
  urgency: UrgencyLevel;
  confidence: number;
  isEmergency: boolean;
  emergencyNotice?: string;
}

const providerSchema = z.object({
  categoryCode: z.string().trim().min(1).nullable(),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']),
  confidence: z.number().min(0).max(1),
  summaryEn: z.string().trim().min(1).max(500),
  summaryHi: z.string().trim().min(1).max(500),
  isEmergency: z.boolean()
}).strict();

const EMERGENCY_KEYWORDS = [
  'भूस्खलन', 'दबे हुए', 'फंसे हुए', 'बाढ़', 'हादसा', 'मरणासन्न', 'मौत',
  'landslide', 'trapped', 'fire', 'flood', 'collapse', 'fatality', 'life threatening', 'electric wire down'
];
const HIGH_KEYWORDS = ['तुरंत', 'खतरा', 'आपात', 'urgent', 'danger', 'immediately'];
const LOW_KEYWORDS = ['सुझाव', 'जानकारी', 'suggestion', 'information'];

function hasWholeWord(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Unicode letter/mark boundaries handle Hindi matras and English punctuation consistently.
  return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}_])${escaped}($|[^\\p{L}\\p{M}\\p{N}_])`, 'iu').test(text);
}

function normalizedKeywords(category: ClassifierCategory) {
  if (Array.isArray(category.keywords)) return category.keywords;
  if (typeof category.keywords === 'string') {
    try { const value: unknown = JSON.parse(category.keywords); if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string'); }
    catch { return category.keywords.split(',').map(item => item.trim()).filter(Boolean); }
  }
  return CATEGORIES.find(item => item.code === category.code)?.keywords ?? [];
}

function staticCategoryRows(): ClassifierCategory[] {
  return CATEGORIES.map(category => ({ ...category, keywords: category.keywords }));
}

function keywordClassification(text: string, categories: ClassifierCategory[]): AiSuggestionResult {
  const language = /[\u0900-\u097F]/u.test(text) ? 'hi' : 'en';
  const matches = categories.map(category => ({ category, count: normalizedKeywords(category).filter(keyword => hasWholeWord(text, keyword)).length }))
    .sort((left, right) => right.count - left.count);
  const best = matches[0]?.count ? matches[0].category : undefined;
  const emergency = EMERGENCY_KEYWORDS.some(keyword => hasWholeWord(text, keyword));
  const urgency: UrgencyLevel = emergency ? 'EMERGENCY'
    : HIGH_KEYWORDS.some(keyword => hasWholeWord(text, keyword)) ? 'HIGH'
      : LOW_KEYWORDS.some(keyword => hasWholeWord(text, keyword)) ? 'LOW' : 'NORMAL';
  const confidence = best ? (matches[0].count >= 2 ? 0.82 : 0.72) : 0.2;
  const truncated = text.trim().slice(0, 100);
  const summaryEn = best ? `Issue regarding ${best.nameEn}: "${truncated}"` : `Unclassified citizen report: "${truncated}"`;
  const summaryHi = best ? `${best.nameHi} से संबंधित शिकायत: "${truncated}"` : `अवर्गीकृत नागरिक शिकायत: "${truncated}"`;
  const department = best && DEPARTMENTS.find(item => item.id === best.departmentId);
  return {
    language, summaryEn, summaryHi,
    ...(best ? { categoryId: best.id, categoryCode: best.code } : {}),
    ...(best ? { departmentId: best.departmentId, departmentCode: best.departmentCode || department?.code } : {}),
    urgency, confidence, isEmergency: emergency,
    ...(emergency ? { emergencyNotice: '⚠️ आपातकालीन स्थिति का संकेत मिला है। यदि तत्काल जानमाल का खतरा है, तो कृपया तुरंत 112 डायल करें।' } : {})
  };
}

async function geminiClassification(text: string, categories: ClassifierCategory[]) {
  if (!env.GEMINI_API_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Classify this citizen complaint. Return only strict JSON with categoryCode (one listed value or null), urgency (LOW|NORMAL|HIGH|EMERGENCY), confidence (0..1), summaryEn, summaryHi, isEmergency (boolean). Only mark emergency for credible immediate threat to life/safety. Categories: ${JSON.stringify(categories.map(({ code, nameEn, nameHi, departmentId }) => ({ code, nameEn, nameHi, departmentId })))}. Complaint: ${text}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const raw = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return null; }
    const result = providerSchema.safeParse(parsed);
    if (!result.success) return null;
    const category = result.data.categoryCode ? categories.find(item => item.code === result.data.categoryCode) : undefined;
    if (result.data.categoryCode && !category) return null;
    const emergency = result.data.isEmergency;
    return {
      language: /[\u0900-\u097F]/u.test(text) ? 'hi' as const : 'en' as const,
      summaryEn: result.data.summaryEn, summaryHi: result.data.summaryHi,
      ...(category ? { categoryId: category.id, categoryCode: category.code, departmentId: category.departmentId,
        departmentCode: category.departmentCode || DEPARTMENTS.find(item => item.id === category.departmentId)?.code } : {}),
      urgency: emergency ? 'EMERGENCY' as const : result.data.urgency === 'EMERGENCY' ? 'HIGH' as const : result.data.urgency,
      confidence: result.data.confidence, isEmergency: emergency,
      ...(emergency ? { emergencyNotice: '⚠️ आपातकालीन स्थिति का संकेत मिला है। यदि तत्काल जानमाल का खतरा है, तो कृपया तुरंत 112 डायल करें।' } : {})
    } satisfies AiSuggestionResult;
  } catch {
    // Provider details and complaint text are intentionally not logged or exposed.
    return null;
  } finally { clearTimeout(timeout); }
}

export async function classifyComplaint(text: string, categoryRecords?: ClassifierCategory[]): Promise<AiSuggestionResult> {
  const categories = categoryRecords ?? staticCategoryRows();
  const provider = await geminiClassification(text, categories);
  return provider ?? keywordClassification(text, categories);
}
