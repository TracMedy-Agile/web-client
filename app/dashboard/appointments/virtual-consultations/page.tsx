"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Plus,
  RefreshCcw,
  Search,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import VideoCallView from "@/components/video-call/VideoCallView";
import { getCallToken, joinCall, startCall } from "@/lib/api/video-call";
import AppointmentDateRangePicker from "../components/AppointmentDateRangePicker";
import RescheduleAppointmentModal from "../components/RescheduleAppointmentModal";
import ScheduleAppointmentModal from "../components/ScheduleAppointmentModal";

type MetricCardData = {
  title: string;
  value: string;
  description: string;
  descriptionClassName?: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  iconWrapClassName: string;
};

type ConsultationStatus = "ready" | "completed" | "in-progress" | "upcoming" | "missed";
type AppointmentType = "physical" | "teleconsultation";

type ApiRecord = Record<string, unknown>;

type ActiveVideoCallSession = {
  appointmentId: string;
  callCid: string;
  token: string;
};

type Consultation = {
  id: string;
  patientName: string;
  appointmentId: string;
  appointmentType: AppointmentType;
  scheduledPrimary: string;
  scheduledSecondary: string;
  scheduledDate: string;
  scheduledTime: string;
  clinicianId: string;
  clinician: string;
  hospitalId: string;
  reason: string;
  status: ConsultationStatus;
  callStatus: string;
  streamCallCid: string | null;
  isJoinWindow: boolean;
  statusDetail: string;
  waitMinutes: number | null;
  completedAt: string;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;
const READY_JOIN_WINDOW_MINUTES = 30;

const statusStyles: Record<ConsultationStatus, string> = {
  ready: "bg-[#E7F2FF] text-primary",
  completed: "bg-emerald-50 text-emerald-600",
  "in-progress": "bg-red-50 text-red-500",
  upcoming: "bg-orange-50 text-orange-500",
  missed: "bg-slate-100 text-slate-500",
};

const statusDotStyles: Record<ConsultationStatus, string> = {
  ready: "bg-primary",
  completed: "bg-emerald-500",
  "in-progress": "bg-red-500",
  upcoming: "bg-orange-500",
  missed: "bg-slate-500",
};

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function unwrapData(payload: unknown) {
  const record = asRecord(payload);
  return record?.data ?? payload;
}

function getString(record: ApiRecord | null, keys: string[], fallback = "") {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return fallback;
}

function getNumber(record: ApiRecord | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function getAppointmentItems(payload: unknown): ApiRecord[] {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const record = asRecord(data);
  if (!record) return [];

  // The list response is double-wrapped ({ data: { data: [...], total, page, limit } }),
  // so the paginated array lives under a nested "data" key, not "items"/"appointments"/"results".
  for (const key of ["data", "items", "appointments", "results"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  return [];
}

async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-token");
    const { accessToken } = await res.json();
    return typeof accessToken === "string" ? accessToken : null;
  } catch {
    return null;
  }
}

async function fetchTeleconsultations() {
  const accessToken = await getAccessToken();
  const res = await fetch(`${BASE}/appointments?type=teleconsultation`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(payload?.message ?? "Failed to load virtual consultations.");
  }

  return payload;
}

// AppointmentResponseDto only exposes clinicianId (no embedded clinician name), so names are
// resolved separately from GET /clinicians and merged in by id.
async function fetchClinicianDirectory(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${BASE}/clinicians?limit=100`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) return {};

  const root = asRecord(payload);
  const list = Array.isArray(root?.data) ? root.data : [];
  const directory: Record<string, string> = {};

  for (const item of list) {
    const record = asRecord(item);
    const id = getString(record, ["id"]);
    const name = getString(record, ["name"]);
    if (!id || !name) continue;
    const department = getString(record, ["department"]);
    directory[id] = `Dr. ${name}${department ? ` - ${department}` : ""}`;
  }

  return directory;
}

function minutesToDisplayTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatDate(value: string) {
  if (!value) return "--";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

function formatTime(value: string) {
  if (!value) return "--";

  const parsed = Date.parse(value);
  if (value.includes("T") && Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return minutesToDisplayTime(date.getHours() * 60 + date.getMinutes());
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (match) return minutesToDisplayTime(Number(match[1]) * 60 + Number(match[2]));

  return value;
}

function getIsoDate(value: string) {
  if (!value) return "";
  const parsed = Date.parse(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value.slice(0, 10);
}

function getScheduledDate(record: ApiRecord) {
  return getString(record, ["date", "appointmentDate", "scheduledDate", "startsAt", "startTime"]);
}

function getScheduledTime(record: ApiRecord) {
  return getString(record, ["time", "appointmentTime", "scheduledTime", "startsAt", "startTime"]);
}

function getTimeParts(value: string) {
  if (!value) return null;

  const isoParsed = Date.parse(value);
  if (value.includes("T") && Number.isFinite(isoParsed)) {
    const date = new Date(isoParsed);
    return { hours: date.getHours(), minutes: date.getMinutes() };
  }

  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const period = match[3]?.toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null;
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  if (hours < 0 || hours > 23) return null;

  return { hours, minutes };
}

function getAppointmentDateTime(dateValue: string, timeValue: string) {
  if (!dateValue && !timeValue) return null;

  const dateSource = dateValue || timeValue;
  const dateMatch = dateSource.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeParts = getTimeParts(timeValue);

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]) - 1;
    const day = Number(dateMatch[3]);

    if (timeParts) return new Date(year, month, day, timeParts.hours, timeParts.minutes);
    if (!dateValue.includes("T")) return new Date(year, month, day, 0, 0);
  }

  const parsed = Date.parse(dateValue || timeValue);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function getStatusDetail(status: ConsultationStatus, appointmentDate: Date | null, record: ApiRecord) {
  const explicit = getString(record, ["statusDetail", "statusMessage"], "");
  if (explicit) return explicit;

  const now = new Date();
  if (status === "ready" && appointmentDate) {
    const minutes = Math.max(0, Math.round((appointmentDate.getTime() - now.getTime()) / 60000));
    return `Starts in ${minutes} mins`;
  }

  if (status === "in-progress") {
    const startedAt = getString(record, ["startedAt", "checkedInAt", "updatedAt"], "");
    const parsed = Date.parse(startedAt);
    if (Number.isFinite(parsed)) {
      const minutes = Math.max(0, Math.round((now.getTime() - parsed) / 60000));
      return `Started ${minutes} mins ago`;
    }
    return "Session active now";
  }

  return "";
}

function normalizeAppointmentType(type: string): AppointmentType {
  const normalized = type.toLowerCase().replace(/[\s-]+/g, "_");
  return normalized.includes("tele") ? "teleconsultation" : "physical";
}

function normalizeCallStatus(status: string | null | undefined) {
  const normalized = (status ?? "not_started").toLowerCase().replace(/[\s-]+/g, "_");
  if (["not_started", "waiting", "active", "ended", "missed"].includes(normalized)) return normalized;
  return "not_started";
}

function canJoinConsultationCall(consultation: Consultation) {
  return consultation.callStatus !== "ended" && consultation.callStatus !== "missed";
}

// The backend only ever lets an appointment's assigned clinician (or its patient) join its call
// — not other clinicians, and not hospital_admin. isAssigned must reflect that same check so the
// button is never shown for a click that would just 403.
function shouldShowJoinAction(consultation: Consultation, isAssigned: boolean) {
  if (!isAssigned) return false;
  if (consultation.status === "completed" || consultation.status === "in-progress") return false;
  return consultation.isJoinWindow && canJoinConsultationCall(consultation);
}

function shouldShowUpcomingActions(consultation: Consultation, isAssigned: boolean) {
  if (consultation.status !== "upcoming" && consultation.status !== "missed") return false;
  return !shouldShowJoinAction(consultation, isAssigned);
}
function isWithinReadyWindow(appointmentDate: Date | null) {
  if (!appointmentDate) return false;
  const minutesUntil = Math.round((appointmentDate.getTime() - Date.now()) / 60000);
  return minutesUntil >= -5 && minutesUntil <= READY_JOIN_WINDOW_MINUTES;
}

// The call window is considered closed 5 minutes past the scheduled time — the same boundary
// isWithinReadyWindow uses as its lower bound, so "ready" and "missed" never overlap or gap.
function isPastJoinWindow(appointmentDate: Date | null) {
  if (!appointmentDate) return false;
  const minutesUntil = Math.round((appointmentDate.getTime() - Date.now()) / 60000);
  return minutesUntil < -5;
}

function mapStatus(status: string, callStatus: string, isJoinWindow: boolean, isPastDue: boolean): ConsultationStatus {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, "_");
  const normalizedCallStatus = normalizeCallStatus(callStatus);

  if (normalizedCallStatus === "active") return "in-progress";
  if (normalized.includes("complete") || normalizedCallStatus === "ended") return "completed";
  if (normalized.includes("progress") || normalized.includes("checked_in")) return "in-progress";
  if (normalized.includes("no_show") || normalizedCallStatus === "missed") return "missed";
  if (isJoinWindow) return "ready";
  if (isPastDue) return "missed";

  return "upcoming";
}

function normalizeConsultation(record: ApiRecord): Consultation {
  const patient = asRecord(record.patient);
  const scheduledDate = getScheduledDate(record);
  const scheduledTime = getScheduledTime(record);
  const appointmentDate = getAppointmentDateTime(scheduledDate, scheduledTime);
  const rawStatus = getString(record, ["status"], "upcoming");
  const normalizedRawStatus = rawStatus.toLowerCase().replace(/[\s-]+/g, "_");
  const callStatus = normalizeCallStatus(getString(record, ["callStatus"]));
  // Cancelled/no-show/pending/completed appointments have their own meaning and must never be
  // swept into "ready" or the time-based "missed" fallback below just because their scheduled
  // time has passed.
  const isBlockedFromTiming = ["pending", "cancelled", "canceled", "no_show", "completed"].some((blockedStatus) => normalizedRawStatus.includes(blockedStatus));
  const isJoinWindow = !isBlockedFromTiming && isWithinReadyWindow(appointmentDate);
  const isPastDue = !isBlockedFromTiming && isPastJoinWindow(appointmentDate);
  const status = mapStatus(rawStatus, callStatus, isJoinWindow, isPastDue);
  const waitMinutes = getNumber(record, ["waitMinutes", "waitTime", "averageWaitMinutes"]);
  const clinicianId = getString(record, ["clinicianId"]);
  const patientName = getString(record, ["patientName"], "") || getString(patient, ["name", "fullName"], "Unknown Patient");

  return {
    id: getString(record, ["id", "_id", "appointmentId", "code"], "--"),
    patientName,
    appointmentId: getString(record, ["appointmentId", "code", "id"], "--"),
    appointmentType: normalizeAppointmentType(getString(record, ["type", "appointmentType"], "teleconsultation")),
    scheduledPrimary: scheduledDate.includes("T") ? formatDate(scheduledDate) : formatDate(scheduledDate || getString(record, ["createdAt"], "")),
    scheduledSecondary: formatTime(scheduledTime || scheduledDate),
    scheduledDate: getIsoDate(scheduledDate),
    scheduledTime,
    clinicianId,
    // Resolved from the clinician directory once it loads — see `consultations` memo below.
    clinician: clinicianId ? "" : "Unassigned",
    hospitalId: getString(record, ["hospitalId", "patientHospitalId"], "") || getString(patient, ["hospitalId", "tracmedyId", "medicalRecordNumber", "id"], "--"),
    reason: getString(record, ["reason", "notes"], "Teleconsultation"),
    status,
    callStatus,
    streamCallCid: getString(record, ["streamCallCid"]) || null,
    isJoinWindow,
    statusDetail: getStatusDetail(status, appointmentDate, record),
    waitMinutes,
    completedAt: getString(record, ["completedAt", "updatedAt"], ""),
  };
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  const Icon = metric.icon;

  return (
    <article className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#344054]">{metric.title}</p>
          <p className="mt-6 text-xl font-bold text-[#111827] md:text-3xl">{metric.value}</p>
          <p className={cn("mt-2 text-xs font-medium text-[#71809B]", metric.descriptionClassName)}>
            {metric.description}
          </p>
        </div>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", metric.iconWrapClassName)}>
          <Icon className={cn("h-5 w-5", metric.iconClassName)} />
        </span>
      </div>
    </article>
  );
}

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

function getConsultationStatusLabel(status: ConsultationStatus): string {
  if (status === "ready") return "Ready to join";
  if (status === "in-progress") return "In Progress";
  if (status === "missed") return "Missed";
  if (status === "completed") return "Completed";
  return "Upcoming";
}

function ConsultationStatusBadge({ consultation }: { consultation: Consultation }) {
  const status = consultation.status;
  const label = getConsultationStatusLabel(status);

  if (status === "ready" || status === "in-progress") {
    return (
      <span className={cn("inline-flex flex-col rounded-full px-3 py-1 text-xs font-bold", statusStyles[status])}>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDotStyles[status])} />
          {label}
        </span>
        {consultation.statusDetail ? <span className="mt-1 text-xs">{consultation.statusDetail}</span> : null}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", statusStyles[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotStyles[status])} />
      {label}
    </span>
  );
}

function escapeCsvValue(value: string) {
  return '"' + value.replace(/"/g, '""') + '"';
}

function downloadConsultationsCsv(consultations: Consultation[]) {
  const headers = ["Patient Name", "Appointment ID", "Scheduled Date", "Scheduled Time", "Clinician", "Status"];
  const rows = consultations.map((consultation) => [
    consultation.patientName,
    consultation.appointmentId,
    consultation.scheduledPrimary,
    consultation.scheduledSecondary,
    consultation.clinician,
    getConsultationStatusLabel(consultation.status),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "virtual-consultations.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isToday(value: string) {
  if (!value) return false;
  const today = new Date().toISOString().slice(0, 10);
  return getIsoDate(value) === today;
}

export default function VirtualConsultationsPage() {
  const { user } = useDashboardUser();
  const currentUserId = (user?.id ?? "").toLowerCase();
  const isAssignedClinician = useCallback(
    (consultation: Consultation) => Boolean(consultation.clinicianId && currentUserId && consultation.clinicianId.toLowerCase() === currentUserId),
    [currentUserId],
  );
  const [rawConsultations, setRawConsultations] = useState<Consultation[]>([]);
  const [clinicianNames, setClinicianNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clinicianFilter, setClinicianFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ dateFrom: "", dateTo: "" });
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Consultation | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeCallAppointmentId, setActiveCallAppointmentId] = useState<string | null>(null);
  const [activeVideoCallSession, setActiveVideoCallSession] = useState<ActiveVideoCallSession | null>(null);

  const loadConsultations = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");

    try {
      const payload = await fetchTeleconsultations();
      setRawConsultations(getAppointmentItems(payload).map(normalizeConsultation));
    } catch (requestError) {
      setRawConsultations([]);
      setError(requestError instanceof Error ? requestError.message : "Failed to load virtual consultations.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const prepareCallSession = useCallback(async (consultation: Consultation) => {
    if (!canJoinConsultationCall(consultation)) throw new Error("This consultation call is not available to join.");
    // The backend only allows the appointment's own assigned clinician (or patient) to
    // start/join/token a call — anyone else 403s, which the dashboard's global fetch guard
    // treats as an access-denied event for the whole page. Block it here first instead.
    if (!isAssignedClinician(consultation)) throw new Error("Only the clinician assigned to this appointment can join its call.");

    let callCid = consultation.streamCallCid;

    if (consultation.callStatus === "not_started") {
      const startResponse = await startCall(consultation.id);
      callCid = startResponse.callCid;
    }

    if (!callCid) throw new Error("Call session was not returned.");

    const tokenResponse = await getCallToken(consultation.id);
    if (!tokenResponse.token) throw new Error("Call token was not returned.");

    const joinResponse = await joinCall(consultation.id);
    return {
      appointmentId: consultation.id,
      callCid,
      token: tokenResponse.token,
      callStatus: normalizeCallStatus(joinResponse.callStatus),
    };
  }, [isAssignedClinician]);

  const startConsultation = useCallback(async (consultation: Consultation) => {
    if (activeCallAppointmentId || !canJoinConsultationCall(consultation)) return;
    setActiveCallAppointmentId(consultation.id);

    try {
      const session = await prepareCallSession(consultation);
      setActiveVideoCallSession({ appointmentId: session.appointmentId, callCid: session.callCid, token: session.token });
      toast.success(session.callStatus === "active" ? "Consultation session active." : "Consultation session ready.");
      void loadConsultations(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to join consultation.";
      toast.error(message);
    } finally {
      setActiveCallAppointmentId(null);
    }
  }, [activeCallAppointmentId, loadConsultations, prepareCallSession]);

  const rejoinConsultation = useCallback(async (consultation: Consultation) => {
    if (activeCallAppointmentId || !canJoinConsultationCall(consultation)) return;
    setActiveCallAppointmentId(consultation.id);

    try {
      const session = await prepareCallSession(consultation);
      setActiveVideoCallSession({ appointmentId: session.appointmentId, callCid: session.callCid, token: session.token });
      toast.success(session.callStatus === "active" ? "Consultation session active." : "Consultation session ready.");
      void loadConsultations(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to rejoin consultation.";
      toast.error(message);
    } finally {
      setActiveCallAppointmentId(null);
    }
  }, [activeCallAppointmentId, loadConsultations, prepareCallSession]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const directory = await fetchClinicianDirectory();
        if (!ignore) setClinicianNames(directory);
      } catch {
        if (!ignore) setClinicianNames({});
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const consultations = useMemo(
    () =>
      rawConsultations.map((consultation) =>
        consultation.clinicianId
          ? { ...consultation, clinician: clinicianNames[consultation.clinicianId] ?? "--" }
          : consultation,
      ),
    [rawConsultations, clinicianNames],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadConsultations());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clinicianOptions = useMemo(() => {
    const clinicians = Array.from(new Set(consultations.map((consultation) => consultation.clinician).filter(Boolean))).sort();
    return [{ label: "All Clinicians", value: "all" }, ...clinicians.map((clinician) => ({ label: clinician, value: clinician }))];
  }, [consultations]);

  const filteredConsultations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return consultations.filter((consultation) => {
      const matchesSearch = !normalizedSearch || [consultation.patientName, consultation.appointmentId, consultation.clinician]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "all" || consultation.status === statusFilter;
      const matchesClinician = clinicianFilter === "all" || consultation.clinician === clinicianFilter;
      const matchesDateFrom = !dateRange.dateFrom || consultation.scheduledDate >= dateRange.dateFrom;
      const matchesDateTo = !dateRange.dateTo || consultation.scheduledDate <= dateRange.dateTo;

      return matchesSearch && matchesStatus && matchesClinician && matchesDateFrom && matchesDateTo;
    });
  }, [clinicianFilter, consultations, dateRange.dateFrom, dateRange.dateTo, search, statusFilter]);

  const metrics = useMemo<MetricCardData[]>(() => {
    const upcomingCount = consultations.filter((consultation) => consultation.status === "upcoming" || consultation.status === "ready").length;
    const activeClinicians = new Set(
      consultations
        .filter((consultation) => consultation.status === "ready" || consultation.status === "in-progress")
        .map((consultation) => consultation.clinician)
        .filter(Boolean),
    ).size;
    const completedToday = consultations.filter((consultation) => consultation.status === "completed" && isToday(consultation.completedAt || consultation.scheduledDate)).length;
    const waitValues = consultations
      .map((consultation) => consultation.waitMinutes)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const averageWait = waitValues.length
      ? Math.round(waitValues.reduce((total, value) => total + value, 0) / waitValues.length)
      : 0;

    return [
      {
        title: "Upcoming Consultations",
        value: String(upcomingCount),
        description: `${upcomingCount} Upcoming Consultations`,
        icon: CalendarDays,
        iconClassName: "text-primary",
        iconWrapClassName: "bg-[#E7F2FF]",
      },
      {
        title: "Active Clinicians",
        value: String(activeClinicians),
        description: "Session active now",
        descriptionClassName: "text-red-500",
        icon: Target,
        iconClassName: "text-red-500",
        iconWrapClassName: "bg-red-50",
      },
      {
        title: "Completed Today",
        value: String(completedToday),
        description: completedToday ? "Completed today" : "No completed consultations today",
        icon: CheckCircle2,
        iconClassName: "text-primary",
        iconWrapClassName: "bg-[#E7F2FF]",
      },
      {
        title: "Average Wait Time",
        value: String(averageWait),
        description: `${averageWait} Minutes Average Wait Time`,
        icon: History,
        iconClassName: "text-primary",
        iconWrapClassName: "bg-[#E7F2FF]",
      },
    ];
  }, [consultations]);

  return (
    <>
      <div className="space-y-6">
        <Link
          href="/dashboard/appointments"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#71809B] transition-colors hover:text-[#111827]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Appointments
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#111827] md:text-2xl">Virtual Consultations</h1>
            <p className="mt-1 text-sm font-medium text-[#71809B]">
              Manage confirmed teleconsultation appointments and consultation sessions.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => loadConsultations(true)}
              disabled={isRefreshing || isLoading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#8AA0C0] bg-white px-5 text-sm font-semibold text-[#71809B] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <RefreshCcw className={cn("h-5 w-5", isRefreshing ? "animate-spin" : "")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              Today&apos;s Consultation
            </button>
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} metric={metric} />
          ))}
        </div>

        <section className="rounded-sm bg-white p-4">
          <div className="mb-7 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative h-10 w-full xl:max-w-[370px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71809B]" />
              <input
                type="text"
                placeholder="Search by name, ID, Department"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-full w-full rounded-md border border-border bg-white pl-10 pr-3 text-sm font-medium text-[#344054] placeholder:text-[#71809B] focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <FilterSelect
              className="w-full xl:w-[120px]"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "All Status", value: "all" },
                { label: "Ready to join", value: "ready" },
                { label: "Completed", value: "completed" },
                { label: "In Progress", value: "in-progress" },
                { label: "Upcoming", value: "upcoming" },
                { label: "Missed", value: "missed" },
              ]}
            />
            <FilterSelect className="w-full xl:w-[140px]" value={clinicianFilter} onChange={setClinicianFilter} options={clinicianOptions} />
            <AppointmentDateRangePicker dateFrom={dateRange.dateFrom} dateTo={dateRange.dateTo} onChange={setDateRange} />
            <button
              type="button"
              onClick={() => downloadConsultationsCsv(filteredConsultations)}
              className="flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-[#111827] xl:ml-auto"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-[#EEF4FF] text-xs font-semibold uppercase text-[#71809B]">
                  <th className="rounded-l-sm px-2 py-4 sm:px-3 xl:px-4">Patient Name</th>
                  <th className="hidden px-3 py-4 xl:table-cell">Appointment ID</th>
                  <th className="px-2 py-4 sm:px-3 xl:px-4">Scheduled</th>
                  <th className="hidden px-3 py-4 lg:table-cell">Clinician</th>
                  <th className="px-2 py-4 sm:px-3 xl:px-4">Status</th>
                  <th className="rounded-r-sm px-2 py-4 text-right sm:px-3 xl:px-4">Action</th>
                </tr>
              </thead>
              {isLoading ? (
                <tbody>
                  {Array.from({ length: 4 }, (_, index) => (
                    <tr key={index} className="border-b border-border text-sm text-[#344054] last:border-b-0">
                      {Array.from({ length: 6 }, (_item, cellIndex) => (
                        <td key={cellIndex} className="px-6 py-5">
                          <div className="h-4 w-full max-w-[150px] animate-pulse rounded bg-[#EEF2F7]" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ) : (
                <tbody>
                  {filteredConsultations.map((consultation) => (
                    <tr key={consultation.id} className="border-b border-border text-sm text-[#344054] last:border-b-0">
                      <td className="px-2 py-4 font-semibold text-[#111827] sm:px-3 xl:px-4"><p className="truncate" title={consultation.patientName}>{consultation.patientName}</p></td>
                      <td className="hidden px-3 py-4 font-medium xl:table-cell"><p className="truncate" title={consultation.appointmentId}>{consultation.appointmentId}</p></td>
                      <td className="px-2 py-4 sm:px-3 xl:px-4">
                        <p className="truncate font-bold">{consultation.scheduledPrimary}</p>
                        <p className="truncate font-medium">{consultation.scheduledSecondary}</p>
                      </td>
                      <td className="hidden px-3 py-4 font-medium lg:table-cell"><p className="truncate" title={consultation.clinician}>{consultation.clinician}</p></td>
                      <td className="px-2 py-4 sm:px-3 xl:px-4">
                        <ConsultationStatusBadge consultation={consultation} />
                      </td>
                      <td className="px-2 py-4 text-right sm:px-3 xl:px-4">
                        <div className="flex justify-end">
                          {shouldShowJoinAction(consultation, isAssignedClinician(consultation)) ? (
                            <button type="button" onClick={() => void startConsultation(consultation)} disabled={activeCallAppointmentId === consultation.id || !canJoinConsultationCall(consultation)} className="h-10 rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                              Join Consultation
                            </button>
                          ) : null}
                          {consultation.status === "in-progress" && isAssignedClinician(consultation) ? (
                            <button type="button" onClick={() => void rejoinConsultation(consultation)} disabled={activeCallAppointmentId === consultation.id || !canJoinConsultationCall(consultation)} className="h-10 rounded-xl border border-primary bg-white px-5 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-60">
                              Rejoin Session
                            </button>
                          ) : null}
                          {consultation.status === "completed" ? (
                            <Link href={`/dashboard/appointments/${encodeURIComponent(consultation.id)}`} className="text-xs font-bold text-primary">
                              View Details
                            </Link>
                          ) : null}
                          {shouldShowUpcomingActions(consultation, isAssignedClinician(consultation)) ? (
                            <div className="flex items-center gap-4 lg:gap-6">
                              <Link href={`/dashboard/appointments/${encodeURIComponent(consultation.id)}`} className="text-xs font-bold text-primary">
                                View Details
                              </Link>
                              <button type="button" onClick={() => setReschedulingAppointment(consultation)} className="text-xs font-bold text-[#344054]">
                                Reschedule
                              </button>
                            </div>
                          ) : null}
                          {(consultation.status === "ready" || consultation.status === "in-progress") && !isAssignedClinician(consultation) ? (
                            <Link href={`/dashboard/appointments/${encodeURIComponent(consultation.id)}`} className="text-xs font-bold text-primary">
                              View Details
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredConsultations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-[#71809B]">
                        No virtual consultations found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              )}
            </table>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-[#71809B]">Showing {filteredConsultations.length ? 1 : 0}-{filteredConsultations.length} of {filteredConsultations.length} Virtual Consultations</p>

            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous page" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-[#CBD5E1]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                1
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-[#111827]">
                2
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-[#111827]">
                3
              </button>
              <span className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-[#111827]">...</span>
              <button type="button" className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-[#111827]">
                29
              </button>
              <button type="button" aria-label="Next page" className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary text-primary">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <RescheduleAppointmentModal
        key={reschedulingAppointment ? `reschedule-${reschedulingAppointment.id}` : "reschedule-closed"}
        isOpen={Boolean(reschedulingAppointment)}
        appointmentId={reschedulingAppointment?.id}
        patientName={reschedulingAppointment?.patientName}
        appointmentReason={reschedulingAppointment?.reason}
        appointmentDate={reschedulingAppointment?.scheduledDate}
        appointmentTime={reschedulingAppointment?.scheduledTime}
        hospitalId={reschedulingAppointment?.hospitalId}
        initialAppointmentType={reschedulingAppointment?.appointmentType ?? "teleconsultation"}
        onClose={() => setReschedulingAppointment(null)}
        onSuccess={() => {
          toast.success("Appointment rescheduled successfully.");
          setReschedulingAppointment(null);
          void loadConsultations(true);
        }}
      />
      <ScheduleAppointmentModal
        open={isScheduleModalOpen}
        onOpenChange={setIsScheduleModalOpen}
        initialAppointmentType="teleconsultation"
        onAppointmentCreated={() => {
          void loadConsultations(true);
        }}
      />
      {activeVideoCallSession ? (
        <VideoCallView
          appointmentId={activeVideoCallSession.appointmentId}
          callCid={activeVideoCallSession.callCid}
          token={activeVideoCallSession.token}
          onEnd={async () => {
            setActiveVideoCallSession(null);
            await loadConsultations(true);
          }}
        />
      ) : null}
    </>
  );
}












