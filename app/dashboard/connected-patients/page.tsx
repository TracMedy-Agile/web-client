"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RefreshCcw,
  Search,
  Smartphone,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  getConnectedPatients,
  getHospitalFacilityId,
  type ConnectedPatientRecord,
  type ConnectedPatientsMeta,
} from "@/lib/api/connected-patients";

const DEFAULT_META: ConnectedPatientsMeta = { page: 1, limit: 5, total: 0, totalPages: 1 };
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 400;
const PAGE_LIMIT = 5;
// Best-effort sample for "New Connections" — there is no dedicated date-range facility-stats
// endpoint, so this only reflects however many of the most recent connections this page returns.
const STATS_SAMPLE_LIMIT = 100;

function formatStatus(status: string) {
  return status === "active" ? "Connected" : "Disconnected";
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return value || "--";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(new Date(parsed));
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
  icon: Icon,
  iconClassName,
  isLoading,
}: {
  label: string;
  value: string;
  note?: string;
  noteClassName?: string;
  icon: typeof Users;
  iconClassName: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#71809B]">{label}</p>
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        </div>
        <p className="mt-3 text-2xl font-bold text-[#111827] sm:text-3xl">
          {isLoading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-[#F3F4F6]" /> : value}
        </p>
        {note ? (
          <span className={cn("mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold", noteClassName)}>{note}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SelectFilter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { label: string; value: string }[] }) {
  return (
    <div className="relative w-full sm:w-40">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-[#DDE3EC] bg-white px-4 pr-9 text-sm font-medium text-[#71809B] outline-none hover:bg-[#F8FAFC]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[#EFF5FF]">
        <Smartphone className="h-9 w-9 text-[#023E8A]" />
        <RefreshCcw className="absolute -left-2 top-1/2 h-5 w-5 -translate-y-1/2 text-[#023E8A]" />
        <RefreshCcw className="absolute -right-2 top-1/2 h-5 w-5 -translate-y-1/2 text-[#023E8A]" />
      </span>
      <h2 className="mt-6 text-lg font-bold text-[#111827]">No patients connected yet</h2>
      <p className="mt-2 max-w-120 text-sm font-medium leading-6 text-[#71809B]">
        Patients who connect your facility through the Tracmedy app will appear here. Once connected, their clinical
        profiles will appear here automatically in real-time
      </p>
    </div>
  );
}

export default function ConnectedPatientsPage() {
  const [facilityId, setFacilityId] = useState("");
  const [patients, setPatients] = useState<ConnectedPatientRecord[]>([]);
  const [meta, setMeta] = useState<ConnectedPatientsMeta>(DEFAULT_META);
  const [totalConnected, setTotalConnected] = useState(0);
  const [newConnections, setNewConnections] = useState(0);
  const [disconnectedTotal, setDisconnectedTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [isLoadingFacility, setIsLoadingFacility] = useState(true);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    capturePostHogEvent("connected_patients_viewed");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      setIsLoadingFacility(true);
      try {
        const id = await getHospitalFacilityId();
        if (!ignore) setFacilityId(id);
      } catch (requestError) {
        if (!ignore) setError(requestError instanceof Error ? requestError.message : "Failed to load facility.");
      } finally {
        if (!ignore) setIsLoadingFacility(false);
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
      setIsLoadingPatients(true);
      setError("");

      try {
        const response = await getConnectedPatients(facilityId, {
          q: debouncedSearch || undefined,
          status: statusFilter,
          page,
          limit: PAGE_LIMIT,
        });
        if (ignore) return;
        setPatients(response.data);
        setMeta(response.meta);
      } catch (requestError) {
        if (ignore) return;
        setPatients([]);
        setError(requestError instanceof Error ? requestError.message : "Failed to load connected patients.");
      } finally {
        if (!ignore) setIsLoadingPatients(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [facilityId, debouncedSearch, statusFilter, page]);

  // Facility-wide stats are independent of the table's search/status/page filters.
  useEffect(() => {
    if (!facilityId) return;
    let ignore = false;

    (async () => {
      setIsLoadingStats(true);
      try {
        const [allResponse, disconnectedResponse] = await Promise.all([
          getConnectedPatients(facilityId, { limit: STATS_SAMPLE_LIMIT }),
          getConnectedPatients(facilityId, { status: "inactive", limit: 1 }),
        ]);
        if (ignore) return;

        setTotalConnected(allResponse.meta.total);
        setDisconnectedTotal(disconnectedResponse.meta.total);

        const now = Date.now();
        const recentCount = allResponse.data.filter((record) => {
          const connectedAt = Date.parse(record.connectedAt);
          return Number.isFinite(connectedAt) && now - connectedAt <= SEVEN_DAYS_MS;
        }).length;
        setNewConnections(recentCount);
      } catch {
        if (!ignore) {
          setTotalConnected(0);
          setNewConnections(0);
          setDisconnectedTotal(0);
        }
      } finally {
        if (!ignore) setIsLoadingStats(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [facilityId]);

  const filteredByDate = dateFrom || dateTo
    ? patients.filter((record) => {
        const connectedDate = record.connectedAt?.slice(0, 10) ?? "";
        const matchesFrom = !dateFrom || connectedDate >= dateFrom;
        const matchesTo = !dateTo || connectedDate <= dateTo;
        return matchesFrom && matchesTo;
      })
    : patients;

  const isInitialLoading = isLoadingFacility || (isLoadingPatients && patients.length === 0);
  const isEmpty = !isInitialLoading && meta.total === 0 && !search && statusFilter === "all" && !dateFrom && !dateTo;

  const rangeStart = filteredByDate.length > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const rangeEnd = (meta.page - 1) * meta.limit + filteredByDate.length;

  const exportCsv = () => {
    const rows = [["Patient Name", "Tracmedy ID", "Hospital ID", "Status", "Connected Since"]];
    for (const record of filteredByDate) {
      rows.push([
        record.name ?? "",
        record.tracmedyPatientId || "--",
        record.externalPatientId || "N/A",
        formatStatus(record.status),
        formatDate(record.connectedAt),
      ]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "connected-patients.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#111827] md:text-2xl">Connected Patients</h1>
          <p className="mt-2 max-w-140 text-sm font-medium leading-6 text-[#71809B]">
            Manage and monitor active patient telemetry connections across clinical facilities.
          </p>
        </div>
        <Button className="h-11 w-full rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575] sm:w-auto">
          <UserPlus className="h-4 w-4" />
          Connect New Patient
        </Button>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="TOTAL CONNECTED"
          value={totalConnected.toLocaleString()}
          icon={Users}
          iconClassName="bg-[#E7F2FF] text-[#023E8A]"
          isLoading={isLoadingStats}
        />
        <StatCard
          label="NEW CONNECTIONS"
          value={String(newConnections)}
          note="Last 7 days"
          noteClassName="bg-[#DFFBF0] text-[#10B981]"
          icon={UserPlus}
          iconClassName="bg-[#E7F2FF] text-[#023E8A]"
          isLoading={isLoadingStats}
        />
        <StatCard
          label="DISCONNECTED"
          value={String(disconnectedTotal)}
          icon={UserX}
          iconClassName="bg-[#FFECEC] text-[#EF4444]"
          isLoading={isLoadingStats}
        />
      </section>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <CardContent className="p-4 sm:p-5 lg:p-6">
              <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full lg:max-w-91.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71809B]" />
                  <Input
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                    placeholder="Search by name, ID"
                    className="h-10 rounded-lg border-[#DDE3EC] bg-white pl-10 text-sm placeholder:text-[#71809B]"
                  />
                </div>
                <SelectFilter
                  value={statusFilter}
                  onChange={(value) => { setStatusFilter(value); setPage(1); }}
                  options={[
                    { label: "All Status", value: "all" },
                    { label: "Connected", value: "active" },
                    { label: "Disconnected", value: "inactive" },
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
                    <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-1/2 cursor-pointer" />
                    <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-1/2 cursor-pointer" />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={exportCsv}
                  className="h-10 gap-2 px-2 text-sm font-medium text-[#111827] hover:bg-[#F8FAFC] lg:ml-auto"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>

              <Table className="min-w-190">
                <TableHeader className="bg-[#EFF5FF]">
                  <TableRow className="border-0 hover:bg-[#EFF5FF]">
                    {["PATIENT NAME", "TRACMEDY ID", "HOSPITAL ID", "STATUS", "CONNECTED SINCE", "ACTION"].map((heading) => (
                      <TableHead key={heading} className="h-14 px-4 text-xs font-bold text-[#71809B] sm:px-6">
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPatients ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index} className="border-0 hover:bg-transparent">
                        <TableCell colSpan={6} className="px-4 py-5 sm:px-6">
                          <div className="h-5 w-full animate-pulse rounded bg-[#F3F4F6]" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    filteredByDate.map((record) => (
                      <TableRow key={record.patientId} className="border-0 hover:bg-transparent">
                        <TableCell className="px-4 py-5 font-bold text-[#111827] sm:px-6">{record.name || "Unknown Patient"}</TableCell>
                        <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{record.tracmedyPatientId || "--"}</TableCell>
                        <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{record.externalPatientId || "N/A"}</TableCell>
                        <TableCell className="px-4 py-5 sm:px-6">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                              record.status === "active" ? "bg-[#DFFBF0] text-[#10B981]" : "bg-[#FFECEC] text-[#EF4444]",
                            )}
                          >
                            {formatStatus(record.status)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-[#344054] sm:px-6">{formatDate(record.connectedAt)}</TableCell>
                        <TableCell className="px-4 py-5 sm:px-6">
                          <Link
                            href={`/dashboard/connected-patients/${encodeURIComponent(record.patientId)}`}
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#023E8A]"
                          >
                            <Eye className="h-4 w-4" />
                            View Profile
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {!isLoadingPatients && filteredByDate.length === 0 ? (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell colSpan={6} className="px-4 py-8 text-center text-sm font-medium text-[#71809B] sm:px-6">No connected patients found.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>

            <div className="flex flex-col items-center gap-4 border-t border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <p className="text-center text-xs font-medium text-[#71809B] sm:text-left sm:text-sm">
                Showing {rangeStart}-{rangeEnd} of {meta.total} Patients
              </p>
              <div className="flex max-w-full items-center gap-2 overflow-x-auto py-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  className="h-8 w-8 shrink-0 rounded-lg border-[#E5E7EB] text-[#71809B]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPaginationItems(meta.page, meta.totalPages).map((item, index) => (
                  typeof item === "number" ? (
                    <PageButton key={item} page={item} active={item === meta.page} onClick={() => setPage(item)} />
                  ) : (
                    <PageButton key={`${item}-${index}`} page={item.trim()} active={false} />
                  )
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage((current) => Math.min(current + 1, meta.totalPages))}
                  className="h-8 w-8 shrink-0 rounded-lg border-[#023E8A] text-[#023E8A]"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
