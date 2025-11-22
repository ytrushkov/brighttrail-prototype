"use client"

import * as React from "react"
import { format, addDays, startOfToday, isSameDay } from "date-fns"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Toaster } from "@/components/ui/toaster"
import { BookingWizard } from "@/components/booking/BookingWizard"
import {
    fetchLocations,
    fetchTherapists,
    fetchAppointments,
    Location,
    Therapist,
    Appointment
} from "@/lib/api"
import { cn } from "@/lib/utils"

export default function StaffPortal() {
  const [locations, setLocations] = React.useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>("")
  const [date, setDate] = React.useState<Date>(startOfToday())

  // Grid Data
  const [therapists, setTherapists] = React.useState<Therapist[]>([])
  const [appointments, setAppointments] = React.useState<Appointment[]>([])

  // Loading
  const [loading, setLoading] = React.useState(false)

  // Init
  React.useEffect(() => {
    fetchLocations().then(locs => {
        setLocations(locs)
        if (locs.length > 0) setSelectedLocationId(locs[0].id.toString())
    }).catch(console.error)
  }, [])

  const refreshData = React.useCallback(() => {
      if (!selectedLocationId) return;

      setLoading(true);
      const locId = Number(selectedLocationId);

      Promise.all([
          fetchTherapists(locId),
          fetchAppointments() // In a real app, we'd filter by date range and location via API
      ]).then(([therapistsData, apptsData]) => {
          setTherapists(therapistsData);
          // Client side filter for prototype
          const filteredAppts = apptsData.filter(a =>
            a.locationId === locId &&
            isSameDay(new Date(a.datetime * 1000), date)
          );
          setAppointments(filteredAppts);
      }).catch(console.error).finally(() => setLoading(false));
  }, [selectedLocationId, date]);

  React.useEffect(() => {
      refreshData();
  }, [refreshData]);

  // Grid Config
  const startHour = 9;
  const endHour = 18; // 6 PM
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col gap-6 font-sans">
      <Toaster />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff Portal</h1>
            <p className="text-muted-foreground">Manage schedules and appointments.</p>
        </div>

        <div className="flex items-center gap-2">
             {/* Location Selector */}
            <div className="w-[200px]">
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                        {locations.map(l => (
                            <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* New Appointment Action */}
            {selectedLocationId && (
                <BookingWizard
                    locationId={Number(selectedLocationId)}
                    onSuccess={refreshData}
                />
            )}
        </div>
      </div>

      {/* Date Controls */}
      <div className="flex items-center justify-between border rounded-lg p-2 bg-card shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => setDate(prev => addDays(prev, -1))}>
            <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
            </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" onClick={() => setDate(prev => addDays(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Schedule Grid */}
      <div className="flex-1 border rounded-lg bg-card shadow-sm overflow-x-auto">
         <div className="min-w-[800px]">
             {/* Header Row */}
            <div className="grid grid-cols-[200px_1fr] border-b">
                <div className="p-4 font-medium text-muted-foreground border-r bg-muted/50">Therapist</div>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
                    {hours.map(h => (
                        <div key={h} className="p-2 text-center text-sm text-muted-foreground border-r last:border-r-0">
                            {h > 12 ? h - 12 : h} {h >= 12 ? 'PM' : 'AM'}
                        </div>
                    ))}
                </div>
            </div>

            {/* Body */}
            {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading schedule...</div>
            ) : therapists.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No therapists found for this location.</div>
            ) : (
                therapists.map(therapist => (
                    <div key={therapist.id} className="grid grid-cols-[200px_1fr] border-b last:border-b-0 h-20">
                         {/* Row Header */}
                         <div className="p-4 flex items-center font-medium border-r bg-muted/50">
                            <div className="flex flex-col">
                                <span>{therapist.name}</span>
                                <span className="text-xs text-muted-foreground font-normal">{therapist.specialization || therapist.role}</span>
                            </div>
                         </div>

                         {/* Row Content */}
                         <div className="relative h-full bg-background">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
                                {hours.map(h => <div key={h} className="border-r last:border-r-0 h-full border-dashed opacity-20" />)}
                            </div>

                            {/* Appointments */}
                            {appointments
                                .filter(a => a.therapistId === therapist.id)
                                .map(appt => {
                                    // Calculate Position
                                    const apptDate = new Date(appt.datetime * 1000);
                                    const startMins = apptDate.getHours() * 60 + apptDate.getMinutes();
                                    const gridStartMins = startHour * 60;
                                    const offsetMins = startMins - gridStartMins;
                                    const totalGridMins = (endHour - startHour) * 60;

                                    // Percentage
                                    const left = (offsetMins / totalGridMins) * 100;
                                    const width = (appt.durationMins / totalGridMins) * 100;

                                    // Skip if out of bounds (e.g. before 9am or after 6pm)
                                    if (left < 0 || left >= 100) return null;

                                    return (
                                        <div
                                            key={appt.id}
                                            className="absolute top-1 bottom-1 bg-primary/10 border-l-4 border-primary text-primary text-xs p-1 rounded-sm overflow-hidden whitespace-nowrap hover:z-10 hover:bg-primary/20 transition-colors cursor-pointer"
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            title={`${format(apptDate, "h:mm a")} - ${appt.patient?.name || 'Patient'} (${appt.service?.name})`}
                                        >
                                            <div className="font-bold truncate">{appt.patient?.name || 'Unknown Patient'}</div>
                                            <div className="truncate text-[10px] opacity-80">{appt.service?.name}</div>
                                        </div>
                                    )
                                })
                            }
                         </div>
                    </div>
                ))
            )}
         </div>
      </div>
    </div>
  )
}
