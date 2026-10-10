import { NextRequest, NextResponse } from 'next/server';
import { createSession, staffLogin } from '@/lib/auth';
import { getClientIp } from '@/lib/client-ip';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { type: 'validation_error', title: 'Email and password required', status: 400 },
        { status: 400 }
      );
    }

    const result = await staffLogin(email, password, getClientIp(req.headers));
    if (!result.success || !result.session) {
      return NextResponse.json(
        { type: 'unauthorized', title: result.message || 'Staff login failed', status: 401 },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, session: result.session });
    await createSession(response, result.session);
    return response;
  } catch (err: unknown) {
    console.error(JSON.stringify({ level: 'ERROR', event: 'staff_login_failed', requestId: req.headers.get('x-request-id'), errorType: err instanceof Error ? err.name : 'unknown' }));
    return NextResponse.json(
      { type: 'internal_error', title: 'Unable to complete sign-in', status: 500 },
      { status: 500 }
    );
  }
}
