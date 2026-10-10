import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/cron-auth';
import { cleanupExpiredData } from '@/lib/cron-cleanup';

export async function POST(request: NextRequest) {
  const denied = requireCronAuthorization(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await cleanupExpiredData());
  } catch (error) {
    console.error(JSON.stringify({ level: 'ERROR', message: 'expired_record_cleanup_failed', error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ type: 'internal_error', title: 'Could not clean expired records', status: 500 }, { status: 500 });
  }
}
