import { NextResponse } from 'next/server';
import { db } from '@/db';
import { availabilities } from '@/db/schema';

export async function GET() {
  try {
    const allAvailabilities = await db.select().from(availabilities);
    return NextResponse.json(allAvailabilities);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch availabilities' }, { status: 500 });
  }
}
