import { NextResponse } from 'next/server';
import { DISTRICTS, DEPARTMENTS, CATEGORIES } from '@/lib/taxonomy';

export async function GET() {
  return NextResponse.json({
    districts: DISTRICTS,
    departments: DEPARTMENTS,
    categories: CATEGORIES
  });
}
