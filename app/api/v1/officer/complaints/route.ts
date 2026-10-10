import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maskForRole } from '@/lib/pii';

const staffRoles = ['OFFICER', 'DEPT_ADMIN', 'CMO_VIEWER', 'AUDITOR', 'SUPER_ADMIN'];

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session || !staffRoles.includes(session.role)) return NextResponse.json({ type: 'unauthorized', title: 'Staff sign-in required', status: 401 }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const where: Record<string, unknown> = {};
  if (searchParams.has('status')) where.status = searchParams.get('status');
  if (searchParams.has('level')) where.escalationLevel = Number(searchParams.get('level'));
  if (session.role === 'OFFICER') where.assignedOfficer = { userId: session.userId };
  if (session.role === 'DEPT_ADMIN' || session.role === 'OFFICER') {
    if (session.departmentId) where.departmentId = session.departmentId;
    if (session.districtId) where.districtId = session.districtId;
  }
  const complaints = await prisma.complaint.findMany({
    where,
    include: { events: { orderBy: { createdAt: 'asc' } }, attachments: true, feedback: true, department: true, category: true, district: true, assignedOfficer: { include: { user: true } } },
    orderBy: [{ urgency: 'desc' }, { slaDueAt: 'asc' }, { createdAt: 'desc' }], take: 100
  });
  return NextResponse.json({ complaints: complaints.map(complaint => maskForRole(complaint, session)), total: complaints.length });
}
