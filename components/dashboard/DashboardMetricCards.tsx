"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, HeartPulse, ShieldAlert, TrendingUp, Users } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import { getAlertsSnapshot } from "@/lib/api/alerts";
import { getCareEpisodes, type CareEpisodeRecord } from "@/lib/api/care-episodes";
import { getFacilityForecastSummary } from "@/lib/api/dashboard";
import { getReportsDateRange, getReportsSnapshot } from "@/lib/api/reports";

type Trend = { change: string; type: "positive" | "negative" };
type DashboardMetrics = {
  activePatients: number;
  highRiskToday: number;
  criticalAlerts: number;
  recovery: number;
  readmissionRate: number | null;
  activePatientsTrend: Trend;
  highRiskTrend: Trend;
  criticalAlertsTrend: Trend;
  recoveryTrend: Trend;
  readmissionTrend: Trend | null;
};

const POLL_INTERVAL_MS = 60_000;
const emptyTrend: Trend = { change: "0%", type: "positive" };
const emptyMetrics: DashboardMetrics = {
  activePatients: 0,
  highRiskToday: 0,
  criticalAlerts: 0,
  recovery: 0,
  readmissionRate: null,
  activePatientsTrend: emptyTrend,
  highRiskTrend: emptyTrend,
  criticalAlertsTrend: emptyTrend,
  recoveryTrend: emptyTrend,
  readmissionTrend: null,
};

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

function calculateInverseTrend(changePercent: number | null): Trend | null {
  if (changePercent === null) return null;
  const rounded = Math.round(changePercent);
  return {
    change: `${rounded > 0 ? "+" : ""}${rounded}%`,
    type: rounded > 0 ? "negative" : "positive",
  };
}

function recoveryProgress(episode: CareEpisodeRecord) {
  if (!episode.dayStart || !episode.expectedDurationDays || episode.expectedDurationDays <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((episode.dayStart / episode.expectedDurationDays) * 100)));
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function isHighRiskEpisode(episode: CareEpisodeRecord) {
  const risk = episode.riskCategory?.toLowerCase() ?? "";
  return risk === "high" || risk === "critical" || (episode.riskScore !== null && episode.riskScore >= 70);
}

function buildMetrics(
  episodes: Awaited<ReturnType<typeof getCareEpisodes>>,
  alerts: Awaited<ReturnType<typeof getAlertsSnapshot>>,
  report: Awaited<ReturnType<typeof getReportsSnapshot>> | null,
  forecast: Awaited<ReturnType<typeof getFacilityForecastSummary>> | null,
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
  const currentHighRisk = currentEpisodes.filter(isHighRiskEpisode).length;
  const previousHighRisk = previousEpisodes.filter(isHighRiskEpisode).length;
  const currentRecovery = currentEpisodes.map(recoveryProgress).filter((value): value is number => value !== null);
  const previousRecovery = previousEpisodes.map(recoveryProgress).filter((value): value is number => value !== null);
  const allRecovery = activeEpisodes.map(recoveryProgress).filter((value): value is number => value !== null);
  const criticalAlerts = alerts.active.filter((alert) => alert.severity === "critical");
  const currentCriticalAlerts = criticalAlerts.filter((alert) => inRange(alert.timestamp, alertCurrentStart, today)).length;
  const previousCriticalAlerts = criticalAlerts.filter((alert) => inRange(alert.timestamp, alertPreviousStart, alertPreviousEnd)).length;

  return {
    activePatients: forecast?.activeEpisodeCount ?? (episodes.activeCount || activeEpisodes.length),
    highRiskToday: forecast?.atRiskCount ?? (episodes.highRiskCount || activeEpisodes.filter(isHighRiskEpisode).length),
    criticalAlerts: criticalAlerts.length,
    recovery: forecast?.avgRecoveryPercentage ?? average(allRecovery),
    readmissionRate: report?.readmissionRatePercent ?? null,
    activePatientsTrend: calculateTrend(currentEpisodes.length, previousEpisodes.length),
    highRiskTrend: calculateTrend(currentHighRisk, previousHighRisk),
    criticalAlertsTrend: calculateTrend(currentCriticalAlerts, previousCriticalAlerts),
    recoveryTrend: calculateTrend(average(currentRecovery), average(previousRecovery)),
    readmissionTrend: calculateInverseTrend(report?.readmissionRateChangePercent ?? null),
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
      try {
        const [episodes, alerts, report, forecast] = await Promise.all([
          getCareEpisodes({ page: 1, limit: 500 }),
          getAlertsSnapshot(),
          getReportsSnapshot(getReportsDateRange(30)).catch(() => null),
          getFacilityForecastSummary().catch(() => null),
        ]);
        if (!ignore) setMetrics(buildMetrics(episodes, alerts, report, forecast));
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

  const change = (trend: Trend | null) => hasError ? "--" : trend?.change;
  const value = (metric: number | null, suffix = "") => {
    if (hasError || metric === null) return "--";
    return `${metric}${suffix}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard isLoading={isLoading} icon={Users} iconClassName="bg-secondary/30 text-primary" label="Active Patients" value={value(metrics.activePatients)} change={change(metrics.activePatientsTrend)} changeType={metrics.activePatientsTrend.type} changeTitle="Active patient episodes created in the latest 30 days compared with the previous 30 days" description="Currently monitored" />
      <MetricCard isLoading={isLoading} icon={ShieldAlert} iconClassName="bg-amber-50 text-amber-600" label="High Risk Today" value={value(metrics.highRiskToday)} change={change(metrics.highRiskTrend)} changeType={metrics.highRiskTrend.type} changeTitle="High and critical risk episode movement across the latest 30-day cohort" description="Needs close follow-up" />
      <MetricCard isLoading={isLoading} icon={AlertTriangle} iconClassName="bg-red-50 text-red-500" label="Critical Alerts" value={value(metrics.criticalAlerts)} change={change(metrics.criticalAlertsTrend)} changeType={metrics.criticalAlertsTrend.type} changeTitle="Critical alert movement in the latest 7 days compared with the previous 7 days" description="Open clinical alerts" />
      <MetricCard isLoading={isLoading} icon={TrendingUp} iconClassName="bg-emerald-50 text-emerald-600" label="Avg Recovery %" value={value(metrics.recovery, "%")} change={change(metrics.recoveryTrend)} changeType={metrics.recoveryTrend.type} changeTitle="Average recovery progress for the latest 30-day episode cohort compared with the previous cohort" description="Across active episodes" />
      <MetricCard isLoading={isLoading} icon={HeartPulse} iconClassName="bg-sky-50 text-primary" label="Readmission Rate" value={value(metrics.readmissionRate, "%")} change={change(metrics.readmissionTrend)} changeType={metrics.readmissionTrend?.type ?? "positive"} changeTitle="Lower readmission movement is positive" description="Last 30 days" />
    </div>
  );
}