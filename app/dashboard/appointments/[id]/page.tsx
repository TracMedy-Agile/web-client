"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  MessageSquare,
  MoreVertical,
  RefreshCcw,
  Send,
  Stethoscope,
  UserRound,
  UserX,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import {
  checkInAppointment,
  confirmAppointment,
  getAppointmentById,
  markNoShow,
} from "@/lib/api/appointments";
import { cn } from "@/lib/utils";
import CancelAppointmentModal from "../components/CancelAppointmentModal";
import RescheduleAppointmentModal from "../components/RescheduleAppointmentModal";

type ApiRecord = Record<string, unknown>;

type ClinicianOption = {
  id: string;
  name: string;
  department: string;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

type AppointmentHistoryStep = {
  title: string;
  description: string;
  timestamp?: string;
  active?: boolean;
};

type AppointmentDetails = {
  id: string;
  clinicianId: string | null;
  appointmentCode: string;
  rawStatus: string;
  status: string;
  patient: {
    initials: string;
    name: string;
    hospitalId: string;
    ageGender: string;
    phone: string;
    email: string;
  };
  details: {
    appointmentId: string;
    status: string;
    dateTime: string;
    bookedVia: string;
    linkedEpisode: string;
    createdBy: string;
    bookingDate: string;
    previousDateTime: string;
    cancelledReason: string;
    rescheduleReason: string;
  };
  service: {
    department: string;
    type: string;
    assignedDoctor: string;
  };
  notes: {
    reason: string;
    additional: string;
  };
  communication: {
    message: string;
    timestamp: string;
  };
  history: AppointmentHistoryStep[];
};

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function unwrapData(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return payload;
  return record.data ?? payload;
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

function getNullableString(record: ApiRecord | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    if (!(key in record)) continue;
    const value = record[key];
    if (value === null) return null;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number") return String(value);
  }

  return null;
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

async function authorizedRequest(path: string, init?: RequestInit) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(getString(asRecord(payload), ["message", "error"], "Request failed"));
    error.name = getString(asRecord(payload), ["errorCode", "code", "type"], "");
    throw error;
  }

  return payload;
}

function normalizeClinician(record: ApiRecord): ClinicianOption {
  const id = getString(record, ["id", "clinicianId", "_id"]);
  const name = getString(record, ["name", "fullName", "displayName"], id || "Unnamed clinician");
  const department = getString(record, ["department", "specialty", "specialization"], "");
  return { id, name, department };
}

function isClinicianUnavailableError(error: unknown) {
  return error instanceof Error && error.name === "CLINICIAN_UNAVAILABLE";
}


function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PT";
}

function normalizeStatusKey(status: string) {
  return status.toLowerCase().replace(/[\s-]+/g, "_");
}

function mapType(type: string) {
  const normalized = type.toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("nurse")) return "Nurse Check-in";
  return "Physical Visit";
}

function mapStatus(status: string) {
  const normalized = normalizeStatusKey(status);
  if (normalized.includes("pending")) return "Pending";
  if (normalized.includes("cancel")) return "Canceled";
  if (normalized.includes("rescheduled")) return "Rescheduled";
  if (normalized.includes("no_show")) return "No Show";
  if (normalized.includes("checked_in")) return "Checked In";
  if (normalized.includes("complete")) return "Completed";
  return "Confirmed";
}

function statusBadgeClass(status: string) {
  const normalized = normalizeStatusKey(status);
  if (normalized.includes("confirm") || normalized.includes("checked_in") || normalized.includes("complete")) return "bg-emerald-100 text-emerald-600";
  if (normalized.includes("cancel") || normalized.includes("no_show")) return "bg-red-100 text-red-500";
  return "bg-orange-100 text-orange-500";
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
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return value || "--";
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(parsed));
}

function formatTime(value: string) {
  const parsed = Date.parse(value);
  if (value.includes("T") && Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return minutesToDisplayTime(date.getHours() * 60 + date.getMinutes());
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (match) return minutesToDisplayTime(Number(match[1]) * 60 + Number(match[2]));
  return value || "--";
}

function formatDateTime(dateValue: string, timeValue: string) {
  const date = formatDate(dateValue);
  const time = formatTime(timeValue || dateValue);
  return date === "--" && time === "--" ? "--" : `${date} - ${time}`;
}

function getHistoryItems(record: ApiRecord, fallbackStatus: string, fallbackDate: string): AppointmentHistoryStep[] {
  const rawHistory = record.statusHistory;

  if (Array.isArray(rawHistory) && rawHistory.length > 0) {
    return rawHistory
      .map((item, index) => {
        const historyRecord = asRecord(item);
        const status = getString(historyRecord, ["status", "title"], fallbackStatus);
        const timestamp = getString(historyRecord, ["createdAt", "timestamp", "date"], "");

        return {
          title: mapStatus(status),
          description: getString(historyRecord, ["description", "reason", "notes", "message"], "Appointment status updated"),
          timestamp: timestamp ? formatDateTime(timestamp, timestamp) : undefined,
          active: index === 0,
        };
      });
  }

  return [
    { title: mapStatus(fallbackStatus), description: "Latest appointment state from the API", timestamp: fallbackDate, active: true },
    { title: "Doctor Assigned", description: "Waiting for administrator to assign clinical staff" },
    { title: "Confirmed", description: "Visit scheduled and notification sent" },
    { title: "Completed", description: "Post-visit documentation and summary" },
  ];
}

function normalizeAppointment(payload: unknown, fallbackId: string): AppointmentDetails {
  const record = asRecord(unwrapData(payload)) ?? {};
  const patient = asRecord(record.patient);
  const clinician = asRecord(record.clinician) ?? asRecord(record.assignedStaff) ?? asRecord(record.doctor);
  const departmentRecord = asRecord(record.department);
  const careEpisode = asRecord(record.careEpisode);
  const patientName = getString(record, ["patientName"], "") || getString(patient, ["name", "fullName"], "Unknown Patient");
  const rawStatus = normalizeStatusKey(getString(record, ["status"], "pending"));
  const status = mapStatus(rawStatus);
  const appointmentCode = getString(record, ["appointmentId", "code", "id"], fallbackId);
  const date = getString(record, ["date", "appointmentDate", "scheduledDate", "startsAt", "startTime"]);
  const time = getString(record, ["time", "appointmentTime", "scheduledTime", "startsAt", "startTime"]);
  const previousDate = getString(record, ["previousDate", "oldDate"]);
  const previousTime = getString(record, ["previousTime", "oldTime"]);
  const bookingDate = formatDateTime(getString(record, ["createdAt", "bookingDate"]), getString(record, ["createdAt", "bookingDate"]));
  const department = getString(record, ["department", "service"], "") || getString(departmentRecord, ["name"], "Unassigned");
  const clinicianId = getNullableString(record, ["clinicianId"]) ?? getNullableString(clinician, ["id", "clinicianId", "_id"]);
  const assignedDoctor = clinicianId ? getString(record, ["clinicianName", "doctor", "assignedDoctor"], "") || getString(clinician, ["name", "fullName"], "None assigned") : "None assigned";
  const patientAgeGender = [getString(patient, ["age"]), getString(patient, ["gender", "sex"])].filter(Boolean).join(" yrs, ");

  return {
    id: getString(record, ["id"], fallbackId),
    clinicianId,
    appointmentCode,
    rawStatus,
    status,
    patient: {
      initials: getInitials(patientName),
      name: patientName,
      hospitalId: getString(record, ["hospitalId", "patientHospitalId"], "") || getString(patient, ["hospitalId", "tracmedyId", "medicalRecordNumber", "id"], "--"),
      ageGender: patientAgeGender || "--",
      phone: getString(record, ["phone"], "") || getString(patient, ["phone", "phoneNumber"], "--"),
      email: getString(record, ["email"], "") || getString(patient, ["email"], "--"),
    },
    details: {
      appointmentId: appointmentCode,
      status,
      dateTime: formatDateTime(date, time),
      bookedVia: getString(record, ["bookedVia", "source"], "Patient App"),
      linkedEpisode: getString(record, ["linkedEpisode"], "") || getString(careEpisode, ["code", "id", "title"], "--"),
      createdBy: getString(record, ["createdBy"], "Patient (Self-booked)"),
      bookingDate,
      previousDateTime: previousDate || previousTime ? formatDateTime(previousDate, previousTime) : "",
      cancelledReason: getString(record, ["cancelledReason", "cancelReason", "cancellationReason"], ""),
      rescheduleReason: getString(record, ["rescheduleReason", "rescheduledReason"], ""),
    },
    service: {
      department,
      type: mapType(getString(record, ["type", "appointmentType"], "in_person")),
      assignedDoctor,
    },
    notes: {
      reason: getString(record, ["reason"], "No reason provided."),
      additional: getString(record, ["notes", "additionalNotes", "description"], "No additional notes."),
    },
    communication: {
      message: getString(record, ["lastCommunication"], "Appointment request received and awaiting confirmation."),
      timestamp: formatDateTime(getString(record, ["updatedAt", "createdAt"]), getString(record, ["updatedAt", "createdAt"])),
    },
    history: getHistoryItems(record, rawStatus, bookingDate),
  };
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-border bg-white p-4 shadow-sm md:p-6", className)}>{children}</section>;
}

function CardHeader({ icon, title, showChevron = false }: { icon: React.ReactNode; title: string; showChevron?: boolean }) {
  return (
    <div className="mb-7 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E7F2FF] text-primary">{icon}</span>
        <h2 className="text-xl font-bold text-[#111827]">{title}</h2>
      </div>
      {showChevron ? <ChevronRight className="h-5 w-5 text-[#111827]" /> : null}
    </div>
  );
}

function DetailItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#344054]">{label}</p>
      <div className="mt-1 text-sm font-bold text-[#111827]">{value}</div>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-64 animate-pulse rounded-xl border border-border bg-white p-4 shadow-sm md:p-6">
          <div className="h-6 w-44 rounded bg-[#EEF2F7]" />
          <div className="mt-8 space-y-4">
            <div className="h-4 w-full rounded bg-[#EEF2F7]" />
            <div className="h-4 w-2/3 rounded bg-[#EEF2F7]" />
            <div className="h-4 w-4/5 rounded bg-[#EEF2F7]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppointmentDetailsPage() {
  const params = useParams<{ id: string }>();
  const appointmentId = decodeURIComponent(params.id);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [clinicians, setClinicians] = useState<ClinicianOption[]>([]);
  const [isDoctorSelectorOpen, setIsDoctorSelectorOpen] = useState(false);
  const [isLoadingClinicians, setIsLoadingClinicians] = useState(false);
  const [isAssigningDoctor, setIsAssigningDoctor] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [clinicianUnavailableError, setClinicianUnavailableError] = useState("");
  const [pendingClinicianId, setPendingClinicianId] = useState<string | null>(null);
  const [forceAssignChecked, setForceAssignChecked] = useState(false);
  const [resolvedDoctorName, setResolvedDoctorName] = useState<string | null>(null);

  const loadAppointment = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const payload = await getAppointmentById(appointmentId);
      setAppointment(normalizeAppointment(payload, appointmentId));
    } catch (requestError) {
      setAppointment(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to load appointment.");
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void Promise.resolve().then(loadAppointment);
  }, [loadAppointment]);

  // AppointmentResponseDto only exposes clinicianId, not a clinician name — resolve the display
  // name via GET /clinicians/:id whenever a clinician is actually assigned.
  useEffect(() => {
    const clinicianId = appointment?.clinicianId;
    if (!clinicianId) return;

    let ignore = false;

    (async () => {
      setResolvedDoctorName(null);
      try {
        const payload = await authorizedRequest(`/clinicians/${encodeURIComponent(clinicianId)}`);
        const record = asRecord(asRecord(payload)?.data) ?? asRecord(payload);
        const name = getString(record, ["name"]);
        const department = getString(record, ["department"]);
        if (!ignore) setResolvedDoctorName(name ? `Dr. ${name}${department ? ` - ${department}` : ""}` : null);
      } catch {
        if (!ignore) setResolvedDoctorName(null);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [appointment?.clinicianId]);


  const historySteps = useMemo(() => appointment?.history ?? [], [appointment]);

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setActiveAction(label);
    setActionError("");
    setNotice("");

    try {
      await action();
      setNotice(`${label} successfully.`);
      await loadAppointment();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : `${label} failed.`);
    } finally {
      setActiveAction(null);
      setIsActionsOpen(false);
    }
  };


  const loadClinicians = async () => {
    setIsDoctorSelectorOpen(true);
    setAssignmentError("");
    setClinicianUnavailableError("");
    setPendingClinicianId(null);
    setForceAssignChecked(false);

    if (clinicians.length > 0) return;

    setIsLoadingClinicians(true);
    try {
      const payload = await authorizedRequest("/clinicians");
      const dataRecord = asRecord(asRecord(payload)?.data);
      const items = Array.isArray(dataRecord?.data)
        ? dataRecord.data.filter((item): item is ApiRecord => Boolean(asRecord(item)))
        : [];
      setClinicians(items.map(normalizeClinician).filter((clinician) => clinician.id));
    } catch (requestError) {
      setAssignmentError(requestError instanceof Error ? requestError.message : "Failed to load clinicians.");
    } finally {
      setIsLoadingClinicians(false);
    }
  };

  const assignClinician = async (clinicianId: string, force = false) => {
    await authorizedRequest(`/appointments/${encodeURIComponent(appointmentId)}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ clinicianId, force }),
    });
  };

  const handleClinicianSelected = async (clinicianId: string) => {
    if (!clinicianId) return;

    setIsAssigningDoctor(true);
    setAssignmentError("");
    setClinicianUnavailableError("");
    setPendingClinicianId(null);
    setForceAssignChecked(false);

    try {
      await assignClinician(clinicianId);
    } catch (requestError) {
      if (!isClinicianUnavailableError(requestError)) {
        setAssignmentError(requestError instanceof Error ? requestError.message : "Failed to assign clinician.");
        setIsAssigningDoctor(false);
        return;
      }

      toast.warning(
        "Clinician is not available at the requested appointment time. Please select another clinician or reschedule the appointment.",
      );
      setClinicianUnavailableError("This clinician is not available at the appointment time.");
      setPendingClinicianId(clinicianId);
      setIsAssigningDoctor(false);
      return;
    }

    toast.success("Doctor assigned successfully.");
    setNotice("Doctor assigned successfully.");
    setIsDoctorSelectorOpen(false);
    setClinicianUnavailableError("");
    setPendingClinicianId(null);
    setForceAssignChecked(false);
    await loadAppointment();
    setIsAssigningDoctor(false);
  };

  const handleForceAssignToggle = async (checked: boolean) => {
    setForceAssignChecked(checked);
    if (!checked || !pendingClinicianId) return;

    setIsAssigningDoctor(true);
    setAssignmentError("");

    try {
      await assignClinician(pendingClinicianId, true);
    } catch (forcedError) {
      setAssignmentError(forcedError instanceof Error ? forcedError.message : "Failed to assign clinician.");
      setIsAssigningDoctor(false);
      return;
    }

    toast.success("Doctor assigned successfully.");
    setNotice("Doctor assigned successfully.");
    setIsDoctorSelectorOpen(false);
    setClinicianUnavailableError("");
    setPendingClinicianId(null);
    setForceAssignChecked(false);
    await loadAppointment();
    setIsAssigningDoctor(false);
  };
  const rawStatus = appointment?.rawStatus ?? "";
  const isPending = rawStatus === "pending";
  const isConfirmed = rawStatus === "confirmed";
  const canConfirm = isPending;
  const canComplete = isConfirmed;
  const canReschedule = isPending || isConfirmed;
  const canCancel = isPending || isConfirmed;
  const canShowMoreActions = isConfirmed;
  const needsClinician = isPending && !appointment?.clinicianId;

  const handleConfirmClick = () => {
    if (needsClinician) {
      toast.error("Please assign a doctor before confirming");
      return;
    }

    void runAction("Appointment confirmed", () => confirmAppointment(appointmentId));
  };

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-5">
            <Link href="/dashboard/appointments" aria-label="Back to appointments" className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] text-[#111827]">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-lg font-bold text-[#111827] md:text-2xl">{appointment?.appointmentCode ?? appointmentId}</h1>
                <span className={cn("rounded-full px-3 py-1 text-xs font-bold", statusBadgeClass(appointment?.rawStatus ?? "pending"))}>{appointment?.status ?? "Loading"}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-[#71809B]">Manage patient visit details and logistics.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canConfirm ? (
              <button type="button" disabled={!appointment || Boolean(activeAction) || needsClinician} onClick={handleConfirmClick} className="flex h-11 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                {activeAction === "Appointment confirmed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm
              </button>
            ) : null}
            {canComplete ? (
              <button type="button" disabled={!appointment || Boolean(activeAction)} onClick={() => runAction("Appointment marked as completed", () => checkInAppointment(appointmentId))} className="flex h-11 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                {activeAction === "Appointment marked as completed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark as Completed
              </button>
            ) : null}
            {canReschedule ? (
              <button type="button" disabled={!appointment || Boolean(activeAction)} onClick={() => setIsRescheduleOpen(true)} className="flex h-11 items-center gap-2 rounded-xl border border-[#8AA0C0] bg-white px-5 text-sm font-bold text-[#344054] disabled:cursor-not-allowed disabled:opacity-60">
                <RefreshCcw className="h-4 w-4" />
                Reschedule
              </button>
            ) : null}
            {canCancel ? (
              <button type="button" disabled={!appointment || Boolean(activeAction)} onClick={() => setIsCancelOpen(true)} className="flex h-11 items-center gap-2 rounded-xl border border-red-500 bg-white px-5 text-sm font-bold text-red-500 disabled:cursor-not-allowed disabled:opacity-60">
                <X className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
            {canShowMoreActions ? (
              <div className="relative">
                <button type="button" aria-label="More appointment actions" disabled={!appointment || Boolean(activeAction)} onClick={() => setIsActionsOpen((current) => !current)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#8AA0C0] bg-white text-[#71809B] disabled:cursor-not-allowed disabled:opacity-60">
                  <MoreVertical className="h-5 w-5" />
                </button>
                {isActionsOpen ? (
                  <div className="absolute right-0 top-14 z-20 w-52 rounded-lg border border-border bg-white py-2 shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
                    <button type="button" onClick={() => runAction("Appointment marked as no-show", () => markNoShow(appointmentId))} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-[#111827] transition-colors hover:bg-[#F8FAFC]">
                      {activeAction === "Appointment marked as no-show" ? <Loader2 className="h-4 w-4 animate-spin text-[#71809B]" /> : <UserX className="h-4 w-4 text-[#71809B]" />}
                      Mark as No-show
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600">{notice}</div> : null}
        {actionError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{actionError}</div> : null}

        {isLoading ? <DetailsSkeleton /> : null}

        {!isLoading && error ? (
          <div className="rounded-xl border border-red-200 bg-white px-4 sm:px-6 py-10 text-center">
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button type="button" onClick={loadAppointment} className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white">Retry</button>
          </div>
        ) : null}

        {!isLoading && !error && !appointment ? (
          <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-4 sm:px-6 py-16 text-center text-sm font-semibold text-[#71809B]">No appointment found.</div>
        ) : null}

        {!isLoading && !error && appointment ? (
          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Card>
                <CardHeader icon={<UsersRound className="h-5 w-5" />} title="Patient Information" showChevron />
                <div className="flex items-center gap-4 lg:gap-6">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold md:text-3xl text-white">{appointment.patient.initials}</div>
                  <div>
                    <h3 className="text-lg font-bold text-[#111827]">{appointment.patient.name}</h3>
                    <p className="mt-3 text-base font-medium text-[#344054]">Hospital ID: <Link href="#" className="font-bold text-[#1473E6]">{appointment.patient.hospitalId}</Link></p>
                  </div>
                </div>
                <div className="mt-9 space-y-5">
                  <div className="flex items-center justify-between gap-4"><p className="font-medium text-[#344054]">Age / Gender</p><p className="font-bold text-[#111827]">{appointment.patient.ageGender}</p></div>
                  <div className="flex items-center justify-between gap-4"><p className="font-medium text-[#344054]">Phone</p><p className="font-bold text-[#111827]">{appointment.patient.phone}</p></div>
                  <div className="flex items-center justify-between gap-4"><p className="font-medium text-[#344054]">Email</p><p className="font-bold text-[#111827]">{appointment.patient.email}</p></div>
                </div>
              </Card>

              <Card>
                <CardHeader icon={<CalendarDays className="h-5 w-5" />} title="Appointment Details" />
                <div className="grid gap-x-16 gap-y-5 md:grid-cols-2">
                  <DetailItem label="Appointment ID" value={appointment.details.appointmentId} />
                  <DetailItem label="Status" value={<span className={cn(statusBadgeClass(appointment.rawStatus).includes("orange") ? "text-orange-500" : statusBadgeClass(appointment.rawStatus).includes("red") ? "text-red-500" : "text-emerald-600")}>{appointment.details.status}</span>} />
                  <DetailItem label="Date & Time" value={appointment.details.dateTime} />
                  <DetailItem label="Booked Via" value={appointment.details.bookedVia} />
                  <DetailItem label="Linked Episode" value={<Link href="#" className="text-[#1473E6]">{appointment.details.linkedEpisode}</Link>} />
                  <DetailItem label="Created By" value={appointment.details.createdBy} />
                  <DetailItem label="Booking Date" value={appointment.details.bookingDate} />
                  {appointment.details.previousDateTime ? <DetailItem label="Previous Date & Time" value={appointment.details.previousDateTime} /> : null}
                  {appointment.details.rescheduleReason ? <DetailItem label="Reschedule Reason" value={appointment.details.rescheduleReason} /> : null}
                  {appointment.details.cancelledReason ? <DetailItem label="Cancelled Reason" value={appointment.details.cancelledReason} /> : null}
                </div>
              </Card>

              <Card>
                <CardHeader icon={<Clock3 className="h-5 w-5" />} title="Appointment History" />
                <div className="relative pl-8">
                  <span className="absolute left-[15px] top-5 h-[calc(100%-52px)] w-px bg-[#D5DCE8]" />
                  <div className="space-y-8">
                    {historySteps.map((step, index) => (
                      <div key={`${step.title}-${index}`} className="relative">
                        <span className={cn("absolute -left-8 top-0 flex h-8 w-8 items-center justify-center rounded-full text-white", step.active ? "bg-primary" : "bg-[#CBD5E1]")}><Clock3 className="h-3.5 w-3.5" /></span>
                        <div className={cn(step.active ? "text-[#111827]" : "text-[#9AA4B2]")}>
                          <p className="text-sm font-bold">{step.title}</p>
                          <p className="mt-1 text-xs font-medium">{step.description}</p>
                          {step.timestamp ? <p className="mt-3 text-xs font-bold uppercase text-primary">{step.timestamp}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader icon={<Stethoscope className="h-5 w-5" />} title="Service & Doctor" />
                <div className="space-y-6">
                  <DetailItem label="Service / Department" value={appointment.service.department} />
                  <DetailItem label="Appointment Type" value={<Link href="#" className="inline-flex items-center gap-2 text-[#1473E6]"><Video className="h-4 w-4" />{appointment.service.type}</Link>} />
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#344054]">Assigned Doctor</p>
                    <div className="relative">
                      <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-[#F3F4F6] px-4 text-sm font-medium text-[#71809B]">
                        {isAssigningDoctor ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <UserRound className="h-4 w-4 text-primary" />}
                        <span className="min-w-0 flex-1 truncate">
                          {appointment.clinicianId ? resolvedDoctorName ?? "Loading..." : appointment.service.assignedDoctor}
                        </span>
                        {!appointment.clinicianId ? (
                          <button type="button" onClick={loadClinicians} disabled={isLoadingClinicians || isAssigningDoctor} className="shrink-0 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-60">
                            {isLoadingClinicians ? "Loading..." : "Assign"}
                          </button>
                        ) : null}
                      </div>
                      {isDoctorSelectorOpen && !appointment.clinicianId ? (
                        <div className="absolute left-0 right-0 top-[52px] z-20 rounded-xl border border-border bg-white p-2 shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
                          <label className="sr-only" htmlFor="clinician-select">Select clinician</label>
                          <div className="relative">
                            <select
                              id="clinician-select"
                              disabled={isLoadingClinicians || isAssigningDoctor || clinicians.length === 0}
                              onChange={(event) => void handleClinicianSelected(event.target.value)}
                              defaultValue=""
                              className="h-11 w-full appearance-none rounded-lg border border-border bg-[#F3F4F6] px-4 pr-10 text-sm font-medium text-[#111827] focus:border-primary/40 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <option value="">{isLoadingClinicians ? "Loading clinicians..." : clinicians.length > 0 ? "Select clinician" : "No clinicians available"}</option>
                              {clinicians.map((clinician) => (
                                <option key={clinician.id} value={clinician.id}>
                                  {clinician.name} {clinician.department ? `(${clinician.department})` : ""}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {assignmentError ? <p className="mt-4 flex items-center gap-2 text-sm font-medium text-red-500"><AlertCircle className="h-4 w-4" />{assignmentError}</p> : null}
                    {clinicianUnavailableError ? (
                      <div className="mt-4 space-y-3">
                        <p className="flex items-center gap-2 text-sm font-medium text-red-500">
                          <AlertCircle className="h-4 w-4" />
                          {clinicianUnavailableError}
                        </p>
                        <label className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                          <input
                            type="checkbox"
                            checked={forceAssignChecked}
                            disabled={isAssigningDoctor}
                            onChange={(event) => void handleForceAssignToggle(event.target.checked)}
                            className="h-4 w-4 rounded border-border text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          Assign anyway (override availability)
                        </label>
                        {forceAssignChecked ? (
                          <p className="flex items-center gap-2 text-sm font-medium text-orange-500">
                            <AlertCircle className="h-4 w-4" />
                            Assigning outside clinician availability
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {needsClinician ? <p className="mt-4 flex items-center gap-2 text-sm font-medium text-red-500"><AlertCircle className="h-4 w-4" />Doctor assignment required before confirmation.</p> : null}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader icon={<FileText className="h-5 w-5" />} title="Patient Notes" />
                <div>
                  <p className="mb-4 font-bold text-[#111827]">Reason for visit / Notes</p>
                  <div className="border-l-2 border-primary bg-[#E7F2FF] px-4 py-4 text-sm font-medium leading-7 text-[#111827]">{appointment.notes.reason}</div>
                </div>
                <div className="mt-8"><p className="font-bold text-[#111827]">Additional Notes</p><p className="mt-3 text-sm font-medium text-[#111827]">{appointment.notes.additional}</p></div>
              </Card>

              <Card>
                <CardHeader icon={<MessageSquare className="h-5 w-5" />} title="Communication" />
                <div className="border-l-2 border-primary bg-[#E7F2FF] px-5 py-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#344054]">Last Communication</p>
                  <p className="mt-3 text-sm font-bold text-[#111827]">{appointment.communication.message}</p>
                  <p className="mt-5 text-xs font-bold uppercase text-[#344054]">{appointment.communication.timestamp}</p>
                </div>
                <div className="mt-6 space-y-5">
                  <button type="button" className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white text-sm font-semibold text-primary"><Send className="h-4 w-4" />Send Message</button>
                  <button type="button" className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white text-sm font-semibold text-primary"><Bell className="h-4 w-4" />Send Appointment Update</button>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>

      <RescheduleAppointmentModal
        isOpen={isRescheduleOpen}
        appointmentId={appointment?.id ?? appointmentId}
        patientName={appointment?.patient.name}
        appointmentReason={appointment?.notes.reason}
        hospitalId={appointment?.patient.hospitalId}
        onClose={() => setIsRescheduleOpen(false)}
        onSuccess={() => {
          setNotice("Appointment rescheduled successfully.");
          void loadAppointment();
        }}
      />
      <CancelAppointmentModal
        isOpen={isCancelOpen}
        appointmentId={appointment?.id ?? appointmentId}
        onClose={() => setIsCancelOpen(false)}
        onSuccess={() => {
          setNotice("Appointment cancelled successfully.");
          void loadAppointment();
        }}
      />
    </>
  );
}










