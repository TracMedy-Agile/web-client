"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Clock3, Coffee, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AddClinicianScheduleModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ApiRecord = Record<string, unknown>;

type ClinicianOption = {
  id: string;
  name: string;
  displayName: string;
  department: string;
  capacityUtilization: number;
  status: string;
  nextAvailable: string;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

const workingDays = [
  { key: "monday", label: "M", apiValue: "Mon" },
  { key: "tuesday", label: "T", apiValue: "Tue" },
  { key: "wednesday", label: "W", apiValue: "Wed" },
  { key: "thursday", label: "T", apiValue: "Thu" },
  { key: "friday", label: "F", apiValue: "Fri" },
  { key: "saturday", label: "S", apiValue: "Sat" },
  { key: "sunday", label: "S", apiValue: "Sun" },
];

const appointmentTypes = [
  { key: "initial-consultation", label: "Initial Consultation", apiValue: "in_person" },
  { key: "follow-up", label: "Follow-up", apiValue: "teleconsultation" },
  { key: "urgent-triage", label: "Urgent Triage", apiValue: "nurse_checkin" },
  { key: "virtual-visit", label: "Virtual Visit", apiValue: "teleconsultation" },
  { key: "procedural", label: "Procedural", apiValue: "in_person" },
  { key: "diagnostic-review", label: "Diagnostic Review", apiValue: "in_person" },
];

const departmentOptions = ["Emergency Medicine", "Cardiology", "Neurology", "Pediatrics", "Endocrinology"];
const timeOptions = ["08:00 AM", "08:30 AM", "09:00 AM", "12:30 PM", "01:30 PM", "04:00 PM", "05:00 PM", "06:00 PM"];
const capacityOptions = ["5", "10", "15", "20", "25", "30"];

const selectClassName =
  "h-12 rounded-lg border-[#C9D5E5] bg-white px-4 text-sm font-medium text-[#111827] shadow-none focus:ring-0 focus:ring-offset-0";

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

  for (const key of ["data", "items", "results", "clinicians"]) {
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

function formatDoctorName(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  return cleaned ? `Dr. ${cleaned}` : "Dr. Unknown Clinician";
}

function normalizeClinician(record: ApiRecord): ClinicianOption {
  const schedule = asRecord(record.schedule);
  const name = getString(record, ["name", "fullName", "displayName"], "Unknown Clinician");
  const workingHoursStart = getString(schedule, ["workingHoursStart"], "");

  return {
    id: getString(record, ["id", "clinicianId", "_id"]),
    name,
    displayName: formatDoctorName(name),
    department: getString(record, ["department", "specialty", "speciality"], "Cardiology"),
    capacityUtilization: Math.round(getNumber(record, ["utilizationPercentage", "capacityUtilization"], 0)),
    status: getString(record, ["status"], "available").toLowerCase().replace(/[\s-]+/g, "_"),
    nextAvailable: workingHoursStart || getString(record, ["nextAvailable", "nextAvailableAt"], "--"),
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
    throw new Error(getString(asRecord(payload), ["message", "error"], "Request failed"));
  }

  return payload;
}

function toTwentyFourHour(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return time;

  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3].toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

const previewStatusClasses: Record<string, string> = {
  available: "border-[#10B981] text-[#10B981]",
  near_capacity: "border-[#F59E0B] text-[#F59E0B]",
  full: "border-[#EF4444] text-[#EF4444]",
  unavailable: "border-[#98A2B3] text-[#71809B]",
  off_duty: "border-[#98A2B3] text-[#71809B]",
};

const previewStatusLabels: Record<string, string> = {
  available: "AVAILABLE",
  near_capacity: "NEAR CAPACITY",
  full: "FULL",
  unavailable: "UNAVAILABLE",
  off_duty: "OFF DUTY",
};

function getLoadClassName(utilization: number) {
  if (utilization > 90) return "text-[#EF4444]";
  if (utilization > 70) return "text-[#F59E0B]";
  return "text-[#023E8A]";
}

function getInitials(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "DR";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-bold tracking-[0.12em] text-[#71809B]">{children}</p>;
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
  items: { label: string; value: string }[];
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
        <SelectContent>
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

function TimeBlock({
  icon,
  title,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  icon: React.ReactNode;
  title: string;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <section className="rounded-xl border border-[#DDE3EC] bg-white p-4">
      <div className="mb-6 flex items-center gap-2 text-[#344054]">
        <span className="text-[#023E8A]">{icon}</span>
        <h3 className="text-base font-bold text-[#344054]">{title}</h3>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <label>
          <FieldLabel>START</FieldLabel>
          <Select value={start} onValueChange={onStartChange}>
            <SelectTrigger className="h-10 rounded-lg border-[#DDE3EC] bg-[#F6F7F9] px-3 text-sm font-bold text-[#111827] shadow-none focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span className="pb-2 text-sm font-medium text-[#71809B]">to</span>
        <label>
          <FieldLabel>END</FieldLabel>
          <Select value={end} onValueChange={onEndChange}>
            <SelectTrigger className="h-10 rounded-lg border-[#DDE3EC] bg-[#F6F7F9] px-3 text-sm font-bold text-[#111827] shadow-none focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    </section>
  );
}

export default function AddClinicianScheduleModal({ isOpen, onClose }: AddClinicianScheduleModalProps) {
  const [selectedDays, setSelectedDays] = useState(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [selectedTypes, setSelectedTypes] = useState(["follow-up", "urgent-triage"]);
  const [isActive, setIsActive] = useState(true);
  const [clinicians, setClinicians] = useState<ClinicianOption[]>([]);
  const [selectedClinicianId, setSelectedClinicianId] = useState("");
  const [selectedClinician, setSelectedClinician] = useState<ClinicianOption | null>(null);
  const [department, setDepartment] = useState("Cardiology");
  const [workingHoursStart, setWorkingHoursStart] = useState("08:00 AM");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("05:00 PM");
  const [breakStart, setBreakStart] = useState("12:30 PM");
  const [breakEnd, setBreakEnd] = useState("01:30 PM");
  const [dailyCapacity, setDailyCapacity] = useState("15");
  const [isLoadingClinicians, setIsLoadingClinicians] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");


  const selectedDepartmentOptions = useMemo(() => {
    return Array.from(new Set([department, selectedClinician?.department, ...departmentOptions].filter((item): item is string => Boolean(item))));
  }, [department, selectedClinician?.department]);

  const clinicianItems = useMemo(() => {
    if (isLoadingClinicians) return [{ label: "Loading clinicians...", value: "loading" }];
    if (clinicians.length === 0) return [{ label: "No clinicians available", value: "none" }];
    return clinicians.map((clinician) => ({ label: clinician.displayName, value: clinician.id }));
  }, [clinicians, isLoadingClinicians]);

  const fetchClinicians = useCallback(async () => {
    setIsLoadingClinicians(true);
    setError("");

    try {
      const payload = await authorizedRequest("/clinicians");
      console.log("Raw clinicians response:", payload);
      const nextClinicians = getItems(payload).map(normalizeClinician).filter((clinician) => clinician.id);
      setClinicians(nextClinicians);

      if (!selectedClinicianId && nextClinicians[0]) {
        setSelectedClinicianId(nextClinicians[0].id);
        setSelectedClinician(nextClinicians[0]);
        setDepartment(nextClinicians[0].department);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load clinicians.");
    } finally {
      setIsLoadingClinicians(false);
    }
  }, [selectedClinicianId]);

  const fetchClinicianProfile = useCallback(async (clinicianId: string) => {
    if (!clinicianId || clinicianId === "loading" || clinicianId === "none") {
      setSelectedClinician(null);
      return;
    }

    setIsLoadingProfile(true);
    setSelectedClinician(null);
    setError("");

    try {
      const payload = await authorizedRequest(`/clinicians/${encodeURIComponent(clinicianId)}`);
      const profile = normalizeClinician(asRecord(unwrapData(payload)) ?? {});
      setSelectedClinician(profile.id ? profile : null);
      if (profile.department) setDepartment(profile.department);
    } catch (requestError) {
      setSelectedClinician(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to load clinician profile.");
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void Promise.resolve().then(fetchClinicians);
  }, [fetchClinicians, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedClinicianId) return;
    void Promise.resolve().then(() => fetchClinicianProfile(selectedClinicianId));
  }, [fetchClinicianProfile, isOpen, selectedClinicianId]);


  const toggleDay = (day: string) => {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((selectedDay) => selectedDay !== day) : [...current, day],
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((selectedType) => selectedType !== type) : [...current, type],
    );
  };

  const handleSave = async () => {
    if (!selectedClinicianId || selectedClinicianId === "loading" || selectedClinicianId === "none") {
      setError("Select a clinician before saving.");
      return;
    }

    setIsSaving(true);
    setError("");

    const body = {
      workingDays: workingDays.filter((day) => selectedDays.includes(day.key)).map((day) => day.apiValue),
      workingHoursStart: toTwentyFourHour(workingHoursStart),
      workingHoursEnd: toTwentyFourHour(workingHoursEnd),
      breakStart: toTwentyFourHour(breakStart),
      breakEnd: toTwentyFourHour(breakEnd),
      dailyCapacity: Number(dailyCapacity),
      supportedAppointmentTypes: Array.from(new Set(appointmentTypes.filter((type) => selectedTypes.includes(type.key)).map((type) => type.apiValue))),
      department,
      isActive,
    };

    try {
      await authorizedRequest(`/clinicians/${encodeURIComponent(selectedClinicianId)}/schedule`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Schedule saved successfully");
      await fetchClinicians();
      window.dispatchEvent(new CustomEvent("clinicians:refresh"));
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const previewName = selectedClinician?.name ?? "";
  const previewInitials = selectedClinician ? getInitials(selectedClinician.name) : "";
  const utilization = selectedClinician?.capacityUtilization ?? 0;
  const nextAvailable = selectedClinician?.nextAvailable ?? "--";
  const statusKey = selectedClinician?.status ?? "unavailable";
  const statusLabel = previewStatusLabels[statusKey] ?? "UNAVAILABLE";
  const statusClassName = previewStatusClasses[statusKey] ?? previewStatusClasses.unavailable;

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-32px)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#DDE3EC] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.32)] outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <header className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 sm:px-8 py-4 sm:py-7">
              <div>
                <DialogPrimitive.Title className="text-lg font-bold md:text-xl text-[#111827]">
                  Add Clinician Schedule
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm font-medium text-[#344054]">
                  Configure hospital availability and operational limits.
                </DialogPrimitive.Description>
              </div>
              <button
                type="button"
                aria-label="Close add clinician schedule modal"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#344054] transition-colors hover:bg-[#E5E7EB]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4 sm:py-7 sm:px-8">
              {error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div> : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  label="Clinician"
                  value={selectedClinicianId || (isLoadingClinicians ? "loading" : "none")}
                  items={clinicianItems}
                  onChange={(value) => {
                    setSelectedClinicianId(value);
                    setSelectedClinician(null);
                  }}
                  disabled={isLoadingClinicians}
                />
                <SelectField
                  label="Department"
                  value={department}
                  items={selectedDepartmentOptions.map((item) => ({ label: item, value: item }))}
                  onChange={setDepartment}
                />
              </div>

              <section className="mt-8">
                <h3 className="mb-4 text-xs font-bold tracking-[0.08em] text-[#71809B]">Working Days</h3>
                <div className="flex flex-wrap gap-3">
                  {workingDays.map((day) => {
                    const isSelected = selectedDays.includes(day.key);

                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
                          isSelected
                            ? "border-[#023E8A] bg-[#023E8A] text-white"
                            : "border-[#C9D5E5] bg-[#F8FAFC] text-[#71809B] hover:bg-[#EFF5FF]",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <TimeBlock icon={<Clock3 className="h-5 w-5" />} title="Working Hours" start={workingHoursStart} end={workingHoursEnd} onStartChange={setWorkingHoursStart} onEndChange={setWorkingHoursEnd} />
                <TimeBlock icon={<Coffee className="h-5 w-5" />} title="Optional Break" start={breakStart} end={breakEnd} onStartChange={setBreakStart} onEndChange={setBreakEnd} />
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <SelectField label="Daily Capacity (Patients)" value={dailyCapacity} items={capacityOptions.map((item) => ({ label: item, value: item }))} onChange={setDailyCapacity} />
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <div className="flex h-12 items-center justify-between rounded-lg border border-[#C9D5E5] bg-white px-4">
                    <span className="text-sm font-bold text-[#023E8A]">{isActive ? "Active" : "Inactive"}</span>
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                      className="data-[state=checked]:bg-[#023E8A] data-[state=unchecked]:bg-[#DDE3EC]"
                    />
                  </div>
                </div>
              </div>

              <section className="mt-8">
                <h3 className="mb-5 text-xs font-bold tracking-[0.08em] text-[#344054]">
                  Supported Appointment Types
                </h3>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
                  {appointmentTypes.map((type) => {
                    const checked = selectedTypes.includes(type.key);

                    return (
                      <label key={type.key} className="flex items-center gap-3 text-sm font-medium text-[#344054]">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleType(type.key)}
                          className="h-5 w-5 rounded border-[#DDE3EC] data-[state=checked]:border-[#023E8A] data-[state=checked]:bg-[#023E8A]"
                        />
                        <span>{type.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              {selectedClinicianId && selectedClinicianId !== "loading" && selectedClinicianId !== "none" ? (
                <section className="mt-8 flex flex-col gap-4 rounded-xl border border-[#B9D9FF] bg-[#E7F2FF] p-4 sm:flex-row sm:items-center sm:justify-between">
                  {isLoadingProfile ? (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-[#DDE7F5] ring-4 ring-white" />
                        <div>
                          <div className="h-4 w-40 animate-pulse rounded bg-[#CFE4FF]" />
                          <div className="mt-3 h-3 w-72 max-w-full animate-pulse rounded bg-[#CFE4FF]" />
                        </div>
                      </div>
                      <div className="h-8 w-28 shrink-0 animate-pulse rounded-full bg-white" />
                    </>
                  ) : selectedClinician ? (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDE7F5] text-sm font-bold text-[#023E8A] ring-4 ring-white">
                          {previewInitials}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#111827]">{previewName}</h3>
                          <p className="mt-1 text-sm font-medium text-[#344054]">
                            Active Load: <span className={cn("font-bold", getLoadClassName(utilization))}>{utilization}%</span>
                            <span className="mx-2">&bull;</span>
                            Next available: {nextAvailable}
                          </p>
                        </div>
                      </div>
                      <span className={cn("inline-flex h-8 shrink-0 items-center justify-center rounded-full border bg-white px-4 text-xs font-bold", statusClassName)}>
                        {statusLabel}
                      </span>
                    </>
                  ) : null}
                </section>
              ) : null}
            </div>

            <footer className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:gap-5 border-t border-[#E5E7EB] bg-[#F8FAFC] px-4 sm:px-8 py-5">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="h-11 px-2 text-sm font-bold text-[#344054] hover:bg-transparent hover:text-[#111827]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="h-12 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isSaving ? "Saving..." : "Save Schedule"}
              </Button>
            </footer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}