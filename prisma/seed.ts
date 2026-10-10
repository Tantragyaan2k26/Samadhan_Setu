import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { DISTRICTS, DEPARTMENTS, CATEGORIES } from '../lib/taxonomy';
import { store } from './seed-data';
import { developmentSeedOfficers } from '../lib/seed-officers';

const prisma = new PrismaClient();
const phoneE164 = (value: string) => `+91${value.replace(/\D/g, '').slice(-10)}`;

async function main() {
  for (const district of DISTRICTS) await prisma.district.upsert({ where: { id: district.id }, update: district, create: district });
  for (const department of DEPARTMENTS) await prisma.department.upsert({
    where: { id: department.id },
    update: department,
    create: { ...department, nameEn: department.nameEn, nameHi: department.nameHi }
  });
  for (const category of CATEGORIES) await prisma.category.upsert({
    where: { id: category.id },
    update: { ...category, keywords: JSON.stringify(category.keywords) },
    create: { ...category, keywords: JSON.stringify(category.keywords) }
  });

  const isDevelopment = process.env.NODE_ENV === 'development';
  const demoOfficers = isDevelopment ? developmentSeedOfficers(store.officers) : [];
  let demoPassword = process.env.DEMO_OFFICER_PASSWORD;
  if (demoOfficers.length && !demoPassword) {
    demoPassword = randomBytes(24).toString('base64url');
    console.info(`Generated one-time demo officer password: ${demoPassword}`);
  }
  const demoPasswordHash = demoOfficers.length ? await hash(demoPassword!, 12) : undefined;
  for (const officer of demoOfficers) {
    const user = await prisma.user.upsert({
      where: { email: officer.email.toLowerCase() },
      update: { name: officer.name, role: officer.role, isActive: true },
      create: { email: officer.email.toLowerCase(), name: officer.name, phone: phoneE164(officer.phone), role: officer.role, passwordHash: demoPasswordHash! }
    });
    await prisma.officerProfile.upsert({
      where: { userId: user.id },
      update: { departmentId: officer.departmentId, districtId: officer.districtId || null, level: officer.level, designation: officer.designation, isActive: true },
      create: { id: officer.id, userId: user.id, departmentId: officer.departmentId, districtId: officer.districtId, level: officer.level, designation: officer.designation }
    });
  }

  if (process.env.NODE_ENV === 'production') {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password || password.length < 14) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 14 characters before seeding production.');
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: process.env.BOOTSTRAP_ADMIN_NAME || 'System administrator', role: 'SUPER_ADMIN', passwordHash: await hash(password, 12), emailVerifiedAt: new Date() }
    });
  }

  for (const complaint of isDevelopment ? store.complaints : []) {
    const phone = phoneE164(complaint.citizenPhone);
    const citizen = await prisma.user.upsert({ where: { phone }, update: {}, create: { phone, name: complaint.citizenName, role: 'CITIZEN', phoneVerifiedAt: new Date() } });
    await prisma.complaint.upsert({
      where: { ticketNo: complaint.ticketNo },
      update: {},
      create: {
        id: complaint.id,
        ticketNo: complaint.ticketNo,
        citizenId: citizen.id,
        citizenPhone: phone,
        citizenName: complaint.citizenName,
        title: complaint.title,
        description: complaint.description,
        language: complaint.language,
        departmentId: complaint.departmentId,
        categoryId: complaint.categoryId,
        districtId: complaint.districtId,
        villageOrTehsil: complaint.villageOrTehsil,
        status: complaint.status,
        urgency: complaint.urgency,
        escalationLevel: complaint.escalationLevel,
        assignedOfficerId: complaint.assignedOfficerId,
        assignedOfficerName: complaint.assignedOfficerName,
        slaDueAt: complaint.slaDueAt ? new Date(complaint.slaDueAt) : null,
        remindersCount: complaint.remindersCount,
        lastRemindedAt: complaint.lastRemindedAt ? new Date(complaint.lastRemindedAt) : null,
        aiSummaryEn: complaint.aiSummaryEn,
        aiSummaryHi: complaint.aiSummaryHi,
        aiConfidence: complaint.aiConfidence,
        supportersCount: complaint.supportersCount,
        sourceChannel: complaint.sourceChannel,
        bridgeAppRef: complaint.bridgeAppRef,
        createdAt: new Date(complaint.createdAt),
        updatedAt: new Date(complaint.updatedAt),
        events: { create: complaint.events.map(event => ({
          actorType: event.actorType, actorName: event.actorName, fromStatus: event.fromStatus,
          toStatus: event.toStatus, reason: event.reason, notes: event.notes, createdAt: new Date(event.createdAt)
        })) },
        attachments: { create: complaint.attachments.map(attachment => ({
          url: attachment.url, mimeType: attachment.mimeType, fileName: attachment.fileName,
          fileSize: attachment.fileSize, createdAt: new Date(attachment.createdAt)
        })) }
      }
    });
  }

  for (const application of isDevelopment ? store.apuniApplications : []) await prisma.applicationRef.upsert({
    where: { applicationNo: application.applicationNo },
    update: {},
    create: {
      applicationNo: application.applicationNo, serviceName: application.serviceName,
      applicantName: application.applicantName, phone: phoneE164(application.phone), district: application.district,
      departmentCode: application.departmentCode, submittedAt: new Date(application.submittedAt),
      expectedBy: new Date(application.expectedBy), currentStatus: application.currentStatus, delayDays: application.delayDays
    }
  });
  console.info('Database seed completed. Demo users are only created in development.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
