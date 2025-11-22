import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, therapistServices, availabilities } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const serviceId = searchParams.get('service_id');
    const locationId = searchParams.get('location_id');

    // Start with base query: Users with role 'therapist'
    let queryConditions = [eq(users.role, 'therapist')];

    // 1. Filter by Service Certification
    if (serviceId) {
      const certifiedTherapistIds = await db
        .select({ userId: therapistServices.userId })
        .from(therapistServices)
        .where(eq(therapistServices.serviceId, Number(serviceId)));

      if (certifiedTherapistIds.length === 0) {
        return NextResponse.json([]); // No therapists found for this service
      }

      const ids = certifiedTherapistIds.map(t => t.userId);
      queryConditions.push(inArray(users.id, ids));
    }

    // 2. Filter by Location Availability
    if (locationId) {
        const availableTherapistIds = await db
            .select({ userId: availabilities.userId })
            .from(availabilities)
            .where(eq(availabilities.locationId, Number(locationId)));

        if (availableTherapistIds.length === 0) {
             return NextResponse.json([]); // No therapists found for this location
        }

        const ids = availableTherapistIds.map(t => t.userId);
        queryConditions.push(inArray(users.id, ids));
    }

    const therapists = await db
      .select()
      .from(users)
      .where(and(...queryConditions));

    return NextResponse.json(therapists);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch therapists' }, { status: 500 });
  }
}
