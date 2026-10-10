import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { classifyComplaint } from '@/lib/ai-classifier';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkSharedRateLimit } from '@/lib/rate-limiter';

const inputSchema = z.object({
  text: z.string().trim().min(8).max(10000),
  districtId: z.string().trim().min(1).max(100).optional()
}).strict();

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ type: 'unauthorized', title: 'Sign in to use complaint suggestions', status: 401 }, { status: 401 });
  if (session.role !== 'CITIZEN') return NextResponse.json({ type: 'forbidden', title: 'Only citizen accounts can request filing suggestions', status: 403 }, { status: 403 });
  const limited = await checkSharedRateLimit(`ai-suggest:${session.userId}`, { limit: 20, windowMs: 60_000 });
  if (!limited.allowed) return NextResponse.json({ type: 'rate_limited', title: 'Too many suggestions. Try again shortly.', status: 429 });
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ type: 'validation_error', title: parsed.error.issues[0]?.message || 'Invalid suggestion input', status: 400 }, { status: 400 });

  try {
    if (parsed.data.districtId && !await prisma.district.findUnique({ where: { id: parsed.data.districtId }, select: { id: true } })) {
      return NextResponse.json({ type: 'validation_error', title: 'Choose a valid district', status: 400 }, { status: 400 });
    }
    const categories = await prisma.category.findMany({ include: { department: { select: { code: true } } } });
    const suggestion = await classifyComplaint(parsed.data.text, categories);
    let duplicateMatch = null;
    if (parsed.data.districtId && suggestion.categoryId) {
      const match = await prisma.complaint.findFirst({
        where: {
          districtId: parsed.data.districtId,
          categoryId: suggestion.categoryId,
          status: { not: 'CLOSED' },
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
        },
        select: { ticketNo: true, title: true, supportersCount: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      });
      if (match) duplicateMatch = match;
    }
    return NextResponse.json({ success: true, suggestion, duplicateMatch });
  } catch {
    return NextResponse.json({ type: 'internal_error', title: 'AI processing error', status: 500 }, { status: 500 });
  }
}
