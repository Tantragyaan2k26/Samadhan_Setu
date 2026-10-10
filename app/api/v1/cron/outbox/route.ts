import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/cron-auth';
import { processOutbox } from '@/lib/outbox-worker';

export async function POST(request: NextRequest) {
  const denied = requireCronAuthorization(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await processOutbox());
  } catch (error) {
    console.error(JSON.stringify({ level: 'ERROR', message: 'outbox_processing_failed', error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not process notification outbox', status: 500 }, { status: 500 });
  }
}
