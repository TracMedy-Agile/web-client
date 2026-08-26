"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Loader2,
  Search,
  Video,
  X,
} from "lucide-react";
import type { components } from "@/docs/types/api";
import { confirmAppointment, createAppointment, getAppointmentCapacity, type AppointmentCapacity } from "@/lib/api/appointments";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import { cn } from "@/lib/utils";

type AppointmentType = "physical" | "teleconsultation";
type AppointmentPriority = "Routine" | "Urgent" | "Critical";
type InitialPatient = { id: string; name: string };
type CreatedAppointmentPayload = components["schemas"]["CreateAppointmentResponseDto"];

export type ScheduledAppointmentResult = {
  id: CreatedAppointmentPayload["id"];
  type: CreatedAppointmentPayload["type"];
  date: CreatedAppointmentPayload["date"];
  time: CreatedAppointmentPayload["time"];
  reason: CreatedAppointmentPayload["reason"];
  episodeId: CreatedAppointmentPayload["episodeId"];
};

type ScheduleAppointmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppointmentCreated?: (appointment: ScheduledAppointmentResult) => void;
  initialAppointmentType?: AppointmentType;
  initialPatient?: InitialPatient;
  initialCareEpisodeId?: string;
  initialCareEpisodeLabel?: string;
  initialReason?: string;
  /** Immediately confirms the appointment after creation, instead of leaving it pending review. */
  autoConfirm?: boolean;
};

type ScheduleAppointmentFormData = {
  patient: string;
  department: string;
  location: string;
  appointmentType: AppointmentType;
  date: string;
  time: string;
  duration: string;
  priority: AppointmentPriority;
  reason: string;
  clinicianId: string;
  careEpisode: string;
};

type PatientSearchResult = {
  id: string;
  name: string;
  subtitle: string;
};

type ClinicianOption = {
  id: string;
  label: string;
  schedule: string;
  avatarUrl: string;
};

type ApiRecord = Record<string, unknown>;

const fieldClass =
  "h-12 w-full rounded-lg border border-transparent bg-[#F3F4F6] px-4 text-sm font-medium text-[#111827] placeholder:text-[#71809B] focus:border-primary/40 focus:bg-white focus:outline-none";

const BASE = process.env.NEXT_PUBLIC_API_URL;

const initialFormData: ScheduleAppointmentFormData = {
  patient: "",
  department: "Cardiology",
  location: "",
  appointmentType: "physical",
  date: "",
  time: "",
  duration: "30m",
  priority: "Routine",
  reason: "",
  clinicianId: "",
  careEpisode: "No active care episodes available",
};

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
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

function unwrapData(payload: unknown) {
  const record = asRecord(payload);
  return record && "data" in record ? record.data : payload;
}

function toApiAppointmentType(type: AppointmentType): CreatedAppointmentPayload["type"] {
  return type === "teleconsultation" ? "teleconsultation" : "in_person";
}

function getAppointmentType(record: ApiRecord | null, fallback: AppointmentType): CreatedAppointmentPayload["type"] {
  const value = getString(record, ["type"]);
  return value === "teleconsultation" || value === "in_person" || value === "nurse_checkin"
    ? value
    : toApiAppointmentType(fallback);
}

function normalizeCreatedAppointment(
  payload: unknown,
  formValues: ScheduleAppointmentFormData,
  episodeId?: string,
): ScheduledAppointmentResult {
  const data = asRecord(unwrapData(payload));
  return {
    id: getString(data, ["id"]),
    type: getAppointmentType(data, formValues.appointmentType),
    date: getString(data, ["date"], formValues.date),
    time: getString(data, ["time"], formValues.time),
    reason: getString(data, ["reason"], formValues.reason || "Routine checkup") || null,
    episodeId: getString(data, ["episodeId"], episodeId ?? "") || null,
  };
}

function getPatientItems(payload: unknown): ApiRecord[] {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const record = asRecord(data);
  if (!record) return [];

  const candidates = [record.items, record.patients, record.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  return [];
}

function normalizePatient(record: ApiRecord): PatientSearchResult {
  const id = getString(record, ["id", "patientId", "_id"]);
  const name = getString(record, ["name", "fullName", "patientName"], "Unknown Patient");
  const subtitle = getString(record, ["email"]);

  return { id, name, subtitle };
}

function getClinicianItems(payload: unknown): ApiRecord[] {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const record = asRecord(data);
  if (!record) return [];

  const candidates = [record.data, record.items, record.clinicians, record.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  return [];
}

function normalizeClinician(record: ApiRecord): ClinicianOption {
  const id = getString(record, ["id", "clinicianId", "_id"]);
  const name = getString(record, ["name", "fullName", "clinicianName"], "Unknown");
  const department = getString(record, ["department", "specialty", "specialization"]);
  // ClinicianListItemDto.schedule is a human-readable string (e.g. "Mon-Fri 08:00-17:00"),
  // not an object with separate start/end fields.
  const schedule = getString(record, ["schedule"], "");

  return {
    id,
    label: `Dr. ${name} - ${department || "No department"}`,
    schedule,
    avatarUrl: getString(record, ["avatarUrl", "photoUrl", "imageUrl"]),
  };
}

function getFacilityIdFromMe(payload: unknown) {
  const data = asRecord(unwrapData(payload));
  const user = asRecord(data?.user) ?? data;
  const facility = asRecord(user?.facility);

  return getString(user, ["facilityId"], "") || getString(facility, ["id", "facilityId"], "");
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
    throw new Error(getString(asRecord(payload), ["message"], "Request failed"));
  }

  return payload;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-7 flex items-center gap-3">
      <span className="h-6 w-1 rounded-full bg-primary" />
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#344054]">{children}</h3>
    </div>
  );
}

function getClinicianInitials(label: string) {
  const cleanLabel = label.replace(/^Dr\.\s+/i, "").split(" - ")[0] || label;
  const parts = cleanLabel.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "DR";
}

function ClinicianAvatar({ clinician }: { clinician: ClinicianOption }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7F2FF] bg-cover bg-center text-xs font-bold text-primary"
      style={clinician.avatarUrl ? { backgroundImage: `url(${clinician.avatarUrl})` } : undefined}
      aria-hidden="true"
    >
      {clinician.avatarUrl ? null : getClinicianInitials(clinician.label)}
    </span>
  );
}
function SelectLike({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        fieldClass,
        "flex items-center justify-between text-left",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-[#71809B]" />
    </button>
  );
}

function AppointmentTypeCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[78px] items-center gap-4 rounded-xl border p-4 text-left transition-colors",
        active ? "border-2 border-primary bg-[#E7F2FF]" : "border-border bg-white hover:border-primary/40",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E7F2FF] text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#111827]">{title}</span>
        <span className="mt-1 block text-xs font-medium text-[#71809B]">{description}</span>
      </span>
    </button>
  );
}

function buildAppointmentPayload(formValues: ScheduleAppointmentFormData, facilityId: string, patientId: string, episodeId?: string) {
  const clinicianId = formValues.clinicianId.trim();

  return {
    facilityId,
    patientId,
    type: formValues.appointmentType === "physical" ? "in_person" : "teleconsultation",
    date: formValues.date,
    time: formValues.time,
    duration: parseInt(formValues.duration, 10) || 30,
    reason: formValues.reason || "Routine checkup",
    ...(clinicianId ? { clinicianId } : {}),
    ...(episodeId ? { episodeId } : {}),
    priority: "normal",
    ...(formValues.location.trim() ? { location: formValues.location.trim() } : {}),
    department: formValues.department.trim(),
  };
}

export default function ScheduleAppointmentModal({
  open,
  onOpenChange,
  onAppointmentCreated,
  initialAppointmentType = "physical",
  initialPatient,
  initialCareEpisodeId,
  initialCareEpisodeLabel,
  initialReason = "",
  autoConfirm = false,
}: ScheduleAppointmentModalProps) {
  const router = useRouter();
  const { user } = useDashboardUser();
  const isCurrentUserClinician = user?.role?.toLowerCase() === "clinician";
  const currentClinicianId = isCurrentUserClinician ? user?.id ?? "" : "";
  const currentClinicianLabel = user?.name ? "Dr. " + user.name + " - " + (user.specialty || "No department") : "Me";
  const freshFormData = useCallback((): ScheduleAppointmentFormData => ({
    ...initialFormData,
    appointmentType: initialAppointmentType,
    patient: initialPatient?.name ?? "",
    reason: initialReason,
    clinicianId: currentClinicianId,
    careEpisode: initialCareEpisodeLabel ?? initialFormData.careEpisode,
  }), [currentClinicianId, initialAppointmentType, initialCareEpisodeLabel, initialPatient?.name, initialReason]);
  const [formData, setFormData] = useState<ScheduleAppointmentFormData>(freshFormData);
  const [facilityId, setFacilityId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id ?? "");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [clinicians, setClinicians] = useState<ClinicianOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [capacity, setCapacity] = useState<AppointmentCapacity | null>(null);
  const [isCheckingCapacity, setIsCheckingCapacity] = useState(false);
  const [isClinicianPickerOpen, setIsClinicianPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    void Promise.resolve().then(() => {
      setFormData(freshFormData());
      setSelectedPatientId(initialPatient?.id ?? "");
      setPatientResults([]);
      setApiError("");
      setCapacity(null);
    });
  }, [freshFormData, initialPatient?.id, open]);

  useEffect(() => {
    if (!open || !currentClinicianId) return;

    void Promise.resolve().then(() => {
      setFormData((current) => current.clinicianId ? current : { ...current, clinicianId: currentClinicianId });
    });
  }, [currentClinicianId, open]);

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    const loadMe = async () => {
      try {
        const payload = await authorizedRequest("/auth/me");
        if (!ignore) setFacilityId(getFacilityIdFromMe(payload));
      } catch {
        if (!ignore) setFacilityId("");
      }
    };

    void Promise.resolve().then(loadMe);

    return () => {
      ignore = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    const loadClinicians = async () => {
      try {
        const payload = await authorizedRequest("/clinicians");
        if (!ignore) setClinicians(getClinicianItems(payload).map(normalizeClinician).filter((clinician) => clinician.id));
      } catch {
        if (!ignore) setClinicians([]);
      }
    };

    void loadClinicians();

    return () => {
      ignore = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const searchTerm = formData.patient.trim();
    if (searchTerm.length < 2 || selectedPatientId) return;

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const payload = await authorizedRequest(`/patients/search?q=${encodeURIComponent(searchTerm)}`);
        if (!ignore) setPatientResults(getPatientItems(payload).map(normalizePatient).filter((patient) => patient.id));
      } catch {
        if (!ignore) setPatientResults([]);
      } finally {
        if (!ignore) setIsSearchingPatients(false);
      }
    }, 300);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [formData.patient, open, selectedPatientId]);

  useEffect(() => {
    if (!open) return;
    if (!facilityId) return;
    if (!formData.date) return;

    let ignore = false;
    const capacityQuery = { facilityId, date: formData.date, time: formData.time };
    getAppointmentCapacity(capacityQuery)
      .then((result) => {
        if (!ignore) setCapacity(result);
      })
      .catch(() => {
        if (!ignore) setCapacity(null);
      })
      .finally(() => {
        if (!ignore) setIsCheckingCapacity(false);
      });

    return () => {
      ignore = true;
    };
  }, [facilityId, formData.date, formData.time, open]);

  const clinicianOptions = useMemo(() => {
    if (!currentClinicianId || clinicians.some((clinician) => clinician.id === currentClinicianId)) return clinicians;
    return [{ id: currentClinicianId, label: currentClinicianLabel, schedule: "Current clinician", avatarUrl: "" }, ...clinicians];
  }, [clinicians, currentClinicianId, currentClinicianLabel]);

  const selectedClinician = clinicianOptions.find((clinician) => clinician.id === formData.clinicianId);

  const updateFormData = <Key extends keyof ScheduleAppointmentFormData>(
    key: Key,
    value: ScheduleAppointmentFormData[Key],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const resetAndClose = () => {
    setFormData(freshFormData());
    setSelectedPatientId(initialPatient?.id ?? "");
    setPatientResults([]);
    setApiError("");
    setCapacity(null);
    onOpenChange(false);
  };

  const selectPatient = (patient: PatientSearchResult) => {
    setSelectedPatientId(patient.id);
    setPatientResults([]);
    updateFormData("patient", patient.name);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");

    if (!selectedPatientId) {
      setApiError("Select a patient from the search results before adding an appointment.");
      return;
    }

    if (!facilityId) {
      setApiError("Unable to determine your facility. Please sign in again and retry.");
      return;
    }

    if (capacity && !capacity.canBook) {
      setApiError("No appointment capacity remains for the selected date and time.");
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createAppointment(buildAppointmentPayload(formData, facilityId, selectedPatientId, initialCareEpisodeId));
      const createdAppointment = normalizeCreatedAppointment(created, formData, initialCareEpisodeId);
      if (autoConfirm) {
        if (createdAppointment.id) {
          // Best-effort — if this fails the appointment still exists as pending, which is
          // still correct (just not auto-confirmed); don't block the success flow on it.
          await confirmAppointment(createdAppointment.id).catch(() => undefined);
        }
      }
      setFormData(freshFormData());
      setSelectedPatientId("");
      setPatientResults([]);
      onAppointmentCreated?.(createdAppointment);
      onOpenChange(false);
      toast.success("Appointment added successfully.");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error. Please check your connection.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/60 px-4 py-4 sm:py-8 backdrop-blur-[3px]">
      <div className="max-h-[calc(100vh-64px)] w-full max-w-[768px] overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)]">
        <div className="flex h-[84px] items-center justify-between border-b border-border px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E7F2FF] text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold md:text-xl text-[#111827]">Schedule Appointment</h2>
          </div>
          <button
            type="button"
            aria-label="Close schedule appointment modal"
            onClick={resetAndClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#8AA0C0] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(100vh-232px)] overflow-y-auto px-4 sm:px-8 py-4 sm:py-7">
            <SectionHeader>Appointment Information</SectionHeader>

            {apiError ? (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {apiError}
              </div>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#111827]">Patient Name</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
                  <input
                    className={cn(fieldClass, "pl-11")}
                    placeholder="Patient (Search or Enter New)"
                    value={formData.patient}
                    onChange={(event) => {
                      setSelectedPatientId("");
                      setPatientResults([]);
                      setIsSearchingPatients(false);
                      updateFormData("patient", event.target.value);
                    }}
                  />
                  {isSearchingPatients ? (
                    <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#71809B]" />
                  ) : null}
                </span>
                {patientResults.length > 0 ? (
                  <div className="absolute z-50 mt-2 max-h-56 w-[calc(50%-44px)] overflow-y-auto rounded-lg border border-border bg-white py-2 shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
                    {patientResults.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => selectPatient(patient)}
                        className="block w-full px-4 py-3 text-left transition-colors hover:bg-[#F3F4F6]"
                      >
                        <span className="block text-sm font-bold text-[#111827]">{patient.name}</span>
                        {patient.subtitle ? <span className="mt-1 block text-xs font-medium text-[#71809B]">{patient.subtitle}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedPatientId ? <span className="mt-2 block text-xs font-semibold text-emerald-600">Patient selected</span> : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#111827]">Department / Service</span>
                <span className="relative block">
                  <select
                    className={cn(fieldClass, "appearance-none pr-10")}
                    value={formData.department}
                    onChange={(event) => updateFormData("department", event.target.value)}
                    required
                  >
                    <option value="Cardiology">Cardiology</option>
                    <option value="Obstetrics">Obstetrics</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="General Surgery">General Surgery</option>
                    <option value="Endocrinology">Endocrinology</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
                </span>
              </label>
            </div>

            <div className="mt-7">
              <span className="mb-3 block text-sm font-bold text-[#111827]">Appointment Type</span>
              <div className="grid gap-4 sm:grid-cols-2">
                <AppointmentTypeCard
                  active={formData.appointmentType === "physical"}
                  icon={<Building2 className="h-5 w-5" />}
                  title="Physical Visit"
                  description="In-clinic examination"
                  onClick={() => updateFormData("appointmentType", "physical")}
                />
                <AppointmentTypeCard
                  active={formData.appointmentType === "teleconsultation"}
                  icon={<Video className="h-5 w-5" />}
                  title="Teleconsultation"
                  description="Secure video link session"
                  onClick={() => updateFormData("appointmentType", "teleconsultation")}
                />
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-[1fr_0.48fr_0.48fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#111827]">Date</span>
                <span className="relative block">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
                  <input
                    type="date"
                    className={cn(fieldClass, "pl-11")}
                    value={formData.date}
                    onChange={(event) => {
                      setCapacity(null);
                      setIsCheckingCapacity(Boolean(event.target.value));
                      updateFormData("date", event.target.value);
                    }}
                    required
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#111827]">Time</span>
                <input
                  type="time"
                  className={fieldClass}
                  value={formData.time}
                  onChange={(event) => {
                    setCapacity(null);
                    setIsCheckingCapacity(Boolean(formData.date));
                    updateFormData("time", event.target.value);
                  }}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#111827]">Duration</span>
                <SelectLike>{formData.duration}</SelectLike>
              </label>
            </div>

            {formData.date ? (
              <p role="status" className={cn("mt-2 text-xs font-semibold", capacity && !capacity.canBook ? "text-red-600" : "text-[#71809B]")}>
                {isCheckingCapacity
                  ? "Checking appointment capacity..."
                  : capacity
                    ? `${capacity.availableSlots} of ${capacity.totalSlots} slots available${formData.time ? " for this time" : " for this date"}.`
                    : "Capacity could not be confirmed; the server will validate it when you submit."}
              </p>
            ) : null}

            <label className="mt-7 block">
              <span className="mb-2 block text-sm font-bold text-[#111827]">Reason for Visit</span>
              <textarea
                className="min-h-[74px] w-full resize-none rounded-lg border border-transparent bg-[#F3F4F6] px-4 py-4 text-sm font-medium text-[#111827] placeholder:text-[#71809B] focus:border-primary/40 focus:bg-white focus:outline-none"
                placeholder="Chief complaints, symptoms reported..."
                value={formData.reason}
                onChange={(event) => updateFormData("reason", event.target.value)}
              />
            </label>

            <div className="mt-10">
              <SectionHeader>Assignment &amp; Continuity</SectionHeader>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="relative block">
                  <span className="mb-2 block text-sm font-bold text-[#111827]">Assigned Doctor / Staff</span>
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isClinicianPickerOpen}
                    onClick={() => setIsClinicianPickerOpen((current) => !current)}
                    className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#D0D5DD] bg-white px-4 text-left text-sm font-medium text-[#111827] focus:border-primary/40 focus:outline-none"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {selectedClinician ? <ClinicianAvatar clinician={selectedClinician} /> : null}
                      <span className={cn("truncate", selectedClinician ? "text-[#111827]" : "text-[#71809B]")}>{selectedClinician?.label ?? "Select a clinician"}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#71809B]" />
                  </button>
                  {isClinicianPickerOpen ? (
                    <div role="listbox" className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-white py-2 shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
                      {clinicianOptions.length > 0 ? clinicianOptions.map((clinician) => (
                        <button
                          key={clinician.id}
                          type="button"
                          role="option"
                          aria-selected={formData.clinicianId === clinician.id}
                          onClick={() => {
                            updateFormData("clinicianId", clinician.id);
                            setIsClinicianPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F3F4F6]",
                            formData.clinicianId === clinician.id ? "bg-[#E7F2FF]" : "bg-white",
                          )}
                        >
                          <ClinicianAvatar clinician={clinician} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-[#111827]">{clinician.label}</span>
                            <span className="mt-1 block truncate text-xs font-medium text-[#71809B]">{clinician.schedule || "Schedule not set"}</span>
                          </span>
                        </button>
                      )) : (
                        <span className="block px-4 py-3 text-sm font-medium text-[#71809B]">No clinicians available</span>
                      )}
                    </div>
                  ) : null}
                  <span className="mt-3 flex items-center gap-2 text-xs font-medium text-[#71809B]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {selectedClinician
                      ? `Schedule: ${selectedClinician.schedule || "Not set"}`
                      : "Select a clinician to view their schedule"}
                  </span>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[#111827]">Link Care Episode</span>
                  <SelectLike>{formData.careEpisode}</SelectLike>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:gap-6 border-t border-border bg-[#F8FAFC] px-4 sm:px-8 py-4">
            <button
              type="button"
              onClick={resetAndClose}
              disabled={isSubmitting}
              className="h-12 px-2 text-sm font-bold text-[#344054] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Adding...
                </>
              ) : (
                "Schedule Appointment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}






