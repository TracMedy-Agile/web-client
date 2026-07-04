export type DailyAppointmentStatus = "Confirmed" | "Pending" | "Rescheduled" | "No Show";

export type DailyCalendarAppointment = {
  id: string;
  patientName: string;
  startTime: string;
  endTime: string;
  type: "In-person Visit" | "Teleconsultation" | string;
  doctor: string;
  status: DailyAppointmentStatus;
};

export type CalendarAppointment = DailyCalendarAppointment & {
  date: string;
};

type CalendarApiRecord = Record<string, unknown>;

export function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}

export function startOfWeek(date: Date) {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

function asRecord(value: unknown): CalendarApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as CalendarApiRecord : null;
}

function getString(record: CalendarApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return fallback;
}

function getNestedString(record: CalendarApiRecord, parentKey: string, keys: string[]) {
  const parent = asRecord(record[parentKey]);
  return parent ? getString(parent, keys) : "";
}

function getNumber(record: CalendarApiRecord, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
}

export function minutesToDisplayTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function parseTimeToMinutes(value: string) {
  const trimmed = value.trim();
  const twelveHourMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (twelveHourMatch) {
    const [, rawHour, rawMinute = "00", rawPeriod] = twelveHourMatch;
    let hour = Number(rawHour);
    const minute = Number(rawMinute);
    const period = rawPeriod.toUpperCase();

    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFourHourMatch) {
    const [, rawHour, rawMinute] = twentyFourHourMatch;
    return Number(rawHour) * 60 + Number(rawMinute);
  }

  return 8 * 60;
}

export function toDisplayTime(value: string) {
  const isoDate = Date.parse(value);
  if (value.includes("T") && Number.isFinite(isoDate)) {
    const date = new Date(isoDate);
    return minutesToDisplayTime(date.getHours() * 60 + date.getMinutes());
  }

  return minutesToDisplayTime(parseTimeToMinutes(value));
}

export function getCurrentDisplayTime() {
  const now = new Date();
  return minutesToDisplayTime(now.getHours() * 60 + now.getMinutes());
}

function getRecordDate(record: CalendarApiRecord, fallback: string) {
  const value = getString(record, ["date", "appointmentDate", "scheduledDate", "startsAt", "startTime"], fallback);
  const parsed = Date.parse(value);
  if (value.includes("T") && Number.isFinite(parsed)) return formatDateForApi(new Date(parsed));
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? fallback;
}

function mapAppointmentType(type: string) {
  const normalized = type.toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("nurse")) return "Nurse Check-in";
  return "In-person Visit";
}

function mapAppointmentStatus(status: string): DailyAppointmentStatus {
  const normalized = status.toLowerCase().replace(/[_-]/g, " ");

  if (normalized.includes("rescheduled")) return "Rescheduled";
  if (normalized.includes("no show")) return "No Show";
  if (normalized.includes("pending")) return "Pending";
  return "Confirmed";
}

function getCalendarItems(payload: unknown): CalendarApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));

  const record = asRecord(payload);
  if (!record) return [];

  if (Array.isArray(record.data)) return record.data.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));

  const data = asRecord(record.data);
  if (data) {
    if (Array.isArray(data.appointments)) return data.appointments.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));
    if (Array.isArray(data.items)) return data.items.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));
    if (Array.isArray(data.results)) return data.results.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));
  }

  if (Array.isArray(record.appointments)) return record.appointments.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));
  if (Array.isArray(record.items)) return record.items.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));
  if (Array.isArray(record.results)) return record.results.filter((item): item is CalendarApiRecord => Boolean(asRecord(item)));

  return [];
}

export function normalizeCalendarAppointments(payload: unknown, fallbackDate: string): CalendarAppointment[] {
  return getCalendarItems(payload).map((appointment) => {
    const startValue = getString(appointment, ["startTime", "time", "startsAt", "scheduledTime"], "08:00");
    const duration = getNumber(appointment, ["duration", "durationMinutes"], 30);
    const endValue = getString(appointment, ["endTime", "endsAt"], "");
    const startTime = toDisplayTime(startValue);
    const endTime = endValue ? toDisplayTime(endValue) : minutesToDisplayTime(parseTimeToMinutes(startTime) + duration);
    const type = getString(appointment, ["type", "appointmentType"], "in_person");
    const patientName = getString(appointment, ["patientName", "patient"], "") || getNestedString(appointment, "patient", ["name", "fullName"]);
    const doctor = getString(appointment, ["doctor", "clinicianName", "assignedStaff"], "") || getNestedString(appointment, "clinician", ["name", "fullName"]);
    const date = getRecordDate(appointment, fallbackDate);

    return {
      id: getString(appointment, ["id", "appointmentId"], `${date}-${startValue}-${patientName || "appointment"}`),
      patientName: patientName || "Unknown Patient",
      startTime,
      endTime,
      type: mapAppointmentType(type),
      doctor: doctor || "Unassigned",
      status: mapAppointmentStatus(getString(appointment, ["status"], "confirmed")),
      date,
    };
  }).sort((current, next) => parseTimeToMinutes(current.startTime) - parseTimeToMinutes(next.startTime));
}
