"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronLeft, Loader2, PencilLine, UserRoundCheck, UserRoundMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DisconnectPatientDialog } from "@/app/dashboard/connected-patients/components/DisconnectPatientDialog";
import { EditConnectedPatientDialog } from "@/app/dashboard/connected-patients/components/EditConnectedPatientDialog";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";
import {
  disconnectConnectedPatient,
  getHospitalFacilityId,
  getPatientProfile,
  reconnectConnectedPatient,
  updateConnectedPatient,
  type ApiRecord,
  type PatientProfileResponse,
  type UpdateConnectedPatientInput,
} from "@/lib/api/connected-patients";

type EpisodeStatus = "active" | "completed" | "pending";
type AppointmentStatus = "completed" | "cancelled" | "scheduled";
type HistoryTone = "positive" | "negative" | "neutral";

type CareEpisodeRow = {
  id: string;
  name: string;
  clinician: string;
  startDate: string;
  status: EpisodeStatus;
};

type AppointmentEntry = {
  id: string;
  type: string;
  status: AppointmentStatus;
  dateTime: string;
  clinicianName: string;
};

const episodeStatusClasses: Record<EpisodeStatus, string> = {
  active: "bg-emerald-50 text-emerald-600",
  completed: "bg-blue-50 text-primary",
  pending: "bg-amber-50 text-amber-700",
};

const appointmentStatusClasses: Record<AppointmentStatus, string> = {
  completed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-red-50 text-red-500",
  scheduled: "bg-blue-50 text-primary",
};

const historyToneClasses: Record<HistoryTone, string> = {
  positive: "bg-emerald-500 ring-emerald-100",
  negative: "bg-red-500 ring-red-100",
  neutral: "bg-slate-500 ring-slate-100",
};

function getString(record: ApiRecord, keys: string[], fallback = "--") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatLongDate(value: string | null) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!value || !Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function formatAppointmentDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return "--";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(parsed));
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(parsed));
  return `${date} @ ${time}`;
}

function normalizeEpisodeStatus(value: string): EpisodeStatus {
  const normalized = value.toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "pending") return "pending";
  return "completed";
}

function normalizeAppointmentStatus(value: string): AppointmentStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("complete")) return "completed";
  return "scheduled";
}

function normalizeAppointmentType(value: string) {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "_");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("nurse")) return "Nurse Check-in";
  return "Physical Visit";
}

function normalizeCareEpisodeRow(record: ApiRecord): CareEpisodeRow {
  return {
    id: getString(record, ["id"], ""),
    name: getString(record, ["diagnosis", "name", "title"], "Care Episode"),
    clinician: getString(record, ["clinicianName", "clinician"]),
    startDate: getString(record, ["openedAt", "createdAt", "startDate"], ""),
    status: normalizeEpisodeStatus(getString(record, ["status"], "")),
  };
}

function normalizeAppointmentEntry(record: ApiRecord): AppointmentEntry {
  const date = getString(record, ["date", "dateTime"], "");
  const time = getString(record, ["time"], "");
  const dateTime = date && time && !date.includes("T")
    ? date + "T" + time
    : date && time
      ? date.slice(0, 10) + "T" + time
      : date;

  return {
    id: getString(record, ["id"], ""),
    type: normalizeAppointmentType(getString(record, ["type"], "in_person")),
    status: normalizeAppointmentStatus(getString(record, ["status"], "scheduled")),
    dateTime,
    clinicianName: getString(record, ["clinicianName", "clinician"]),
  };
}

function historyTypeLabel(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("disconnect")) return "Disconnected";
  if (normalized.includes("reconnect")) return "Reconnected";
  if (normalized.includes("connect")) return "Connected";
  return type || "Update";
}

function historyTone(type: string): HistoryTone {
  const normalized = type.toLowerCase();
  if (normalized.includes("disconnect")) return "negative";
  if (normalized.includes("connect")) return "positive";
  return "neutral";
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="h-24 w-24 animate-pulse rounded-full bg-muted" />
          <div className="space-y-3">
            <div className="h-6 w-56 animate-pulse rounded bg-muted" />
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="hidden h-11 w-48 animate-pulse rounded-lg bg-muted sm:block" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="space-y-6">
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function ConnectedPatientProfilePage() {
  const params = useParams<{ id: string }>();
  const patientId = params?.id ?? "";

  const [profile, setProfile] = useState<PatientProfileResponse | null>(null);
  const [facilityId, setFacilityId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isConnectionActionRunning, setIsConnectionActionRunning] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  useEffect(() => {
    if (patientId) {
      capturePostHogEvent("patient_profile_viewed", { patient_id: patientId });
    }
  }, [patientId]);

  const loadProfile = useCallback(async (showLoading = true) => {
    if (!patientId) return;
    if (showLoading) setIsLoading(true);
    setError("");
    try {
      const resolvedFacilityId = facilityId || await getHospitalFacilityId();
      if (!resolvedFacilityId) throw new Error("Unable to determine your facility. Please sign in again and retry.");
      setFacilityId(resolvedFacilityId);
      setProfile(await getPatientProfile(resolvedFacilityId, patientId));
    } catch (requestError) {
      setProfile(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to load patient.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [facilityId, patientId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadProfile]);

  const careEpisodes = useMemo(() => (profile?.careEpisodes ?? []).map(normalizeCareEpisodeRow), [profile]);
  const appointments = useMemo(() => (profile?.appointments ?? []).map(normalizeAppointmentEntry), [profile]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/connected-patients"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Connected Patients
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center text-sm font-semibold text-red-600">
          {error || "Patient not found."}
        </div>
      </div>
    );
  }

  const { patient, connection, connectionHistory } = profile;
  const name = patient.name || "Unknown Patient";
  const isConnected = connection.status === "active";
  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/connected-patients"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Connected Patients
      </Link>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          {patient.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={patient.avatarUrl} alt={name} className="h-24 w-24 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground">
              {getInitials(name)}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-foreground md:text-2xl">{name}</h1>
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                  isConnected ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
                )}
              >
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-base font-medium text-muted-foreground">
              <CalendarDays className="h-5 w-5" />
              Connected since {formatLongDate(connection.connectedAt || null)}
            </p>
          </div>
        </div>

        {isConnected ? (

            <Button
              type="button"
              size="lg"
              className="h-12 self-start rounded-lg px-6 font-bold sm:self-center"
              disabled={isConnectionActionRunning}
              onClick={() => setIsDisconnectDialogOpen(true)}
            >
              <UserRoundMinus className="h-5 w-5" />
              Disconnect Patient
            </Button>

        ) : (

            <Button
              type="button"
              size="lg"
              className="h-12 self-start rounded-lg px-6 font-bold sm:self-center"
              disabled={isConnectionActionRunning}
              onClick={() => void (async () => {
                setIsConnectionActionRunning(true);
                try {
                  await reconnectConnectedPatient(facilityId, patientId);
                  capturePostHogEvent("connected_patient_reconnected", { patient_id: patientId });
                  await loadProfile(false);
                  toast.success("Patient reconnected successfully.");
                } catch (requestError) {
                  toast.error(requestError instanceof Error ? requestError.message : "Failed to reconnect patient.");
                } finally {
                  setIsConnectionActionRunning(false);
                }
              })()}
            >
              {isConnectionActionRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserRoundCheck className="h-5 w-5" />}
              Reconnect Patient
            </Button>

        )}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold text-foreground">Patient Information</h2>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <PencilLine className="h-4 w-4" />
                  Edit
                </button>

            </div>
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-x-12 gap-y-9 sm:grid-cols-2">
                <InfoField label="TRACMEDY ID" value={patient.tracmedyPatientId || "--"} />
                <InfoField label="HOSPITAL ID" value={connection.externalPatientId || "--"} />
                <InfoField label="AGE" value={patient.age !== null ? `${patient.age} Years` : "--"} />
                <InfoField label="GENDER" value={patient.gender || "--"} />
                <InfoField label="PHONE NUMBER" value={patient.phone || "--"} />
                <InfoField label="EMAIL ADDRESS" value={patient.email || "--"} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold text-foreground">Care Episodes</h2>
            </div>
            <CardContent className="p-0">
              {careEpisodes.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm font-medium text-muted-foreground">No care episodes found for this patient.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-170 border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-primary/5 text-left">
                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground">EPISODE NAME</th>
                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground">CLINICIAN</th>
                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground">START DATE</th>
                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {careEpisodes.map((episode) => (
                        <tr key={episode.id} className="border-b border-border last:border-0">
                          <td className="px-6 py-5 font-bold text-foreground">{episode.name}</td>
                          <td className="px-6 py-5 text-foreground/80">{episode.clinician}</td>
                          <td className="px-6 py-5 text-foreground/80">{formatLongDate(episode.startDate || null)}</td>
                          <td className="px-6 py-5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase",
                                episodeStatusClasses[episode.status],
                              )}
                            >
                              {episode.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-xl border-border bg-card shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <h2 className="mb-7 text-lg font-bold text-foreground">Connection History</h2>
              {connectionHistory.length === 0 ? (
                <p className="text-sm font-medium text-muted-foreground">No connection history available.</p>
              ) : (
                <ol className="space-y-8">
                  {connectionHistory.map((event, index) => (
                    <li key={event.id || index} className="relative flex gap-4 pl-1">
                      {index < connectionHistory.length - 1 ? (
                        <span className="absolute left-[9px] top-5 h-[calc(100%+2rem)] w-px bg-border" />
                      ) : null}
                      <span
                        className={cn(
                          "relative mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-card ring-4",
                          historyToneClasses[historyTone(event.type)],
                        )}
                      />
                      <div>
                        <p className="text-sm font-bold text-foreground">{historyTypeLabel(event.type)}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatLongDate(event.occurredAt || null)}</p>
                        {event.note ? <p className="mt-2 text-xs font-medium italic leading-5 text-muted-foreground">{event.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-5 sm:px-6">
                <h2 className="text-lg font-bold text-foreground">Appointments</h2>
                <Link
                  href={"/dashboard/appointments?patientId=" + encodeURIComponent(patient.id)}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  See All
                </Link>
            </div>
            <CardContent className="p-0">
              <div>
                {appointments.length === 0 ? (
                  <p className="px-6 py-10 text-sm font-medium text-muted-foreground">No appointments found for this patient.</p>
                ) : (
                  appointments.slice(0, 3).map((appointment) => (
                    <div key={appointment.id} className="border-b border-border px-5 py-5 last:border-0 sm:px-6">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-foreground">{appointment.type}</p>
                        <span
                          className={cn(
                            "inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase",
                            appointmentStatusClasses[appointment.status],
                          )}
                        >
                          {appointment.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-primary">{formatAppointmentDateTime(appointment.dateTime)}</p>
                      {appointment.clinicianName !== "--" ? (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/40 text-[10px] font-bold text-foreground">
                            {getInitials(appointment.clinicianName)}
                          </span>
                          <p className="text-xs font-medium text-muted-foreground">{appointment.clinicianName}</p>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DisconnectPatientDialog
        open={isDisconnectDialogOpen}
        patientName={name}
        onOpenChange={setIsDisconnectDialogOpen}
        onConfirm={async () => {
          setIsConnectionActionRunning(true);
          try {
            await disconnectConnectedPatient(facilityId, patientId);
            capturePostHogEvent("connected_patient_disconnected", { patient_id: patientId });
            await loadProfile(false);
            toast.success("Patient disconnected successfully.");
          } finally {
            setIsConnectionActionRunning(false);
          }
        }}
      />
      <EditConnectedPatientDialog
        key={isEditDialogOpen ? "edit-open" : "edit-closed"}
        open={isEditDialogOpen}
        patient={patient}
        connection={connection}
        onOpenChange={setIsEditDialogOpen}
        onSave={async (input: UpdateConnectedPatientInput) => {
          const updated = await updateConnectedPatient(facilityId, patientId, input);
          setProfile(updated);
          capturePostHogEvent("connected_patient_updated", { patient_id: patientId });
          toast.success("Patient information updated.");
        }}
      />
    </div>
  );
}
