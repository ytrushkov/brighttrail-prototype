import { db } from './index';
import { locations, users, services, availabilities, therapistServices, appointments } from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding database...');

  // 1. Clear existing data (optional, simplified for prototype)
  // Deleting in reverse dependency order
  await db.delete(appointments);
  await db.delete(therapistServices);
  await db.delete(availabilities);
  await db.delete(services);
  await db.delete(users);
  await db.delete(locations);

  // 2. Locations
  const locationData = [
    { name: 'Downtown', address: '123 Main St' },
    { name: 'Westside', address: '456 West Ave' },
  ];
  const insertedLocations = await db.insert(locations).values(locationData).returning();
  const downtown = insertedLocations.find(l => l.name === 'Downtown')!;
  const westside = insertedLocations.find(l => l.name === 'Westside')!;

  console.log('Locations seeded.');

  // 3. Services
  const serviceData = [
    { name: 'Initial Assessment', durationMins: 60, costCents: 15000 },
    { name: 'Massage', durationMins: 45, costCents: 10000 },
    { name: 'Dry Needling', durationMins: 30, costCents: 8000 },
  ];
  const insertedServices = await db.insert(services).values(serviceData).returning();
  const initialAssessment = insertedServices.find(s => s.name === 'Initial Assessment')!;
  const massage = insertedServices.find(s => s.name === 'Massage')!;
  const dryNeedling = insertedServices.find(s => s.name === 'Dry Needling')!;

  console.log('Services seeded.');

  // 4. Therapists
  const therapistData = [
    { name: 'Therapist A', role: 'therapist', specialization: 'General' },
    { name: 'Therapist B', role: 'therapist', specialization: 'Massage' },
    { name: 'Therapist C', role: 'therapist', specialization: 'Sports' },
  ];
  const insertedTherapists = await db.insert(users).values(therapistData).returning();
  const therapistA = insertedTherapists.find(t => t.name === 'Therapist A')!;
  const therapistB = insertedTherapists.find(t => t.name === 'Therapist B')!;
  const therapistC = insertedTherapists.find(t => t.name === 'Therapist C')!;

  console.log('Therapists seeded.');

  // 5. Therapist Services (Certifications)
  // Therapist A: All services
  await db.insert(therapistServices).values([
    { userId: therapistA.id, serviceId: initialAssessment.id },
    { userId: therapistA.id, serviceId: massage.id },
    { userId: therapistA.id, serviceId: dryNeedling.id },
  ]);
  // Therapist B: Massage only
  await db.insert(therapistServices).values([
    { userId: therapistB.id, serviceId: massage.id },
  ]);
  // Therapist C: Initial Assessment and Dry Needling (Generated)
  await db.insert(therapistServices).values([
    { userId: therapistC.id, serviceId: initialAssessment.id },
    { userId: therapistC.id, serviceId: dryNeedling.id },
  ]);

  console.log('Therapist Services seeded.');

  // 6. Availabilities
  // Therapist A: Downtown M-F (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)
  // 9:00 AM (540) to 5:00 PM (1020)
  const availabilitiesA = [];
  for (let day = 1; day <= 5; day++) {
    availabilitiesA.push({
      userId: therapistA.id,
      locationId: downtown.id,
      dayOfWeek: day,
      startTime: 540,
      endTime: 1020,
    });
  }
  await db.insert(availabilities).values(availabilitiesA);

  // Therapist B: Westside Tu-Thu
  // 10:00 AM (600) to 6:00 PM (1080)
  const availabilitiesB = [];
  for (let day = 2; day <= 4; day++) {
    availabilitiesB.push({
      userId: therapistB.id,
      locationId: westside.id,
      dayOfWeek: day,
      startTime: 600,
      endTime: 1080,
    });
  }
  await db.insert(availabilities).values(availabilitiesB);

  // Therapist C: Generated availability (Weekends at Downtown)
  const availabilitiesC = [
    { userId: therapistC.id, locationId: downtown.id, dayOfWeek: 0, startTime: 600, endTime: 900 }, // Sun
    { userId: therapistC.id, locationId: downtown.id, dayOfWeek: 6, startTime: 600, endTime: 900 }, // Sat
  ];
  await db.insert(availabilities).values(availabilitiesC);

  console.log('Availabilities seeded.');

  // 7. Patients
  const patientData = Array.from({ length: 5 }).map((_, i) => ({
    name: `Patient ${i + 1}`,
    role: 'patient',
    specialization: null,
  }));
  const insertedPatients = await db.insert(users).values(patientData).returning();

  console.log('Patients seeded.');

  // 8. Appointments
  // Helper to create timestamp for "next week" + day offset + hour offset
  const getNextWeekTimestamp = (dayOffset: number, hour: number) => {
    const now = new Date();
    const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    nextWeek.setDate(nextWeek.getDate() - nextWeek.getDay() + dayOffset); // Adjust to specific day
    nextWeek.setHours(hour, 0, 0, 0);
    return Math.floor(nextWeek.getTime() / 1000);
  };

  const appointmentsData = [
    // Therapist A (Downtown) Appointments
    {
      datetime: getNextWeekTimestamp(1, 10), // Mon 10am
      durationMins: 60,
      status: 'scheduled',
      patientId: insertedPatients[0].id,
      therapistId: therapistA.id,
      serviceId: initialAssessment.id,
      locationId: downtown.id,
    },
    {
      datetime: getNextWeekTimestamp(1, 13), // Mon 1pm
      durationMins: 45,
      status: 'scheduled',
      patientId: insertedPatients[1].id,
      therapistId: therapistA.id,
      serviceId: massage.id,
      locationId: downtown.id,
    },
    {
      datetime: getNextWeekTimestamp(3, 11), // Wed 11am
      durationMins: 30,
      status: 'completed',
      patientId: insertedPatients[2].id,
      therapistId: therapistA.id,
      serviceId: dryNeedling.id,
      locationId: downtown.id,
    },
     {
      datetime: getNextWeekTimestamp(5, 14), // Fri 2pm
      durationMins: 60,
      status: 'scheduled',
      patientId: insertedPatients[3].id,
      therapistId: therapistA.id,
      serviceId: initialAssessment.id,
      locationId: downtown.id,
    },

    // Therapist B (Westside) Appointments
    {
      datetime: getNextWeekTimestamp(2, 10), // Tue 10am
      durationMins: 45,
      status: 'scheduled',
      patientId: insertedPatients[4].id,
      therapistId: therapistB.id,
      serviceId: massage.id,
      locationId: westside.id,
    },
    {
      datetime: getNextWeekTimestamp(2, 12), // Tue 12pm
      durationMins: 45,
      status: 'scheduled',
      patientId: insertedPatients[0].id,
      therapistId: therapistB.id,
      serviceId: massage.id,
      locationId: westside.id,
    },
     {
      datetime: getNextWeekTimestamp(4, 15), // Thu 3pm
      durationMins: 45,
      status: 'cancelled',
      patientId: insertedPatients[1].id,
      therapistId: therapistB.id,
      serviceId: massage.id,
      locationId: westside.id,
    },

    // Therapist C (Downtown - Weekend)
    {
      datetime: getNextWeekTimestamp(6, 10), // Sat 10am
      durationMins: 60,
      status: 'scheduled',
      patientId: insertedPatients[2].id,
      therapistId: therapistC.id,
      serviceId: initialAssessment.id,
      locationId: downtown.id,
    },
    {
      datetime: getNextWeekTimestamp(0, 11), // Sun 11am
      durationMins: 30,
      status: 'scheduled',
      patientId: insertedPatients[3].id,
      therapistId: therapistC.id,
      serviceId: dryNeedling.id,
      locationId: downtown.id,
    },
    {
      datetime: getNextWeekTimestamp(6, 12), // Sat 12pm
      durationMins: 30,
      status: 'completed',
      patientId: insertedPatients[4].id,
      therapistId: therapistC.id,
      serviceId: dryNeedling.id,
      locationId: downtown.id,
    },
  ];

  await db.insert(appointments).values(appointmentsData);

  console.log('Appointments seeded.');
  console.log('Database seeding completed successfully.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
