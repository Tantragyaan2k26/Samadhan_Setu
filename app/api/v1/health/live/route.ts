import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'live',
    timestamp: new Date().toISOString(),
    service: 'samadhan-setu',
    version: process.env.APP_VERSION || 'development'
  }, { headers: { 'Cache-Control': 'no-store' } });
}
