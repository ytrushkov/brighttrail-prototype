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
    const detailedParam = searchParams.get('detailed'); // 'true' or null

    if (!locationIdParam || !serviceIdParam || !startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
    }

    const locationId = Number(locationIdParam);
    const serviceId = Number(serviceIdParam);
    const isDetailed = detailedParam === 'true';

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

      // Step B: Have availability at location
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
    const start = new Date(startDateParam + 'T00:00:00');
    const end = new Date(endDateParam + 'T23:59:59');

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
    const shifts = await db
        .select()
        .from(availabilities)
        .where(
            and(
                inArray(availabilities.userId, therapistIds),
                eq(availabilities.locationId, locationId)
            )
        );

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
    // Using ISO strings to enforce "Floating" time semantics (Clinic Time)
    const result: Record<string, any[]> = {};

    for (const dateObj of datesToCheck) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const dayOfWeek = dateObj.getDay(); // 0-6

        // Map ISO Time String -> Set of therapist IDs
        const slotsMap = new Map<string, Set<number>>();
        const simpleSlots = new Set<string>();

        for (const therapistId of therapistIds) {
            const therapistShifts = shifts.filter(
                s => s.userId === therapistId && s.dayOfWeek === dayOfWeek
            );

            const therapistAppts = existingAppointments.filter(a => {
                if (a.therapistId !== therapistId) return false;
                const apptDate = new Date(a.datetime * 1000);
                const aYear = apptDate.getFullYear();
                const aMonth = String(apptDate.getMonth() + 1).padStart(2, '0');
                const aDay = String(apptDate.getDate()).padStart(2, '0');
                return `${aYear}-${aMonth}-${aDay}` === dateString;
            });

            for (const shift of therapistShifts) {
                for (let time = shift.startTime; time + serviceDurationMins <= shift.endTime; time += 30) {
                    // Construct UTC date corresponding to this clinic time
                    // year, monthIndex, day, hours, minutes
                    const slotDateUTC = new Date(Date.UTC(year, Number(month) - 1, Number(day), Math.floor(time / 60), time % 60, 0, 0));

                    // Timestamp (UTC)
                    const slotTimestamp = Math.floor(slotDateUTC.getTime() / 1000);

                    // ISO String (e.g., "2025-11-24T09:00:00.000Z")
                    // We will return this. The 'Z' indicates UTC.
                    const isoString = slotDateUTC.toISOString();

                    const slotEndTimestamp = slotTimestamp + (serviceDurationMins * 60);

                    const isBlocked = therapistAppts.some(appt => {
                        const apptStart = appt.datetime;
                        const apptEnd = appt.datetime + (appt.durationMins * 60);
                        return (apptStart < slotEndTimestamp && apptEnd > slotTimestamp);
                    });

                    if (!isBlocked) {
                        if (isDetailed) {
                            if (!slotsMap.has(isoString)) {
                                slotsMap.set(isoString, new Set());
                            }
                            slotsMap.get(isoString)!.add(therapistId);
                        } else {
                            simpleSlots.add(isoString);
                        }
                    }
                }
            }
        }

        if (isDetailed) {
            const sortedTimes = Array.from(slotsMap.keys()).sort();
            result[dateString] = sortedTimes.map(time => ({
                time, // ISO String
                therapistIds: Array.from(slotsMap.get(time)!)
            }));
        } else {
            result[dateString] = Array.from(simpleSlots).sort();
        }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate slots' }, { status: 500 });
  }
}
