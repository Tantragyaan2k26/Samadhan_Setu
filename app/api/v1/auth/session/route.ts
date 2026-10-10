import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, revokeSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getAuthSession(request);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, session });
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  await revokeSession(request, response);
  return response;
}
