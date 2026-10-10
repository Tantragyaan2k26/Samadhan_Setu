export interface StoredResponse<T = unknown> {
  status: number;
  body: T;
}

export function encodeStoredResponse<T>(status: number, body: T) {
  return JSON.stringify({ status, body } satisfies StoredResponse<T>);
}

export function decodeStoredResponse<T = unknown>(response: string | null): StoredResponse<T> {
  if (!response) return { status: 200, body: {} as T };
  const parsed = JSON.parse(response) as T | Partial<StoredResponse<T>>;
  if (parsed && typeof parsed === 'object' && 'body' in parsed && 'status' in parsed) {
    const stored = parsed as StoredResponse<T>;
    return { status: Number.isInteger(stored.status) ? stored.status : 200, body: stored.body };
  }
  // Backward compatibility for idempotency responses written before status was stored.
  return { status: 200, body: parsed as T };
}

export function isIdempotencyKeyConflict(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') return false;
  const meta = 'meta' in error && error.meta && typeof error.meta === 'object' ? error.meta as { target?: unknown } : undefined;
  const target = meta?.target;
  if (Array.isArray(target)) return target.length === 1 && String(target[0]).toLowerCase() === 'key';
  return typeof target === 'string' && /idempotencyrecord.*(pkey|key)|key.*idempotencyrecord/i.test(target);
}
