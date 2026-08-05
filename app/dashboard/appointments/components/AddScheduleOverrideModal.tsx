"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarDays, Clock3, FileText, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AddScheduleOverrideModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type ApiRecord = Record<string, unknown>;

type ClinicianOption = {
  id: string;
  name: string;
};

type AppointmentRow = {
  id: string;
  clinicianId: string;
  time: string;
  patientName: string;
  type: string;
  status: string;
};

type OverrideType = "available" | "unavailable";
type OverrideScope = "full_day" | "partial";
type Resolution = "assign_covering" | "return_to_queue" | "";

const BASE = process.env.NEXT_PUBLIC_API_URL;
const REASONS = ["Vacation", "Sick leave", "Training", "Emergency", "Other"];
const TIME_OPTIONS = ["08:00 AM", "09:00 AM", "10:00 AM", "12:00 PM", "01:00 PM", "03:00 PM", "05:00 PM", "06:00 PM"];

const selectClassName =
  "h-12 rounded-lg border-[#DDE3EC] bg-[#F8FAFC] px-4 text-sm font-medium text-[#111827] shadow-none focus:ring-0 focus:ring-offset-0";

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ApiRecord) : null;
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

  for (const key of ["data", "items", "results", "clinicians", "appointments"]) {
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

function formatDoctorName(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  return cleaned ? `Dr. ${cleaned}` : "Dr. Unknown Clinician";
}

function normalizeClinician(record: ApiRecord): ClinicianOption {
  return {
    id: getString(record, ["id", "clinicianId", "_id"]),
    name: getString(record, ["name", "fullName", "displayName"], "Unknown Clinician"),
  };
}

function normalizeStatus(value: string) {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "_");
  if (normalized.includes("complete")) return "Completed";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("progress") || normalized.includes("check")) return "In Progress";
  return "Scheduled";
}

function formatAppointmentType(value: string) {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "_");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("nurse") || normalized.includes("follow") || normalized.includes("checkin")) return "Follow-Up";
  if (normalized.includes("person") || normalized.includes("physical")) return "Physical Visit";
  return value || "Physical Visit";
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const parsed = Date.parse(`${value}T00:00:00`);
  if (!value || !Number.isFinite(parsed)) return "Select date";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function formatDisplayTime(value: string) {
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

function toApiTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function normalizeAppointment(record: ApiRecord): AppointmentRow {
  const patient = asRecord(record.patient);
  const clinician = asRecord(record.clinician) ?? asRecord(record.assignedStaff) ?? asRecord(record.doctor);

  return {
    id: getString(record, ["id", "appointmentId", "_id"]),
    clinicianId:
      getString(record, ["clinicianId", "assignedClinicianId", "doctorId"], "") ||
      getString(clinician, ["id", "_id", "clinicianId"]),
    time: formatDisplayTime(getString(record, ["time", "appointmentTime", "startsAt", "startTime", "date"])),
    patientName: getString(record, ["patientName"], "") || getString(patient, ["name", "fullName"], "Unknown Patient"),
    type: getString(record, ["type", "appointmentType"], "in_person"),
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

async function apiRequest(path: string, init?: RequestInit, query?: URLSearchParams) {
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-bold tracking-[0.08em] text-[#344054]">{children}</p>;
}

function SelectField({
  label,
  value,
  items,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  items: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={selectClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-100">
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 rounded-lg border-[#DDE3EC] bg-[#F8FAFC] px-4 text-sm font-medium text-[#71809B] shadow-none focus:ring-0 focus:ring-offset-0">
          <SelectValue />
          <Clock3 className="h-5 w-5 text-[#71809B]" />
        </SelectTrigger>
        <SelectContent className="z-100">
          {TIME_OPTIONS.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ResolutionCard({
  title,
  description,
  action,
  active,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <article className={cn("rounded-xl border bg-white p-4", active ? "border-[#023E8A]" : "border-[#DDE3EC]")}>
      <h4 className="text-sm font-bold text-[#111827]">{title}</h4>
      <p className="mt-2 min-h-10 text-sm font-medium leading-5 text-[#344054]">{description}</p>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        className="mt-4 h-10 w-full rounded-lg border-[#023E8A] bg-white text-sm font-bold text-[#023E8A] hover:bg-[#F5FAFF]"
      >
        {action}
      </Button>
    </article>
  );
}

export default function AddScheduleOverrideModal({ isOpen, onClose, onSuccess }: AddScheduleOverrideModalProps) {
  const router = useRouter();
  const [clinicians, setClinicians] = useState<ClinicianOption[]>([]);
  const [selectedClinicianId, setSelectedClinicianId] = useState("");
  const [date, setDate] = useState(formatDateParam(new Date()));
  const [overrideType, setOverrideType] = useState<OverrideType>("unavailable");
  const [scope, setScope] = useState<OverrideScope>("partial");
  const [startTime, setStartTime] = useState("08:00 AM");
  const [endTime, setEndTime] = useState("05:00 PM");
  const [reason, setReason] = useState("Vacation");
  const [notes, setNotes] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [resolution, setResolution] = useState<Resolution>("");
  const [coveringClinicianId, setCoveringClinicianId] = useState("");
  const [showCoveringSelect, setShowCoveringSelect] = useState(false);
  const [isLoadingClinicians, setIsLoadingClinicians] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");


  const selectedClinician = clinicians.find((clinician) => clinician.id === selectedClinicianId);
  const isFullDay = scope === "full_day";

  const clinicianItems = useMemo(() => {
    if (clinicians.length === 0) return [{ label: "No clinicians available", value: "none" }];
    return clinicians.map((clinician) => ({ label: formatDoctorName(clinician.name), value: clinician.id }));
  }, [clinicians]);

  const impactMetrics = useMemo(() => {
    const physical = appointments.filter((appointment) => appointment.type === "in_person").length;
    const telecon = appointments.filter((appointment) => appointment.type === "teleconsultation").length;
    const followUp = appointments.filter((appointment) => {
      const normalized = appointment.type.toLowerCase().replace(/[\s_-]+/g, "_");
      return normalized.includes("nurse") || normalized.includes("follow") || normalized.includes("checkin");
    }).length;

    return [
      { label: "TOTAL", value: String(appointments.length) },
      { label: "PHYSICAL", value: String(physical) },
      { label: "TELECON", value: String(telecon) },
      { label: "FOLLOW-UP", value: String(followUp) },
    ];
  }, [appointments]);

  const resetForm = () => {
    setSelectedClinicianId("");
    setDate(formatDateParam(new Date()));
    setOverrideType("unavailable");
    setScope("partial");
    setStartTime("08:00 AM");
    setEndTime("05:00 PM");
    setReason("Vacation");
    setNotes("");
    setAppointments([]);
    setResolution("");
    setCoveringClinicianId("");
    setShowCoveringSelect(false);
    setError("");
  };

  const loadClinicians = useCallback(async () => {
    setIsLoadingClinicians(true);
    setError("");
    console.log("Fetching clinicians...");

    try {
      const payload = await apiRequest("/clinicians");
      console.log("Clinicians response:", payload);
      const items = getItems(payload);
      console.log("Clinicians data:", items);
      const nextClinicians = items.map(normalizeClinician).filter((clinician) => clinician.id);
      setClinicians(nextClinicians);
      setSelectedClinicianId((currentId) => currentId || nextClinicians[0]?.id || "");
    } catch (requestError) {
      console.log("Clinicians fetch failed:", requestError);
      setClinicians([]);
      setError(requestError instanceof Error ? requestError.message : "Failed to load clinicians.");
    } finally {
      setIsLoadingClinicians(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    if (!selectedClinicianId || selectedClinicianId === "none" || !date || overrideType !== "unavailable") {
      setAppointments([]);
      return;
    }

    setIsLoadingAppointments(true);
    setError("");

    try {
      const query = new URLSearchParams({ dateFrom: date, dateTo: date });
      const payload = await apiRequest("/appointments", undefined, query);
      const allAppointments = getItems(payload).map(normalizeAppointment);
      setAppointments(allAppointments.filter((appointment) => appointment.clinicianId === selectedClinicianId));
    } catch (requestError) {
      setAppointments([]);
      setError(requestError instanceof Error ? requestError.message : "Failed to load affected appointments.");
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [date, overrideType, selectedClinicianId]);

  useEffect(() => {
    console.log("Modal opened, isOpen:", isOpen);
    if (!isOpen) return;
    void Promise.resolve().then(loadClinicians);
  }, [isOpen, loadClinicians]);

  useEffect(() => {
    if (!isOpen) return;
    void Promise.resolve().then(loadAppointments);
  }, [isOpen, loadAppointments]);

  useEffect(() => {
    console.log("Selected clinician:", selectedClinicianId);
  }, [selectedClinicianId]);

  useEffect(() => {
    console.log("Selected date:", date);
  }, [date]);


  const discardChanges = () => {
    resetForm();
    onClose();
  };

  const viewAffectedAppointments = () => {
    router.push("/dashboard/appointments");
  };

  const applyOverride = async () => {
    if (!selectedClinicianId || selectedClinicianId === "none") {
      setError("Select a clinician before applying the override.");
      return;
    }

    if (!date) {
      setError("Select a date before applying the override.");
      return;
    }

    if (appointments.length > 0 && overrideType === "unavailable" && !resolution) {
      setError("Choose how affected appointments should be resolved.");
      return;
    }

    if (resolution === "assign_covering" && !coveringClinicianId) {
      setError("Select a covering clinician.");
      return;
    }

    setIsSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      date,
      overrideType,
      scope,
      reason,
      notes,
    };

    if (scope === "partial") {
      body.startTime = toApiTime(startTime);
      body.endTime = toApiTime(endTime);
    }

    if (appointments.length > 0 && resolution) {
      body.affectedAppointmentResolution = resolution;
    }

    if (resolution === "assign_covering") {
      body.coveringClinicianId = coveringClinicianId;
    }

    try {
      await apiRequest(`/clinicians/${encodeURIComponent(selectedClinicianId)}/override`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Override applied successfully");
      resetForm();
      onClose();
      onSuccess?.();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to apply override.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const firstAppointments = appointments.slice(0, 3);
  const remainingAppointments = Math.max(appointments.length - firstAppointments.length, 0);
  const showAppointmentImpact = Boolean(
    selectedClinicianId && selectedClinicianId !== "none" && date && overrideType === "unavailable",
  );
  const showResolution = overrideType === "unavailable" && appointments.length > 0;

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => (!open ? discardChanges() : undefined)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[#111827]/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[71] flex max-h-[94vh] w-[calc(100vw-32px)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#DDE3EC] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.32)] outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <header className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4 sm:px-8 sm:py-7">
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-[#111827] md:text-xl">
                  Add Schedule Override
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm font-medium text-[#344054]">
                  Temporarily modify clinician availability and manage affected appointments.
                </DialogPrimitive.Description>
              </div>
              <button
                type="button"
                aria-label="Close add schedule override modal"
                onClick={discardChanges}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#344054] transition-colors hover:bg-[#E5E7EB]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">
              {error ? (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                {isLoadingClinicians ? (
                  <label className="block">
                    <FieldLabel>Clinician</FieldLabel>
                    <div className="h-12 animate-pulse rounded-lg border border-[#DDE3EC] bg-[#F8FAFC]" />
                  </label>
                ) : (
                  <label className="block">
                    <FieldLabel>Clinician</FieldLabel>
                    <Select
                      value={selectedClinicianId || "none"}
                      onValueChange={(value) => setSelectedClinicianId(value === "none" ? "" : value)}
                    >
                      <SelectTrigger className={selectClassName}>
                        <SelectValue placeholder="Select a clinician" />
                      </SelectTrigger>
                      <SelectContent className="z-100">
                        {clinicianItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
                <label className="block">
                  <FieldLabel>Date</FieldLabel>
                  <div className="relative flex h-12 items-center justify-between rounded-lg border border-[#DDE3EC] bg-[#F8FAFC] px-4 text-sm font-medium text-[#111827]">
                    <span>{formatDisplayDate(date)}</span>
                    <CalendarDays className="h-5 w-5 text-[#023E8A]" />
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      min={formatDateParam(new Date())}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </div>
                </label>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <FieldLabel>Override Type</FieldLabel>
                  <div className="grid h-12 grid-cols-2 rounded-lg border border-[#023E8A] bg-white p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideType("available");
                        setResolution("");
                        setCoveringClinicianId("");
                        setShowCoveringSelect(false);
                      }}
                      className={cn(
                        "rounded-md text-sm font-bold",
                        overrideType === "available" ? "bg-[#023E8A] text-white" : "text-[#344054]",
                      )}
                    >
                      Available
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverrideType("unavailable")}
                      className={cn(
                        "rounded-md text-sm font-bold",
                        overrideType === "unavailable" ? "bg-[#023E8A] text-white" : "text-[#344054]",
                      )}
                    >
                      Unavailable
                    </button>
                  </div>
                </div>
                <div>
                  <FieldLabel>Override Scope</FieldLabel>
                  <div className="flex h-12 items-center justify-between rounded-lg border border-[#DDE3EC] bg-white px-4">
                    <span className="text-sm font-medium text-[#344054]">Full Day</span>
                    <Switch
                      checked={isFullDay}
                      onCheckedChange={(checked) => setScope(checked ? "full_day" : "partial")}
                      className="data-[state=checked]:bg-[#023E8A]"
                    />
                  </div>
                </div>
              </div>

              {!isFullDay ? (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <TimeField label="Start Time" value={startTime} onChange={setStartTime} />
                  <TimeField label="End Time" value={endTime} onChange={setEndTime} />
                </div>
              ) : null}

              <div className="mt-5">
                <SelectField
                  label="Reason"
                  value={reason}
                  items={REASONS.map((item) => ({ label: item, value: item }))}
                  onChange={setReason}
                />
              </div>

              <label className="mt-5 block">
                <FieldLabel>Optional Notes</FieldLabel>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Additional context for this override..."
                  className="min-h-24 resize-none rounded-lg border-[#DDE3EC] bg-[#F8FAFC] px-4 py-4 text-sm font-medium text-[#111827] placeholder:text-[#71809B] focus-visible:border-[#023E8A] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </label>

              {showAppointmentImpact ? (
                <section className="mt-6 rounded-xl border border-[#DDE3EC] bg-[#F8FBFF] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#CFE5FF] text-[#023E8A]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-[#023E8A]">Appointment Impact</h3>
                      <p className="mt-1 text-sm font-medium text-[#344054]">
                        {selectedClinician
                          ? `${formatDoctorName(selectedClinician.name)} has ${appointments.length} confirmed appointments scheduled during the affected period.`
                          : "Select a clinician and date to view affected appointments."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {impactMetrics.map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-3">
                        <p className="text-xs font-bold tracking-[0.08em] text-[#344054]">{metric.label}</p>
                        <p className="mt-1 text-lg font-bold text-[#111827]">
                          {isLoadingAppointments ? <Loader2 className="h-4 w-4 animate-spin" /> : metric.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                    <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1fr] bg-[#EFF5FF] px-4 py-3 text-xs font-bold text-[#344054]">
                      <span>Time</span>
                      <span>Patient</span>
                      <span>Type</span>
                      <span className="text-right">Status</span>
                    </div>
                    {isLoadingAppointments ? (
                      <div className="px-4 py-5 text-sm font-medium text-[#71809B]">Loading affected appointments...</div>
                    ) : (
                      firstAppointments.map((appointment) => (
                        <div
                          key={appointment.id || `${appointment.time}-${appointment.patientName}`}
                          className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1fr] border-t border-[#E5E7EB] px-4 py-3 text-sm font-medium text-[#344054]"
                        >
                          <span className="text-[#111827]">{appointment.time}</span>
                          <span>{appointment.patientName}</span>
                          <span>{formatAppointmentType(appointment.type)}</span>
                          <span className="text-right font-bold text-[#023E8A]">{appointment.status}</span>
                        </div>
                      ))
                    )}
                    {!isLoadingAppointments && firstAppointments.length === 0 ? (
                      <div className="px-4 py-5 text-sm font-medium text-[#71809B]">No affected appointments found.</div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 text-xs font-bold sm:flex-row sm:items-center sm:justify-between">
                    {remainingAppointments > 0 ? (
                      <button type="button" className="text-left text-[#344054]">
                        +{remainingAppointments} More Appointments
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" onClick={viewAffectedAppointments} className="text-left text-[#023E8A] sm:text-right">
                      VIEW ALL AFFECTED APPOINTMENTS
                    </button>
                  </div>
                </section>
              ) : null}

              {showResolution ? (
                <section className="mt-7">
                  <h3 className="text-lg font-bold text-[#111827]">Resolve Affected Appointments</h3>
                  <p className="mt-4 text-sm font-medium leading-6 text-[#344054]">
                    Choose how affected appointments should be managed before applying the override.
                  </p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <ResolutionCard
                      title="Assign Covering Clinician"
                      description="Transfer affected appointments to another available clinician."
                      action="Assign Covering Clinician"
                      active={resolution === "assign_covering"}
                      onClick={() => {
                        setResolution("assign_covering");
                        setShowCoveringSelect(true);
                      }}
                    />
                    <ResolutionCard
                      title="Return To Pending Queue"
                      description="Move affected appointments back to the assignment queue for manual reassignment."
                      action="Return To Pending Queue"
                      active={resolution === "return_to_queue"}
                      onClick={() => {
                        setResolution("return_to_queue");
                        setCoveringClinicianId("");
                        setShowCoveringSelect(false);
                      }}
                    />
                  </div>
                  {showCoveringSelect ? (
                    <div className="mt-4">
                      <SelectField
                        label="Covering Clinician"
                        value={coveringClinicianId || "none"}
                        items={[
                          { label: "Select clinician", value: "none" },
                          ...clinicians
                            .filter((clinician) => clinician.id !== selectedClinicianId)
                            .map((clinician) => ({ label: formatDoctorName(clinician.name), value: clinician.id })),
                        ]}
                        onChange={(value) => setCoveringClinicianId(value === "none" ? "" : value)}
                      />
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>

            <footer className="flex flex-col items-stretch justify-end gap-3 border-t border-[#E5E7EB] bg-[#F8FAFC] px-4 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-8">
              <Button
                type="button"
                variant="ghost"
                onClick={discardChanges}
                className="h-11 px-2 text-sm font-bold text-[#344054] hover:bg-transparent hover:text-[#111827]"
              >
                Discard Changes
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void applyOverride()}
                className="h-12 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSaving ? "Applying..." : "Apply Override"}
              </Button>
            </footer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
