import { useEffect, useState } from "react";
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Loader2, Stethoscope, Video } from "lucide-react";
import { getCalendarAppointments } from "@/lib/api/appointments";
import { getHospitalFacilityId } from "@/lib/api/care-episodes";
import { cn } from "@/lib/utils";
import AppointmentEmptyState from "./AppointmentEmptyState";
import {
  formatDateForApi,
  getCurrentDisplayTime,
  normalizeCalendarAppointments,
  parseTimeToMinutes,
  type DailyAppointmentStatus,
  type DailyCalendarAppointment,
} from "./calendar-data";

export type { DailyAppointmentStatus, DailyCalendarAppointment } from "./calendar-data";

type CalendarFilters = {
  status: string;
  department: string;
  type: string;
};

type AppointmentCalendarDailyProps = {
  date: Date;
  onPreviousDay?: () => void;
  onNextDay?: () => void;
  onViewChange?: (view: "day" | "week") => void;
  onAppointmentsChange?: (appointments: DailyCalendarAppointment[]) => void;
};

const START_HOUR = 8;
const END_HOUR = 17;
const HOUR_HEIGHT = 80;
const MIN_CARD_HEIGHT = 96;

const timeSlots = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
  const hour = START_HOUR + index;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour;

  return `${displayHour.toString().padStart(2, "0")}:00 ${period}`;
});

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

const statusStyles: Record<
  DailyAppointmentStatus,
  {
    card: string;
    name: string;
    badge: string;
  }
> = {
  Confirmed: {
    card: "border-l-[4px] border-emerald-500 bg-emerald-50",
    name: "text-emerald-600",
    badge: "bg-emerald-500 text-white",
  },
  Pending: {
    card: "border-l-[4px] border-amber-500 bg-amber-50",
    name: "text-amber-500",
    badge: "bg-amber-500 text-white",
  },
  Rescheduled: {
    card: "border-l-[4px] border-gray-400 bg-gray-100",
    name: "text-[#111827]",
    badge: "bg-gray-400 text-white",
  },
  "No Show": {
    card: "border-l-[4px] border-gray-400 bg-gray-100",
    name: "text-[#111827]",
    badge: "bg-gray-400 text-white",
  },
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

function minutesFromMidnight(time: string) {
  return parseTimeToMinutes(time);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTimeRange(appointment: DailyCalendarAppointment) {
  return `${appointment.startTime}-${appointment.endTime}`;
}

function positionFromTime(time: string) {
  return ((minutesFromMidnight(time) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function AppointmentCard({ appointment }: { appointment: DailyCalendarAppointment }) {
  const styles = statusStyles[appointment.status];
  const top = Math.max(0, positionFromTime(appointment.startTime));
  const rawHeight = positionFromTime(appointment.endTime) - top;
  const height = Math.max(MIN_CARD_HEIGHT, rawHeight);
  const isTeleconsultation = appointment.type.toLowerCase().includes("tele");

  return (
    <article
      className={cn(
        "absolute left-6 right-6 rounded-xl px-5 py-5 text-sm shadow-sm",
        styles.card,
      )}
      style={{ top, height }}
    >
      <div className="flex h-full items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={cn("truncate text-base font-bold leading-tight", styles.name)}>{appointment.patientName}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[#344054]">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Clock3 className="h-4 w-4 shrink-0" />
              {formatTimeRange(appointment)}
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {isTeleconsultation ? <Video className="h-4 w-4 shrink-0" /> : <Building2 className="h-4 w-4 shrink-0" />}
              {appointment.type}
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Stethoscope className="h-4 w-4 shrink-0" />
              {appointment.doctor}
            </span>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase leading-none", styles.badge)}>
          {appointment.status}
        </span>
      </div>
    </article>
  );
}

function CalendarLoadingState() {
  return (
    <div className="absolute left-6 right-6 top-10 space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-4 py-3 text-sm font-semibold text-[#71809B] shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading appointments
      </div>
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-xl border-l-[4px] border-[#CBD5E1] bg-[#F3F4F6]" />
      ))}
    </div>
  );
}

function CalendarMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-6 right-6 top-10 rounded-xl border border-dashed border-[#CBD5E1] bg-white px-5 py-4 sm:py-8 text-center text-sm font-semibold text-[#71809B]">
      {children}
    </div>
  );
}

export default function AppointmentCalendarDaily({
  date,
  onPreviousDay,
  onNextDay,
  onViewChange,
  onAppointmentsChange,
}: AppointmentCalendarDailyProps) {
  const [appointments, setAppointments] = useState<DailyCalendarAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<CalendarFilters>({ status: "all", department: "all", type: "all" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowTime, setNowTime] = useState(() => getCurrentDisplayTime());
  const [facilityId, setFacilityId] = useState("");
  const timelineHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const nowTop = Math.max(0, Math.min(timelineHeight, positionFromTime(nowTime)));

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
    const dateString = formatDateForApi(date);

    const loadAppointments = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getCalendarAppointments({ date: dateString, facilityId });
        const nextAppointments = normalizeCalendarAppointments(payload, dateString);
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

    void Promise.resolve().then(loadAppointments);

    return () => {
      ignore = true;
    };
  }, [date, facilityId, onAppointmentsChange, refreshKey]);

  const updateFilter = (key: keyof CalendarFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <FilterSelect className="w-full sm:w-[120px]" value={filters.status} options={statusOptions} onChange={(value) => updateFilter("status", value)} />
          <FilterSelect className="w-full sm:w-[155px]" value={filters.department} options={departmentOptions} onChange={(value) => updateFilter("department", value)} />
          <FilterSelect className="w-full sm:w-[170px]" value={filters.type} options={typeOptions} onChange={(value) => updateFilter("type", value)} />
        </div>

        <div className="flex items-center justify-center gap-5 text-[#111827]">
          <button type="button" aria-label="Previous day" className="text-[#111827]" onClick={onPreviousDay}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="whitespace-nowrap text-lg font-bold md:text-xl">{formatDate(date)}</p>
          <button type="button" aria-label="Next day" className="text-[#111827]" onClick={onNextDay}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="inline-flex h-10 self-start rounded-xl bg-[#E7F2FF] p-1 xl:self-auto">
          <button
            type="button"
            onClick={() => onViewChange?.("day")}
            className="rounded-lg bg-white px-4 text-xs font-semibold text-[#111827] shadow-sm transition-colors"
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => onViewChange?.("week")}
            className="rounded-lg px-4 text-xs font-medium text-[#71809B] transition-colors"
          >
            Week
          </button>
        </div>
      </div>

      {!isLoading && !error && appointments.length === 0 ? (
        <AppointmentEmptyState onRefresh={() => setRefreshKey((key) => key + 1)} />
      ) : (
      <div className="w-full overflow-hidden">
        <div className="relative w-full bg-white pb-3 pl-4 pr-6">
          <div className="relative ml-20 border-l border-[#CBD5E1]" style={{ height: timelineHeight }}>
            {timeSlots.map((slot, index) => (
              <div key={slot} className="absolute left-[-78px] right-0 h-px" style={{ top: index * HOUR_HEIGHT }}>
                <span className="absolute -left-1 top-[-7px] w-16 text-right text-xs font-medium text-[#5F708D]">
                  {slot}
                </span>
              </div>
            ))}

            <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
              <span className="h-2 w-2 -translate-x-[5px] rounded-full bg-red-500" />
              <span className="h-px flex-1 bg-red-500" />
              <span className="rounded border border-red-500 bg-white px-3 py-1 text-xs font-medium text-red-500">
                NOW {nowTime}
              </span>
            </div>

            {isLoading ? <CalendarLoadingState /> : null}
            {!isLoading && error ? <CalendarMessage>{error}</CalendarMessage> : null}
            {!isLoading && !error && appointments.length === 0 ? <CalendarMessage>No appointments scheduled for this day.</CalendarMessage> : null}
            {!isLoading && !error
              ? appointments.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} />
                ))
              : null}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}




