"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,

  FolderOpen,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddPatientModal } from "./components/AddPatientModal";
import { PatientReviewModal } from "./components/PatientReviewModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getCareEpisodes,
  getHospitalFacilityId,
  type CareEpisodeRecord,
} from "@/lib/api/care-episodes";
import { getClinicianDirectory, type ClinicianSearchResult } from "@/lib/api/clinicians";
import { getConnectedPatients, type ConnectedPatientRecord } from "@/lib/api/connected-patients";

type TabKey = "active" | "pending" | "closed";

type Counts = {
  activeCount: number;
  pendingCount: number;
  closedCount: number;
  highRiskCount: number;
};

const DEFAULT_COUNTS: Counts = { activeCount: 0, pendingCount: 0, closedCount: 0, highRiskCount: 0 };
const PAGE_LIMIT = 5;

const TABS: { key: TabKey; label: string; dotClassName: string; borderClassName: string; countKey: keyof Counts }[] = [
  { key: "active", label: "Active Episodes", dotClassName: "bg-primary", borderClassName: "border-primary", countKey: "activeCount" },
  { key: "pending", label: "Pending Review", dotClassName: "bg-red-500", borderClassName: "border-red-500", countKey: "pendingCount" },
  { key: "closed", label: "Closed Episode", dotClassName: "bg-emerald-500", borderClassName: "border-emerald-500", countKey: "closedCount" },
];

const EMPTY_STATE_COPY: Record<TabKey, { title: string; description: string }> = {
  active: {
    title: "No Active Care Episodes.",
    description:
      "Episodes will appear automatically once patients register and begin logging data on the Tracmedy mobile app. Their clinical profiles will appear here in real time.",
  },
  pending: {
    title: "No Episodes Pending Review.",
    description: "Great job! You are all caught up. New reviews will be generated based on clinical thresholds.",
  },
  closed: {
    title: "No Closed Episodes Found.",
    description:
      "Once an episode is marked as complete, it will be automatically logged here for long-term storage and audit tracking.",
  },
};

function formatDate(value?: string | null) {
  if (!value) return "--";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "--";
  const date = new Date(parsed);
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${date.getDate()} ${month}, ${date.getFullYear()}`;
}

function getEpisodeDuration(createdAt: string, closedAt: string | null | undefined, fallback: number | null) {
  const created = Date.parse(createdAt);
  const closed = closedAt ? Date.parse(closedAt) : Number.NaN;
  if (Number.isFinite(created) && Number.isFinite(closed)) {
    return Math.max(1, Math.ceil((closed - created) / 86_400_000));
  }
  return fallback ?? 0;
}

// CareEpisodeSummaryDto only exposes patientId/clinicianId — names are resolved from a
// facility-wide directory fetched separately (see patientDirectory/clinicianDirectory state).
function getClinicianLabel(directory: Record<string, ClinicianSearchResult>, clinicianId: string | null) {
  if (!clinicianId) return "--";
  const clinician = directory[clinicianId];
  if (!clinician) return clinicianId;
  const prefix = clinician.name.startsWith("Dr.") ? "" : "Dr. ";
  const displayName = `${prefix}${clinician.name}`;
  return clinician.department ? `${displayName} - ${clinician.department}` : displayName;
}

function getPatientName(directory: Record<string, ConnectedPatientRecord>, patientId: string) {
  return directory[patientId]?.name || "--";
}

function getPatientTracmedyCode(directory: Record<string, ConnectedPatientRecord>, patientId: string) {
  const tracmedyPatientId = directory[patientId]?.tracmedyPatientId;
  return tracmedyPatientId ? `#PT-${tracmedyPatientId}` : "--";
}

function getCarePhaseBadge(carePhase: string | null) {
  const value = (carePhase ?? "").toLowerCase();
  if (value === "alert") return { label: "Alert", className: "bg-red-50 text-red-500" };
  if (value.startsWith("monitor")) return { label: "Monitoring", className: "bg-amber-50 text-amber-500" };
  if (value === "stable") return { label: "Stable", className: "bg-emerald-50 text-emerald-500" };
  return { label: "Stable", className: "bg-emerald-50 text-emerald-500" };
}

function getRiskBadge(riskCategory: string | null) {
  if (!riskCategory) return { label: "Unrated", className: "bg-slate-100 text-slate-500" };
  const value = riskCategory.toLowerCase();
  if (value === "high") return { label: "High Risk", className: "bg-red-50 text-red-500" };
  if (value === "medium") return { label: "Moderate", className: "bg-amber-50 text-amber-500" };
  if (value === "low") return { label: "Low Risk", className: "bg-emerald-50 text-emerald-500" };
  return { label: "Unrated", className: "bg-slate-100 text-slate-500" };
}

function getRecommendation(riskCategory: string | null) {
  const value = (riskCategory ?? "").toLowerCase();
  if (value === "high") return "Immediate attention required";
  if (value === "medium") return "Monitor closely";
  if (value === "low") return "Routine care sufficient";
  return "Needs follow-up";
}

function getClosureInfo(closureReason: string | null) {
  const value = (closureReason ?? "").toLowerCase();
  const isNegative = ["lost", "drop", "abandon", "deceas", "fail", "transfer"].some((keyword) => value.includes(keyword));
  return isNegative
    ? { label: "Lost to Follow-up", dotClassName: "bg-red-500", textClassName: "text-red-500" }
    : { label: "Recovery Completed", dotClassName: "bg-emerald-500", textClassName: "text-emerald-500" };
}

function getProgressPercent(dayStart: number | null, expectedDurationDays: number | null) {
  if (!dayStart || !expectedDurationDays) return 0;
  return Math.min(100, Math.max(0, Math.round((dayStart / expectedDurationDays) * 100)));
}

function getPaginationItems(current: number, total: number) {
  if (total <= 5) return Array.from({ length: Math.max(total, 1) }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "... ", total];
}

function StatCard({
  label,
  value,
  note,
  noteClassName,
  isLoading,
}: {
  label: string;
  value: string;
  note: string;
  noteClassName: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="rounded-xl border-border bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        {note ? (
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", noteClassName)}>{note}</span>
        ) : null}
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          {isLoading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" /> : value}
        </p>
      </CardContent>
    </Card>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="relative w-32 shrink-0 xl:w-36">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-border bg-white px-4 pr-9 text-sm font-medium text-slate-500 outline-none hover:bg-slate-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function PageButton({ page, active, onClick }: { page: number | string; active: boolean; onClick?: () => void }) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "h-8 min-w-8 shrink-0 rounded-lg px-3 text-sm font-bold disabled:cursor-default disabled:opacity-100",
        active ? "bg-primary text-white hover:bg-primary/90" : "text-slate-900 hover:bg-slate-100",
      )}
    >
      {page}
    </Button>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const copy = EMPTY_STATE_COPY[tab];
  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center px-4 py-16 text-center">
      <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-blue-50">
        <FolderOpen className="h-9 w-9 text-primary" />
        <span className="absolute -right-1 bottom-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-primary shadow-[0_2px_8px_rgba(15,23,42,0.16)]">
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </span>
      </span>
      <h2 className="mt-6 text-lg font-bold text-slate-900">{copy.title}</h2>
      <p className="mt-2 max-w-120 text-sm font-medium leading-6 text-slate-500">{copy.description}</p>
    </div>
  );
}


export default function CareEpisodesPage() {
  const [facilityId, setFacilityId] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [episodes, setEpisodes] = useState<CareEpisodeRecord[]>([]);
  const [clinicianDirectory, setClinicianDirectory] = useState<Record<string, ClinicianSearchResult>>({});
  const [patientDirectory, setPatientDirectory] = useState<Record<string, ConnectedPatientRecord>>({});
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [riskFilter, setRiskFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewEpisodeId, setReviewEpisodeId] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    capturePostHogEvent("care_episodes_viewed");
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const directory = await getClinicianDirectory();
        if (!ignore) setClinicianDirectory(directory);
      } catch {
        if (!ignore) setClinicianDirectory({});
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const id = await getHospitalFacilityId();
        if (!ignore) setFacilityId(id);
      } catch {
        if (!ignore) setFacilityId("");
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!facilityId) return;
    let ignore = false;
    (async () => {
      try {
        const response = await getConnectedPatients(facilityId, { limit: 100 });
        if (ignore) return;
        const directory: Record<string, ConnectedPatientRecord> = {};
        for (const patient of response.data) {
          if (patient.patientId) directory[patient.patientId] = patient;
        }
        setPatientDirectory(directory);
      } catch {
        if (!ignore) setPatientDirectory({});
      }
    })();
    return () => {
      ignore = true;
    };
  }, [facilityId]);


  useEffect(() => {
    let ignore = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await getCareEpisodes({
          status: activeTab,
          riskLevel: riskFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          limit: PAGE_LIMIT,
        });
        if (ignore) return;
        setEpisodes(response.data);
        setTotal(response.total);
        setTotalPages(Math.max(response.totalPages, 1));
        setCounts({
          activeCount: response.activeCount,
          pendingCount: response.pendingCount,
          closedCount: response.closedCount,
          highRiskCount: response.highRiskCount,
        });
      } catch (requestError) {
        if (ignore) return;
        setEpisodes([]);
        setTotal(0);
        setTotalPages(1);
        setError(requestError instanceof Error ? requestError.message : "Failed to load care episodes.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [activeTab, riskFilter, dateFrom, dateTo, page, refreshKey]);

  const isEmpty = !isLoading && episodes.length === 0;
  const rangeStart = episodes.length > 0 ? (page - 1) * PAGE_LIMIT + 1 : 0;
  const rangeEnd = (page - 1) * PAGE_LIMIT + episodes.length;
  const tabNoun = activeTab === "active" ? "Active Episodes" : activeTab === "pending" ? "Pending Reviews" : "Closed Episodes";

  useEffect(() => {
    if (!isEmpty) return;
    capturePostHogEvent("care_episode_empty_state_viewed", {
      tab: activeTab,
      risk_filter: riskFilter,
      has_date_filter: Boolean(dateFrom || dateTo),
    });
  }, [activeTab, dateFrom, dateTo, isEmpty, riskFilter]);

  const csvRows = useMemo(() => {
    if (activeTab === "active") {
      const header = ["Patient", "Diagnosis", "Assigned Clinician", "Status", "Progress", "Risk Level"];
      const rows = episodes.map((episode) => [
        getPatientName(patientDirectory, episode.patientId),
        episode.diagnosis ?? "",
        getClinicianLabel(clinicianDirectory, episode.clinicianId),
        getCarePhaseBadge(episode.carePhase).label,
        `Day ${episode.dayStart ?? 0}/${episode.expectedDurationDays ?? 0}`,
        getRiskBadge(episode.riskCategory).label,
      ]);
      return [header, ...rows];
    }
    if (activeTab === "pending") {
      const header = ["Patient", "Diagnosis", "Consultation Date", "Recommendation"];
      const rows = episodes.map((episode) => [
        getPatientName(patientDirectory, episode.patientId),
        episode.diagnosis ?? "",
        formatDate(episode.createdAt),
        getRecommendation(episode.riskCategory),
      ]);
      return [header, ...rows];
    }
    const header = ["Patient", "Closed Date", "Episode Duration", "Closure Reason"];
    const rows = episodes.map((episode) => [
      getPatientName(patientDirectory, episode.patientId),
      formatDate(episode.closedAt || episode.updatedAt),
      getEpisodeDuration(episode.createdAt, episode.closedAt, episode.expectedDurationDays) + " days",
      getClosureInfo(episode.closureReason).label,
    ]);
    return [header, ...rows];
  }, [activeTab, episodes, clinicianDirectory, patientDirectory]);

  const exportCsv = () => {
    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `care-episodes-${activeTab}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    capturePostHogEvent("care_episodes_exported", {
      tab: activeTab,
      row_count: episodes.length,
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 md:text-2xl">Care Episode Management</h1>
          <p className="mt-2 max-w-140 text-sm font-medium leading-6 text-slate-500">
            Operational summaries and episode workspace
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            capturePostHogEvent("care_episode_queue_opened");
            setIsModalOpen(true);
          }}
          disabled={!facilityId}
          className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          New Patient To Queue
        </Button>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Episodes"
          value={counts.activeCount.toLocaleString()}
          note=""
          noteClassName="bg-emerald-50 text-emerald-500"
          isLoading={isLoading && episodes.length === 0}
        />
        <StatCard
          label="Pending Reviews"
          value={counts.pendingCount.toLocaleString()}
          note=""
          noteClassName="bg-red-50 text-red-500"
          isLoading={isLoading && episodes.length === 0}
        />
        <StatCard
          label="High-Risk Patients"
          value={counts.highRiskCount.toLocaleString()}
          note=""
          noteClassName="bg-red-50 text-red-500"
          isLoading={isLoading && episodes.length === 0}
        />
        <StatCard
          label="Closed Episodes"
          value={counts.closedCount.toLocaleString()}
          note=""
          noteClassName="bg-emerald-50 text-emerald-500"
          isLoading={isLoading && episodes.length === 0}
        />
      </section>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5 lg:p-6">
          <div className="mb-6 flex flex-nowrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex min-w-0 flex-nowrap items-center gap-3 pb-1 xl:gap-4">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPage(1);
                  }}
                  aria-pressed={activeTab === tab.key}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-3 text-xs font-bold transition-colors xl:px-1",
                    activeTab === tab.key ? cn(tab.borderClassName, "text-slate-900") : "border-transparent text-slate-500 hover:text-slate-900",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", tab.dotClassName)} />
                  {tab.label}
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    {counts[tab.countKey]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex shrink-0 flex-nowrap items-center gap-2">
              <SelectFilter
                label="Filter care episodes by risk"
                value={riskFilter}
                onChange={(value) => {
                  setRiskFilter(value);
                  setPage(1);
                }}
                options={[
                  { label: "All Risks", value: "all" },
                  { label: "High Risk", value: "high" },
                  { label: "Moderate", value: "medium" },
                  { label: "Low Risk", value: "low" },
                ]}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-36 shrink-0 justify-between rounded-lg border-border bg-white px-3 text-sm font-medium text-slate-500 hover:bg-slate-50"
                  >
                    Date Range
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="episode-date-from">Created from</Label>
                    <Input
                      id="episode-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(event) => {
                        setDateFrom(event.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="episode-date-to">Created to</Label>
                    <Input
                      id="episode-date-to"
                      type="date"
                      min={dateFrom || undefined}
                      value={dateTo}
                      onChange={(event) => {
                        setDateTo(event.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  {dateFrom || dateTo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                        setPage(1);
                      }}
                      className="w-full"
                    >
                      Clear date range
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                onClick={exportCsv}
                disabled={episodes.length === 0}
                className="h-10 shrink-0 gap-1.5 whitespace-nowrap px-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {isEmpty ? (
            <EmptyState tab={activeTab} />
          ) : (
            <>
              {activeTab === "active" ? (
                <Table className="w-full table-fixed">
                  <TableHeader className="bg-blue-50">
                    <TableRow className="border-0 hover:bg-blue-50">
                      {["PATIENT NAME", "DIAGNOSIS", "ASSIGNED CLINICIAN", "STATUS", "PROGRESS", "RISK LEVEL", "ACTION"].map((heading) => (
                        <TableHead key={heading} className="h-14 px-3 text-xs font-bold text-slate-500 sm:px-4">
                          {heading}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index} className="border-0 hover:bg-transparent">
                          <TableCell colSpan={7} className="px-3 py-5 sm:px-4">
                            <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      episodes.map((episode) => {
                        const statusBadge = getCarePhaseBadge(episode.carePhase);
                        const riskBadge = getRiskBadge(episode.riskCategory);
                        const percent = getProgressPercent(episode.dayStart, episode.expectedDurationDays);
                        return (
                          <TableRow key={episode.id} className="border-0 hover:bg-transparent">
                            <TableCell className="px-3 py-5 sm:px-4">
                              <span className="block font-bold text-slate-900">{getPatientName(patientDirectory, episode.patientId)}</span>
                              <span className="mt-1 block text-xs font-medium text-slate-500">{getPatientTracmedyCode(patientDirectory, episode.patientId)}</span>
                            </TableCell>
                            <TableCell className="break-words px-3 py-5 text-slate-700 sm:px-4">{episode.diagnosis || "--"}</TableCell>
                            <TableCell className="px-4 py-5 text-slate-700 sm:px-6">
                              {getClinicianLabel(clinicianDirectory, episode.clinicianId)}
                            </TableCell>
                            <TableCell className="px-3 py-5 sm:px-4">
                              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", statusBadge.className)}>
                                {statusBadge.label}
                              </span>
                            </TableCell>
                            <TableCell className="px-3 py-5 sm:px-4">
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                                  Day {episode.dayStart ?? 0}/{episode.expectedDurationDays ?? 0}
                                </span>
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-slate-700">{percent}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-5 sm:px-4">
                              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                                {riskBadge.label}
                              </span>
                            </TableCell>
                            <TableCell className="px-3 py-5 sm:px-4">
                              <Link
                                href={`/dashboard/care-episodes/${encodeURIComponent(episode.id)}`}
                                className="text-sm font-bold text-primary"
                              >
                                View
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              ) : null}

              {activeTab === "pending" ? (
                <Table className="w-full table-fixed">
                  <TableHeader className="bg-blue-50">
                    <TableRow className="border-0 hover:bg-blue-50">
                      {["PATIENT NAME", "DIAGNOSIS", "CREATED DATE", "RECOMMENDATION", "ACTION"].map((heading) => (
                        <TableHead key={heading} className="h-14 px-3 text-xs font-bold text-slate-500 sm:px-4">
                          {heading}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index} className="border-0 hover:bg-transparent">
                          <TableCell colSpan={5} className="px-3 py-5 sm:px-4">
                            <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      episodes.map((episode) => (
                        <TableRow key={episode.id} className="border-0 hover:bg-transparent">
                          <TableCell className="px-3 py-5 sm:px-4">
                            <span className="block font-bold text-slate-900">{getPatientName(patientDirectory, episode.patientId)}</span>
                            <span className="mt-1 block text-xs font-medium text-slate-500">{getPatientTracmedyCode(patientDirectory, episode.patientId)}</span>
                          </TableCell>
                          <TableCell className="break-words px-3 py-5 text-slate-700 sm:px-4">{episode.diagnosis || "--"}</TableCell>
                          <TableCell className="px-4 py-5 text-slate-700 sm:px-6">{formatDate(episode.createdAt)}</TableCell>
                          <TableCell className="px-4 py-5 text-slate-700 sm:px-6">{getRecommendation(episode.riskCategory)}</TableCell>
                          <TableCell className="px-3 py-5 sm:px-4">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewEpisodeId(episode.id);
                                setIsReviewModalOpen(true);
                              }}
                              className="text-sm font-bold text-primary"
                            >
                              Review
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : null}

              {activeTab === "closed" ? (
                <Table className="w-full table-fixed">
                  <TableHeader className="bg-blue-50">
                    <TableRow className="border-0 hover:bg-blue-50">
                      {["PATIENT NAME", "CLOSED DATE", "EPISODE DURATION", "CLOSURE REASON", "ACTION"].map((heading) => (
                        <TableHead key={heading} className="h-14 px-3 text-xs font-bold text-slate-500 sm:px-4">
                          {heading}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index} className="border-0 hover:bg-transparent">
                          <TableCell colSpan={5} className="px-3 py-5 sm:px-4">
                            <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      episodes.map((episode) => {
                        const closure = getClosureInfo(episode.closureReason);
                        return (
                          <TableRow key={episode.id} className="border-0 hover:bg-transparent">
                            <TableCell className="px-3 py-5 sm:px-4">
                              <span className="block font-bold text-slate-900">{getPatientName(patientDirectory, episode.patientId)}</span>
                              <span className="mt-1 block text-xs font-medium text-slate-500">{getPatientTracmedyCode(patientDirectory, episode.patientId)}</span>
                            </TableCell>
                            <TableCell className="px-4 py-5 text-slate-700 sm:px-6">{formatDate(episode.closedAt || episode.updatedAt)}</TableCell>
                            <TableCell className="px-4 py-5 text-slate-700 sm:px-6">
                              {getEpisodeDuration(episode.createdAt, episode.closedAt, episode.expectedDurationDays)} days
                            </TableCell>
                            <TableCell className="px-3 py-5 sm:px-4">
                              <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", closure.textClassName)}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", closure.dotClassName)} />
                                {closure.label}
                              </span>
                            </TableCell>
                            <TableCell className="px-3 py-5 sm:px-4">
                              <Link
                                href={`/dashboard/care-episodes/${encodeURIComponent(episode.id)}/closed-summary`}
                                className="text-sm font-bold text-primary"
                              >
                                View Summary
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              ) : null}
            </>
          )}
        </CardContent>

        {!isEmpty && episodes.length > 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <p className="text-center text-xs font-medium text-slate-500 sm:text-left sm:text-sm">
              Showing {rangeStart}-{rangeEnd} of {total} {tabNoun}
            </p>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2 py-1 sm:justify-end">
              <Button
                type="button"
                aria-label="Previous page"
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="h-8 w-8 shrink-0 rounded-lg border-slate-200 text-slate-500"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPaginationItems(page, totalPages).map((item, index) =>
                typeof item === "number" ? (
                  <PageButton key={item} page={item} active={item === page} onClick={() => setPage(item)} />
                ) : (
                  <PageButton key={`${item}-${index}`} page={item.trim()} active={false} />
                ),
              )}
              <Button
                type="button"
                aria-label="Next page"
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                className="h-8 w-8 shrink-0 rounded-lg border-primary text-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <AddPatientModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        facilityId={facilityId}
        onCreated={() => setRefreshKey((key) => key + 1)}
      />

      <PatientReviewModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        episodeId={reviewEpisodeId}
        onActionComplete={() => setRefreshKey((key) => key + 1)}
      />
    </div>
  );
}
