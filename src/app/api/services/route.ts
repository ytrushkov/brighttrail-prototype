import { NextResponse } from 'next/server';
import { db } from '@/db';
import { services } from '@/db/schema';

export async function GET() {
  try {
    const allServices = await db.select().from(services);
    return NextResponse.json(allServices);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}
