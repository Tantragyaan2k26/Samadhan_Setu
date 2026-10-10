import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateSlaDeadlines } from '@/lib/sla-engine';
import { writeAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(req);
  if (!session?.phone || session.role !== 'CITIZEN') return NextResponse.json({ type: 'unauthorized', title: 'Verify the mobile number used on your application first', status: 401 }, { status: 401 });
  const { id } = await params;
  const application = await prisma.applicationRef.findFirst({ where: { OR: [{ id }, { applicationNo: { equals: id, mode: 'insensitive' } }], phone: session.phone } });
  if (!application) return NextResponse.json({ type: 'not_found', title: 'Application not found for this verified mobile number', status: 404 }, { status: 404 });
  if (application.currentStatus !== 'DELAYED' || application.delayDays <= 0) return NextResponse.json({ type: 'conflict', title: 'Only delayed applications can be referred', status: 409 }, { status: 409 });

  const existing = await prisma.complaint.findUnique({ where: { bridgeAppRef: application.applicationNo }, include: { events: true, attachments: true } });
  if (existing) return NextResponse.json({ success: true, alreadyEscalated: true, ticketNo: existing.ticketNo, complaint: existing });
  const department = await prisma.department.findUnique({ where: { code: application.departmentCode } });
  const district = await prisma.district.findFirst({ where: { nameEn: { equals: application.district, mode: 'insensitive' } } });
  const category = await prisma.category.findUnique({ where: { id: 'cat-land-mutation' } });
  if (!department || !district || !category) return NextResponse.json({ type: 'service_unavailable', title: 'Application routing data is incomplete', status: 503 }, { status: 503 });
  const officer = await prisma.officerProfile.findFirst({ where: { departmentId: department.id, districtId: district.id, level: 1, isActive: true }, include: { user: true } });
  const ticketNo = `UK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
  const now = new Date();
  const sla = calculateSlaDeadlines(category.id, 'HIGH', 1);
  try {
    const complaint = await prisma.$transaction(async tx => {
      const created = await tx.complaint.create({
        data: {
          ticketNo, citizenId: session.userId, citizenPhone: session.phone!, citizenName: session.name || application.applicantName,
          title: `Delayed certificate application: ${application.applicationNo}`,
          description: `Application ${application.applicationNo} for ${application.serviceName} is ${application.delayDays} days past its expected completion date.`,
          submissionType: 'GRIEVANCE', language: 'en', departmentId: department.id, categoryId: category.id, districtId: district.id,
          status: officer ? 'ASSIGNED' : 'SUBMITTED', urgency: 'HIGH', escalationLevel: 1, assignedOfficerId: officer?.id,
          assignedOfficerName: officer?.designation, slaDueAt: sla.resolutionDueAt, sourceChannel: 'BRIDGE', bridgeAppRef: application.applicationNo,
          createdAt: now, updatedAt: now,
          events: { create: [
            { actorType: 'CITIZEN', actorName: session.name || 'Citizen', toStatus: 'SUBMITTED', reason: 'Citizen requested a reference for a delayed Apuni Sarkar application' },
            ...(officer ? [{ actorType: 'SYSTEM', actorName: 'Samadhan Setu', fromStatus: 'SUBMITTED', toStatus: 'ASSIGNED', reason: 'Routed to the Level 1 department officer' }] : [])
          ] }
        }, include: { events: { orderBy: { createdAt: 'asc' } }, attachments: true }
      });
      await tx.outboxEvent.create({ data: { eventType: 'BRIDGE_APPLICATION_REFERRED', payload: JSON.stringify({ ticketNo, phone: session.phone, applicationNo: application.applicationNo, applicantName: session.name || application.applicantName }) } });
      if (officer) await writeAudit(tx, { action: 'COMPLAINT_ASSIGNED', entityType: 'Complaint', entityId: created.id, actorId: session.userId, actorRole: 'CITIZEN', ipAddress: getClientIp(req.headers), details: { officerId: officer.id, source: 'bridge-initial-routing' } });
      return created;
    });
    return NextResponse.json({ success: true, ticketNo, complaint, message: 'A follow-up submission was created.' }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      const current = await prisma.complaint.findUnique({ where: { bridgeAppRef: application.applicationNo } });
      if (current) return NextResponse.json({ success: true, alreadyEscalated: true, ticketNo: current.ticketNo, complaint: current });
    }
    console.error(JSON.stringify({ level: 'ERROR', message: 'bridge_referral_failed', requestId: req.headers.get('x-request-id') }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not create a follow-up submission', status: 500 }, { status: 500 });
  }
}
