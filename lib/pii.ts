import type { AuthSession } from './auth';

const oversight = new Set(['CMO_VIEWER', 'AUDITOR']);
export function maskForRole<T extends { citizenPhone: string; citizenName: string | null }>(complaint: T, session: Pick<AuthSession, 'role'>): T {
  if (!oversight.has(session.role)) return complaint;
  const digits = complaint.citizenPhone;
  const maskedPhone = digits.length >= 6 ? `${digits.slice(0, 2)}XXXX${digits.slice(-4)}` : 'XXXX';
  const result = { ...complaint, citizenPhone: maskedPhone, citizenName: complaint.citizenName ? `${complaint.citizenName.slice(0, 1)}***` : null };
  // Nested user relations can duplicate the citizen's PII through alternate serialization paths.
  if ('citizen' in result && result.citizen && typeof result.citizen === 'object') {
    const citizen = result.citizen as Record<string, unknown>;
    (result as Record<string, unknown>).citizen = { ...citizen, phone: maskedPhone, name: result.citizenName };
  }
  if ('events' in result && Array.isArray(result.events)) {
    (result as Record<string, unknown>).events = result.events.map((event: unknown) => {
      if (!event || typeof event !== 'object') return event;
      const row = event as Record<string, unknown>;
      return row.actorType === 'CITIZEN' && typeof row.actorName === 'string'
        ? { ...row, actorName: `${row.actorName.slice(0, 1)}***` }
        : row;
    });
  }
  return result;
}
