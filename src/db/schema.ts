import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Locations Table
export const locations = sqliteTable('locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  address: text('address').notNull(),
});

// Users Table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'admin', 'therapist', 'patient'
  specialization: text('specialization'),
});

// Services Table
export const services = sqliteTable('services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  durationMins: integer('duration_mins').notNull(),
  costCents: integer('cost_cents').notNull(),
});

// Therapist Services Junction Table
export const therapistServices = sqliteTable('therapist_services', {
  userId: integer('user_id').notNull().references(() => users.id),
  serviceId: integer('service_id').notNull().references(() => services.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.serviceId] }),
}));

// Availabilities Table
export const availabilities = sqliteTable('availabilities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  locationId: integer('location_id').notNull().references(() => locations.id),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6
  startTime: integer('start_time').notNull(), // Minutes from midnight
  endTime: integer('end_time').notNull(), // Minutes from midnight
});

// Appointments Table
export const appointments = sqliteTable('appointments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  datetime: integer('datetime').notNull(), // Unix timestamp
  durationMins: integer('duration_mins').notNull(),
  status: text('status').notNull(), // 'scheduled', 'completed', 'cancelled'
  patientId: integer('patient_id').notNull().references(() => users.id),
  therapistId: integer('therapist_id').notNull().references(() => users.id),
  serviceId: integer('service_id').notNull().references(() => services.id),
  locationId: integer('location_id').notNull().references(() => locations.id),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  therapistServices: many(therapistServices),
  availabilities: many(availabilities),
  appointmentsAsPatient: many(appointments, { relationName: 'patientAppointments' }),
  appointmentsAsTherapist: many(appointments, { relationName: 'therapistAppointments' }),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  availabilities: many(availabilities),
  appointments: many(appointments),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  therapistServices: many(therapistServices),
  appointments: many(appointments),
}));

export const therapistServicesRelations = relations(therapistServices, ({ one }) => ({
  user: one(users, {
    fields: [therapistServices.userId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [therapistServices.serviceId],
    references: [services.id],
  }),
}));

export const availabilitiesRelations = relations(availabilities, ({ one }) => ({
  user: one(users, {
    fields: [availabilities.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [availabilities.locationId],
    references: [locations.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(users, {
    fields: [appointments.patientId],
    references: [users.id],
    relationName: 'patientAppointments',
  }),
  therapist: one(users, {
    fields: [appointments.therapistId],
    references: [users.id],
    relationName: 'therapistAppointments',
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  location: one(locations, {
    fields: [appointments.locationId],
    references: [locations.id],
  }),
}));
