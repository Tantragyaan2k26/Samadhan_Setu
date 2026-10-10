import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { sendOtp, verifyPhoneOtp, OtpChannel } from './notifications/providers';
import { env } from './env';
import { getRedis } from './redis';
import { Role } from './types';
import { writeAudit } from './audit';

export interface AuthSession {
  userId: string;
  phone?: string;
  email?: string;
  name?: string;
  role: Role;
  officerLevel?: number;
  departmentId?: string;
  districtId?: string;
}

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const sessionCookie = env.SESSION_COOKIE_NAME;
const sha256 = (value: string) => createHmac('sha256', env.AUTH_SESSION_SECRET || 'development-only-session-pepper').update(value).digest('hex');
const localLimits = new Map<string, { count: number; expiresAt: number }>();

export async function checkAuthRateLimit(key: string, limit: number, windowSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === 'wait') await redis.connect();
      const results = await redis.multi().incr(key).expire(key, windowSeconds, 'NX').ttl(key).exec();
      if (!results) throw new Error('Redis did not return rate-limit results');
      const count = Number(results[0]?.[1]);
      const ttl = Number(results[2]?.[1]);
      if (!Number.isFinite(count) || !Number.isFinite(ttl)) throw new Error('Redis returned invalid rate-limit results');
      return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetInSeconds: Math.max(0, ttl) };
    } catch (error) {
      if (env.NODE_ENV === 'production') throw error;
    }
  } else if (env.NODE_ENV === 'production') {
    throw new Error('Redis is required for authentication rate limiting');
  }
  const now = Date.now();
  const current = localLimits.get(key);
  if (!current || current.expiresAt <= now) {
    localLimits.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetInSeconds: Math.ceil((current.expiresAt - now) / 1000) };
}

export async function clearAuthRateLimit(key: string) {
  const redis = getRedis();
  if (redis) {
    try { await redis.del(key); return; }
    catch (error) { if (env.NODE_ENV === 'production') throw error; }
  } else if (env.NODE_ENV === 'production') throw new Error('Redis is required for authentication rate limiting');
  localLimits.delete(key);
}

function normalizeDestination(destination: string, channel: OtpChannel) {
  if (channel === 'email') {
    const email = destination.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
    return email;
  }
  const digits = destination.replace(/\D/g, '');
  if (!/^\d{10}$/.test(digits)) throw new Error('Enter a valid 10-digit Indian mobile number');
  return `+91${digits}`;
}

export async function requestLoginOtp(destination: string, channel: OtpChannel) {
  const normalized = normalizeDestination(destination, channel);
  const code = randomInt(100000, 1000000).toString();
  const provider = await sendOtp(normalized, channel, code);
  await prisma.otpChallenge.deleteMany({ where: { destination: normalized, purpose: 'LOGIN', expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  await prisma.otpChallenge.create({
    data: {
      destination: normalized,
      channel: channel === 'phone' ? 'SMS' : 'EMAIL',
      purpose: 'LOGIN',
      codeHash: channel === 'email' || provider.provider === 'local' ? sha256(code) : null,
      providerRef: provider.reference,
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });
  return { success: true, destination: normalized, ...(provider.provider === 'local' ? { localCode: code } : {}) };
}

function safeEqualHash(expected: string, supplied: string) {
  const actual = Buffer.from(sha256(supplied), 'hex');
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export async function verifyLoginOtp(destination: string, channel: OtpChannel, code: string) {
  const normalized = normalizeDestination(destination, channel);
  const challenge = await prisma.otpChallenge.findFirst({
    where: { destination: normalized, purpose: 'LOGIN', channel: channel === 'phone' ? 'SMS' : 'EMAIL', consumedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  if (!challenge || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= MAX_OTP_ATTEMPTS) {
    return { success: false as const, message: 'Invalid or expired verification code' };
  }

  let approved = false;
  if (channel === 'phone' && challenge.providerRef) approved = await verifyPhoneOtp(normalized, code);
  else if (challenge.codeHash) approved = safeEqualHash(challenge.codeHash, code);
  if (!approved) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return { success: false as const, message: 'Invalid or expired verification code' };
  }
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

  const user = channel === 'phone'
    ? await prisma.user.upsert({
        where: { phone: normalized },
        update: { phoneVerifiedAt: new Date() },
        create: { phone: normalized, phoneVerifiedAt: new Date(), role: 'CITIZEN' }
      })
    : await prisma.user.upsert({
        where: { email: normalized },
        update: { emailVerifiedAt: new Date() },
        create: { email: normalized, emailVerifiedAt: new Date(), role: 'CITIZEN' }
      });
  if (!user.isActive) return { success: false as const, message: 'This account is disabled' };
  const session: AuthSession = {
    userId: user.id,
    phone: user.phone || undefined,
    email: user.email || undefined,
    name: user.name || undefined,
    role: user.role as Role
  };
  return { success: true as const, session };
}

// Valid bcrypt cost-12 hash generated from a random throwaway input; it never matches a real account password.
const dummyPasswordHash = '$2b$12$6tsQgu77awkBb.81QNdp8eI.h0dRtWZFj5xYYoxKFjTs.YQJ/aEni';
const staffFailureMessage = 'Invalid email or password';

export async function staffLogin(email: string, password: string, ipAddress = 'unknown') {
  const normalizedEmail = email.trim().toLowerCase();
  const emailId = createHmac('sha256', env.AUTH_SESSION_SECRET || 'local-rate-limit-pepper').update(normalizedEmail).digest('hex');
  const ipKey = `staff-login:ip:${ipAddress}`;
  const emailKey = `staff-login:email:${emailId}`;
  const failKey = `staff-login:failed:${emailId}`;
  const [ipLimit, emailLimit] = await Promise.all([
    checkAuthRateLimit(ipKey, 10, 15 * 60),
    checkAuthRateLimit(emailKey, 5, 15 * 60)
  ]);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, include: { officer: true } });
  const passwordMatch = await compare(password, user?.passwordHash || dummyPasswordHash);
  const authorized = Boolean(user && user.isActive && user.passwordHash && passwordMatch && ['OFFICER', 'DEPT_ADMIN', 'CMO_VIEWER', 'AUDITOR', 'SUPER_ADMIN'].includes(user.role));
  if (!user || !ipLimit.allowed || !emailLimit.allowed || !authorized) {
    // This fixed-window shared counter records failures and ensures the sixth concurrent/future failure is denied.
    await checkAuthRateLimit(failKey, 5, 15 * 60);
    await writeAudit(prisma, {
      action: 'STAFF_LOGIN_FAILURE', entityType: 'User', actorId: user?.id,
      actorRole: user?.role, ipAddress,
      details: { attemptedIdentityHash: emailId, outcome: 'denied' }
    });
    return { success: false as const, message: staffFailureMessage };
  }
  if (!(await checkAuthRateLimit(failKey, 5, 15 * 60)).allowed) {
    await writeAudit(prisma, { action: 'STAFF_LOGIN_FAILURE', entityType: 'User', actorId: user.id, actorRole: user.role, ipAddress, details: { attemptedIdentityHash: emailId, outcome: 'locked' } });
    return { success: false as const, message: staffFailureMessage };
  }
  await Promise.all([clearAuthRateLimit(emailKey), clearAuthRateLimit(failKey)]);
  await writeAudit(prisma, { action: 'STAFF_LOGIN_SUCCESS', entityType: 'User', entityId: user.id, actorId: user.id, actorRole: user.role, ipAddress });
  const session: AuthSession = {
    userId: user.id,
    email: user.email || undefined,
    phone: user.phone || undefined,
    name: user.name || undefined,
    role: user.role as Role,
    officerLevel: user.officer?.level,
    departmentId: user.officer?.departmentId,
    districtId: user.officer?.districtId || undefined
  };
  return { success: true as const, session };
}

export async function createSession(response: NextResponse, session: AuthSession) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.authSession.create({ data: { tokenHash: sha256(token), userId: session.userId, expiresAt } });
  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt
  });
}

export async function getAuthSession(request: NextRequest): Promise<AuthSession | null> {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  const saved = await prisma.authSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { officer: true } } }
  });
  if (!saved || saved.revokedAt || saved.expiresAt.getTime() <= Date.now() || !saved.user.isActive) return null;
  const user = saved.user;
  return {
    userId: user.id,
    phone: user.phone || undefined,
    email: user.email || undefined,
    name: user.name || undefined,
    role: user.role as Role,
    officerLevel: user.officer?.level,
    departmentId: user.officer?.departmentId,
    districtId: user.officer?.districtId || undefined
  };
}

export async function revokeSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (token) await prisma.authSession.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() }
  });
  response.cookies.set(sessionCookie, '', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookie, '', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) });
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}
