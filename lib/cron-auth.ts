import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { env } from './env';

export function isValidCronAuthorization(header: string | null, expected = env.CRON_BEARER_TOKEN) {
  if (!expected || Buffer.byteLength(expected, 'utf8') < 32 || !header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const received = Buffer.from(match[1], 'utf8');
  const configured = Buffer.from(expected, 'utf8');
  if (received.length < 32 || received.length !== configured.length) return false;
  return timingSafeEqual(received, configured);
}

export function requireCronAuthorization(request: NextRequest) {
  if (!env.CRON_BEARER_TOKEN) {
    return NextResponse.json({ type: 'service_unavailable', title: 'Cron authorization is not configured', status: 503 }, { status: 503 });
  }
  if (!isValidCronAuthorization(request.headers.get('authorization'))) {
    return NextResponse.json({ type: 'unauthorized', title: 'Valid cron authorization is required', status: 401 }, { status: 401 });
  }
  return null;
}
