"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,

  FolderOpen,
  History,
  Search,
} from "lucide-react";
import {
  getAlertReviewImpact,
  getAlertsSnapshot,
  type AlertReviewImpact,
  type AlertSeverity,
  type AlertsSnapshot,
  type ClinicalAlert,
} from "@/lib/api/alerts";
import {
  ReviewImpactModal,
  type ReviewImpactData,
} from "@/app/dashboard/care-episodes/[id]/components/ReviewImpactModal";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

const EMPTY_SNAPSHOT: AlertsSnapshot = { active: [], history: [] };
const ALERT_TAB_LABELS = { all: "All Alert", critical: "Critical", moderate: "Moderate", low: "Low" } as const;

const severityStyles: Record<AlertSeverity, string> = {
  critical: "bg-red-50 text-red-700 ring-red-200",
  moderate: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  const difference = Date.now() - date.getTime();
  if (difference >= 0 && difference < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(difference / 60_000));
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  if (difference >= 0 && difference < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(difference / 3_600_000));
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isWithinRange(value: string, range: string) {
  if (range === "all") return true;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const days = Number(range);
  return timestamp >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function downloadCsv(alerts: ClinicalAlert[], filename: string) {
  const rows = [
    ["Patient", "Patient ID", "Alert reason", "Trigger source", "Severity", "Clinician", "Timestamp"],
    ...alerts.map((alert) => [
      alert.patientName,
      alert.patientId,
      alert.reason,
      alert.triggerSource,
      alert.severity,
      alert.status === "resolved" ? alert.acknowledgedBy : alert.assignedClinician,
      alert.timestamp,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`inline-flex min-w-[90px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${severityStyles[severity]}`}>
      {severity === "low" ? "Low Risk" : severity}
    </span>
  );
}

function getReviewImpactData(alert: ClinicalAlert, impact: AlertReviewImpact | null): ReviewImpactData {
  const severity = alert.severity.toUpperCase();
  return {
    title: `${alert.triggerSource} - ${alert.reason}`,
    subtitle: "Reviewing 72-hour clinical trajectory",
    expectedLabel: impact?.expectedLabel ?? "Alert trigger",
    expected: impact?.expected ?? alert.triggerSource,
    actualLabel: impact?.actualLabel ?? "Current risk score",
    actual: impact?.actual ?? (alert.riskScore === null ? "Not recorded" : `${Math.round(alert.riskScore)}/100`),
    trend: impact?.trend ?? alert.riskTrend ?? "No trend supplied",
    analysisSummary: impact?.analysisSummary,
    generatedAt: impact?.generatedAt,
    source: impact?.analysisSource,
    suggestedReview: impact?.suggestedReview,
    evidence: impact?.evidence ?? [
      { label: "Patient reference", value: alert.patientCode, status: "RECORDED" },
      { label: "Risk category", value: alert.riskCategory || alert.severity, status: severity },
      { label: "Alert severity", value: alert.severity, status: severity },
      { label: "Assigned clinician", value: alert.assignedClinician, status: "LINKED" },
    ],
  };
}

function EmptyAlerts({ history, onReload }: { history: boolean; onReload: () => void }) {
  if (history) {
    return (
      <section className="flex min-h-[646px] flex-col items-center justify-center rounded-xl bg-card px-6 py-16 text-center shadow-sm">
        <span className="flex h-48 w-48 items-center justify-center rounded-full bg-primary/5">
          <span className="flex h-40 w-40 items-center justify-center rounded-full bg-primary/5 text-blue-500">
            <FolderOpen className="h-16 w-16" strokeWidth={1.8} />
          </span>
        </span>
        <h2 className="mt-7 text-2xl font-bold text-foreground">No Resolved Alerts Yet.</h2>
        <p className="mt-3 max-w-sm text-base leading-6 text-muted-foreground">
          Acknowledged alerts and clinical events will appear here for audit and review.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-[606px] w-full max-w-[672px] flex-col items-center justify-center rounded-xl bg-card px-6 py-16 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <span className="relative flex h-32 w-32 items-center justify-center rounded-full bg-primary/5">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-card text-blue-600 shadow-lg">
          <CheckCircle2 className="h-11 w-11" strokeWidth={1.8} />
        </span>
        <span className="absolute right-4 top-5 h-3 w-3 rounded-full bg-emerald-400" />
        <span className="absolute bottom-5 left-3 h-2 w-2 rounded-full bg-blue-400" />
      </span>
      <h2 className="mt-10 text-2xl font-bold text-foreground">No Active Alerts To Resolve</h2>
      <p className="mt-3 max-w-xl text-base leading-6 text-muted-foreground">
        New notifications will appear here automatically based on patient monitoring data
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={onReload}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          Reload Page
        </button>
        <Link
          href="/dashboard/alerts?view=history"
          className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold text-muted-foreground hover:bg-muted"
        >
          <History className="h-4 w-4" />
          View History
        </Link>
      </div>
    </section>
  );
}

type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, "ellipsis-end", totalPages];
  if (currentPage >= totalPages - 2) return [1, "ellipsis-start", totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis-start", currentPage, "ellipsis-end", totalPages];
}

function PaginationControls({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground disabled:opacity-35"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {getPaginationItems(currentPage, totalPages).map((item) => typeof item === "number" ? (
        <button
          key={item}
          type="button"
          aria-label={`Go to page ${item}`}
          aria-current={currentPage === item ? "page" : undefined}
          onClick={() => onChange(item)}
          className={currentPage === item
            ? "flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary px-2 text-sm font-bold text-primary-foreground"
            : "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium text-foreground hover:bg-muted"}
        >
          {item}
        </button>
      ) : (
        <span key={item} className="px-1 text-sm text-muted-foreground">...</span>
      ))}
      <button
        type="button"
        aria-label="Next page"
        onClick={() => onChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary text-primary disabled:border-border disabled:text-muted-foreground disabled:opacity-35"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
export default function AlertsScreen() {
  const searchParams = useSearchParams();
  const isHistory = searchParams.get("view") === "history";
  const [snapshot, setSnapshot] = useState<AlertsSnapshot>(EMPTY_SNAPSHOT);
  const [severity, setSeverity] = useState<"all" | AlertSeverity>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [source, setSource] = useState("all");
  const [clinician, setClinician] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewAlert, setReviewAlert] = useState<ClinicalAlert | null>(null);
  const [reviewImpact, setReviewImpact] = useState<AlertReviewImpact | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const reviewRequestId = useRef(0);

  useEffect(() => {
    capturePostHogEvent(isHistory ? "alerts_history_viewed" : "alerts_viewed");
  }, [isHistory]);

  useEffect(() => {
    let ignore = false;
    getAlertsSnapshot()
      .then((data) => {
        if (!ignore) setSnapshot(data);
      })
      .catch((requestError: unknown) => {
        if (!ignore) setError(requestError instanceof Error ? requestError.message : "Unable to load alerts.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const sourceAlerts = isHistory ? snapshot.history : snapshot.active;
  const pageSize = isHistory ? 6 : 7;
  const clinicians = useMemo(
    () =>
      Array.from(
        new Set(
          sourceAlerts.map((alert) =>
            alert.status === "resolved"
              ? alert.acknowledgedBy
              : alert.assignedClinician,
          ),
        ).values(),
      )
        .filter((name) => name && name !== "\u2014" && name !== "Not recorded")
        .sort(),
    [sourceAlerts],
  );
  const sources = useMemo(
    () =>
      Array.from(
        new Set(sourceAlerts.map((alert) => alert.triggerSource)),
      ).sort(),
    [sourceAlerts],
  );
  const counts = useMemo(
    () => ({
      all: snapshot.active.length,
      critical: snapshot.active.filter(
        (alert) => alert.severity === "critical",
      ).length,
      moderate: snapshot.active.filter(
        (alert) => alert.severity === "moderate",
      ).length,
      low: snapshot.active.filter((alert) => alert.severity === "low").length,
    }),
    [snapshot.active],
  );

  const filteredAlerts = useMemo(
    () =>
      sourceAlerts.filter((alert) => {
        const alertClinician =
          alert.status === "resolved"
            ? alert.acknowledgedBy
            : alert.assignedClinician;
        return (
          (!searchQuery.trim() || [alert.patientName, alert.patientCode, alert.reason].some((value) => value.toLowerCase().includes(searchQuery.trim().toLowerCase()))) &&
          (severity === "all" || alert.severity === severity) &&
          (source === "all" || alert.triggerSource === source) &&
          (clinician === "all" || alertClinician === clinician) &&
          isWithinRange(alert.timestamp, dateRange)
        );
      }),
    [clinician, dateRange, searchQuery, severity, source, sourceAlerts],
  );

  const totalPages = Math.max(
    Math.ceil(filteredAlerts.length / pageSize),
    1,
  );
  const currentPage = Math.min(page, totalPages);
  const visibleAlerts = filteredAlerts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const reload = () => {
    capturePostHogEvent("alerts_reloaded", {
      view: isHistory ? "history" : "active",
    });
    setIsLoading(true);
    setError("");
    setRefreshKey((key) => key + 1);
  };

  const resetFilters = () => {
    setSeverity("all");
    setSearchQuery("");
    setDateRange("30");
    setSource("all");
    setClinician("all");
    setPage(1);
  };

  const openReview = (alert: ClinicalAlert) => {
    capturePostHogEvent("alert_review_opened", {
      alert_id: alert.id,
      episode_id: alert.episodeId,
      severity: alert.severity,
    });
    const requestId = reviewRequestId.current + 1;
    reviewRequestId.current = requestId;
    setReviewAlert(alert);
    setReviewImpact(null);
    setIsReviewLoading(true);
    void getAlertReviewImpact(alert)
      .then((impact) => {
        if (reviewRequestId.current === requestId) setReviewImpact(impact);
      })
      .finally(() => {
        if (reviewRequestId.current === requestId) setIsReviewLoading(false);
      });
  };

  const exportAlerts = () => {
    downloadCsv(
      filteredAlerts,
      isHistory ? "alert-history.csv" : "active-alerts.csv",
    );
    capturePostHogEvent("alerts_exported", {
      view: isHistory ? "history" : "active",
      row_count: filteredAlerts.length,
      severity,
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isHistory ? (
            <Link
              href="/dashboard/alerts"
              aria-label="Back to active alerts"
              className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}
          <h1 className="text-2xl font-bold text-foreground">
            {isHistory ? "Alerts History Log" : "Alerts Management"}
          </h1>
          {!isHistory ? (
            <p className="mt-1 text-base text-muted-foreground">Monitor and respond to patients alerts in real time</p>
          ) : null}
        </div>
        {isHistory || isLoading || sourceAlerts.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {!isHistory ? (
              <Link
                href="/dashboard/alerts?view=history"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary bg-card px-4 text-sm font-bold text-primary hover:bg-primary/5"
              >
                History Log
              </Link>
            ) : null}
            <button
              type="button"
              onClick={exportAlerts}
              disabled={isLoading || (!isHistory && filteredAlerts.length === 0)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <span>{error}</span>
          <button type="button" onClick={reload} className="font-semibold underline">Try again</button>
        </div>
      ) : null}

      {isHistory ? (
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              label: "Total Resolved",
              value: String(snapshot.history.length),
              icon: <CheckCircle2 className="h-6 w-6" />,
              iconClassName: "bg-emerald-50 text-emerald-500",
              available: true,
            },
            {
              label: "Avg. Response Time",
              value: snapshot.history.length === 0 ? "0" : "--",
              icon: <Clock3 className="h-6 w-6" />,
              iconClassName: "bg-blue-50 text-blue-500",
              available: snapshot.history.length === 0,
            },
            {
              label: "Compliance Rate",
              value: snapshot.history.length === 0 ? "0%" : "--",
              icon: <ClipboardCheck className="h-6 w-6" />,
              iconClassName: "bg-violet-50 text-violet-500",
              available: snapshot.history.length === 0,
            },
          ].map((metric) => (
            <article
              key={metric.label}
              title={metric.available ? undefined : "Not provided by the current API"}
              className="flex min-h-[102px] items-center gap-4 rounded-xl border border-border bg-card px-6 py-5 shadow-sm"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${metric.iconClassName}`}>
                {metric.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{metric.value}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {error ? null : isLoading ? (
        <div className="h-[520px] animate-pulse rounded-xl bg-muted" />
      ) : isHistory && sourceAlerts.length === 0 ? (
        <EmptyAlerts history onReload={reload} />
      ) : !isHistory && sourceAlerts.length === 0 ? (
        <div className="pt-20">
          <EmptyAlerts history={false} onReload={reload} />
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl bg-card shadow-sm">
          {isHistory ? (
            <div className="p-4 pb-0">
              <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border px-4 py-4 xl:flex-nowrap">
                <label className="relative block min-w-[240px] flex-1 self-end xl:max-w-[300px]">
                  <span className="sr-only">Search alert history</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }}
                    placeholder="Search by name, email, or ID..."
                    className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </label>
                <label className="block sm:border-l sm:border-border sm:pl-4">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Date Range</span>
                  <span className="relative block">
                    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1); }} className="h-10 min-w-36 appearance-none rounded-lg border border-border bg-card px-3 pr-9 text-sm text-muted-foreground">
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="all">All time</option>
                    </select>
                  </span>
                </label>
                <label className="block sm:border-l sm:border-border sm:pl-4">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Severity</span>
                  <select value={severity} onChange={(event) => { setSeverity(event.target.value as "all" | AlertSeverity); setPage(1); }} className="h-10 min-w-32 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground">
                    <option value="all">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="moderate">Moderate</option>
                    <option value="low">Low Risk</option>
                  </select>
                </label>
                <label className="block sm:border-l sm:border-border sm:pl-4">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Trigger Source</span>
                  <select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }} className="h-10 min-w-36 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground">
                    <option value="all">All Sources</option>
                    {sources.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block sm:border-l sm:border-border sm:pl-4">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Clinician</span>
                  <select value={clinician} onChange={(event) => { setClinician(event.target.value); setPage(1); }} className="h-10 min-w-36 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground">
                    <option value="all">All Clinician</option>
                    {clinicians.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <button type="button" onClick={resetFilters} className="ml-auto h-10 shrink-0 px-1 text-sm font-semibold text-primary hover:text-primary/80">
                  Clear all filters
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-24 flex-col gap-4 border-b border-border px-4 pt-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap border-b border-border">
                {(["all", "critical", "moderate", "low"] as const).map((item) => {
                  const dotClass = item === "all" ? "bg-primary" : item === "critical" ? "bg-red-500" : item === "moderate" ? "bg-orange-400" : "bg-emerald-400";
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setSeverity(item); setPage(1); }}
                      className={`relative flex h-12 min-w-fit flex-1 items-center justify-center gap-2 px-3 text-sm font-semibold xl:px-5 ${severity === item ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                      {ALERT_TAB_LABELS[item]}
                      <span className="rounded bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{String(counts[item]).padStart(2, "0")}</span>
                      {severity === item ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" /> : null}
                    </button>
                  );
                })}
              </div>
              <label className="relative shrink-0 pb-4 lg:pl-6">
                <span className="sr-only">Date range</span>
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-[calc(50%+0.5rem)] text-muted-foreground" />
                <select value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1); }} className="h-10 min-w-40 appearance-none rounded-lg border border-border bg-card px-3 pr-9 text-sm text-muted-foreground">
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">Date Range</option>
                </select>
              </label>
            </div>
          )}

          <div className={isHistory ? "mt-4 overflow-x-auto px-4" : "overflow-x-auto"}>
            <table className="w-full min-w-[860px] table-fixed text-left text-sm">
              {isHistory ? (
                <colgroup>
                  <col className="w-[17%]" />
                  <col className="w-[32%]" />
                  <col className="w-[12%]" />
                  <col className="w-[20%]" />
                  <col className="w-[19%]" />
                </colgroup>
              ) : null}
              <thead className="border-y border-border bg-primary/5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Patient Name</th>
                  <th className="px-6 py-4">Alert Reason</th>
                  {!isHistory ? <th className="px-6 py-4">Trigger Source</th> : null}
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">{isHistory ? "Acknowledged By" : "Assigned Clinician"}</th>
                  <th className="px-6 py-4">Time Stamp</th>
                  {!isHistory ? <th className="px-6 py-4 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody className={isHistory ? "" : "divide-y divide-border"}>
                {visibleAlerts.length === 0 ? (
                  <tr><td colSpan={isHistory ? 5 : 7} className="px-6 py-16 text-center text-sm font-medium text-muted-foreground">No alerts match the selected filters.</td></tr>
                ) : null}
                {visibleAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3.5"><span className="block font-semibold text-foreground">{alert.patientName}</span><span className="mt-1 block text-xs text-muted-foreground">{alert.patientCode}</span></td>
                    <td className="max-w-80 px-6 py-3.5 font-medium text-foreground">{alert.reason}</td>
                    {!isHistory ? <td className="px-6 py-3.5 text-muted-foreground">{alert.triggerSource}</td> : null}
                    <td className="px-6 py-3.5"><SeverityBadge severity={alert.severity} /></td>
                    <td className="px-6 py-3.5 text-muted-foreground">{isHistory ? alert.acknowledgedBy : alert.assignedClinician}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{formatTimestamp(alert.timestamp)}</td>
                    {!isHistory ? (
                      <td className="px-6 py-3.5 text-right">
                        <button type="button" onClick={() => openReview(alert)} className="font-semibold text-primary hover:underline">Review</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className={isHistory ? "mx-4 flex flex-col gap-3 border-t border-border py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between" : "flex flex-col gap-3 border-t border-border px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"}>
            <span>Showing {filteredAlerts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredAlerts.length)} of {filteredAlerts.length} Alerts</span>
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onChange={setPage} />
          </footer>
        </section>
      )}
      <ReviewImpactModal
        open={Boolean(reviewAlert)}
        alert={reviewAlert ? getReviewImpactData(reviewAlert, reviewImpact) : null}
        onOpenChange={(open) => {
          if (!open) {
            reviewRequestId.current += 1;
            setReviewAlert(null);
            setReviewImpact(null);
            setIsReviewLoading(false);
          }
        }}
        onAcknowledge={() => undefined}
        careEpisodeHref={reviewAlert ? `/dashboard/care-episodes/${reviewAlert.episodeId}/recovery` : undefined}
        isLoading={isReviewLoading}
      />
    </div>
  );
}
