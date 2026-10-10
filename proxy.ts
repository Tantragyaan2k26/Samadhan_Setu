import { NextResponse, NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { checkSharedRateLimit } from './lib/rate-limiter';
import { randomBytes } from 'node:crypto';
import { getClientIp } from './lib/client-ip';

function contentSecurityPolicy(nonce: string) {
  let sentry = '';
  for (const dsn of [process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_DSN]) {
    if (!dsn) continue;
    try { sentry = ` ${new URL(dsn).origin}`; break; } catch { /* invalid optional DSN is ignored here */ }
  }
  return `default-src 'self'; img-src 'self' data: https://images.unsplash.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; connect-src 'self'${sentry}; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests`;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = randomUUID();
  const nonce = randomBytes(16).toString('base64');
  const csp = contentSecurityPolicy(nonce);
  const securityHeaders = { 'x-request-id': requestId, 'content-security-policy': csp };

  if (pathname.startsWith('/api/v1/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');
    let crossOrigin = !origin && fetchSite === 'cross-site';
    if (origin) {
      try { crossOrigin = new URL(origin).host !== request.nextUrl.host; }
      catch { crossOrigin = true; }
    }
    if (crossOrigin) {
      return NextResponse.json({ type: 'forbidden', title: 'Cross-origin request rejected', status: 403, requestId }, { status: 403, headers: securityHeaders });
    }
  }

  // Rate limiting for API requests
  // Health checks must report process/dependency state directly, including when Redis is down.
  if (pathname.startsWith('/api/v1/') && !['/api/v1/health/live', '/api/v1/health/ready'].includes(pathname)) {
    const ip = getClientIp(request.headers);
    const key = `samadhan:rate:${ip}:${pathname}`;
    let allowed = true;
    let remaining = 119;
    let resetInMs = 60_000;
    try {
      // Next.js 16 Proxy uses Node.js by default, so the shared ioredis backend is supported here.
      const result = await checkSharedRateLimit(key, { limit: 120, windowMs: 60 * 1000 });
      allowed = result.allowed;
      remaining = result.remaining;
      resetInMs = result.resetInMs;
    } catch {
      return NextResponse.json({ type: 'service_unavailable', title: 'Request protection is temporarily unavailable', status: 503, requestId }, { status: 503, headers: securityHeaders });
    }

    if (!allowed) {
      return NextResponse.json(
        {
          type: 'rate_limited',
          title: 'Too many requests. Please slow down.',
          status: 429,
          requestId
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '120',
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': resetInMs.toString(),
            ...securityHeaders
          }
        }
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
