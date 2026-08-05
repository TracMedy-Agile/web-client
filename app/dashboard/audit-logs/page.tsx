"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileSearch,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getAllAuditLogs,
  getAuditLog,
  getAuditLogs,
  type AuditLogEntry,
} from "@/lib/api/audit-logs";

const PAGE_SIZE = 6;
const AUDIT_MODULE_OPTIONS = [
  { value: "alerts", label: "Alerts" },
  { value: "appointments", label: "Appointments" },
  { value: "care-episodes", label: "Care Episodes" },
  { value: "care_episode", label: "Care Plan" },
  { value: "denied_attempts", label: "Denied Attempts" },
  { value: "facilities", label: "Facilities" },
  { value: "home_care", label: "Home Care" },
  { value: "patient_management", label: "Patient Management" },
  { value: "sensitive_read", label: "Sensitive Read" },
];

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function formatTableTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadCsv(entries: AuditLogEntry[], fileName: string) {
  const rows = [
    ["Audit ID", "Staff Name", "Role", "Module", "Action", "Reference", "Timestamp", "IP Address", "Device / Agent"],
    ...entries.map((entry) => [
      entry.id,
      entry.staffName,
      entry.staffRole,
      entry.module,
      entry.action,
      entry.reference ?? "",
      formatDateTime(entry.timestamp),
      entry.ipAddress,
      entry.deviceAgent,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#e5eaf0] bg-[#fbfcfe] p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#667085]">
        <span className="text-[#6b7c93]">{icon}</span>
        {label}
      </div>
      <p className="break-words text-sm font-semibold text-[#172b4d]">{value}</p>
    </div>
  );
}

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [module, setModule] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    capturePostHogEvent("audit_log_viewed");
  }, []);

  useEffect(() => {
    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setIsRefreshing(true);
      setLoadError("");
      try {
        const response = await getAuditLogs({
          search: searchQuery.trim() || undefined,
          module: module === "all" ? undefined : module,
          page,
          limit: PAGE_SIZE,
        });
        if (!ignore) {
          setEntries(response.data);
          setTotalEntries(response.meta.total);
          setTotalPages(response.meta.totalPages);
        }
      } catch (requestError) {
        if (!ignore) {
          setEntries([]);
          setTotalEntries(0);
          setLoadError(requestError instanceof Error ? requestError.message : "Failed to load audit logs.");
        }
      } finally {
        if (!ignore) setIsRefreshing(false);
      }
    }, 250);
    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [module, page, refreshKey, searchQuery]);

  const modules = useMemo(() => {
    const options = new Map(AUDIT_MODULE_OPTIONS.map((item) => [item.value, item.label]));
    entries.forEach((entry) => options.set(entry.moduleKey, entry.module));
    return [...options].map(([value, label]) => ({ value, label }));
  }, [entries]);
  const filteredEntries = entries;
  const safePage = Math.min(page, totalPages);
  const pageEntries = filteredEntries;
  const firstShown = totalEntries ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = Math.min((safePage - 1) * PAGE_SIZE + pageEntries.length, totalEntries);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  function updateFilter(callback: () => void, filterName: string) {
    callback();
    setPage(1);
    capturePostHogEvent("audit_log_filtered", { filter: filterName });
  }

  function clearFilters() {
    setIsRefreshing(true);
    setSearchQuery("");
    setModule("all");
    setPage(1);
    capturePostHogEvent("audit_log_refreshed");
    setRefreshKey((value) => value + 1);
  }

  function exportEntries(entries: AuditLogEntry[], source: "list" | "detail") {
    if (!entries.length) return;
    const suffix = source === "detail" ? entries[0].id.toLowerCase() : "filtered";
    downloadCsv(entries, `tracmedy-audit-log-${suffix}.csv`);
    capturePostHogEvent("audit_log_exported", {
      source,
      record_count: entries.length,
    });
  }

  async function exportFilteredEntries() {
    setIsExporting(true);
    try {
      const exportEntries = await getAllAuditLogs({
        search: searchQuery.trim() || undefined,
        module: module === "all" ? undefined : module,
      });
      downloadCsv(exportEntries, "tracmedy-audit-log-filtered.csv");
      capturePostHogEvent("audit_log_exported", {
        source: "list",
        record_count: exportEntries.length,
      });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to export audit logs.");
    } finally {
      setIsExporting(false);
    }
  }

  async function openDetails(entry: AuditLogEntry) {
    setSelectedEntry(entry);
    capturePostHogEvent("audit_log_entry_viewed", {
      audit_id: entry.id,
      module: entry.module,
    });
    try {
      setSelectedEntry(await getAuditLog(entry.id));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to load audit details.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#172b4d]">Audit Log</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Track all administrative actions for trust, compliance, and accountability.
          </p>
        </div>
        <button
          type="button"
          disabled={totalEntries === 0 || Boolean(loadError) || isExporting}
          onClick={() => void exportFilteredEntries()}
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-[#0756d8] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#064abd] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export
        </button>
      </section>

      {!isRefreshing && !loadError && pageEntries.length === 0 ? (
        <section className="flex min-h-[520px] flex-col items-center justify-center rounded-xl border border-[#e6eaf0] bg-white px-6 py-14 text-center shadow-[0_2px_12px_rgba(16,24,40,0.04)]">
          <div className="relative mb-7 flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-3 rounded-full bg-[#eff6ff]" />
            <FileSearch className="relative h-16 w-16 text-[#76a9f7]" strokeWidth={1.35} />
            <span className="absolute bottom-2 right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-[#0756d8] text-white">
              <Search className="h-4 w-4" />
            </span>
          </div>
          <h3 className="text-xl font-bold text-[#172b4d]">No Audit Logs Found.</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">
            Audit records will appear here as system actions and clinical events are captured.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0756d8] px-5 text-sm font-semibold text-white hover:bg-[#064abd]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh History
          </button>
        </section>
      ) : (
      <section className="overflow-hidden rounded-xl border border-[#e6eaf0] bg-white shadow-[0_2px_12px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#eaecf0] p-4 lg:flex-row lg:items-center lg:p-6">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search Logs</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  updateFilter(() => setSearchQuery(event.target.value), "search")
                }
                placeholder="Search staff, action, module or IP address"
                className="h-11 w-full rounded-lg border border-[#d0d5dd] bg-white pl-10 pr-3 text-sm text-[#172b4d] outline-none transition placeholder:text-[#98a2b3] focus:border-[#0756d8] focus:ring-2 focus:ring-[#0756d8]/15"
              />
            </span>
          </label>

          <label className="w-full lg:w-52">
            <span className="sr-only">Module</span>
            <select
              value={module}
              onChange={(event) => updateFilter(() => setModule(event.target.value), "module")}
              className="h-11 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm text-[#344054] outline-none focus:border-[#0756d8] focus:ring-2 focus:ring-[#0756d8]/15"
            >
              <option value="all">All Modules</option>
              {modules.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loadError ? (
          <div role="alert" className="flex min-h-[360px] flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertCircle className="h-7 w-7" />
            </span>
            <h3 className="mt-5 text-lg font-bold text-[#172b4d]">Unable to load audit logs</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">{loadError}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0756d8] px-5 text-sm font-semibold text-white hover:bg-[#064abd]"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : isRefreshing && pageEntries.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center" aria-live="polite">
            <Loader2 className="h-7 w-7 animate-spin text-[#0756d8]" />
            <span className="sr-only">Loading audit logs</span>
          </div>
        ) : null}

        {!loadError && pageEntries.length ? (
          <>
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[19%]" />
                  <col className="w-[14%]" />
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                  <col className="w-[13%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#eaecf0] bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                    <th className="px-3 py-4 lg:px-5">Staff Name</th>
                    <th className="px-3 py-4 lg:px-4">Module</th>
                    <th className="px-3 py-4 lg:px-4">Action Taken</th>
                    <th className="px-3 py-4 lg:px-4">Timestamp</th>
                    <th className="px-3 py-4 lg:px-4">IP Address</th>
                    <th className="px-2 py-4 text-right lg:px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="text-xs hover:bg-[#f9fbff] xl:text-sm"
                    >
                      <td className="break-words px-3 py-4 lg:px-5">
                        <p className="font-semibold leading-5 text-[#172b4d]">{entry.staffName}</p>
                        <p className="mt-0.5 text-xs text-[#667085]">{entry.staffRole}</p>
                      </td>
                      <td className="break-words px-3 py-4 lg:px-4">
                        <span className="font-medium text-[#475467]">{entry.module}</span>
                      </td>
                      <td className="break-words px-3 py-4 leading-5 text-[#475467] lg:px-4">
                        <span className="line-clamp-2 break-words">{entry.action}</span>
                      </td>
                      <td className="break-words px-3 py-4 leading-5 text-[#475467] lg:px-4">
                        {formatTableTimestamp(entry.timestamp)}
                      </td>
                      <td className="break-all px-3 py-4 font-mono text-xs leading-5 text-[#475467] lg:px-4">
                        {entry.ipAddress}
                      </td>
                      <td className="px-1 py-4 text-right lg:px-3">
                        <button
                          type="button"
                          onClick={() => void openDetails(entry)}
                          className="inline-flex max-w-full items-center gap-1 rounded-md px-1 py-1.5 text-xs font-semibold text-[#0756d8] hover:bg-[#edf4ff] xl:px-2 xl:text-sm"
                        >
                          <Eye className="h-4 w-4 shrink-0" />
                          <span className="hidden xl:inline">View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-[#eaecf0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-[#667085]">
                Showing {firstShown}-{lastShown} of {totalEntries} Audit Log
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d0d5dd] text-[#475467] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageNumbers.map((pageNumber, index) => (
                  <span key={pageNumber} className="contents">
                    {index > 0 && pageNumber - pageNumbers[index - 1] > 1 ? (
                      <span className="flex h-9 w-7 items-center justify-center text-[#98a2b3]">…</span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Page ${pageNumber}`}
                      aria-current={safePage === pageNumber ? "page" : undefined}
                      onClick={() => setPage(pageNumber)}
                      className={
                        safePage === pageNumber
                          ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[#0756d8] text-sm font-semibold text-white"
                          : "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-[#475467] hover:bg-[#f1f5f9]"
                      }
                    >
                      {pageNumber}
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage === totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d0d5dd] text-[#475467] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>
      )}

      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl">
          {selectedEntry ? (
            <>
              <DialogHeader className="border-b border-[#eaecf0] px-6 py-5 pr-14">
                <DialogTitle className="flex items-center gap-3 text-xl text-[#172b4d]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#edf4ff] text-[#0756d8]">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  Audit Log Details
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Full read-only information for audit record {selectedEntry.id}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 px-6 py-6">
                <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <section>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#667085]">
                      Logged By
                    </p>
                    <div className="flex min-h-28 flex-col justify-center rounded-xl border border-[#e5eaf0] bg-[#fbfcfe] p-5">
                      <p className="font-bold text-[#172b4d]">{selectedEntry.staffName}</p>
                      <p className="mt-1 text-sm text-[#667085]">{selectedEntry.staffRole}</p>
                    </div>
                  </section>

                  <section>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#667085]">
                      Action Description
                    </p>
                    <div className="min-h-28 py-2">
                      <p className="text-base font-semibold leading-7 text-[#344054]">
                        {selectedEntry.action}
                      </p>
                      {selectedEntry.reference ? (
                        <p className="mt-2 text-sm font-semibold text-[#0756d8]">
                          {selectedEntry.reference}
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem
                    icon={<span className="font-mono text-xs">IP</span>}
                    label="IP Address"
                    value={selectedEntry.ipAddress}
                  />
                  <DetailItem
                    icon={<ClipboardList className="h-4 w-4" />}
                    label="Module"
                    value={selectedEntry.module}
                  />
                  <DetailItem
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Time Stamp"
                    value={formatDateTime(selectedEntry.timestamp)}
                  />
                  <DetailItem
                    icon={<span className="text-xs">◫</span>}
                    label="Device / Agent"
                    value={selectedEntry.deviceAgent}
                  />
                </div>
              </div>

              <DialogFooter className="flex-row items-center justify-end gap-3 border-t border-[#eaecf0] bg-[#fbfcfe] px-6 py-4">
                <button
                  type="button"
                  onClick={() => exportEntries([selectedEntry], "detail")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#0756d8] hover:bg-[#edf4ff]"
                >
                  <Download className="h-4 w-4" />
                  Download Export
                </button>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0756d8] px-6 text-sm font-semibold text-white hover:bg-[#064abd]"
                  >
                    Close
                  </button>
                </DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
