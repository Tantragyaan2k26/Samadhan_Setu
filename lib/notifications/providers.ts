import nodemailer from 'nodemailer';
import twilio from 'twilio';

export type OtpChannel = 'phone' | 'email';

export function isLocalOtpDeliveryEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.OTP_LOCAL_DELIVERY === 'true';
}

export async function sendOtp(destination: string, channel: OtpChannel, code?: string) {
  if (channel === 'phone') {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
      if (isLocalOtpDeliveryEnabled()) return { provider: 'local', reference: undefined };
      throw new Error('Phone verification provider is not configured');
    }
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const result = await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: destination, channel: 'sms' });
    return { provider: 'twilio', reference: result.sid };
  }

  if (!code) throw new Error('An email verification code is required');
  const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    if (isLocalOtpDeliveryEnabled()) return { provider: 'local', reference: undefined };
    throw new Error('Email delivery provider is not configured');
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
  const result = await transporter.sendMail({
    from: `Samadhan Setu <${SMTP_FROM}>`,
    to: destination,
    subject: 'Your Samadhan Setu verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`
  });
  return { provider: 'smtp', reference: result.messageId };
}

export async function sendSms(destination: string, body: string) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_MESSAGING_SERVICE_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error('Twilio messaging credentials are not configured');
  if (!TWILIO_PHONE_NUMBER && !TWILIO_MESSAGING_SERVICE_SID) throw new Error('Configure a Twilio phone number or messaging service for SMS delivery');
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const message = await client.messages.create({
    to: destination,
    body,
    ...(TWILIO_MESSAGING_SERVICE_SID ? { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID } : { from: TWILIO_PHONE_NUMBER })
  });
  return { provider: 'twilio' as const, reference: message.sid };
}

export async function verifyPhoneOtp(destination: string, code: string) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) return false;
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const result = await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: destination, code });
  return result.status === 'approved';
}
