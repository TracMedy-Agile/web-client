import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Loader2, MapPin, Utensils, Video } from "lucide-react";
import { getCalendarAppointments } from "@/lib/api/appointments";
import { getHospitalFacilityId } from "@/lib/api/care-episodes";
import { cn } from "@/lib/utils";
import AppointmentCalendarDaily from "./AppointmentCalendarDaily";
import AppointmentEmptyState from "./AppointmentEmptyState";
import {
  addDays,
  formatDateForApi,
  getCurrentDisplayTime,
  normalizeCalendarAppointments,
  parseTimeToMinutes,
  startOfWeek,
  type CalendarAppointment,
  type DailyAppointmentStatus,
  type DailyCalendarAppointment,
} from "./calendar-data";

type CalendarMode = "day" | "week";
type CalendarFilters = {
  status: string;
  department: string;
  type: string;
};

const weekSlots = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "LUNCH", "1:00 PM", "2:00 PM"];
const weekSlotHours = [8, 9, 10, 11, null, 13, 14];
const rowHeight = 96;

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Pending", value: "pending" },
  { label: "Rescheduled", value: "rescheduled" },
  { label: "No Shows", value: "no_show" },
];

const departmentOptions = [
  { label: "All Departments", value: "all" },
  { label: "Cardiology", value: "Cardiology" },
  { label: "Obstetrics", value: "Obstetrics" },
  { label: "Pulmonology", value: "Pulmonology" },
  { label: "General Surgery", value: "General Surgery" },
  { label: "Endocrinology", value: "Endocrinology" },
];

const typeOptions = [
  { label: "Appointment type", value: "all" },
  { label: "Physical Visit", value: "in_person" },
  { label: "Teleconsultation", value: "teleconsultation" },
  { label: "Nurse Check-in", value: "nurse_checkin" },
];

const weekCardStyles: Record<DailyAppointmentStatus, string> = {
  Confirmed: "border-l-4 border-emerald-500 bg-emerald-50 text-emerald-500",
  Pending: "border-l-4 border-amber-500 bg-amber-50 text-amber-500",
  Rescheduled: "border-l-4 border-gray-400 bg-gray-100 text-[#111827]",
  "No Show": "border-l-4 border-gray-400 bg-gray-100 text-[#111827]",
};

function FilterSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-md border border-border bg-white px-3 pr-9 text-sm font-medium text-[#71809B] focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
    </span>
  );
}

function formatWeekTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildWeekDays(date: Date) {
  const weekStart = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    return {
      key: formatDateForApi(day),
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day).toUpperCase(),
      date: String(day.getDate()),
      active: formatDateForApi(day) === formatDateForApi(date),
    };
  });
}

function getWeekSlotIndex(appointment: CalendarAppointment) {
  const minutes = parseTimeToMinutes(appointment.startTime);
  const hour = Math.floor(minutes / 60);
  const index = weekSlotHours.findIndex((slotHour) => slotHour === hour);
  return index >= 0 ? index : 0;
}

function getNowLineTop(nowTime: string) {
  const minutes = parseTimeToMinutes(nowTime);
  const hour = Math.floor(minutes / 60);
  const slotIndex = weekSlotHours.findIndex((slotHour) => slotHour === hour);
  if (slotIndex < 0) return null;
  return slotIndex * rowHeight + ((minutes % 60) / 60) * rowHeight;
}

function WeekAppointmentCard({ appointment }: { appointment: CalendarAppointment }) {
  const isTeleconsultation = appointment.type.toLowerCase().includes("tele");

  return (
    <Link
      href={`/dashboard/appointments/${encodeURIComponent(appointment.id)}`}
      aria-label={`Open appointment details for ${appointment.patientName}`}
      className={cn(
        "mx-1 mt-1 block min-w-0 cursor-pointer overflow-hidden rounded-xl px-2 py-3 text-xs shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 xl:px-3",
        weekCardStyles[appointment.status],
      )}
    >
      <p className="truncate font-bold leading-tight">{appointment.patientName}</p>
      <p className="mt-1 truncate font-medium text-[#71809B]">{appointment.type}</p>
      <p className="mt-0.5 flex min-w-0 items-center gap-1 font-medium text-[#71809B]">
        <Clock3 className="h-3 w-3 shrink-0" />
        <span className="truncate">{appointment.startTime}</span>
      </p>
      <p className="mt-0.5 flex min-w-0 items-center gap-1 font-medium text-[#71809B]">
        {isTeleconsultation ? <Video className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
        <span className="truncate">{appointment.doctor}</span>
      </p>
      <p className="mt-1 truncate font-bold">{appointment.status}</p>
    </Link>
  );
}

function WeekLoadingState() {
  return (
    <div className="absolute inset-x-24 top-24 z-20 rounded-lg border border-[#DDE3EC] bg-white px-4 py-3 text-sm font-semibold text-[#71809B] shadow-sm">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading appointments
      </span>
    </div>
  );
}

function WeekMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-24 top-24 z-20 rounded-xl border border-dashed border-[#CBD5E1] bg-white px-5 py-4 sm:py-8 text-center text-sm font-semibold text-[#71809B]">
      {children}
    </div>
  );
}

function WeekCalendar({
  date,
  onPreviousWeek,
  onNextWeek,
  onViewChange,
  onAppointmentsChange,
}: {
  date: Date;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onViewChange?: (mode: CalendarMode) => void;
  onAppointmentsChange?: (appointments: DailyCalendarAppointment[]) => void;
}) {
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<CalendarFilters>({ status: "all", department: "all", type: "all" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowTime, setNowTime] = useState(() => getCurrentDisplayTime());
  const [facilityId, setFacilityId] = useState("");
  const days = useMemo(() => buildWeekDays(date), [date]);
  const nowLineTop = getNowLineTop(nowTime);

  useEffect(() => {
    const updateNow = () => setNowTime(getCurrentDisplayTime());
    updateNow();
    const interval = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const id = await getHospitalFacilityId();
        if (!ignore) setFacilityId(id);
      } catch {
        if (!ignore) setFacilityId("");
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!facilityId) return;
    let ignore = false;
    const weekDays = buildWeekDays(date);

    const loadAppointments = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payloads = await Promise.all(
          weekDays.map((day) => getCalendarAppointments({ date: day.key, facilityId })),
        );
        const nextAppointments = weekDays.flatMap((day, index) =>
          normalizeCalendarAppointments(payloads[index], day.key),
        );
        if (!ignore) {
          setAppointments(nextAppointments);
          onAppointmentsChange?.(nextAppointments);
        }
      } catch {
        if (!ignore) {
          setAppointments([]);
          onAppointmentsChange?.([]);
          setError("Failed to load calendar data.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadAppointments();

    return () => {
      ignore = true;
    };
  }, [date, facilityId, onAppointmentsChange, refreshKey]);

  const updateFilter = (key: keyof CalendarFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <FilterSelect className="w-full sm:w-[120px]" value={filters.status} options={statusOptions} onChange={(value) => updateFilter("status", value)} />
          <FilterSelect className="w-full sm:w-[155px]" value={filters.department} options={departmentOptions} onChange={(value) => updateFilter("department", value)} />
          <FilterSelect className="w-full sm:w-[170px]" value={filters.type} options={typeOptions} onChange={(value) => updateFilter("type", value)} />
        </div>

        <div className="flex items-center justify-center gap-5 text-[#111827]">
          <button type="button" aria-label="Previous week" className="text-[#111827]" onClick={onPreviousWeek}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="whitespace-nowrap text-lg font-bold md:text-xl">{formatWeekTitle(date)}</p>
          <button type="button" aria-label="Next week" className="text-[#111827]" onClick={onNextWeek}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="inline-flex h-10 self-start rounded-xl bg-[#E7F2FF] p-1 xl:self-auto">
          <button
            type="button"
            onClick={() => onViewChange?.("day")}
            className="rounded-lg px-4 text-xs font-medium text-[#71809B] transition-colors"
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => onViewChange?.("week")}
            className="rounded-lg bg-white px-4 text-xs font-semibold text-[#111827] shadow-sm transition-colors"
          >
            Week
          </button>
        </div>
      </div>

      {!isLoading && !error && appointments.length === 0 ? (
        <AppointmentEmptyState onRefresh={() => setRefreshKey((key) => key + 1)} />
      ) : (
      <div className="w-full overflow-hidden">
        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-white">
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border sm:grid-cols-[64px_repeat(7,minmax(0,1fr))] xl:grid-cols-[80px_repeat(7,minmax(0,1fr))]">
            <div className="h-16 border-r border-border bg-white" />
            {days.map((day) => (
              <div
                key={day.key}
                className={cn(
                  "flex h-16 flex-col items-center justify-center border-r border-border last:border-r-0",
                  day.active ? "bg-[#E4F1FF]" : "bg-white",
                )}
              >
                <span className={cn("text-xs font-bold", day.active ? "text-primary" : "text-[#71809B]")}>{day.weekday}</span>
                <span className={cn("mt-1 text-lg font-bold", day.active ? "text-primary" : "text-[#111827]")}>{day.date}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            {nowLineTop !== null ? (
              <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: nowLineTop }}>
                <span className="w-20 pr-2 text-right text-xs font-bold text-red-500">{nowTime}</span>
                <span className="h-px flex-1 bg-red-500" />
                <span className="mr-8 rounded border border-red-500 bg-white px-3 py-1 text-xs font-medium text-red-500">NOW {nowTime}</span>
              </div>
            ) : null}

            {isLoading ? <WeekLoadingState /> : null}
            {!isLoading && error ? <WeekMessage>{error}</WeekMessage> : null}
            {!isLoading && !error && appointments.length === 0 ? <WeekMessage>No appointments scheduled for this week.</WeekMessage> : null}

            {weekSlots.map((slot, slotIndex) => {
              if (slot === "LUNCH") {
                return (
                  <div key={slot} className="grid min-h-24 grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border sm:grid-cols-[64px_repeat(7,minmax(0,1fr))] xl:grid-cols-[80px_repeat(7,minmax(0,1fr))]">
                    <div className="border-r border-border px-4 py-3 text-xs font-bold text-[#71809B]">LUNCH</div>
                    <div className="col-span-7 flex items-center justify-center bg-white text-xs font-bold tracking-[0.14em] text-[#71809B]">
                      <Utensils className="mr-2 h-4 w-4" />
                      CLINIC CLOSED FOR LUNCH
                    </div>
                  </div>
                );
              }

              return (
                <div key={slot} className="grid min-h-24 grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0 sm:grid-cols-[64px_repeat(7,minmax(0,1fr))] xl:grid-cols-[80px_repeat(7,minmax(0,1fr))]">
                  <div className="border-r border-border px-4 py-3 text-xs font-medium text-[#5F708D]">{slot}</div>
                  {days.map((day) => {
                    const dayAppointments = appointments.filter(
                      (appointment) => appointment.date === day.key && getWeekSlotIndex(appointment) === slotIndex,
                    );

                    return (
                      <div key={`${day.weekday}-${slot}`} className="min-h-24 border-r border-border last:border-r-0">
                        {!isLoading && !error ? dayAppointments.map((appointment) => (
                          <WeekAppointmentCard key={appointment.id} appointment={appointment} />
                        )) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </>
  );
}

type AppointmentCalendarProps = {
  mode: CalendarMode;
  date?: Date;
  onPreviousDay?: () => void;
  onNextDay?: () => void;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onCalendarModeChange?: (mode: CalendarMode) => void;
  onAppointmentsChange?: (appointments: DailyCalendarAppointment[]) => void;
};

export default function AppointmentCalendar({
  mode,
  date = new Date(),
  onPreviousDay,
  onNextDay,
  onPreviousWeek,
  onNextWeek,
  onCalendarModeChange,
  onAppointmentsChange,
}: AppointmentCalendarProps) {
  return mode === "day" ? (
    <AppointmentCalendarDaily
      date={date}
      onPreviousDay={onPreviousDay}
      onNextDay={onNextDay}
      onViewChange={onCalendarModeChange}
      onAppointmentsChange={onAppointmentsChange}
    />
  ) : (
    <WeekCalendar
      date={date}
      onPreviousWeek={onPreviousWeek}
      onNextWeek={onNextWeek}
      onViewChange={onCalendarModeChange}
      onAppointmentsChange={onAppointmentsChange}
    />
  );
}



