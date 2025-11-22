import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { availabilities, appointments, therapistServices, users, services } from '@/db/schema';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationIdParam = searchParams.get('location_id');
    const serviceIdParam = searchParams.get('service_id');
    const startDateParam = searchParams.get('start_date'); // YYYY-MM-DD
    const endDateParam = searchParams.get('end_date');     // YYYY-MM-DD
    const therapistIdParam = searchParams.get('therapist_id');

    if (!locationIdParam || !serviceIdParam || !startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
    }

    const locationId = Number(locationIdParam);
    const serviceId = Number(serviceIdParam);

    // 1. Get Service Duration
    const serviceRecord = await db.select().from(services).where(eq(services.id, serviceId)).get();
    if (!serviceRecord) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    const serviceDurationMins = serviceRecord.durationMins;

    // 2. Identify Candidate Therapists
    let therapistIds: number[] = [];

    if (therapistIdParam) {
      therapistIds = [Number(therapistIdParam)];
    } else {
      // Find all therapists at location certified for service
      // Step A: Certified
      const certified = await db
        .select({ userId: therapistServices.userId })
        .from(therapistServices)
        .where(eq(therapistServices.serviceId, serviceId));

      const certifiedIds = certified.map(c => c.userId);
      if (certifiedIds.length === 0) return NextResponse.json({});

      // Step B: Have availability at location (Optimization: We filter availability later,
      // but filtering candidates here saves processing if they never work there)
       const workingAtLocation = await db
        .select({ userId: availabilities.userId })
        .from(availabilities)
        .where(
            and(
                eq(availabilities.locationId, locationId),
                inArray(availabilities.userId, certifiedIds)
            )
        );
       therapistIds = [...new Set(workingAtLocation.map(w => w.userId))]; // Unique IDs
    }

    if (therapistIds.length === 0) {
        return NextResponse.json({});
    }

    // 3. Define Date Range
    // Use string construction to ensure local date iteration without timezone offsets
    const start = new Date(startDateParam + 'T00:00:00');
    const end = new Date(endDateParam + 'T23:59:59');

    // Helper to iterate dates
    const getDatesInRange = (startDate: Date, endDate: Date) => {
        const dates = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };
    const datesToCheck = getDatesInRange(start, end);

    // 4. Fetch Data
    // Fetch all shifts for these therapists at this location
    const shifts = await db
        .select()
        .from(availabilities)
        .where(
            and(
                inArray(availabilities.userId, therapistIds),
                eq(availabilities.locationId, locationId)
            )
        );

    // Fetch all appointments for these therapists in the date range
    // Timestamp range
    const minTimestamp = Math.floor(start.getTime() / 1000);
    const maxTimestamp = Math.floor(end.getTime() / 1000);

    const existingAppointments = await db
        .select()
        .from(appointments)
        .where(
            and(
                inArray(appointments.therapistId, therapistIds),
                gte(appointments.datetime, minTimestamp),
                lte(appointments.datetime, maxTimestamp)
            )
        );

    // 5. Generate Slots
    const result: Record<string, number[]> = {};

    for (const dateObj of datesToCheck) {
        // Construct key manually to avoid UTC shifts
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const dayOfWeek = dateObj.getDay(); // 0-6
        const validSlots = new Set<number>(); // Use Set to avoid duplicates from multiple therapists

        for (const therapistId of therapistIds) {
            // Get shifts for this therapist on this day
            const therapistShifts = shifts.filter(
                s => s.userId === therapistId && s.dayOfWeek === dayOfWeek
            );

            // Get appointments for this therapist on this date
            // Filter by day logic (appointment datetime falls within this calendar date)
            const therapistAppts = existingAppointments.filter(a => {
                if (a.therapistId !== therapistId) return false;
                const apptDate = new Date(a.datetime * 1000);
                // Match against the local date string we constructed
                const aYear = apptDate.getFullYear();
                const aMonth = String(apptDate.getMonth() + 1).padStart(2, '0');
                const aDay = String(apptDate.getDate()).padStart(2, '0');
                return `${aYear}-${aMonth}-${aDay}` === dateString;
            });

            for (const shift of therapistShifts) {
                // Generate 30 min intervals
                // shift.startTime and shift.endTime are minutes from midnight
                // e.g. 540 (9:00) to 1020 (17:00)

                for (let time = shift.startTime; time + serviceDurationMins <= shift.endTime; time += 30) {
                    // Convert 'time' (mins from midnight) to Unix Timestamp for this specific date
                    const slotDate = new Date(dateObj);
                    slotDate.setHours(Math.floor(time / 60), time % 60, 0, 0);
                    const slotTimestamp = Math.floor(slotDate.getTime() / 1000);
                    const slotEndTimestamp = slotTimestamp + (serviceDurationMins * 60);

                    // Check collisions
                    const isBlocked = therapistAppts.some(appt => {
                        const apptStart = appt.datetime;
                        const apptEnd = appt.datetime + (appt.durationMins * 60);
                        // Overlap: (StartA < EndB) and (EndA > StartB)
                        return (apptStart < slotEndTimestamp && apptEnd > slotTimestamp);
                    });

                    if (!isBlocked) {
                        validSlots.add(slotTimestamp);
                    }
                }
            }
        }

        result[dateString] = Array.from(validSlots).sort((a, b) => a - b);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate slots' }, { status: 500 });
  }
}
