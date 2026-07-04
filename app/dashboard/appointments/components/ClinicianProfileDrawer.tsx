"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Clock3,
  Loader2,
  PencilLine,
  ShieldOff,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import AddClinicianScheduleModal from "./AddClinicianScheduleModal";
import AddScheduleOverrideModal from "./AddScheduleOverrideModal";
import {
  Sheet,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ClinicianProfileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  clinicianId?: string;
};

type ApiRecord = Record<string, unknown>;

type ClinicianProfile = {
  id: string;
  name: string;
  email: string;
  department: string;
  dailyCapacity: number;
  assignedToday: number;
  remainingToday: number;
  utilizationPercentage: number;
  workloadThresholdWarning: boolean;
  schedule: {
    id: string;
    workingDays: string[];
    workingHoursStart: string;
    workingHoursEnd: string;
    breakStart: string;
    breakEnd: string;
    dailyCapacity: number;
    supportedAppointmentTypes: string[];
    department: string;
  };
};

type AppointmentRow = {
  id: string;
  time: string;
  patient: string;
  type: string;
  status: string;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;
const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayNames: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const statusClasses: Record<string, string> = {
  Completed: "bg-[#DFFBF0] text-[#10B981]",
  "In Progress": "bg-[#D9EAFF] text-[#023E8A]",
  Scheduled: "bg-[#F2F4F7] text-[#71809B]",
  Cancelled: "bg-[#FFECEC] text-[#EF4444]",
};

const appointmentTypeLabels: Record<string, { label: string; icon: typeof Stethoscope }> = {
  in_person: { label: "Physical Visit", icon: Stethoscope },
  physical: { label: "Physical Visit", icon: Stethoscope },
  physical_visit: { label: "Physical Visit", icon: Stethoscope },
  teleconsultation: { label: "Teleconsultation", icon: Video },
  telecon: { label: "Teleconsultation", icon: Video },
  follow_up: { label: "Follow-up", icon: Clock3 },
  followup: { label: "Follow-up", icon: Clock3 },
  nurse_checkin: { label: "Nurse Check-in", icon: Clock3 },
};

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function unwrapData(payload: unknown) {
  const record = asRecord(payload);
  return record?.data ?? payload;
}

function getItems(payload: unknown) {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const record = asRecord(data);
  if (!record) return [];

  for (const key of ["items", "results", "appointments"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  return [];
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

function getNumber(record: ApiRecord | null, keys: string[], fallback = 0) {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }

  return fallback;
}

function getBoolean(record: ApiRecord | null, keys: string[], fallback = false) {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }

  return fallback;
}

function getStringArray(record: ApiRecord | null, keys: string[]) {
  if (!record) return [];

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  }

  return [];
}

function normalizeDay(day: string) {
  const trimmed = day.trim().slice(0, 3).toLowerCase();
  const found = dayOrder.find((item) => item.toLowerCase() === trimmed);
  return found ?? day;
}

function normalizeStatus(status: string) {
  const normalized = status.toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("complete")) return "Completed";
  if (normalized.includes("progress") || normalized.includes("checked")) return "In Progress";
  if (normalized.includes("cancel")) return "Cancelled";
  return "Scheduled";
}

function normalizeAppointmentType(type: string) {
  const normalized = type.toLowerCase().replace(/[-\s]+/g, "_");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("follow")) return "Follow-Up";
  if (normalized.includes("nurse")) return "Nurse Check-in";
  return "Physical";
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: string) {
  const parsed = Date.parse(value);
  if (value.includes("T") && Number.isFinite(parsed)) {
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(parsed));
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value || "--";

  const hour24 = Number(match[1]);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${match[2]} ${period}`;
}

function normalizeProfile(payload: unknown): ClinicianProfile {
  const record = asRecord(unwrapData(payload)) ?? {};
  const schedule = asRecord(record.schedule) ?? {};
  const dailyCapacity = getNumber(record, ["dailyCapacity"], getNumber(schedule, ["dailyCapacity"], 0));
  const assignedToday = getNumber(record, ["assignedToday", "assignedAppointments"], 0);
  const utilizationPercentage = Math.round(getNumber(record, ["utilizationPercentage", "capacityUtilization"], 0));

  return {
    id: getString(record, ["id", "clinicianId", "_id"]),
    name: getString(record, ["name", "fullName", "displayName"], "Unknown Clinician"),
    email: getString(record, ["email"], ""),
    department: getString(record, ["department"], getString(schedule, ["department"], "--")),
    dailyCapacity,
    assignedToday,
    remainingToday: getNumber(record, ["remainingToday"], Math.max(dailyCapacity - assignedToday, 0)),
    utilizationPercentage,
    workloadThresholdWarning: getBoolean(record, ["workloadThresholdWarning"], false),
    schedule: {
      id: getString(schedule, ["id", "scheduleId", "_id"], ""),
      workingDays: getStringArray(schedule, ["workingDays"]).map(normalizeDay),
      workingHoursStart: getString(schedule, ["workingHoursStart"], "--"),
      workingHoursEnd: getString(schedule, ["workingHoursEnd"], "--"),
      breakStart: getString(schedule, ["breakStart"], ""),
      breakEnd: getString(schedule, ["breakEnd"], ""),
      dailyCapacity: getNumber(schedule, ["dailyCapacity"], dailyCapacity),
      supportedAppointmentTypes: getStringArray(schedule, ["supportedAppointmentTypes"]),
      department: getString(schedule, ["department"], ""),
    },
  };
}

function normalizeAppointment(record: ApiRecord): AppointmentRow {
  const patient = asRecord(record.patient);

  return {
    id: getString(record, ["id", "appointmentId", "_id"]),
    time: formatTime(getString(record, ["time", "appointmentTime", "startsAt", "startTime", "date"])),
    patient: getString(record, ["patientName"], "") || getString(patient, ["name", "fullName"], "Unknown Patient"),
    type: normalizeAppointmentType(getString(record, ["type", "appointmentType"], "Physical")),
    status: normalizeStatus(getString(record, ["status"], "Scheduled")),
  };
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

async function authorizedRequest(path: string, init?: RequestInit, query?: URLSearchParams) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}${path}${query?.toString() ? `?${query}` : ""}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getString(asRecord(payload), ["message", "error"], "Request failed"));
  }

  return payload;
}

function getInitials(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "DR";
}

function getUtilizationTone(utilization: number) {
  if (utilization >= 90) return { label: "FULL", badge: "bg-[#FFECEC] text-[#EF4444]", bar: "bg-[#EF4444]", text: "text-[#EF4444]" };
  if (utilization >= 70) return { label: "NEAR CAPACITY", badge: "bg-[#FFF4E5] text-[#F59E0B]", bar: "bg-[#F59E0B]", text: "text-[#F59E0B]" };
  return { label: "AVAILABLE", badge: "bg-[#DFFBF0] text-[#10B981]", bar: "bg-[#10B981]", text: "text-[#10B981]" };
}

function getAnalytics(appointments: AppointmentRow[], profile: ClinicianProfile | null) {
  const completed = appointments.filter((appointment) => appointment.status === "Completed").length;
  const totalConfirmed = appointments.filter((appointment) => appointment.status !== "Cancelled").length;
  const physical = appointments.filter((appointment) => appointment.type === "Physical").length;
  const teleconsultation = appointments.filter((appointment) => appointment.type === "Teleconsultation").length;
  const followUp = appointments.filter((appointment) => appointment.type === "Follow-Up").length;

  return [
    { label: "Total Confirmed", value: String(totalConfirmed), note: "+2 from avg", noteClassName: "text-[#10B981]" },
    { label: "Completed", value: String(completed), note: `${profile?.utilizationPercentage ?? 0}% Pace`, noteClassName: "text-[#344054]" },
    { label: "Remaining", value: String(profile?.remainingToday ?? Math.max(totalConfirmed - completed, 0)), note: "High Density", noteClassName: "text-[#F59E0B]" },
    { label: "PHYSICAL", value: String(physical) },
    { label: "TELECONSULTATION", value: String(teleconsultation) },
    { label: "FOLLOW-UP", value: String(followUp) },
  ];
}

function getSupportedTypeBadges(types: string[]) {
  return Array.from(new Set(types)).map((type) => {
    const key = type.toLowerCase().replace(/[\s-]+/g, "_");
    return appointmentTypeLabels[key] ?? { label: type, icon: Clock3 };
  });
}

function groupWeeklyAvailability(days: string[], start: string, end: string) {
  const ordered = dayOrder.filter((day) => days.includes(day));
  const groups: { day: string; time: string }[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const startDay = ordered[index];
    let endIndex = index;

    while (endIndex + 1 < ordered.length && dayOrder.indexOf(ordered[endIndex + 1]) === dayOrder.indexOf(ordered[endIndex]) + 1) {
      endIndex += 1;
    }

    const endDay = ordered[endIndex];
    groups.push({
      day: startDay === endDay ? dayNames[startDay] ?? startDay : `${startDay} - ${endDay}`,
      time: `${start} - ${end}`,
    });
    index = endIndex;
  }

  return groups;
}

function SectionHeader({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h3 className="text-base font-bold tracking-[0.02em] text-[#111827]">{title}</h3>
      {aside ? <span className="text-sm font-bold text-[#111827]">{aside}</span> : null}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-8 pb-40">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-[#DDE3EC] bg-white" />
        ))}
      </div>
      <div className="mt-7 h-40 animate-pulse rounded-xl bg-[#EEF2F7]" />
      <div className="mt-7 h-72 animate-pulse rounded-xl bg-[#EEF2F7]" />
      <div className="mt-7 h-48 animate-pulse rounded-xl bg-[#EEF2F7]" />
    </div>
  );
}

export default function ClinicianProfileDrawer({ isOpen, onClose, clinicianId }: ClinicianProfileDrawerProps) {
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [capturedClinicianId, setCapturedClinicianId] = useState("");
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const match = url.match(/\/clinicians\/([^/?#]+)(?!\/schedule)/);
      if (match?.[1]) setCapturedClinicianId(decodeURIComponent(match[1]));
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const activeClinicianId = clinicianId || capturedClinicianId;

  const loadProfile = useCallback(async () => {
    if (!activeClinicianId) return;

    setIsLoading(true);
    setError("");

    try {
      const profilePayload = await authorizedRequest(`/clinicians/${encodeURIComponent(activeClinicianId)}`);
      const nextProfile = normalizeProfile(profilePayload);
      const today = formatDateParam(new Date());
      const query = new URLSearchParams({ clinicianId: activeClinicianId, dateFrom: today, dateTo: today });
      const appointmentsPayload = await authorizedRequest("/appointments", undefined, query);

      setProfile(nextProfile);
      setAppointments(getItems(appointmentsPayload).map(normalizeAppointment));
    } catch (requestError) {
      setProfile(null);
      setAppointments([]);
      setError(requestError instanceof Error ? requestError.message : "Failed to load clinician profile.");
    } finally {
      setIsLoading(false);
    }
  }, [activeClinicianId]);

  useEffect(() => {
    if (!isOpen) return;
    void Promise.resolve().then(loadProfile);
  }, [isOpen, loadProfile]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const tone = getUtilizationTone(profile?.utilizationPercentage ?? 0);
  const analyticsCards = useMemo(() => getAnalytics(appointments, profile), [appointments, profile]);
  const appointmentTypeFilters = useMemo(() => getSupportedTypeBadges(profile?.schedule.supportedAppointmentTypes ?? []), [profile]);
  const weeklyAvailability = useMemo(
    () => groupWeeklyAvailability(profile?.schedule.workingDays ?? [], profile?.schedule.workingHoursStart ?? "--", profile?.schedule.workingHoursEnd ?? "--"),
    [profile],
  );

  const topMetrics = [
    { label: "DAILY CAP", value: String(profile?.dailyCapacity ?? 0) },
    { label: "ASSIGNED", value: String(profile?.assignedToday ?? 0) },
    { label: "REMAINING", value: String(profile?.remainingToday ?? 0) },
    { label: "UTILIZATION", value: `${profile?.utilizationPercentage ?? 0}%`, valueClassName: tone.text },
  ];

  const deactivateSchedule = async () => {
    if (!activeClinicianId || !window.confirm("Are you sure you want to deactivate this schedule?")) return;

    setIsDeactivating(true);
    setToast("");

    try {
      await authorizedRequest(`/clinicians/${encodeURIComponent(activeClinicianId)}/schedule`, {
        method: "POST",
        body: JSON.stringify({ isActive: false }),
      });
      setToast("Schedule deactivated successfully");
      window.dispatchEvent(new CustomEvent("clinicians:refresh"));
      onClose();
    } catch (requestError) {
      setToast(requestError instanceof Error ? requestError.message : "Failed to deactivate schedule.");
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <>
      {toast ? (
        <div className="fixed right-6 top-6 z-[80] rounded-lg border border-[#DDE3EC] bg-white px-4 py-3 text-sm font-semibold text-[#023E8A] shadow-lg">
          {toast}
        </div>
      ) : null}
      <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <SheetPortal>
          <SheetOverlay className="bg-[#111827]/55 backdrop-blur-[3px]" />
          <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[600px] flex-col border-l border-[#DDE3EC] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.36)] outline-none duration-300 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=open]:animate-in">
            <header className="flex items-start justify-between gap-4 border-b border-[#DDE3EC] bg-white px-4 sm:px-6 py-4 sm:py-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#DDE3EC] bg-[linear-gradient(135deg,#E7F2FF,#F2F4F7)] text-base font-bold text-[#023E8A] ring-4 ring-[#F8FAFC]">
                  {profile ? getInitials(profile.name) : isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "--"}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle className="text-lg font-bold md:text-xl text-[#0F2747]">{profile?.name ?? "Clinician Profile"}</SheetTitle>
                    {profile ? <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase", tone.badge)}>{tone.label}</span> : null}
                  </div>
                  <SheetDescription className="mt-1 text-sm font-medium text-[#344054]">
                    {profile ? `${profile.department} • ${profile.assignedToday}/${profile.dailyCapacity} assigned • ${profile.utilizationPercentage}% Utilized` : "Loading clinician details"}
                  </SheetDescription>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close clinician profile drawer"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#344054] transition-colors hover:bg-[#F3F4F6]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {isLoading ? <LoadingSkeleton /> : null}

            {!isLoading && error ? (
              <div className="flex-1 px-4 sm:px-6 py-10 pb-40">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm font-semibold text-red-600">
                  {error}
                </div>
                <Button type="button" onClick={loadProfile} className="mt-4 h-10 rounded-xl bg-[#023E8A] text-sm font-bold text-white hover:bg-[#023575]">
                  Retry
                </Button>
              </div>
            ) : null}

            {!isLoading && !error && profile ? (
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-8 pb-40">
                <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {topMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-[#DDE3EC] bg-white px-4 py-5 text-center shadow-sm">
                      <p className="text-xs font-bold tracking-[0.08em] text-[#344054]">{metric.label}</p>
                      <p className={cn("mt-3 text-lg font-bold md:text-2xl text-[#111827]", metric.valueClassName)}>{metric.value}</p>
                    </div>
                  ))}
                </section>

                <section className="mt-7">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <h3 className="text-base font-bold tracking-[0.02em] text-[#111827]">WORKLOAD THRESHOLD</h3>
                    <span className={cn("text-sm font-bold", tone.text)}>{profile.utilizationPercentage}% / 100%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.min(profile.utilizationPercentage, 100)}%` }} />
                  </div>
                  {profile.workloadThresholdWarning ? (
                    <div className="mt-6 rounded-xl border border-[#F59E0B] bg-[#FFF7ED] px-5 py-5">
                      <div className="flex gap-4 text-[#F59E0B]">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                          <p className="text-base font-bold">Near Capacity Warning</p>
                          <p className="mt-1 text-sm font-medium leading-5">
                            {profile.name} is reaching daily limits. Only {profile.remainingToday} slots remaining for overrides today. Please coordinate with shift supervisor for additional assignments.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="mt-7">
                  <SectionHeader title="TODAY'S SCHEDULE" aside={`${appointments.length} Total Appointments`} />
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader className="bg-[#EFF5FF]">
                        <TableRow className="border-0 hover:bg-[#EFF5FF]">
                          {["TIME", "PATIENT", "TYPE", "STATUS"].map((heading) => (
                            <TableHead key={heading} className="h-11 px-4 text-xs font-medium text-[#344054]">
                              {heading}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.map((row) => (
                          <TableRow key={row.id || `${row.time}-${row.patient}`} className="border-0 hover:bg-transparent">
                            <TableCell className="px-4 py-4 text-sm font-medium text-[#111827]">{row.time}</TableCell>
                            <TableCell className="px-4 py-4 text-sm font-medium text-[#344054]">{row.patient}</TableCell>
                            <TableCell className="px-4 py-4 text-sm font-medium text-[#344054]">{row.type}</TableCell>
                            <TableCell className="px-4 py-4">
                              <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", statusClasses[row.status] ?? statusClasses.Scheduled)}>
                                {row.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {appointments.length === 0 ? (
                          <TableRow className="border-0 hover:bg-transparent">
                            <TableCell colSpan={4} className="px-4 py-6 text-center text-sm font-medium text-[#71809B]">No appointments scheduled today.</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                <section className="mt-7">
                  <SectionHeader title="WORKLOAD ANALYTICS" />
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {analyticsCards.map((card) => (
                      <div key={card.label} className="rounded-xl border border-[#DDE3EC] bg-white px-4 py-4 shadow-sm">
                        <p className="text-xs font-bold tracking-[0.04em] text-[#344054]">{card.label}</p>
                        <div className="mt-2 flex items-end justify-between gap-3">
                          <p className="text-lg font-bold md:text-xl text-[#023E8A]">{card.value}</p>
                          {card.note ? <span className={cn("pb-1 text-xs font-bold", card.noteClassName)}>{card.note}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <p className="mb-4 text-xs font-bold tracking-[0.08em] text-[#344054]">APPOINTMENT TYPES</p>
                    <div className="flex flex-wrap gap-2">
                      {appointmentTypeFilters.map((filter) => {
                        const Icon = filter.icon;

                        return (
                          <span
                            key={filter.label}
                            className="inline-flex h-8 items-center gap-2 rounded border border-[#023E8A] bg-white px-3 text-xs font-medium text-[#023E8A]"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {filter.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="mt-7">
                  <SectionHeader title="WEEKLY AVAILABILITY" />
                  <div className="space-y-2">
                    {weeklyAvailability.map((slot) => (
                      <div
                        key={slot.day}
                        className="flex min-h-12 items-center justify-between rounded-lg border border-[#DDE3EC] bg-white px-4 text-sm font-medium text-[#111827] shadow-sm"
                      >
                        <span>{slot.day}</span>
                        <span className="font-bold text-[#344054]">{slot.time}</span>
                      </div>
                    ))}
                    {weeklyAvailability.length === 0 ? <p className="text-sm font-medium text-[#71809B]">No availability configured.</p> : null}
                  </div>
                </section>
              </div>
            ) : null}

            <footer className="fixed bottom-0 right-0 z-[51] w-full max-w-[600px] border-t border-[#C9D5E5] bg-white px-4 sm:px-6 py-4 sm:py-6 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" onClick={() => setIsScheduleModalOpen(true)} className="h-10 rounded-xl bg-[#023E8A] text-sm font-bold text-white hover:bg-[#023575]">
                  <PencilLine className="h-4 w-4" />
                  Edit Schedule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOverrideModalOpen(true)}
                  className="h-10 rounded-xl border-[#023E8A] bg-white text-sm font-bold text-[#023E8A] hover:bg-[#F5FAFF]"
                >
                  <PencilLine className="h-4 w-4" />
                  Add Override
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isDeactivating || !activeClinicianId}
                onClick={() => void deactivateSchedule()}
                className="mt-4 h-10 w-full rounded-xl border-[#EF4444] bg-white text-sm font-bold text-[#EF4444] hover:bg-[#FFF5F5] hover:text-[#EF4444] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                {isDeactivating ? "Deactivating..." : "Deactivate Schedule"}
              </Button>
            </footer>
          </DialogPrimitive.Content>

          <AddScheduleOverrideModal
            isOpen={isOverrideModalOpen}
            onClose={() => setIsOverrideModalOpen(false)}
          />
          <AddClinicianScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
          />
        </SheetPortal>
      </Sheet>
    </>
  );
}