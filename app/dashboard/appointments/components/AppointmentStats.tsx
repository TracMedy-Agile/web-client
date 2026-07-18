"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarCheck, Timer, Video } from "lucide-react";
import { getAppointments } from "@/lib/api/appointments";
import { cn } from "@/lib/utils";

export type AppointmentStatsValues = {
  totalBookings: number;
  todaysAppointments: number;
  physicalVisits: number;
  teleconsultations: number;
  pendingApproval: number;
};

type AppointmentStatsProps = {
  values?: AppointmentStatsValues;
  refreshKey?: number;
};

type ApiRecord = Record<string, unknown>;

const emptyStats: AppointmentStatsValues = {
  totalBookings: 0,
  todaysAppointments: 0,
  physicalVisits: 0,
  teleconsultations: 0,
  pendingApproval: 0,
};

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function getString(record: ApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return fallback;
}

function getAppointmentItems(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const record = asRecord(payload);
  if (!record) return [];

  if (Array.isArray(record.data)) return record.data.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const data = asRecord(record.data);
  if (data) {
    if (Array.isArray(data.data)) return data.data.filter((item): item is ApiRecord => Boolean(asRecord(item)));
    if (Array.isArray(data.appointments)) return data.appointments.filter((item): item is ApiRecord => Boolean(asRecord(item)));
    if (Array.isArray(data.items)) return data.items.filter((item): item is ApiRecord => Boolean(asRecord(item)));
    if (Array.isArray(data.results)) return data.results.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  if (Array.isArray(record.appointments)) return record.appointments.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  if (Array.isArray(record.items)) return record.items.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  if (Array.isArray(record.results)) return record.results.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  return [];
}

function getTotalCount(payload: unknown, fallback: number) {
  const record = asRecord(payload);
  const data = record ? asRecord(record.data) : null;
  const meta = data ? asRecord(data.meta) : null;
  const candidates = [
    record?.total,
    record?.totalCount,
    record?.count,
    data?.total,
    data?.totalCount,
    data?.count,
    meta?.total,
    meta?.totalCount,
    meta?.count,
  ];

  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
}

function getRecordDate(record: ApiRecord) {
  const value = getString(record, ["date", "appointmentDate", "scheduledDate", "startsAt", "startTime"]);
  const parsed = Date.parse(value);
  if (value.includes("T") && Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function getAppointmentType(record: ApiRecord) {
  return getString(record, ["type", "appointmentType"]).toLowerCase().trim();
}

function getAppointmentStatus(record: ApiRecord) {
  return getString(record, ["status"]).toLowerCase().trim();
}

function calculateStats(payload: unknown): AppointmentStatsValues {
  const appointments = getAppointmentItems(payload);
  const today = new Date().toISOString().slice(0, 10);

  return {
    totalBookings: getTotalCount(payload, appointments.length),
    todaysAppointments: appointments.filter((appointment) => getRecordDate(appointment) === today).length,
    physicalVisits: appointments.filter((appointment) => getAppointmentType(appointment) === "in_person").length,
    teleconsultations: appointments.filter((appointment) => getAppointmentType(appointment) === "teleconsultation").length,
    pendingApproval: appointments.filter((appointment) => getAppointmentStatus(appointment) === "pending").length,
  };
}

function StatValue({ isLoading, value }: { isLoading: boolean; value: number }) {
  if (isLoading) {
    return <span className="mt-2 block h-8 w-12 animate-pulse rounded bg-[#EEF2F7]" />;
  }

  return <p className="mt-2 text-xl font-bold leading-none text-[#0F172A] md:text-3xl">{value}</p>;
}

export default function AppointmentStats({ values, refreshKey = 0 }: AppointmentStatsProps) {
  const [stats, setStats] = useState<AppointmentStatsValues>(values ?? emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadStats = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getAppointments();
        if (!ignore) setStats(calculateStats(payload));
      } catch (requestError) {
        if (!ignore) {
          setStats(values ?? emptyStats);
          setError(requestError instanceof Error ? requestError.message : "Failed to load appointment stats.");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void Promise.resolve().then(loadStats);

    return () => {
      ignore = true;
    };
  }, [refreshKey, values]);

  const cards = [
    {
      label: "Total Bookings",
      value: stats.totalBookings,
      change: error ? "--" : "Live",
      tone: "positive",
      icon: CalendarCheck,
      iconClassName: "bg-[#E7F2FF] text-[#1479E8]",
    },
    {
      label: "Today's Appointments",
      value: stats.todaysAppointments,
      change: error ? "--" : "Live",
      tone: "positive",
      icon: CalendarCheck,
      iconClassName: "bg-[#E7F2FF] text-[#1479E8]",
    },
    {
      label: "Physical Visit",
      value: stats.physicalVisits,
      change: error ? "--" : "Live",
      tone: "positive",
      icon: Building2,
      iconClassName: "bg-[#E7F2FF] text-[#1479E8]",
    },
    {
      label: "Teleconsultations",
      value: stats.teleconsultations,
      change: error ? "--" : "Live",
      tone: "positive",
      icon: Video,
      iconClassName: "bg-[#E7F2FF] text-[#1479E8]",
    },
    {
      label: "Pending Approval",
      value: stats.pendingApproval,
      change: error ? "--" : "Live",
      tone: "positive",
      icon: Timer,
      iconClassName: "bg-[#FFF1D8] text-[#F59E0B]",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map(({ label, value, change, tone, icon: Icon, iconClassName }) => (
        <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="flex items-center justify-between">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconClassName)}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span
              className={cn(
                "rounded px-2 py-1 text-xs font-bold",
                tone === "positive" ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500",
              )}
            >
              {isLoading ? "..." : change}
            </span>
          </div>
          <p className="mt-6 text-sm font-medium text-[#71809B]">{label}</p>
          <StatValue isLoading={isLoading} value={value} />
        </div>
      ))}
    </div>
  );
}







