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
  Eye,
  FolderOpen,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  { key: "active", label: "Active Episodes", dotClassName: "bg-[#023E8A]", borderClassName: "border-[#023E8A]", countKey: "activeCount" },
  { key: "pending", label: "Pending Review", dotClassName: "bg-[#EF4444]", borderClassName: "border-[#EF4444]", countKey: "pendingCount" },
  { key: "closed", label: "Closed Episode", dotClassName: "bg-[#10B981]", borderClassName: "border-[#10B981]", countKey: "closedCount" },
];

const EMPTY_STATE_COPY: Record<TabKey, { title: string; description: string }> = {
  active: {
    title: "No Active Care Episodes.",
    description:
      "Episodes will appear automatically once patients register and begin logging data on the Tracmedy mobile app, their clinical profiles will appear here automatically in real-time.",
  },
  pending: {
    title: "No Episodes Pending Review.",
    description: "Great job!! You are all caught up. New reviews will be generated based on clinical thresholds",
  },
  closed: {
    title: "No Closed Episodes Found.",
    description:
      "Once an episode is marked as complete, it will be automatically logged here for long time storage and audit trailing",
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

// CareEpisodeSummaryDto only exposes patientId — there is no endpoint that resolves a raw
// patient ID to a name/tracmedyPatientId (GET /patients/search only matches by name, email,
// phone, or tracmedyPatientId text, and GET /facilities/:id/patients does not exist).
function getClinicianLabel(directory: Record<string, ClinicianSearchResult>, clinicianId: string | null) {
  if (!clinicianId) return "--";
  const clinician = directory[clinicianId];
  if (!clinician) return clinicianId;
  return clinician.department ? `Dr. ${clinician.name} - ${clinician.department}` : `Dr. ${clinician.name}`;
}

function getCarePhaseBadge(carePhase: string | null) {
  const value = (carePhase ?? "").toLowerCase();
  if (value === "alert") return { label: "Alert", className: "bg-[#FFECEC] text-[#EF4444]" };
  if (value.startsWith("monitor")) return { label: "Monitoring", className: "bg-[#FFF4E5] text-[#F59E0B]" };
  if (value === "stable") return { label: "Stable", className: "bg-[#DFFBF0] text-[#10B981]" };
  return { label: "Stable", className: "bg-[#DFFBF0] text-[#10B981]" };
}

function getRiskBadge(riskCategory: string | null) {
  const value = (riskCategory ?? "").toLowerCase();
  if (value === "high") return { label: "High Risk", className: "bg-[#FFECEC] text-[#EF4444]" };
  if (value === "medium") return { label: "Moderate", className: "bg-[#FFF4E5] text-[#F59E0B]" };
  if (value === "low") return { label: "Low Risk", className: "bg-[#DFFBF0] text-[#10B981]" };
  return { label: "Unrated", className: "bg-[#F3F4F6] text-[#71809B]" };
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
    ? { label: "Lost to Follow-up", dotClassName: "bg-[#EF4444]", textClassName: "text-[#EF4444]" }
    : { label: "Recovery Completed", dotClassName: "bg-[#10B981]", textClassName: "text-[#10B981]" };
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
    <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        {note ? (
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", noteClassName)}>{note}</span>
        ) : null}
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">{label}</p>
        <p className="mt-1 text-2xl font-bold text-[#111827] sm:text-3xl">
          {isLoading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-[#F3F4F6]" /> : value}
        </p>
      </CardContent>
    </Card>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="relative w-full sm:w-40">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-[#DDE3EC] bg-white px-4 pr-9 text-sm font-medium text-[#71809B] outline-none hover:bg-[#F8FAFC]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
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
        active ? "bg-[#023E8A] text-white hover:bg-[#023575]" : "text-[#111827] hover:bg-[#F3F4F6]",
      )}
    >
      {page}
    </Button>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const copy = EMPTY_STATE_COPY[tab];
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[#EFF5FF]">
        <FolderOpen className="h-9 w-9 text-[#023E8A]" />
        <span className="absolute -right-1 bottom-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#023E8A] shadow-[0_2px_8px_rgba(15,23,42,0.16)]">
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </span>
      </span>
      <h2 className="mt-6 text-lg font-bold text-[#111827]">{copy.title}</h2>
      <p className="mt-2 max-w-120 text-sm font-medium leading-6 text-[#71809B]">{copy.description}</p>
    </div>
  );
}


export default function CareEpisodesPage() {
  const [facilityId, setFacilityId] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [episodes, setEpisodes] = useState<CareEpisodeRecord[]>([]);
  const [clinicianDirectory, setClinicianDirectory] = useState<Record<string, ClinicianSearchResult>>({});
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

  const csvRows = useMemo(() => {
    if (activeTab === "active") {
      const header = ["Patient", "Diagnosis", "Assigned Clinician", "Status", "Progress", "Risk Level"];
      const rows = episodes.map((episode) => [
        episode.patientId,
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
        episode.patientId,
        episode.diagnosis ?? "",
        formatDate(episode.createdAt),
        getRecommendation(episode.riskCategory),
      ]);
      return [header, ...rows];
    }
    const header = ["Patient", "Closed Date", "Episode Duration", "Closure Reason"];
    const rows = episodes.map((episode) => [
      episode.patientId,
      formatDate(episode.updatedAt),
      `${episode.expectedDurationDays ?? 0} days`,
      getClosureInfo(episode.closureReason).label,
    ]);
    return [header, ...rows];
  }, [activeTab, episodes, clinicianDirectory]);

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
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#111827] md:text-2xl">Care Episode Management</h1>
          <p className="mt-2 max-w-140 text-sm font-medium leading-6 text-[#71809B]">
            Operational summaries and episode workspace
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="h-11 w-full rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575] sm:w-auto"
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
          noteClassName="bg-[#DFFBF0] text-[#10B981]"
          isLoading={isLoading && episodes.length === 0}
        />
        <StatCard
          label="Pending Reviews"
          value={counts.pendingCount.toLocaleString()}
          note=""
          noteClassName="bg-[#FFECEC] text-[#EF4444]"
          isLoading={isLoading && episodes.length === 0}
        />
        <StatCard
          label="High-Risk Patients"
          value={counts.highRiskCount.toLocaleString()}
          note=""
          noteClassName="bg-[#FFECEC] text-[#EF4444]"
          isLoading={isLoading && episodes.length === 0}
        />
        <StatCard
          label="Closed (Month)"
          value={counts.closedCount.toLocaleString()}
          note=""
          noteClassName="bg-[#DFFBF0] text-[#10B981]"
          isLoading={isLoading && episodes.length === 0}
        />
      </section>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5 lg:p-6">
          <div className="mb-6 flex flex-col gap-4 border-b border-[#E5E7EB] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-5">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPage(1);
                  }}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-bold transition-colors",
                    activeTab === tab.key ? cn(tab.borderClassName, "text-[#111827]") : "border-transparent text-[#71809B] hover:text-[#111827]",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", tab.dotClassName)} />
                  {tab.label}
                  <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-xs font-bold text-[#71809B]">
                    {counts[tab.countKey]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <SelectFilter
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
              <div className="relative w-full sm:w-40">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full justify-between rounded-lg border-[#DDE3EC] bg-white px-4 text-sm font-medium text-[#71809B] hover:bg-[#F8FAFC]"
                >
                  Date Range
                  <CalendarDays className="h-4 w-4" />
                </Button>
                <div className="absolute inset-0 flex opacity-0">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setPage(1);
                    }}
                    className="w-1/2 cursor-pointer"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setPage(1);
                    }}
                    className="w-1/2 cursor-pointer"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={exportCsv}
                disabled={episodes.length === 0}
                className="h-10 gap-2 px-2 text-sm font-medium text-[#111827] hover:bg-[#F8FAFC]"
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
                <Table className="min-w-230">
                  <TableHeader className="bg-[#EFF5FF]">
                    <TableRow className="border-0 hover:bg-[#EFF5FF]">
                      {["PATIENT NAME", "DIAGNOSIS", "ASSIGNED CLINICIAN", "STATUS", "PROGRESS", "RISK LEVEL", "ACTION"].map((heading) => (
                        <TableHead key={heading} className="h-14 px-4 text-xs font-bold text-[#71809B] sm:px-6">
                          {heading}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index} className="border-0 hover:bg-transparent">
                          <TableCell colSpan={7} className="px-4 py-5 sm:px-6">
                            <div className="h-5 w-full animate-pulse rounded bg-[#F3F4F6]" />
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
                            <TableCell className="px-4 py-5 sm:px-6">
                              <span className="block font-bold text-[#111827]">{episode.patientId || "Unknown Patient"}</span>
                              <span className="mt-1 block text-xs font-medium text-[#71809B]">--</span>
                            </TableCell>
                            <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{episode.diagnosis || "--"}</TableCell>
                            <TableCell className="px-4 py-5 text-[#344054] sm:px-6">
                              {getClinicianLabel(clinicianDirectory, episode.clinicianId)}
                            </TableCell>
                            <TableCell className="px-4 py-5 sm:px-6">
                              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", statusBadge.className)}>
                                {statusBadge.label}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-5 sm:px-6">
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap text-xs font-semibold text-[#344054]">
                                  Day {episode.dayStart ?? 0}/{episode.expectedDurationDays ?? 0}
                                </span>
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#E5E7EB]">
                                  <div className="h-full rounded-full bg-[#023E8A]" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-[#344054]">{percent}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-5 sm:px-6">
                              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                                {riskBadge.label}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-5 sm:px-6">
                              <Link
                                href={`/dashboard/care-episodes/${encodeURIComponent(episode.id)}`}
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#023E8A]"
                              >
                                <Eye className="h-4 w-4" />
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
                <Table className="min-w-190">
                  <TableHeader className="bg-[#EFF5FF]">
                    <TableRow className="border-0 hover:bg-[#EFF5FF]">
                      {["PATIENT NAME", "DIAGNOSIS", "CONSULTATION DATE", "RECOMMENDATION", "ACTION"].map((heading) => (
                        <TableHead key={heading} className="h-14 px-4 text-xs font-bold text-[#71809B] sm:px-6">
                          {heading}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index} className="border-0 hover:bg-transparent">
                          <TableCell colSpan={5} className="px-4 py-5 sm:px-6">
                            <div className="h-5 w-full animate-pulse rounded bg-[#F3F4F6]" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      episodes.map((episode) => (
                        <TableRow key={episode.id} className="border-0 hover:bg-transparent">
                          <TableCell className="px-4 py-5 sm:px-6">
                            <span className="block font-bold text-[#111827]">{episode.patientId || "Unknown Patient"}</span>
                            <span className="mt-1 block text-xs font-medium text-[#71809B]">--</span>
                          </TableCell>
                          <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{episode.diagnosis || "--"}</TableCell>
                          <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{formatDate(episode.createdAt)}</TableCell>
                          <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{getRecommendation(episode.riskCategory)}</TableCell>
                          <TableCell className="px-4 py-5 sm:px-6">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewEpisodeId(episode.id);
                                setIsReviewModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#023E8A]"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : null}

              {activeTab === "closed" ? (
                <Table className="min-w-190">
                  <TableHeader className="bg-[#EFF5FF]">
                    <TableRow className="border-0 hover:bg-[#EFF5FF]">
                      {["PATIENT NAME", "CLOSED DATE", "EPISODE DURATION", "CLOSURE REASON", "ACTION"].map((heading) => (
                        <TableHead key={heading} className="h-14 px-4 text-xs font-bold text-[#71809B] sm:px-6">
                          {heading}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index} className="border-0 hover:bg-transparent">
                          <TableCell colSpan={5} className="px-4 py-5 sm:px-6">
                            <div className="h-5 w-full animate-pulse rounded bg-[#F3F4F6]" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      episodes.map((episode) => {
                        const closure = getClosureInfo(episode.closureReason);
                        return (
                          <TableRow key={episode.id} className="border-0 hover:bg-transparent">
                            <TableCell className="px-4 py-5 sm:px-6">
                              <span className="block font-bold text-[#111827]">{episode.patientId || "Unknown Patient"}</span>
                              <span className="mt-1 block text-xs font-medium text-[#71809B]">--</span>
                            </TableCell>
                            <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{formatDate(episode.updatedAt)}</TableCell>
                            <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{episode.expectedDurationDays ?? 0} days</TableCell>
                            <TableCell className="px-4 py-5 sm:px-6">
                              <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", closure.textClassName)}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", closure.dotClassName)} />
                                {closure.label}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-5 sm:px-6">
                              <Link
                                href={`/dashboard/care-episodes/${encodeURIComponent(episode.id)}/closed-summary`}
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#023E8A]"
                              >
                                <Eye className="h-4 w-4" />
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
          <div className="flex flex-col items-center gap-4 border-t border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <p className="text-center text-xs font-medium text-[#71809B] sm:text-left sm:text-sm">
              Showing {rangeStart}-{rangeEnd} of {total} {tabNoun}
            </p>
            <div className="flex max-w-full items-center gap-2 overflow-x-auto py-1">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="h-8 w-8 shrink-0 rounded-lg border-[#E5E7EB] text-[#71809B]"
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
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                className="h-8 w-8 shrink-0 rounded-lg border-[#023E8A] text-[#023E8A]"
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
