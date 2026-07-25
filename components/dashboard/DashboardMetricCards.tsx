"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Megaphone, TrendingUp, Users } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import { getAlertsSnapshot } from "@/lib/api/alerts";
import { getCareEpisodes, type CareEpisodeRecord } from "@/lib/api/care-episodes";
import { getAppointments } from "@/lib/api/appointments";

type ApiRecord = Record<string, unknown>;
type Trend = { change: string; type: "positive" | "negative" };
type DashboardMetrics = {
  activeEpisodes: number;
  appointments: number;
  alerts: number;
  recovery: number;
  activeEpisodesTrend: Trend;
  appointmentsTrend: Trend;
  alertsTrend: Trend;
  recoveryTrend: Trend;
};

const POLL_INTERVAL_MS = 60_000;
const emptyTrend: Trend = { change: "0%", type: "positive" };
const emptyMetrics: DashboardMetrics = {
  activeEpisodes: 0,
  appointments: 0,
  alerts: 0,
  recovery: 0,
  activeEpisodesTrend: emptyTrend,
  appointmentsTrend: emptyTrend,
  alertsTrend: emptyTrend,
  recoveryTrend: emptyTrend,
};

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function getTotalCount(payload: unknown) {
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
  return 0;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyForOffset(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
}

function normalizeDateKey(value: string) {
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? formatDateKey(new Date(parsed)) : "";
}

function inRange(value: string, start: string, end: string) {
  const key = normalizeDateKey(value);
  return Boolean(key) && key >= start && key <= end;
}

function calculateTrend(current: number, previous: number): Trend {
  const percentage = previous === 0
    ? current === 0 ? 0 : 100
    : Math.round(((current - previous) / previous) * 100);
  return {
    change: `${percentage > 0 ? "+" : ""}${percentage}%`,
    type: percentage < 0 ? "negative" : "positive",
  };
}

function recoveryProgress(episode: CareEpisodeRecord) {
  if (!episode.dayStart || !episode.expectedDurationDays || episode.expectedDurationDays <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((episode.dayStart / episode.expectedDurationDays) * 100)));
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function buildMetrics(
  episodes: Awaited<ReturnType<typeof getCareEpisodes>>,
  todaysAppointments: number,
  yesterdaysAppointments: number,
  alerts: Awaited<ReturnType<typeof getAlertsSnapshot>>,
): DashboardMetrics {
  const today = dateKeyForOffset(0);
  const currentStart = dateKeyForOffset(-29);
  const previousStart = dateKeyForOffset(-59);
  const previousEnd = dateKeyForOffset(-30);
  const alertCurrentStart = dateKeyForOffset(-6);
  const alertPreviousStart = dateKeyForOffset(-13);
  const alertPreviousEnd = dateKeyForOffset(-7);
  const activeEpisodes = episodes.data.filter((episode) => episode.status.toLowerCase() === "active");
  const currentEpisodes = activeEpisodes.filter((episode) => inRange(episode.createdAt, currentStart, today));
  const previousEpisodes = activeEpisodes.filter((episode) => inRange(episode.createdAt, previousStart, previousEnd));
  const currentRecovery = currentEpisodes.map(recoveryProgress).filter((value): value is number => value !== null);
  const previousRecovery = previousEpisodes.map(recoveryProgress).filter((value): value is number => value !== null);
  const allRecovery = activeEpisodes.map(recoveryProgress).filter((value): value is number => value !== null);
  const currentAlerts = alerts.active.filter((alert) => inRange(alert.timestamp, alertCurrentStart, today)).length;
  const previousAlerts = alerts.active.filter((alert) => inRange(alert.timestamp, alertPreviousStart, alertPreviousEnd)).length;

  return {
    activeEpisodes: episodes.activeCount || activeEpisodes.length,
    appointments: todaysAppointments,
    alerts: alerts.active.length,
    recovery: average(allRecovery),
    activeEpisodesTrend: calculateTrend(currentEpisodes.length, previousEpisodes.length),
    appointmentsTrend: calculateTrend(todaysAppointments, yesterdaysAppointments),
    alertsTrend: calculateTrend(currentAlerts, previousAlerts),
    recoveryTrend: calculateTrend(average(currentRecovery), average(previousRecovery)),
  };
}

export default function DashboardMetricCards() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadMetrics = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true);
      setHasError(false);
      const today = dateKeyForOffset(0);
      const yesterday = dateKeyForOffset(-1);
      try {
        const [episodes, todayPayload, yesterdayPayload, alerts] = await Promise.all([
          getCareEpisodes({ page: 1, limit: 500 }),
          getAppointments({ dateFrom: today, dateTo: today, page: 1, limit: 1 }),
          getAppointments({ dateFrom: yesterday, dateTo: yesterday, page: 1, limit: 1 }),
          getAlertsSnapshot(),
        ]);
        if (!ignore) setMetrics(buildMetrics(episodes, getTotalCount(todayPayload), getTotalCount(yesterdayPayload), alerts));
      } catch {
        if (!ignore) {
          setMetrics(emptyMetrics);
          setHasError(true);
        }
      } finally {
        if (!ignore && showLoading) setIsLoading(false);
      }
    };

    void loadMetrics(true);
    const interval = window.setInterval(() => void loadMetrics(false), POLL_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, []);

  const change = (trend: Trend) => isLoading ? "..." : hasError ? "--" : trend.change;
  const value = (metric: number, suffix = "") => isLoading ? "..." : hasError ? "--" : `${metric}${suffix}`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      <MetricCard icon={Users} iconClassName="bg-secondary/30 text-primary" label="Active Care Episode" value={value(metrics.activeEpisodes)} change={change(metrics.activeEpisodesTrend)} changeType={metrics.activeEpisodesTrend.type} changeTitle="Active episodes created in the latest 30 days compared with the previous 30 days" />
      <MetricCard icon={CalendarCheck} iconClassName="bg-secondary/30 text-primary" label="Appointments" value={value(metrics.appointments)} change={change(metrics.appointmentsTrend)} changeType={metrics.appointmentsTrend.type} changeTitle="Today compared with yesterday" />
      <MetricCard icon={Megaphone} iconClassName="bg-red-50 text-red-500" label="Alerts" value={value(metrics.alerts)} change={change(metrics.alertsTrend)} changeType={metrics.alertsTrend.type} changeTitle="Latest 7 days compared with the previous 7 days" />
      <MetricCard icon={TrendingUp} iconClassName="bg-emerald-50 text-emerald-500" label="Avg Recovery %" value={value(metrics.recovery, "%")} change={change(metrics.recoveryTrend)} changeType={metrics.recoveryTrend.type} changeTitle="Average recovery progress for the latest 30-day episode cohort compared with the previous cohort" />
    </div>
  );
}