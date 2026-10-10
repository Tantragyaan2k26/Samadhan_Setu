import { NextRequest, NextResponse } from 'next/server';
import { checkAuthRateLimit, requestLoginOtp } from '@/lib/auth';
import { isLocalOtpDeliveryEnabled } from '@/lib/notifications/providers';
import { getClientIp } from '@/lib/client-ip';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channel = body.channel === 'email' ? 'email' : 'phone';
    const destination = channel === 'email' ? body.email : body.phone;
    if (!destination) {
      return NextResponse.json(
        { type: 'validation_error', title: channel === 'email' ? 'Email is required' : 'Phone number is required', status: 400 },
        { status: 400 }
      );
    }

    const ip = getClientIp(req.headers);
    const [perIp, perDestination] = await Promise.all([
      checkAuthRateLimit(`otp:ip:${ip}`, 10, 60 * 60),
      checkAuthRateLimit(`otp:destination:${channel}:${String(destination).trim().toLowerCase()}`, 3, 10 * 60)
    ]);
    if (!perIp.allowed || !perDestination.allowed) return NextResponse.json(
      { type: 'rate_limited', title: 'Too many code requests. Wait before requesting another code.', status: 429 },
      { status: 429, headers: { 'Retry-After': String(Math.max(perIp.resetInSeconds, perDestination.resetInSeconds)) } }
    );

    const result = await requestLoginOtp(destination, channel);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      ...(isLocalOtpDeliveryEnabled() ? { developmentCode: result.localCode } : {})
    });
  } catch (err: unknown) {
    const isClientError = err instanceof Error && err.message.startsWith('Enter a valid');
    return NextResponse.json(
      { type: isClientError ? 'validation_error' : 'delivery_error', title: isClientError ? err.message : 'Could not send verification code. Try again later.', status: isClientError ? 400 : 503 },
      { status: isClientError ? 400 : 503 }
    );
  }
}
