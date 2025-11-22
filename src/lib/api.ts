
export type Location = {
  id: number;
  name: string;
  address: string;
};

export type Service = {
  id: number;
  name: string;
  durationMins: number;
  costCents: number;
};

export type Therapist = {
  id: number;
  name: string;
  role: string;
  specialization: string | null;
};

export type Appointment = {
  id: number;
  datetime: number;
  durationMins: number;
  status: string;
  patientId: number;
  therapistId: number;
  serviceId: number;
  locationId: number;
  patient?: { name: string };
  therapist?: { name: string };
  service?: { name: string };
  location?: { name: string };
};

// Detailed slot response
export type SlotDetailed = {
  time: number;
  therapistIds: number[];
};

export async function fetchLocations(): Promise<Location[]> {
  const res = await fetch('/api/locations');
  if (!res.ok) throw new Error('Failed to fetch locations');
  return res.json();
}

export async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  if (!res.ok) throw new Error('Failed to fetch services');
  return res.json();
}

export async function fetchTherapists(locationId?: number, serviceId?: number): Promise<Therapist[]> {
  const params = new URLSearchParams();
  if (locationId) params.append('location_id', locationId.toString());
  if (serviceId) params.append('service_id', serviceId.toString());
  const res = await fetch(`/api/therapists?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch therapists');
  return res.json();
}

export async function fetchAppointments(): Promise<Appointment[]> {
  const res = await fetch('/api/appointments');
  if (!res.ok) throw new Error('Failed to fetch appointments');
  return res.json();
}

export async function fetchSlots(
  locationId: number,
  serviceId: number,
  dateStr: string,
  therapistId?: number | null,
  detailed: boolean = false
): Promise<Record<string, number[] | SlotDetailed[]>> {
  const params = new URLSearchParams({
    location_id: locationId.toString(),
    service_id: serviceId.toString(),
    start_date: dateStr,
    end_date: dateStr,
  });
  if (therapistId) params.append('therapist_id', therapistId.toString());
  if (detailed) params.append('detailed', 'true');

  const res = await fetch(`/api/slots?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch slots');
  return res.json();
}

export async function createAppointment(data: {
  datetime: number;
  duration_mins: number;
  patient_id: number;
  therapist_id: number;
  service_id: number;
  location_id: number;
}): Promise<Appointment> {
  const res = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to create appointment');
  }
  return res.json();
}
