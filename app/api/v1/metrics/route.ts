import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const configured = process.env.METRICS_BEARER_TOKEN;
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!configured || Buffer.byteLength(configured) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))) {
    return new NextResponse('unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  }
  const [total, closed, escalated, inProgress] = await prisma.$transaction([
    prisma.complaint.count(),
    prisma.complaint.count({ where: { status: 'CLOSED' } }),
    prisma.complaint.count({ where: { escalationLevel: { gt: 1 } } }),
    prisma.complaint.count({ where: { status: 'IN_PROGRESS' } })
  ]);
  const memory = process.memoryUsage();
  const metrics = [
    '# HELP samadhan_complaints_total Total submissions', '# TYPE samadhan_complaints_total gauge', `samadhan_complaints_total ${total}`,
    '# HELP samadhan_complaints_closed_total Closed submissions', '# TYPE samadhan_complaints_closed_total gauge', `samadhan_complaints_closed_total ${closed}`,
    '# HELP samadhan_complaints_escalated_total Escalated submissions', '# TYPE samadhan_complaints_escalated_total gauge', `samadhan_complaints_escalated_total ${escalated}`,
    '# HELP samadhan_complaints_in_progress_total In progress submissions', '# TYPE samadhan_complaints_in_progress_total gauge', `samadhan_complaints_in_progress_total ${inProgress}`,
    '# HELP process_resident_memory_bytes Process resident memory', '# TYPE process_resident_memory_bytes gauge', `process_resident_memory_bytes ${memory.rss}`,
    '# HELP process_heap_used_bytes Process heap memory used', '# TYPE process_heap_used_bytes gauge', `process_heap_used_bytes ${memory.heapUsed}`
  ].join('\n');
  return new NextResponse(metrics, { status: 200, headers: { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' } });
}
