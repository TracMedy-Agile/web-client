"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getReportsDateRange,
  getReportsSnapshot,
  type ReportsSnapshot,
  type WorkloadStatus,
} from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportReportModal from "../components/ExportReportModal";

const PAGE_SIZE = 6;

const statusStyles: Record<WorkloadStatus, string> = {
  Low: "bg-emerald-100 text-emerald-600",
  Moderate: "bg-amber-100 text-amber-600",
  High: "bg-red-100 text-red-500",
};

const avatarStyles = [
  "bg-blue-100 text-primary",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-slate-200 text-slate-700",
  "bg-rose-100 text-rose-700",
];

export default function ClinicianWorkloadPage() {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkload = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setSnapshot(await getReportsSnapshot(getReportsDateRange(30)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load clinician workload.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    capturePostHogEvent("clinician_workload_viewed");
    let active = true;
    void getReportsSnapshot(getReportsDateRange(30))
      .then((nextSnapshot) => {
        if (active) setSnapshot(nextSnapshot);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setSnapshot(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load clinician workload.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const clinicians = useMemo(() => snapshot?.clinicians ?? [], [snapshot]);
  const specialties = useMemo(
    () => Array.from(new Set(clinicians.map((clinician) => clinician.specialty))).sort(),
    [clinicians],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return clinicians.filter((clinician) => {
      const matchesQuery = !normalizedQuery || clinician.name.toLowerCase().includes(normalizedQuery);
      const matchesSpecialty = specialty === "all" || clinician.specialty === specialty;
      const matchesStatus = status === "all" || clinician.status === status;
      return matchesQuery && matchesSpecialty && matchesStatus;
    });
  }, [clinicians, query, specialty, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  function resetPage() {
    setPage(1);
  }

  function handleExport() {
    setIsExportOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clinician Workload</h1>
          <p className="text-sm text-muted-foreground">
            Analyze clinician workload, capacity utilization, and operational distribution
          </p>
          {snapshot ? (
            <p className="mt-1 text-xs text-muted-foreground">Facility: {snapshot.facility.name}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!snapshot}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {error ? (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void loadWorkload()} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : null}
      {snapshot?.warnings.length ? (
        <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Some workload data could not be loaded: {snapshot.warnings.join(" · ")}
        </div>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-xl bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1 lg:max-w-[520px]">
            <span className="sr-only">Search clinician by name</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetPage();
              }}
              placeholder="Search by name"
              className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex flex-wrap gap-3 lg:ml-auto">
            <Select value={specialty} onValueChange={(value) => { setSpecialty(value); resetPage(); }}>
              <SelectTrigger aria-label="Filter by specialty" className="w-[165px] bg-card">
                <SelectValue placeholder="All Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialty</SelectItem>
                {specialties.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => { setStatus(value); resetPage(); }}>
              <SelectTrigger aria-label="Filter by workload status" className="w-[130px] bg-card">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={handleExport}
              disabled={!snapshot}
              className="inline-flex items-center gap-2 px-4 text-sm font-medium text-foreground hover:text-primary disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-primary/5 text-xs uppercase text-foreground">
              <tr>
                <th className="px-6 py-5 font-medium">Clinicians</th>
                <th className="px-6 py-5 font-medium">Specialty</th>
                <th className="px-6 py-5 font-medium">Episodes</th>
                <th className="px-6 py-5 font-medium">Alerts</th>
                <th className="px-6 py-5 font-medium">Workload Status</th>
                <th className="px-6 py-5 font-medium">Avg Response Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <tr key={index} className="animate-pulse border-b border-border/50 last:border-0">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="h-10 w-10 shrink-0 rounded-full bg-muted" /><span className="h-4 w-32 rounded bg-muted" /></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-muted" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 rounded bg-muted" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 rounded bg-muted" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-20 rounded-full bg-muted" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-muted" /></td>
                  </tr>
                ))
              ) : visibleRows.map((clinician, index) => (
                <tr key={clinician.id} className="border-b border-border/50 text-foreground last:border-0 hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold", avatarStyles[index % avatarStyles.length])}>
                        {clinician.initials}
                      </span>
                      <span className="font-medium">{clinician.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{clinician.specialty}</td>
                  <td className="px-6 py-4">{clinician.episodes}</td>
                  <td className="px-6 py-4">{clinician.alerts}</td>
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-xs font-medium", statusStyles[clinician.status])}>
                      {clinician.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{clinician.responseTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && visibleRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No clinicians match these filters.</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-4 text-sm">
          <p className="text-muted-foreground">Showing <strong>{start}-{end}</strong> of <strong>{filtered.length}</strong> Team Members</p>
          <nav aria-label="Clinician workload pagination" className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-primary disabled:text-muted-foreground/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                aria-label={`Go to page ${pageNumber}`}
                aria-current={safePage === pageNumber ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
                className={cn(
                  "h-8 min-w-8 rounded-lg px-2 text-sm font-medium",
                  safePage === pageNumber ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                )}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary text-primary disabled:border-border disabled:text-muted-foreground/40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </section>
      <ExportReportModal
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        defaultPeriod="30 days"
        initialReportType="clinician-workload"
        snapshot={snapshot}
      />
    </div>
  );
}
