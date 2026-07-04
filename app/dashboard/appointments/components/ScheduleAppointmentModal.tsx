"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Loader2,
  Search,
  Video,
  X,
} from "lucide-react";
import { createAppointment } from "@/lib/api/appointments";
import { cn } from "@/lib/utils";

type AppointmentType = "physical" | "teleconsultation";
type AppointmentPriority = "Routine" | "Urgent" | "Critical";

type ScheduleAppointmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppointmentCreated?: () => void;
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
  assignedStaff: string | { id?: string };
  careEpisode: string;
};

type PatientSearchResult = {
  id: string;
  name: string;
  subtitle: string;
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
  assignedStaff: "Dr. Emeka Nwosu (Cardiologist)",
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
  const subtitle = [
    getString(record, ["hospitalId", "medicalRecordNumber", "patientCode"]),
    getString(record, ["phone", "phoneNumber"]),
    getString(record, ["email"]),
  ].filter(Boolean).join(" - ");

  return { id, name, subtitle };
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

function getClinicianId(assignedStaff: ScheduleAppointmentFormData["assignedStaff"]) {
  if (typeof assignedStaff === "object" && assignedStaff?.id) return assignedStaff.id;
  if (typeof assignedStaff === "string" && /^(clx|cm|[0-9a-f]{24})/i.test(assignedStaff.trim())) return assignedStaff.trim();
  return "";
}

function buildAppointmentPayload(formValues: ScheduleAppointmentFormData, facilityId: string, patientId: string) {
  const clinicianId = getClinicianId(formValues.assignedStaff);

  return {
    facilityId,
    patientId,
    type: formValues.appointmentType === "physical" ? "in_person" : "teleconsultation",
    date: formValues.date,
    time: formValues.time,
    duration: parseInt(formValues.duration, 10) || 30,
    reason: formValues.reason || "Routine checkup",
    ...(clinicianId ? { clinicianId } : {}),
    priority: "normal",
    ...(formValues.location.trim() ? { location: formValues.location.trim() } : {}),
    department: formValues.department.trim(),
  };
}

export default function ScheduleAppointmentModal({ open, onOpenChange, onAppointmentCreated }: ScheduleAppointmentModalProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ScheduleAppointmentFormData>(initialFormData);
  const [facilityId, setFacilityId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

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

  const updateFormData = <Key extends keyof ScheduleAppointmentFormData>(
    key: Key,
    value: ScheduleAppointmentFormData[Key],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const resetAndClose = () => {
    setFormData(initialFormData);
    setSelectedPatientId("");
    setPatientResults([]);
    setApiError("");
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

    setIsSubmitting(true);

    try {
      await createAppointment(buildAppointmentPayload(formData, facilityId, selectedPatientId));
      setFormData(initialFormData);
      setSelectedPatientId("");
      setPatientResults([]);
      onAppointmentCreated?.();
      onOpenChange(false);
      window.alert("Appointment added successfully.");
      router.refresh();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Network error. Please check your connection.");
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
                    onChange={(event) => updateFormData("date", event.target.value)}
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
                  onChange={(event) => updateFormData("time", event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#111827]">Duration</span>
                <SelectLike>{formData.duration}</SelectLike>
              </label>
            </div>

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
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[#111827]">Assigned Doctor / Staff</span>
                  <input
                    className="h-12 w-full rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-medium text-[#111827] focus:border-primary/40 focus:outline-none"
                    value={typeof formData.assignedStaff === "string" ? formData.assignedStaff : formData.assignedStaff.id ?? ""}
                    onChange={(event) => updateFormData("assignedStaff", event.target.value)}
                  />
                  <span className="mt-3 flex items-center gap-2 text-xs font-medium text-[#71809B]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Available slots: 10:00 AM, 11:30 AM, 2:00 PM
                  </span>
                </label>

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
                "Add Appointment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}






