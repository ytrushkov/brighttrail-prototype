import { NextResponse } from 'next/server';
import { db } from '@/db';
import { locations } from '@/db/schema';

export async function GET() {
  try {
    const allLocations = await db.select().from(locations);
    return NextResponse.json(allLocations);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
