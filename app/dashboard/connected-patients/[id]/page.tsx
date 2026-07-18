"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronLeft, MessageSquare, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getHospitalFacilityId,
  getPatientProfile,
  type ApiRecord,
  type PatientProfileResponse,
} from "@/lib/api/connected-patients";

type EpisodeStatus = "active" | "completed";
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
  active: "bg-[#DFFBF0] text-[#10B981]",
  completed: "bg-[#F3F4F6] text-[#71809B]",
};

const appointmentStatusClasses: Record<AppointmentStatus, string> = {
  completed: "bg-[#DFFBF0] text-[#10B981]",
  cancelled: "bg-[#FFECEC] text-[#EF4444]",
  scheduled: "bg-[#E7F2FF] text-[#023E8A]",
};

const historyToneClasses: Record<HistoryTone, string> = {
  positive: "bg-[#10B981] ring-[#DFFBF0]",
  negative: "bg-[#EF4444] ring-[#FFECEC]",
  neutral: "bg-[#71809B] ring-[#F3F4F6]",
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
  return value.toLowerCase() === "active" ? "active" : "completed";
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
    startDate: getString(record, ["createdAt", "startDate"], ""),
    status: normalizeEpisodeStatus(getString(record, ["status"], "")),
  };
}

function normalizeAppointmentEntry(record: ApiRecord): AppointmentEntry {
  return {
    id: getString(record, ["id"], ""),
    type: normalizeAppointmentType(getString(record, ["type"], "in_person")),
    status: normalizeAppointmentStatus(getString(record, ["status"], "scheduled")),
    dateTime: getString(record, ["date", "dateTime"], ""),
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
      <p className="text-xs font-bold tracking-[0.05em] text-[#71809B]">{label}</p>
      <p className="mt-1.5 text-sm font-bold text-[#111827]">{value}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-[#E5E7EB]" />
      <div className="h-24 animate-pulse rounded-xl bg-[#F3F4F6]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl bg-[#F3F4F6] lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl bg-[#F3F4F6]" />
      </div>
    </div>
  );
}

export default function ConnectedPatientProfilePage() {
  const params = useParams<{ id: string }>();
  const patientId = params?.id ?? "";

  const [profile, setProfile] = useState<PatientProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patientId) return;
    let ignore = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const facilityId = await getHospitalFacilityId();
        if (!facilityId) throw new Error("Unable to determine your facility. Please sign in again and retry.");

        const response = await getPatientProfile(facilityId, patientId);
        if (!ignore) setProfile(response);
      } catch (requestError) {
        if (!ignore) {
          setProfile(null);
          setError(requestError instanceof Error ? requestError.message : "Failed to load patient.");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [patientId]);

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
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#71809B] hover:text-[#111827]"
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

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/connected-patients"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#71809B] hover:text-[#111827]"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Connected Patients
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {patient.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={patient.avatarUrl} alt={name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#023E8A] text-xl font-bold text-white">
              {getInitials(name)}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-[#111827] md:text-xl">{name}</h1>
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                  connection.status === "active" ? "bg-[#DFFBF0] text-[#10B981]" : "bg-[#FFECEC] text-[#EF4444]",
                )}
              >
                {connection.status === "active" ? "Connected" : "Disconnected"}
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-[#71809B]">
              <CalendarDays className="h-4 w-4" />
              Connected since {formatLongDate(connection.connectedAt || null)}
            </p>
          </div>
        </div>
        <div className="flex w-full gap-3 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 gap-2 rounded-xl border-[#DDE3EC] bg-white px-5 text-sm font-bold text-[#111827] hover:bg-[#F8FAFC] sm:flex-none"
          >
            <Share2 className="h-4 w-4" />
            Share Profile
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 gap-2 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575] sm:flex-none"
          >
            <MessageSquare className="h-4 w-4" />
            Message Patient
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111827]">Patient Information</h2>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
                <InfoField label="TRACMEDY ID" value={patient.tracmedyPatientId || "--"} />
                <InfoField label="HOSPITAL ID" value={connection.externalPatientId || "--"} />
                <InfoField label="DATE OF BIRTH" value={formatLongDate(patient.dateOfBirth || null)} />
                <InfoField label="AGE" value={patient.age !== null ? `${patient.age} Years` : "--"} />
                <InfoField label="GENDER" value={patient.gender || "--"} />
                <InfoField label="BLOOD GROUP" value={patient.bloodGroup || "--"} />
                <InfoField label="PHONE NUMBER" value={patient.phone || "--"} />
                <InfoField label="EMAIL ADDRESS" value={patient.email || "--"} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <h2 className="mb-4 text-base font-bold text-[#111827]">Care Episodes</h2>
              {careEpisodes.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-[#71809B]">No care episodes found for this patient.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-150 border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-left">
                        <th className="pb-3 pr-4 text-xs font-bold text-[#71809B]">EPISODE NAME</th>
                        <th className="pb-3 pr-4 text-xs font-bold text-[#71809B]">CLINICIAN</th>
                        <th className="pb-3 pr-4 text-xs font-bold text-[#71809B]">START DATE</th>
                        <th className="pb-3 text-xs font-bold text-[#71809B]">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {careEpisodes.map((episode) => (
                        <tr key={episode.id} className="border-b border-[#E5E7EB] last:border-0">
                          <td className="py-4 pr-4 font-bold text-[#111827]">{episode.name}</td>
                          <td className="py-4 pr-4 text-[#344054]">{episode.clinician}</td>
                          <td className="py-4 pr-4 text-[#344054]">{formatLongDate(episode.startDate || null)}</td>
                          <td className="py-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase",
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
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <h2 className="mb-5 text-base font-bold text-[#111827]">Connection History</h2>
              {connectionHistory.length === 0 ? (
                <p className="text-sm font-medium text-[#71809B]">No connection history available.</p>
              ) : (
                <ol className="space-y-6">
                  {connectionHistory.map((event, index) => (
                    <li key={event.id || index} className="relative flex gap-3 pl-1">
                      {index < connectionHistory.length - 1 ? (
                        <span className="absolute left-[7px] top-4 h-full w-px bg-[#E5E7EB]" />
                      ) : null}
                      <span
                        className={cn(
                          "relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white ring-2",
                          historyToneClasses[historyTone(event.type)],
                        )}
                      />
                      <div>
                        <p className="text-sm font-bold text-[#111827]">{historyTypeLabel(event.type)}</p>
                        <p className="text-xs font-medium text-[#71809B]">{formatLongDate(event.occurredAt || null)}</p>
                        {event.note ? <p className="mt-1 text-xs font-medium italic text-[#71809B]">{event.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111827]">Appointments</h2>
              </div>
              <div className="space-y-5">
                {appointments.length === 0 ? (
                  <p className="text-sm font-medium text-[#71809B]">No appointments found for this patient.</p>
                ) : (
                  appointments.map((appointment) => (
                    <div key={appointment.id} className="border-b border-[#E5E7EB] pb-5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-[#111827]">{appointment.type}</p>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase",
                            appointmentStatusClasses[appointment.status],
                          )}
                        >
                          {appointment.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-[#71809B]">{formatAppointmentDateTime(appointment.dateTime)}</p>
                      {appointment.clinicianName !== "--" ? (
                        <p className="mt-2 text-xs font-medium text-[#344054]">{appointment.clinicianName}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
