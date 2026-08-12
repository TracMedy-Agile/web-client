"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarDays,
  CalendarRange,
  Download,
  FileSearch,
  Loader2,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getReportsDateRange,
  getReportsSnapshot,
  type AlertPerformancePoint,
  type ClinicianWorkload,
  type ConsultationTrendPoint,
  type ReportsDateRange,
  type ReportsSnapshot,
  type WorkloadStatus,
} from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import ExportReportModal from "./ExportReportModal";

type Period = "7 days" | "30 days" | "Custom";

interface ReportsDashboardProps {
  empty?: boolean;
}

const statusStyles: Record<WorkloadStatus, string> = {
  Low: "bg-emerald-500",
  Moderate: "bg-amber-500",
  High: "bg-red-500",
};

function MetricCard({
  label,
  value,
  detail,
  trend,
  trendTone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: string;
  trendTone?: "positive" | "negative" | "neutral";
  icon: typeof AlarmClock;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/25 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <strong className="text-3xl leading-none text-foreground">{value}</strong>
        {trend ? (
          <span
            className={cn(
              "pb-0.5 text-xs font-medium",
              trendTone === "positive"
                ? "text-emerald-500"
                : trendTone === "negative"
                  ? "text-red-500"
                  : "text-muted-foreground",
            )}
          >
            {trend}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function AlertPerformanceChart({ points }: { points: AlertPerformancePoint[] }) {
  const maxHandled = Math.max(1, ...points.map((item) => item.handled));
  const maxResponse = Math.max(
    1,
    ...points.map((item) => item.responseMinutes ?? 0),
  );
  const x = (index: number) => points.length <= 1 ? 300 : index * (600 / (points.length - 1));
  const y = (minutes: number) => 205 - (minutes / maxResponse) * 175;
  const responsePoints = points
    .map((item, index) => item.responseMinutes === null ? null : `${x(index)},${y(item.responseMinutes)}`)
    .filter((point): point is string => Boolean(point))
    .join(" ");
  const labelIndexes = new Set(
    Array.from({ length: Math.min(5, points.length) }, (_, index) =>
      Math.round(index * ((points.length - 1) / Math.max(1, Math.min(5, points.length) - 1))),
    ),
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <TriangleAlert className="h-4 w-4 text-primary" />
            Alert Response Performance
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Acknowledged alert volume vs average clinician response time
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-primary/80" />Handled</span>
          <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-foreground" />Avg (min)</span>
        </div>
      </div>
      <div className="relative mt-5 h-64 border-b border-l border-border/80 pl-3">
        <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-border" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-border" />
        <div className="absolute inset-0 flex items-end gap-1 px-2">
          {points.map((item) => (
            <span
              key={item.key}
              title={`${item.label}: ${item.handled} handled`}
              className="min-w-1 flex-1 rounded-t bg-primary/75"
              style={{ height: `${(item.handled / maxHandled) * 88}%` }}
            />
          ))}
        </div>
        {responsePoints ? (
          <svg
            viewBox="0 0 600 220"
            preserveAspectRatio="none"
            aria-label="Average alert response time trend"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <polyline
              points={responsePoints}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="10 8"
              className="text-foreground"
            />
            {points.map((item, index) => item.responseMinutes === null ? null : (
              <circle
                key={item.key}
                cx={x(index)}
                cy={y(item.responseMinutes)}
                r="4"
                fill="white"
                stroke="currentColor"
                strokeWidth="3"
                className="text-foreground"
              />
            ))}
          </svg>
        ) : null}
      </div>
      <div className="mt-2 grid grid-flow-col justify-between px-2 text-[10px] text-muted-foreground">
        {points.map((point, index) => labelIndexes.has(index) ? <span key={point.key}>{point.label}</span> : null)}
      </div>
    </section>
  );
}

function ConsultationChart({
  points,
  range,
}: {
  points: ConsultationTrendPoint[];
  range: ReportsDateRange;
}) {
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [point.physical, point.teleconsultations]),
  );
  const x = (index: number) => points.length <= 1 ? 150 : 15 + index * (275 / (points.length - 1));
  const y = (value: number) => 145 - (value / maxValue) * 105;
  const physicalPoints = points.map((point, index) => `${x(index)},${y(point.physical)}`).join(" ");
  const teleconsultationPoints = points
    .map((point, index) => `${x(index)},${y(point.teleconsultations)}`)
    .join(" ");
  const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          Consultation Trends
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{range.dateFrom} – {range.dateTo}</p>
      </div>
      <svg
        viewBox="0 0 300 190"
        aria-label="Physical and teleconsultation trend chart"
        className="mt-8 h-48 w-full"
      >
        <path d="M15 40H290M15 75H290M15 110H290M15 145H290" stroke="currentColor" strokeWidth="1" className="text-border" />
        <polyline points={physicalPoints} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" />
        <polyline points={teleconsultationPoints} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" className="text-blue-500" />
        {points.map((point, index) => labelIndexes.has(index) ? (
          <text key={point.key} x={Math.min(265, Math.max(15, x(index) - 8))} y="175" className="fill-muted-foreground text-[10px]">
            {point.label}
          </text>
        ) : null)}
      </svg>
      <div className="flex justify-center gap-6 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2"><span className="h-px w-4 bg-primary" />Physical</span>
        <span className="flex items-center gap-2"><span className="w-4 border-t border-dashed border-blue-500" />Teleconsultations</span>
      </div>
    </section>
  );
}

function ClinicianWorkloadCards({ clinicians }: { clinicians: ClinicianWorkload[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/reports/clinician-workload"
            className="flex items-center gap-2 text-base font-semibold text-foreground hover:text-primary"
            onClick={() => capturePostHogEvent("clinician_workload_opened")}
          >
            <Users className="h-4 w-4 text-primary" />
            Clinician Workload
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Active episodes, open alerts, and average response per clinician
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          {(["Low", "Moderate", "High"] as const).map((status) => (
            <span
              key={status}
              className={cn(
                "flex items-center gap-1",
                status === "Low"
                  ? "text-emerald-600"
                  : status === "Moderate"
                    ? "text-amber-600"
                    : "text-red-600",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", statusStyles[status])} />{status}
            </span>
          ))}
        </div>
      </div>
      {clinicians.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clinicians.slice(0, 6).map((clinician) => (
            <Link
              key={clinician.id}
              href="/dashboard/reports/clinician-workload"
              className="rounded-xl border border-border p-4 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <h3 className="text-sm font-semibold text-foreground">{clinician.name}</h3>
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[10px]",
                    clinician.status === "Low"
                      ? "text-emerald-600"
                      : clinician.status === "Moderate"
                        ? "text-amber-600"
                        : "text-red-600",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", statusStyles[clinician.status])} />
                  {clinician.status === "High" ? "High load" : clinician.status}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div><dt className="text-[10px] uppercase text-muted-foreground">Episodes</dt><dd className="mt-1 text-sm font-semibold">{clinician.episodes}</dd></div>
                <div><dt className="text-[10px] uppercase text-muted-foreground">Alerts</dt><dd className="mt-1 text-sm font-semibold">{clinician.alerts}</dd></div>
                <div><dt className="text-[10px] uppercase text-muted-foreground">Avg</dt><dd className="mt-1 text-sm font-semibold">{clinician.responseTime}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-muted-foreground">No clinicians are available for this facility.</p>
      )}
    </section>
  );
}

function EmptyAnalytics({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section className="flex min-h-[600px] items-center justify-center rounded-xl bg-card p-8 text-center">
      <div>
        <div className="relative mx-auto flex h-52 w-48 items-center justify-center">
          <div className="absolute inset-x-4 inset-y-0 rounded-xl border border-border bg-card shadow-xl">
            <div className="space-y-3 p-5">
              <span className="block h-3 w-4/5 rounded-full bg-muted" />
              <span className="block h-2 w-3/5 rounded-full bg-muted/70" />
              <span className="block h-2 w-2/3 rounded-full bg-muted/70" />
              <span className="block h-2 w-1/2 rounded-full bg-muted/70" />
            </div>
          </div>
          <span className="absolute bottom-12 right-1 flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-primary/20 bg-card text-primary shadow-lg">
            <FileSearch className="h-9 w-9" />
          </span>
        </div>
        <h2 className="mt-7 text-2xl font-semibold text-foreground">No Performance Data To Display.</h2>
        <p className="mx-auto mt-5 max-w-sm text-base leading-6 text-muted-foreground">
          Detailed analytics will appear here once<br />clinical activities begin
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>
    </section>
  );
}

function appointmentTrend(snapshot: ReportsSnapshot | null) {
  if (!snapshot || snapshot.previousAppointmentCount === 0) return null;
  return Math.round(
    ((snapshot.appointmentCount - snapshot.previousAppointmentCount) /
      snapshot.previousAppointmentCount) *
      100,
  );
}

export default function ReportsDashboard({ empty = false }: ReportsDashboardProps) {
  const defaultCustomRange = useMemo(() => getReportsDateRange(30), []);
  const [period, setPeriod] = useState<Period>("30 days");
  const [customFrom, setCustomFrom] = useState(defaultCustomRange.dateFrom);
  const [customTo, setCustomTo] = useState(defaultCustomRange.dateTo);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(!empty);
  const [error, setError] = useState("");

  const range = useMemo<ReportsDateRange>(() => {
    if (period === "7 days") return getReportsDateRange(7);
    if (period === "Custom") return { dateFrom: customFrom, dateTo: customTo };
    return getReportsDateRange(30);
  }, [customFrom, customTo, period]);

  const loadReports = useCallback(async () => {
    if (empty) return;
    if (!range.dateFrom || !range.dateTo || range.dateFrom > range.dateTo) {
      setError("Choose a valid report date range.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      setSnapshot(await getReportsSnapshot(range));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
    } finally {
      setIsLoading(false);
    }
  }, [empty, range]);

  useEffect(() => {
    capturePostHogEvent(empty ? "reports_empty_state_viewed" : "reports_analytics_viewed");
  }, [empty]);

  useEffect(() => {
    if (empty) return;
    let active = true;

    if (!range.dateFrom || !range.dateTo || range.dateFrom > range.dateTo) {
      const timer = window.setTimeout(() => {
        if (!active) return;
        setError("Choose a valid report date range.");
        setIsLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    void getReportsSnapshot(range)
      .then((nextSnapshot) => {
        if (active) setSnapshot(nextSnapshot);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setSnapshot(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [empty, range]);

  function handleRefresh() {
    capturePostHogEvent("reports_refreshed", { source: "reports_dashboard" });
    void loadReports();
  }

  const alertDelta =
    snapshot?.averageAlertResponseMinutes !== null &&
    snapshot?.averageAlertResponseMinutes !== undefined &&
    snapshot.previousAverageAlertResponseMinutes !== null
      ? snapshot.averageAlertResponseMinutes - snapshot.previousAverageAlertResponseMinutes
      : null;
  const appointmentsDelta = appointmentTrend(snapshot);
  const showEmpty = empty || (!isLoading && Boolean(snapshot) && !snapshot?.hasClinicalData);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports &amp; Analytics</h1>
          <p className="text-sm text-muted-foreground">Clinician performance &amp; recovery outcomes</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-xl bg-primary/5 p-1 text-xs text-muted-foreground">
            {(["7 days", "30 days", "Custom"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setError("");
                  setPeriod(item);
                  capturePostHogEvent("reports_period_changed", { period: item });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 transition",
                  period === item ? "bg-card font-medium text-foreground shadow-sm" : "hover:text-foreground",
                )}
              >
                {item === "Custom" ? <CalendarRange className="h-3.5 w-3.5" /> : null}
                {item}
              </button>
            ))}
          </div>

            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              disabled={!snapshot}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

        </div>
      </div>

      {period === "Custom" ? (
        <div className="flex flex-wrap items-end justify-end gap-3 rounded-xl border border-border bg-card p-3">
          <label className="text-xs text-muted-foreground">
            <span className="mb-1 block">From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(event) => {
                setIsLoading(true);
                setError("");
                setCustomFrom(event.target.value);
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            <span className="mb-1 block">To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={getReportsDateRange(1).dateTo}
              onChange={(event) => {
                setIsLoading(true);
                setError("");
                setCustomTo(event.target.value);
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={handleRefresh} className="font-semibold underline underline-offset-2">Retry</button>
        </div>
      ) : null}
      {snapshot?.warnings.length ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Some report data could not be loaded: {snapshot.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Avg Alert Response Time"
          value={
            empty
              ? "0"
              : isLoading
                ? "—"
                : snapshot?.averageAlertResponseMinutes === null
                  ? "—"
                  : `${snapshot?.averageAlertResponseMinutes ?? 0} min`
          }
          detail="vs previous period"
          trend={alertDelta === null ? undefined : `${alertDelta > 0 ? "+" : ""}${alertDelta} min`}
          trendTone={alertDelta === null || alertDelta === 0 ? "neutral" : alertDelta < 0 ? "positive" : "negative"}
          icon={AlarmClock}
        />
        <MetricCard
          label="Appointments"
          value={empty ? "0" : isLoading ? "—" : String(snapshot?.appointmentCount ?? 0)}
          detail="vs previous period"
          trend={appointmentsDelta === null ? undefined : `${appointmentsDelta > 0 ? "+" : ""}${appointmentsDelta}%`}
          trendTone={appointmentsDelta === null || appointmentsDelta === 0 ? "neutral" : appointmentsDelta > 0 ? "positive" : "negative"}
          icon={CalendarDays}
        />
        <MetricCard
          label="Active Clinicians"
          value={empty ? "0" : isLoading ? "—" : String(snapshot?.activeClinicianCount ?? 0)}
          detail={snapshot ? snapshot.facility.name : "Authenticated facility"}
          icon={Users}
        />
      </div>

      {isLoading ? (
        <section className="flex min-h-[520px] items-center justify-center rounded-xl bg-card">
          <div className="text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-primary" />
            Loading facility analytics…
          </div>
        </section>
      ) : showEmpty ? (
        <EmptyAnalytics onRefresh={handleRefresh} refreshing={isLoading} />
      ) : snapshot ? (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <AlertPerformanceChart points={snapshot.alertPerformance} />
            <ConsultationChart points={snapshot.consultationTrend} range={snapshot.range} />
          </div>

            <ClinicianWorkloadCards clinicians={snapshot.clinicians} />

        </>
      ) : null}
      <ExportReportModal
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        defaultPeriod={period}
        snapshot={snapshot}
      />
    </div>
  );
}
