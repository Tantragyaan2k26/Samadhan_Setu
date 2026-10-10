import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/cron-auth';
import { escalateBreachedComplaints } from '@/lib/sla-escalator';

export async function POST(request: NextRequest) {
  const denied = requireCronAuthorization(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await escalateBreachedComplaints());
  } catch (error) {
    console.error(JSON.stringify({ level: 'ERROR', message: 'sla_escalation_failed', error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not process breached submissions', status: 500 }, { status: 500 });
  }
}
