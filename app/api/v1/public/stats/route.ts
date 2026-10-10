import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { DISTRICTS, DEPARTMENTS } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';

const countOf = (row?: { _count?: unknown }) => (row?._count as { _all?: number } | undefined)?._all ?? 0;

export async function GET() {
  const cached = await cache.get<Record<string, unknown>>('public:stats:v1');
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });

  const [total, closed, inProgress, escalated, byDistrictRows, byDepartmentRows, closedCases, feedback] = await prisma.$transaction([
    prisma.complaint.count(),
    prisma.complaint.count({ where: { status: 'CLOSED' } }),
    prisma.complaint.count({ where: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED_PENDING', 'REOPENED'] } } }),
    prisma.complaint.count({ where: { OR: [{ escalationLevel: { gt: 1 } }, { status: 'ESCALATED' }] } }),
    prisma.complaint.groupBy({ by: ['districtId'], _count: { _all: true }, orderBy: { districtId: 'asc' } }),
    prisma.complaint.groupBy({ by: ['departmentId'], _count: { _all: true }, orderBy: { departmentId: 'asc' } }),
    prisma.complaint.findMany({ where: { status: 'CLOSED' }, select: { createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 2000 }),
    prisma.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } })
  ]);
  const avgResolutionDays = closedCases.length ? Number((closedCases.reduce((sum, item) => sum + (item.updatedAt.getTime() - item.createdAt.getTime()) / 86_400_000, 0) / closedCases.length).toFixed(1)) : 0;
  const byDistrict = DISTRICTS.map(district => ({ districtId: district.id, nameEn: district.nameEn, nameHi: district.nameHi, count: countOf(byDistrictRows.find(row => row.districtId === district.id)) }));
  const byDepartment = DEPARTMENTS.map(department => ({ departmentId: department.id, nameEn: department.nameEn, nameHi: department.nameHi, count: countOf(byDepartmentRows.find(row => row.departmentId === department.id)) }));
  const response = {
    metrics: {
      totalGrievances: total,
      liveGrievances: total,
      resolvedCount: closed,
      pendingCount: Math.max(0, total - closed),
      resolutionRatePercent: total ? Math.round((closed / total) * 100) : 0,
      avgResolutionDays,
      inProgressCount: inProgress,
      escalatedCount: escalated,
      citizenSatisfactionScore: feedback._count._all ? Number(feedback._avg.rating?.toFixed(1)) : null
    },
    byDistrict,
    byDepartment,
    lastRefreshedAt: new Date().toISOString()
  };
  await cache.set('public:stats:v1', response, 60);
  return NextResponse.json(response, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
