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
type TrendTone = "positive" | "negative";
type TrendValue = { change: string; tone: TrendTone };
type AppointmentTrends = Record<keyof AppointmentStatsValues, TrendValue>;

const PAGE_LIMIT = 100;
const POLL_INTERVAL_MS = 60_000;
const emptyStats: AppointmentStatsValues = {
  totalBookings: 0,
  todaysAppointments: 0,
  physicalVisits: 0,
  teleconsultations: 0,
  pendingApproval: 0,
};
const emptyTrends: AppointmentTrends = {
  totalBookings: { change: "0%", tone: "positive" },
  todaysAppointments: { change: "0%", tone: "positive" },
  physicalVisits: { change: "0%", tone: "positive" },
  teleconsultations: { change: "0%", tone: "positive" },
  pendingApproval: { change: "0%", tone: "positive" },
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
    for (const key of ["data", "appointments", "items", "results"]) {
      const value = data[key];
      if (Array.isArray(value)) return value.filter((item): item is ApiRecord => Boolean(asRecord(item)));
    }
  }

  for (const key of ["appointments", "items", "results"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  return [];
}

function getTotalCount(payload: unknown, fallback: number) {
  const record = asRecord(payload);
  const data = record ? asRecord(record.data) : null;
  const candidates = [record, data, record ? asRecord(record.meta) : null, data ? asRecord(data.meta) : null];

  for (const candidate of candidates) {
    for (const key of ["total", "totalCount", "count"]) {
      const value = candidate?.[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
    }
  }

  return fallback;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateKeyForOffset(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
}

function normalizeDateKey(value: string) {
  const directMatch = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (directMatch) return directMatch;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? formatDateKey(new Date(parsed)) : "";
}

function getScheduledDateKey(record: ApiRecord) {
  return normalizeDateKey(getString(record, ["date", "appointmentDate", "scheduledDate", "startsAt", "startTime"]));
}

function getBookingDateKey(record: ApiRecord) {
  return normalizeDateKey(getString(record, ["createdAt", "bookingDate", "requestedAt", "date", "appointmentDate"]));
}

function getAppointmentType(record: ApiRecord) {
  return getString(record, ["type", "appointmentType"]).toLowerCase().replace(/[\s-]+/g, "_");
}

function getAppointmentStatus(record: ApiRecord) {
  return getString(record, ["status"]).toLowerCase().replace(/[\s-]+/g, "_");
}

function isPhysical(record: ApiRecord) {
  const type = getAppointmentType(record);
  return type.includes("physical") || type.includes("person");
}

function isTeleconsultation(record: ApiRecord) {
  return getAppointmentType(record).includes("tele");
}

function isPending(record: ApiRecord) {
  return getAppointmentStatus(record).includes("pending");
}

function isDateInRange(date: string, start: string, end: string) {
  return Boolean(date) && date >= start && date <= end;
}

function calculateTrend(current: number, previous: number): TrendValue {
  const percentage = previous === 0
    ? current === 0 ? 0 : 100
    : Math.round(((current - previous) / previous) * 100);
  return {
    change: `${percentage > 0 ? "+" : ""}${percentage}%`,
    tone: percentage < 0 ? "negative" : "positive",
  };
}

async function loadAllAppointmentPayloads() {
  const firstPayload = await getAppointments({ page: 1, limit: PAGE_LIMIT });
  const firstItems = getAppointmentItems(firstPayload);
  const total = getTotalCount(firstPayload, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  if (totalPages === 1) return [firstPayload];

  const remainingPayloads = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => getAppointments({ page: index + 2, limit: PAGE_LIMIT })),
  );
  return [firstPayload, ...remainingPayloads];
}

function calculateStats(payloads: unknown[]): { stats: AppointmentStatsValues; trends: AppointmentTrends } {
  const appointments = payloads.flatMap(getAppointmentItems);
  const today = getDateKeyForOffset(0);
  const yesterday = getDateKeyForOffset(-1);
  const currentStart = getDateKeyForOffset(-29);
  const previousStart = getDateKeyForOffset(-59);
  const previousEnd = getDateKeyForOffset(-30);

  const currentBookings = appointments.filter((item) => isDateInRange(getBookingDateKey(item), currentStart, today));
  const previousBookings = appointments.filter((item) => isDateInRange(getBookingDateKey(item), previousStart, previousEnd));
  const currentScheduled = appointments.filter((item) => isDateInRange(getScheduledDateKey(item), currentStart, today));
  const previousScheduled = appointments.filter((item) => isDateInRange(getScheduledDateKey(item), previousStart, previousEnd));
  const todaysAppointments = appointments.filter((item) => getScheduledDateKey(item) === today).length;
  const yesterdaysAppointments = appointments.filter((item) => getScheduledDateKey(item) === yesterday).length;

  return {
    stats: {
      totalBookings: getTotalCount(payloads[0], appointments.length),
      todaysAppointments,
      physicalVisits: appointments.filter(isPhysical).length,
      teleconsultations: appointments.filter(isTeleconsultation).length,
      pendingApproval: appointments.filter(isPending).length,
    },
    trends: {
      totalBookings: calculateTrend(currentBookings.length, previousBookings.length),
      todaysAppointments: calculateTrend(todaysAppointments, yesterdaysAppointments),
      physicalVisits: calculateTrend(currentScheduled.filter(isPhysical).length, previousScheduled.filter(isPhysical).length),
      teleconsultations: calculateTrend(currentScheduled.filter(isTeleconsultation).length, previousScheduled.filter(isTeleconsultation).length),
      pendingApproval: calculateTrend(currentScheduled.filter(isPending).length, previousScheduled.filter(isPending).length),
    },
  };
}

function StatValue({ isLoading, value }: { isLoading: boolean; value: number }) {
  if (isLoading) return <span className="mt-2 block h-8 w-12 animate-pulse rounded bg-[#EEF2F7]" />;
  return <p className="mt-2 text-xl font-bold leading-none text-[#0F172A] md:text-3xl">{value}</p>;
}

export default function AppointmentStats({ values, refreshKey = 0 }: AppointmentStatsProps) {
  const [stats, setStats] = useState<AppointmentStatsValues>(values ?? emptyStats);
  const [trends, setTrends] = useState<AppointmentTrends>(emptyTrends);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadStats = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true);
      setError("");
      try {
        const payloads = await loadAllAppointmentPayloads();
        if (!ignore) {
          const result = calculateStats(payloads);
          setStats(result.stats);
          setTrends(result.trends);
        }
      } catch (requestError) {
        if (!ignore) {
          setStats(values ?? emptyStats);
          setTrends(emptyTrends);
          setError(requestError instanceof Error ? requestError.message : "Failed to load appointment stats.");
        }
      } finally {
        if (!ignore && showLoading) setIsLoading(false);
      }
    };

    void loadStats(true);
    const interval = window.setInterval(() => void loadStats(false), POLL_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [refreshKey, values]);

  const cards = [
    { label: "Total Bookings", value: stats.totalBookings, trend: trends.totalBookings, icon: CalendarCheck, iconClassName: "bg-[#E7F2FF] text-[#1479E8]", comparison: "Bookings created in the latest 30 days compared with the previous 30 days" },
    { label: "Today's Appointments", value: stats.todaysAppointments, trend: trends.todaysAppointments, icon: CalendarCheck, iconClassName: "bg-[#E7F2FF] text-[#1479E8]", comparison: "Today compared with yesterday" },
    { label: "Physical Visit", value: stats.physicalVisits, trend: trends.physicalVisits, icon: Building2, iconClassName: "bg-[#E7F2FF] text-[#1479E8]", comparison: "Latest 30 scheduled days compared with the previous 30 days" },
    { label: "Teleconsultations", value: stats.teleconsultations, trend: trends.teleconsultations, icon: Video, iconClassName: "bg-[#E7F2FF] text-[#1479E8]", comparison: "Latest 30 scheduled days compared with the previous 30 days" },
    { label: "Pending Approval", value: stats.pendingApproval, trend: trends.pendingApproval, icon: Timer, iconClassName: "bg-[#FFF1D8] text-[#F59E0B]", comparison: "Latest 30 scheduled days compared with the previous 30 days" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map(({ label, value, trend, icon: Icon, iconClassName, comparison }) => (
        <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="flex items-center justify-between">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconClassName)}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span
              title={comparison}
              className={cn(
                "rounded px-2 py-1 text-xs font-bold",
                trend.tone === "positive" ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500",
              )}
            >
              {isLoading ? "..." : error ? "--" : trend.change}
            </span>
          </div>
          <p className="mt-6 text-sm font-medium text-[#71809B]">{label}</p>
          <StatValue isLoading={isLoading} value={value} />
        </div>
      ))}
    </div>
  );
}