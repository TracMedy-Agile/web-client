"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from "@/components/ui/sheet";
import { getAppointmentById, getClinicians } from "@/lib/api/appointments";
import { cn } from "@/lib/utils";

type AssignAppointmentDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  appointmentId?: string;
};

type ApiRecord = Record<string, unknown>;

type AppointmentSummary = {
  id: string;
  patientName: string;
  initials: string;
  department: string;
  type: string;
  reason: string;
  date: string;
};

type ClinicianSuggestion = {
  id: string;
  name: string;
  department: string;
  status: string;
  assigned: number;
  capacity: number;
  utilization: number;
  isTopMatch: boolean;
  isFull: boolean;
  tone: "blue" | "green" | "red";
  initials: string;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

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

  for (const key of ["items", "results", "clinicians"]) {
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

function getInitials(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "PT";
}

function formatDoctorName(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  return cleaned ? `Dr. ${cleaned}` : "Dr. Unknown Clinician";
}

function formatType(value: string) {
  const normalized = value.toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("physical") || normalized.includes("person")) return "Physical Visit";
  return value || "Physical Visit";
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return value || "--";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function normalizeStatusKey(value: string) {
  return value.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function normalizeAppointmentSummary(payload: unknown, fallbackId: string): AppointmentSummary {
  const record = asRecord(unwrapData(payload)) ?? {};
  const patient = asRecord(record.patient);
  const patientName = getString(record, ["patientName"], "") || getString(patient, ["name", "fullName"], "Unknown Patient");

  return {
    id: getString(record, ["id"], fallbackId),
    patientName,
    initials: getInitials(patientName),
    department: getString(record, ["department", "service"], "--"),
    type: formatType(getString(record, ["type", "appointmentType"], "in_person")),
    reason: getString(record, ["reason"], "No reason provided."),
    date: formatDate(getString(record, ["date", "appointmentDate", "scheduledDate", "startsAt", "startTime"])),
  };
}

function normalizeClinicianSuggestion(record: ApiRecord, index: number): ClinicianSuggestion {
  const status = normalizeStatusKey(getString(record, ["status"], "available"));
  const isFull = status === "full" || status === "unavailable";
  const capacity = getNumber(record, ["dailyCapacity"], 0);
  const assigned = getNumber(record, ["assignedAppointments", "assignedToday"], 0);
  const utilization = Math.min(Math.max(Math.round(getNumber(record, ["capacityUtilization", "utilizationPercentage"], 0)), 0), 100);
  const name = formatDoctorName(getString(record, ["name", "fullName", "displayName"], "Unknown Clinician"));

  return {
    id: getString(record, ["id", "clinicianId", "_id"]),
    name,
    department: getString(record, ["department", "speciality", "specialty"], "--"),
    status,
    assigned,
    capacity,
    utilization,
    isTopMatch: index === 0 && !isFull,
    isFull,
    tone: isFull ? "red" : index === 0 ? "blue" : "green",
    initials: getInitials(name),
  };
}

function sortClinicians(items: ApiRecord[]) {
  const rank = (status: string) => (status === "available" ? 0 : status === "near_capacity" ? 1 : 2);

  return [...items].sort((a, b) => {
    const rankDiff = rank(normalizeStatusKey(getString(a, ["status"], "available"))) - rank(normalizeStatusKey(getString(b, ["status"], "available")));
    if (rankDiff !== 0) return rankDiff;
    return getNumber(a, ["capacityUtilization", "utilizationPercentage"], 0) - getNumber(b, ["capacityUtilization", "utilizationPercentage"], 0);
  });
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

async function assignAppointment(appointmentId: string, clinicianId: string, force = false) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}/appointments/${encodeURIComponent(appointmentId)}/assign`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ clinicianId, force }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(getString(asRecord(payload), ["message", "error"], "Failed to assign clinician."));
    error.name = getString(asRecord(payload), ["code", "type"], "");
    throw error;
  }

  return payload;
}

function isCapacityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return text.includes("capacity");
}

function ClinicianCard({
  clinician,
  isAssigning,
  onAssign,
}: {
  clinician: ClinicianSuggestion;
  isAssigning: boolean;
  onAssign: (clinician: ClinicianSuggestion) => void;
}) {
  const utilization = clinician.capacity > 0 ? Math.min((clinician.assigned / clinician.capacity) * 100, 100) : clinician.utilization;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white p-5",
        clinician.isTopMatch ? "border-2 border-[#023E8A]" : "border-[#DDE3EC]",
      )}
    >
      {clinician.isTopMatch ? (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-[#023E8A] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white">
          Top Match
        </div>
      ) : null}

      <div className="flex items-start gap-4">
        <div
          className={cn(
            "mt-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white",
            clinician.tone === "blue" && "bg-[#DDE7F5] text-[#023E8A]",
            clinician.tone === "green" && "bg-[#DDF5EC] text-[#047857]",
            clinician.tone === "red" && "bg-[#FFF1E8] text-[#B91C1C]",
          )}
        >
          {clinician.initials}
        </div>

        <div className="min-w-0 flex-1 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#111827]">{clinician.name}</h3>
              <p className="mt-1 text-sm font-medium text-[#344054]">{clinician.department}</p>
            </div>

            {clinician.isFull ? (
              <span className="rounded-full bg-[#EF4444] px-3 py-1 text-xs font-bold uppercase text-white">
                Full
              </span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase text-[#10B981]">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                Available
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#344054]">Capacity</span>
              <span className={cn("text-xs font-medium", clinician.isFull ? "text-[#EF4444]" : "text-[#111827]")}>
                {clinician.assigned}/{clinician.capacity} Assigned
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className={cn(
                  "h-full rounded-full",
                  clinician.tone === "blue" && "bg-[#023E8A]",
                  clinician.tone === "green" && "bg-[#10B981]",
                  clinician.tone === "red" && "bg-[#EF4444]",
                )}
                style={{ width: `${utilization}%` }}
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={isAssigning}
            onClick={() => onAssign(clinician)}
            className={cn(
              "mt-4 h-12 w-full rounded-lg text-base font-bold disabled:cursor-not-allowed disabled:opacity-70",
              clinician.isTopMatch && "bg-[#023E8A] text-white hover:bg-[#023575]",
              clinician.tone === "green" &&
                "border border-[#023E8A] bg-white text-[#023E8A] hover:bg-[#F5FAFF]",
              clinician.isFull && "border border-[#EF4444] bg-white text-[#EF4444] hover:bg-[#FFF5F5]",
            )}
          >
            {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {clinician.isFull ? "Assign anyway" : "Assign"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-8">
      <div className="h-32 animate-pulse rounded-xl bg-[#EEF2F7]" />
      <div className="mt-8 h-4 w-40 animate-pulse rounded bg-[#EEF2F7]" />
      <div className="mt-4 space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-xl bg-[#EEF2F7]" />
        ))}
      </div>
    </div>
  );
}

export default function AssignAppointmentDrawer({
  isOpen,
  onClose,
  appointmentId = "",
}: AssignAppointmentDrawerProps) {
  const [appointment, setAppointment] = useState<AppointmentSummary | null>(null);
  const [clinicians, setClinicians] = useState<ClinicianSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [assigningId, setAssigningId] = useState("");
  const [assignError, setAssignError] = useState("");
  const [capacityWarning, setCapacityWarning] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState("");
  const [showAll, setShowAll] = useState(false);

  const loadData = useCallback(async () => {
    if (!appointmentId) return;

    setIsLoading(true);
    setError("");

    try {
      const appointmentPayload = await getAppointmentById(appointmentId);
      const summary = normalizeAppointmentSummary(appointmentPayload, appointmentId);
      const cliniciansPayload = await getClinicians({
        department: summary.department === "--" ? undefined : summary.department,
        limit: showAll ? 50 : 5,
      });

      setAppointment(summary);
      setClinicians(sortClinicians(getItems(cliniciansPayload)).map(normalizeClinicianSuggestion));
    } catch (requestError) {
      setAppointment(null);
      setClinicians([]);
      setError(requestError instanceof Error ? requestError.message : "Failed to load appointment.");
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId, showAll]);

  useEffect(() => {
    if (!isOpen) return;
    void Promise.resolve().then(loadData);
  }, [isOpen, loadData]);

  useEffect(() => {
    if (!isOpen) {
      setShowAll(false);
      setCapacityWarning(null);
      setAssignError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleAssign = async (clinician: ClinicianSuggestion, force = false) => {
    if (!appointmentId) return;
    if (clinician.isFull && !force && !window.confirm(`${clinician.name} is at capacity. Assign anyway?`)) return;

    setAssigningId(clinician.id);
    setAssignError("");
    setCapacityWarning(null);

    try {
      await assignAppointment(appointmentId, clinician.id, force || clinician.isFull);
      setToast("Appointment assigned successfully");
      window.dispatchEvent(new CustomEvent("availability:refresh"));
      window.dispatchEvent(new CustomEvent("clinicians:refresh"));
      onClose();
    } catch (requestError) {
      if (isCapacityError(requestError)) {
        setCapacityWarning({ id: clinician.id, name: clinician.name });
      } else {
        setAssignError(requestError instanceof Error ? requestError.message : "Failed to assign clinician.");
      }
    } finally {
      setAssigningId("");
    }
  };

  return (
    <>
      {toast ? (
        <div className="fixed right-6 top-6 z-[80] rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-600 shadow-lg">
          {toast}
        </div>
      ) : null}
      <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <SheetPortal>
          <SheetOverlay className="bg-[#111827]/55 backdrop-blur-[3px]" />
          <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[514px] flex-col border-l border-[#DDE3EC] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.36)] outline-none duration-300 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=open]:animate-in">
            <header className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-4 sm:px-8 py-4 sm:py-8">
              <div>
                <SheetTitle className="text-lg font-bold md:text-xl text-[#111827]">Assign Appointment</SheetTitle>
                <SheetDescription className="mt-1 text-sm font-medium text-[#344054]">
                  {appointment ? `${appointment.department} Department` : "Loading appointment details"}
                </SheetDescription>
              </div>
              <button
                type="button"
                aria-label="Close assign appointment drawer"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#344054] transition-colors hover:bg-[#F3F4F6]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {isLoading ? <DrawerSkeleton /> : null}

            {!isLoading && error ? (
              <div className="flex-1 px-4 sm:px-6 py-10">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm font-semibold text-red-600">{error}</div>
                <Button type="button" onClick={loadData} className="mt-4 h-10 rounded-xl bg-[#023E8A] text-sm font-bold text-white hover:bg-[#023575]">
                  Retry
                </Button>
              </div>
            ) : null}

            {!isLoading && !error && appointment ? (
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-8">
                <section className="rounded-xl border border-[#C7DCF7] bg-[#E7F2FF] p-5">
                  <div className="flex items-center gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#023E8A] text-lg font-bold md:text-xl text-white">
                      {appointment.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#111827]">{appointment.patientName}</h3>
                        <span className="rounded-md bg-[#D6E9FF] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#023E8A]">
                          {appointment.department}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-[#344054]" />
                        <span className="text-sm font-medium text-[#344054]">{appointment.type}</span>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-8">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#344054]">Reason</p>
                          <p className="mt-2 text-sm font-medium text-[#111827]">{appointment.reason}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#344054]">Date</p>
                          <p className="mt-2 text-sm font-medium text-[#111827]">{appointment.date}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="mt-8 flex items-center justify-between border-b border-[#DDE3EC] pb-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#344054]">Suggested Clinicians</p>
                  {!showAll ? (
                    <button type="button" onClick={() => setShowAll(true)} className="text-sm font-bold text-[#023E8A]">
                      View All
                    </button>
                  ) : null}
                </div>

                {assignError ? (
                  <p className="mt-4 flex items-center gap-2 text-sm font-medium text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    {assignError}
                  </p>
                ) : null}

                <div className="mt-4 space-y-4 pb-4">
                  {clinicians.map((clinician) => (
                    <ClinicianCard
                      key={clinician.id}
                      clinician={clinician}
                      isAssigning={assigningId === clinician.id}
                      onAssign={(selected) => void handleAssign(selected)}
                    />
                  ))}
                  {clinicians.length === 0 ? (
                    <p className="py-6 text-center text-sm font-medium text-[#71809B]">No clinicians found for this department.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {capacityWarning ? (
              <div className="sticky bottom-0 border-t border-[#FECACA] bg-[#FFE8E5] px-4 sm:px-6 py-5">
                <div className="flex gap-3 text-sm font-medium leading-5 text-[#FF1F1F]">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    <p>
                      Assigning to {capacityWarning.name} will exceed their daily capacity threshold. Overtime
                      approvals may be triggered and medical director notification will be sent.
                    </p>
                    <button
                      type="button"
                      disabled={Boolean(assigningId)}
                      onClick={() => {
                        const clinician = clinicians.find((item) => item.id === capacityWarning.id);
                        if (clinician) void handleAssign(clinician, true);
                      }}
                      className="mt-3 text-sm font-bold text-[#FF1F1F] underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Assign anyway
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </SheetPortal>
      </Sheet>
    </>
  );
}
