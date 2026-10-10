import { NextRequest, NextResponse } from 'next/server';
import { verifyLoginOtp, createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channel = body.channel === 'email' ? 'email' : 'phone';
    const destination = channel === 'email' ? body.email : body.phone;
    const { code } = body;
    if (!destination || !code) {
      return NextResponse.json(
        { type: 'validation_error', title: 'Phone and code are required', status: 400 },
        { status: 400 }
      );
    }

    const result = await verifyLoginOtp(destination, channel, code);
    if (!result.success || !result.session) {
      return NextResponse.json(
        { type: 'unauthorized', title: result.message || 'OTP verification failed', status: 401 },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, session: result.session });
    await createSession(response, result.session);
    return response;
  } catch (err: unknown) {
    console.error(JSON.stringify({ level: 'ERROR', event: 'otp_verification_failed', requestId: req.headers.get('x-request-id'), errorType: err instanceof Error ? err.name : 'unknown' }));
    return NextResponse.json(
      { type: 'internal_error', title: 'Unable to verify the code', status: 500 },
      { status: 500 }
    );
  }
}
