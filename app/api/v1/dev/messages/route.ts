export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ type: 'not_found', title: 'Not found', status: 404 }, { status: 404 });
  const [messages, total] = await prisma.$transaction([
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.notification.count()
  ]);
  return NextResponse.json({ messages, total });
}
