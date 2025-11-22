import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { appointments, availabilities } from '@/db/schema';
import { eq, and, gte, lt, lte } from 'drizzle-orm';

export async function GET() {
  try {
    const allAppointments = await db.query.appointments.findMany({
      with: {
        patient: true,
        therapist: true,
        service: true,
        location: true,
      },
    });
    return NextResponse.json(allAppointments);
  } catch (error) {
    console.error('GET /api/appointments Error:', error);
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { datetime, duration_mins, patient_id, therapist_id, service_id, location_id } = body;

    if (!datetime || !duration_mins || !patient_id || !therapist_id || !service_id || !location_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const appointmentStart = Number(datetime); // Unix timestamp
    const appointmentEnd = appointmentStart + (Number(duration_mins) * 60);

    // Calculate Day of Week and Minutes from Midnight for Availability Check
    const date = new Date(appointmentStart * 1000);
    const dayOfWeek = date.getDay(); // 0-6
    const startMinutes = date.getHours() * 60 + date.getMinutes();
    const endMinutes = startMinutes + Number(duration_mins);

    // --- Transaction Check 1: Availability (Shift) Exists ---
    // Therapist must have a shift at this location, on this day, covering the full duration
    const validShift = await db.select().from(availabilities).where(
      and(
        eq(availabilities.userId, therapist_id),
        eq(availabilities.locationId, location_id), // Fixed variable name
        eq(availabilities.dayOfWeek, dayOfWeek),
        lte(availabilities.startTime, startMinutes),
        gte(availabilities.endTime, endMinutes)
      )
    ).limit(1);

    if (validShift.length === 0) {
      return NextResponse.json({ error: 'Therapist is not available at this time/location' }, { status: 400 });
    }

    // --- Transaction Check 2: Collision Detection ---
    const overlappingAppointment = await db.select().from(appointments).where(
      and(
        eq(appointments.therapistId, therapist_id),
        lt(appointments.datetime, appointmentEnd),
        gte(appointments.datetime, appointmentStart - (24 * 60 * 60))
      )
    );

    const hasCollision = overlappingAppointment.some(appt => {
        const apptEnd = appt.datetime + (appt.durationMins * 60);
        return (appt.datetime < appointmentEnd && apptEnd > appointmentStart);
    });

    if (hasCollision) {
      return NextResponse.json({ error: 'Therapist is already booked for this time slot' }, { status: 409 });
    }

    // --- Action: Insert Appointment ---
    const newAppointment = await db.insert(appointments).values({
      datetime: appointmentStart,
      durationMins: Number(duration_mins),
      status: 'scheduled',
      patientId: patient_id,
      therapistId: therapist_id,
      serviceId: service_id,
      locationId: location_id, // Fixed variable name
    }).returning();

    return NextResponse.json(newAppointment[0], { status: 201 });

  } catch (error) {
    console.error('POST /api/appointments Exception:', error);
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 });
  }
}
