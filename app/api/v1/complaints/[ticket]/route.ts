import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { maskForRole } from '@/lib/pii';

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  const session = await getAuthSession(request);
  if (!session) return NextResponse.json({ type: 'unauthorized', title: 'Sign in to view this submission', status: 401 }, { status: 401 });
  const complaint = await prisma.complaint.findFirst({
    where: { OR: [{ ticketNo: { equals: ticket, mode: 'insensitive' } }, { id: ticket }] },
    include: { events: { orderBy: { createdAt: 'asc' } }, attachments: true, feedback: true, department: true, category: true, district: true, assignedOfficer: { include: { user: true } } }
  });
  if (!complaint) return NextResponse.json({ type: 'not_found', title: 'Submission not found', status: 404 }, { status: 404 });

  const citizen = session.role === 'CITIZEN' && complaint.citizenId === session.userId;
  const staff = ['OFFICER', 'DEPT_ADMIN', 'SUPER_ADMIN'].includes(session.role);
  const oversight = ['CMO_VIEWER', 'AUDITOR'].includes(session.role);
  const staffScope = staff && (session.role === 'SUPER_ADMIN' || (
    (!session.departmentId || session.departmentId === complaint.departmentId) &&
    (!session.districtId || session.districtId === complaint.districtId)
  ));
  if (!citizen && !staffScope && !oversight) return NextResponse.json({ type: 'not_found', title: 'Submission not found', status: 404 }, { status: 404 });

  const result = {
    ...complaint,
    assignedOfficerName: complaint.assignedOfficer?.user.name || complaint.assignedOfficerName,
    departmentNameEn: complaint.department?.nameEn,
    departmentNameHi: complaint.department?.nameHi,
    categoryNameEn: complaint.category?.nameEn,
    categoryNameHi: complaint.category?.nameHi,
    districtNameEn: complaint.district?.nameEn,
    districtNameHi: complaint.district?.nameHi
  };
  return NextResponse.json({ complaint: maskForRole(result, session) });
}
