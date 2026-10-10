import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.phone || session.role !== 'CITIZEN') return NextResponse.json({ type: 'unauthorized', title: 'Verify the mobile number used on your application first', status: 401 }, { status: 401 });
  const reference = new URL(req.url).searchParams.get('ref')?.trim();
  if (!reference || reference.length < 5 || reference.length > 64) return NextResponse.json({ type: 'validation_error', title: 'Enter an application reference number', status: 400 }, { status: 400 });
  const application = await prisma.applicationRef.findFirst({
    where: { applicationNo: { equals: reference, mode: 'insensitive' }, phone: session.phone },
    select: { id: true, applicationNo: true, serviceName: true, district: true, departmentCode: true, submittedAt: true, expectedBy: true, currentStatus: true, delayDays: true }
  });
  if (!application) return NextResponse.json({ type: 'not_found', title: 'Application not found for this verified mobile number', status: 404 }, { status: 404 });
  return NextResponse.json({ applications: [application], total: 1 }, { headers: { 'Cache-Control': 'private, no-store' } });
}
