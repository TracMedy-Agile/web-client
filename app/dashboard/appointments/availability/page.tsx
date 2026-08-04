"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AddClinicianScheduleModal from "../components/AddClinicianScheduleModal";
import AssignAppointmentDrawer from "../components/AssignAppointmentDrawer";
import ClinicianProfileDrawer from "../components/ClinicianProfileDrawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClinicians, getPendingUnassigned } from "@/lib/api/appointments";
import { cn } from "@/lib/utils";

type ApiRecord = Record<string, unknown>;

type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ClinicianRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  schedule: string;
  dailyCapacity: number;
  assignedAppointments: number;
  utilization: number;
  status: string;
};

type PendingAssignmentRow = {
  id: string;
  patient: string;
  type: string;
  department: string;
  requestedDate: string;
  priority: string;
  status: string;
};

type SystemAlert = {
  tone: string;
  icon: typeof AlertTriangle;
  message: string;
  className: string;
};

const fallbackMeta: Meta = { page: 1, limit: 5, total: 0, totalPages: 1 };

const utilizationClasses = {
  orange: { bar: "bg-amber-500", text: "text-amber-500" },
  red: { bar: "bg-red-500", text: "text-red-500" },
  green: { bar: "bg-emerald-500", text: "text-emerald-500" },
  gray: { bar: "bg-slate-400", text: "text-slate-500" },
} as const;

const statusClasses: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-600",
  near_capacity: "bg-amber-50 text-amber-600",
  full: "bg-red-50 text-red-500",
  unavailable: "bg-slate-100 text-slate-500",
  off_duty: "bg-slate-100 text-slate-500",
};

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function unwrapData(payload: unknown) {
  const record = asRecord(payload);
  return record?.data ?? payload;
}

function getItems(payload: unknown) {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const record = asRecord(data);
  if (!record) return [];

  for (const key of ["data", "items", "results", "clinicians", "appointments"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  return [];
}

function getMeta(payload: unknown): Meta {
  const root = asRecord(payload);
  const data = asRecord(unwrapData(payload));
  const meta = asRecord(root?.meta) ?? asRecord(data?.meta);

  return {
    page: getNumber(meta, ["page"], fallbackMeta.page),
    limit: getNumber(meta, ["limit"], fallbackMeta.limit),
    total: getNumber(meta, ["total"], fallbackMeta.total),
    totalPages: Math.max(getNumber(meta, ["totalPages"], fallbackMeta.totalPages), 1),
  };
}

function getString(record: ApiRecord | null, keys: string[], fallback = "") {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return fallback;
}

function getNumber(record: ApiRecord | null, keys: string[], fallback = 0) {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }

  return fallback;
}

function normalizeStatusKey(value: string) {
  return value.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function formatStatus(value: string) {
  const normalized = normalizeStatusKey(value);
  if (normalized === "near_capacity") return "Near Capacity";
  if (normalized === "off_duty") return "Off Duty";
  return normalized.split("_").filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ") || "Unavailable";
}

function formatType(value: string) {
  const normalized = value.toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("physical") || normalized.includes("person")) return "Physical visit";
  return value || "Physical visit";
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return value || "--";
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(parsed)) + ".";
}

function formatDoctorName(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  return cleaned ? `Dr. ${cleaned}` : "Dr. Unknown Clinician";
}

function formatSchedule(record: ApiRecord) {
  const schedule = asRecord(record.schedule);
  const scheduleText = getString(record, ["schedule"], "");
  if (scheduleText && !schedule) return scheduleText;

  const start = getString(schedule, ["workingHoursStart"], "");
  const end = getString(schedule, ["workingHoursEnd"], "");
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  return "Off Duty";
}

function normalizeClinician(record: ApiRecord): ClinicianRow {
  const status = normalizeStatusKey(getString(record, ["status"], "unavailable"));

  return {
    id: getString(record, ["id", "clinicianId", "_id"]),
    name: formatDoctorName(getString(record, ["name", "fullName", "displayName"], "Unknown Clinician")),
    email: getString(record, ["email"], ""),
    department: getString(record, ["department", "speciality", "specialty"], "--"),
    schedule: formatSchedule(record),
    dailyCapacity: getNumber(record, ["dailyCapacity"], 0),
    assignedAppointments: getNumber(record, ["assignedAppointments", "assignedToday"], 0),
    utilization: Math.min(Math.max(Math.round(getNumber(record, ["capacityUtilization", "utilizationPercentage"], 0)), 0), 100),
    status,
  };
}

function normalizePendingAssignment(record: ApiRecord): PendingAssignmentRow {
  const patient = asRecord(record.patient);
  const requestedDate = getString(record, ["date", "appointmentDate", "requestedDate", "scheduledDate", "startsAt", "startTime"]);

  return {
    id: getString(record, ["id", "appointmentId", "_id"]),
    patient: getString(record, ["patientName"], "") || getString(patient, ["name", "fullName"], "Unknown Patient"),
    type: formatType(getString(record, ["type", "appointmentType"], "Physical visit")),
    department: getString(record, ["department", "service"], "--"),
    requestedDate: formatDate(requestedDate),
    priority: normalizeStatusKey(getString(record, ["priority"], "normal")),
    status: normalizeStatusKey(getString(record, ["status"], "pending")),
  };
}

function getUtilizationTone(utilization: number): keyof typeof utilizationClasses {
  if (utilization < 50) return "green";
  if (utilization < 80) return "orange";
  return "red";
}

function buildSystemAlerts(clinicians: ClinicianRow[], unassignedTotal: number) {
  const nextAlerts: SystemAlert[] = [];

  if (unassignedTotal > 0) {
    nextAlerts.push({ tone: "critical", icon: AlertTriangle, message: `Critical: ${unassignedTotal} appointments require assignment`, className: "border-red-400 bg-red-50 text-red-500" });
  }

  for (const clinician of clinicians) {
    if (clinician.status === "full" || clinician.status === "unavailable") {
      nextAlerts.push({ tone: "critical", icon: AlertTriangle, message: `Critical: ${clinician.name} is unavailable today`, className: "border-red-400 bg-red-50 text-red-500" });
    }
    if (clinician.status === "near_capacity") {
      nextAlerts.push({ tone: "warning", icon: Info, message: `Warning: ${clinician.name} is near capacity (${clinician.utilization}% utilized)`, className: "border-amber-400 bg-amber-50 text-amber-500" });
    }
    if (clinician.dailyCapacity > 0 && clinician.assignedAppointments > clinician.dailyCapacity) {
      nextAlerts.push({ tone: "info", icon: Info, message: `Info: appointments assigned above capacity for ${clinician.name}`, className: "border-primary bg-primary/10 text-primary" });
    }
  }

  return nextAlerts.slice(0, 4);
}

function priorityClass(priority: string) {
  if (priority === "high") return "bg-red-50 text-red-500";
  if (priority === "normal") return "bg-primary/10 text-primary";
  return "bg-slate-100 text-slate-500";
}

async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-token");
    const { accessToken } = await res.json();
    return typeof accessToken === "string" ? accessToken : null;
  } catch {
    return null;
  }
}

async function fetchClinicianProfile(id: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clinicians/${encodeURIComponent(id)}`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (!response.ok) throw new Error("Failed to load clinician profile.");
  return response.json().catch(() => null);
}

function MetricCard({ metric }: { metric: { label: string; value: string; icon: typeof UsersRound; iconClass: string } }) {
  const Icon = metric.icon;

  return (
    <Card className="rounded-xl border-border bg-card shadow-sm">
      <CardContent className="flex min-h-25 items-start justify-between p-4 sm:min-h-31.5 sm:p-5">
        <div className="self-end">
          <p className="text-xs font-medium text-foreground/80 sm:text-sm">{metric.label}</p>
          <p className="mt-4 text-lg font-bold text-foreground sm:mt-6 sm:text-xl md:text-3xl">{metric.value}</p>
        </div>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9", metric.iconClass)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function SelectFilter({ value, onChange, options, compact = false }: { value: string; onChange: (value: string) => void; options: { label: string; value: string }[]; compact?: boolean }) {
  return (
    <div className={cn("relative", compact ? "w-full sm:w-32" : "w-full sm:w-37.5")}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-border bg-card px-4 pr-9 text-sm font-medium text-muted-foreground outline-none hover:bg-muted/30 focus:border-primary focus:ring-2 focus:ring-primary/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", priorityClass(priority))}>{formatStatus(priority)}</span>;
}

function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} className="border-0 hover:bg-transparent">
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column} className="px-3 py-5 sm:px-6">
              <div className="h-4 animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
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
        active ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-foreground hover:bg-muted",
      )}
    >
      {page}
    </Button>
  );
}

function getPaginationItems(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "... ", total];
}

export default function AvailabilityManagementPage() {
  const router = useRouter();
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [selectedClinicianId, setSelectedClinicianId] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [clinicians, setClinicians] = useState<ClinicianRow[]>([]);
  const [allClinicians, setAllClinicians] = useState<ClinicianRow[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignmentRow[]>([]);
  const [clinicianMeta, setClinicianMeta] = useState<Meta>(fallbackMeta);
  const [allClinicianMeta, setAllClinicianMeta] = useState<Meta>(fallbackMeta);
  const [pendingMeta, setPendingMeta] = useState<Meta>(fallbackMeta);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clinicianFilter, setClinicianFilter] = useState("all");
  const [clinicianPage, setClinicianPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingClinicians, setIsLoadingClinicians] = useState(true);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [cliniciansError, setCliniciansError] = useState("");
  const [pendingError, setPendingError] = useState("");



  const refreshAll = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    const refresh = () => refreshAll();
    window.addEventListener("clinicians:refresh", refresh);
    window.addEventListener("availability:refresh", refresh);
    return () => {
      window.removeEventListener("clinicians:refresh", refresh);
      window.removeEventListener("availability:refresh", refresh);
    };
  }, [refreshAll]);

  useEffect(() => {
    let ignore = false;

    const loadAllClinicians = async () => {
      try {
        const payload = await getClinicians({ page: 1, limit: 100 });
        if (!ignore) {
          setAllClinicians(getItems(payload).map(normalizeClinician));
          setAllClinicianMeta(getMeta(payload));
        }
      } catch {
        if (!ignore) {
          setAllClinicians([]);
          setAllClinicianMeta(fallbackMeta);
        }
      }
    };

    void Promise.resolve().then(loadAllClinicians);

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;

    const loadClinicians = async () => {
      setIsLoadingClinicians(true);
      setCliniciansError("");

      try {
        const payload = await getClinicians({
          q: search,
          status: statusFilter,
          page: clinicianPage,
          limit: 5,
        });

        if (ignore) return;
        const rows = getItems(payload).map(normalizeClinician);
        setClinicians(clinicianFilter === "all" ? rows : rows.filter((clinician) => clinician.id === clinicianFilter));
        setClinicianMeta(getMeta(payload));
      } catch (requestError) {
        if (!ignore) setCliniciansError(requestError instanceof Error ? requestError.message : "Failed to load clinicians.");
      } finally {
        if (!ignore) setIsLoadingClinicians(false);
      }
    };

    void Promise.resolve().then(loadClinicians);

    return () => {
      ignore = true;
    };
  }, [clinicianFilter, clinicianPage, refreshKey, search, statusFilter]);

  useEffect(() => {
    let ignore = false;

    const loadPendingAssignments = async () => {
      setIsLoadingPending(true);
      setPendingError("");

      try {
        const payload = await getPendingUnassigned({ page: 1, limit: 5 });

        if (ignore) return;
        setPendingAssignments(getItems(payload).map(normalizePendingAssignment));
        setPendingMeta(getMeta(payload));
      } catch (requestError) {
        if (!ignore) setPendingError(requestError instanceof Error ? requestError.message : "Failed to load pending assignments.");
      } finally {
        if (!ignore) setIsLoadingPending(false);
      }
    };

    void Promise.resolve().then(loadPendingAssignments);

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const metrics = useMemo(() => {
    const availableToday = allClinicians.filter((clinician) => clinician.status === "available").length;
    const nearCapacity = allClinicians.filter((clinician) => clinician.status === "near_capacity").length;

    return [
      { label: "Total Clinicians", value: String(allClinicianMeta.total), icon: UsersRound, iconClass: "bg-primary/10 text-primary" },
      { label: "Available Today", value: String(availableToday), icon: BadgeCheck, iconClass: "bg-primary/10 text-primary" },
      { label: "Near Capacity", value: String(nearCapacity), icon: AlertTriangle, iconClass: "bg-amber-50 text-amber-500" },
      { label: "Unassigned Appointments", value: String(pendingMeta.total), icon: CalendarDays, iconClass: "bg-primary/10 text-primary" },
    ];
  }, [allClinicianMeta.total, allClinicians, pendingMeta.total]);


  const systemAlerts = useMemo(() => buildSystemAlerts(allClinicians, pendingMeta.total), [allClinicians, pendingMeta.total]);
  const clinicianOptions = useMemo(() => [{ label: "All Clinicians", value: "all" }, ...allClinicians.map((clinician) => ({ label: clinician.name, value: clinician.id }))], [allClinicians]);
  const openClinicianProfile = useCallback(async (clinicianId: string) => {
    setSelectedClinicianId(clinicianId);
    setIsProfileDrawerOpen(true);

    try {
      await fetchClinicianProfile(clinicianId);
    } catch {
    }
  }, []);

  const openScheduleModal = (clinicianId?: string) => {
    if (clinicianId) {
      setSelectedClinicianId(clinicianId);
      void fetchClinicianProfile(clinicianId).catch(() => undefined);
    } else {
      setSelectedClinicianId("");
    }
    setIsScheduleModalOpen(true);
  };

  const openAssignDrawer = (appointmentId: string) => {
    if (!appointmentId) return;
    setSelectedAppointmentId(appointmentId);
    setIsAssignDrawerOpen(true);
  };

  const clinicianStart = clinicians.length > 0 ? (clinicianMeta.page - 1) * clinicianMeta.limit + 1 : 0;
  const clinicianEnd = (clinicianMeta.page - 1) * clinicianMeta.limit + clinicians.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Availability Management</h1>
          <p className="mt-1.5 max-w-[440px] text-sm font-medium leading-5 text-muted-foreground">
            Scheduling operations center, keep appointments continuous when clinician availability changes
          </p>
        </div>
        <Button
          onClick={() => openScheduleModal()}
          className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add Clinician Schedule
        </Button>
      </header>
   
    
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>
     

      <section className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">System Alerts</p>
          <div className="space-y-2">
            {systemAlerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <div
                  key={`${alert.tone}-${alert.message}`}
                  className={cn("flex min-h-16 items-center gap-3 rounded-xl border px-3 sm:min-h-18.5 sm:gap-4 sm:px-4", alert.className)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium leading-5">{alert.message}</p>
                </div>
              );
            })}
          </div>
        </div>

        <Card className="rounded-xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5">
            <CardTitle className="text-lg font-bold text-foreground">Pending Assignment Queue</CardTitle>
            <button type="button" onClick={() => router.push("/dashboard/appointments?status=pending")} className="text-sm font-bold text-primary">View All</button>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
            {pendingError ? <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"><span>{pendingError}</span><button type="button" onClick={refreshAll} className="text-primary">Retry</button></div> : null}
            <Table className="w-full table-fixed">
              <TableHeader className="bg-primary/5">
                <TableRow className="border-0 hover:bg-primary/5">
                  {["PATIENT NAME", "APPOINTMENT Type", "DEPARTMENT", "REQUESTED DATE", "PRIORITY", "STATUS", "ACTION"].map(
                    (heading) => (
                      <TableHead key={heading} className="h-14 px-3 text-xs font-bold text-muted-foreground">
                        {heading}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPending ? <TableSkeleton columns={7} rows={2} /> : null}
                {!isLoadingPending && pendingAssignments.map((row) => (
                  <TableRow key={row.id || row.patient} className="border-0 hover:bg-transparent">
                    <TableCell className="px-3 py-4 font-bold leading-5 text-foreground sm:py-6">{row.patient}</TableCell>
                    <TableCell className="px-3 py-4 text-foreground/80 sm:py-6">{row.type}</TableCell>
                    <TableCell className="px-3 py-4 text-foreground/80 sm:py-6">{row.department}</TableCell>
                    <TableCell className="px-3 py-4 font-bold text-foreground/80 sm:py-6">{row.requestedDate}</TableCell>
                    <TableCell className="px-3 py-4 sm:py-6">
                      <PriorityBadge priority={row.priority} />
                    </TableCell>
                    <TableCell className="px-3 py-4 sm:py-6">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Pending
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-4 sm:py-6">
                      <div className="flex gap-3 text-sm font-bold">
                        <button type="button" onClick={() => openAssignDrawer(row.id)} className="text-primary">
                          Assign
                        </button>
                        <button type="button" onClick={() => router.push(`/dashboard/appointments/${encodeURIComponent(row.id)}`)} className="text-muted-foreground">
                          View
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoadingPending && pendingAssignments.length === 0 ? (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={7} className="px-3 py-8 text-center text-sm font-medium text-muted-foreground">No pending assignments found.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-none border-0 bg-card shadow-none">
        <CardHeader className="border-b border-border p-4 sm:p-5 lg:p-6">
          <CardTitle className="text-lg font-bold text-foreground">Clinician Capacity &amp; Utilization</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 lg:p-6">
          <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative w-full xl:max-w-91.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setClinicianPage(1);
                }}
                placeholder="Search by name, ID, Department"
                className="h-10 rounded-lg border-border bg-card pl-10 text-sm placeholder:text-muted-foreground focus-visible:ring-primary/20"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <SelectFilter
                compact
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setClinicianPage(1);
                }}
                options={[
                  { label: "All Status", value: "all" },
                  { label: "Available", value: "available" },
                  { label: "Near Capacity", value: "near_capacity" },
                  { label: "Full", value: "full" },
                  { label: "Unavailable", value: "unavailable" },
                  { label: "Off Duty", value: "off_duty" },
                ]}
              />
              <SelectFilter value={clinicianFilter} onChange={(value) => { setClinicianFilter(value); setClinicianPage(1); }} options={clinicianOptions} />
            </div>
          </div>

          {cliniciansError ? <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"><span>{cliniciansError}</span><button type="button" onClick={refreshAll} className="text-primary">Retry</button></div> : null}
          <Table className="w-full table-fixed">
            <TableHeader className="bg-primary/5">
              <TableRow className="border-0 hover:bg-primary/5">
                {["CLINICIAN", "SPECIALITY", "SCHEDULE", "CAPACITY UTILIZATION", "STATUS", "ACTION"].map((heading) => (
                  <TableHead key={heading} className="h-14 px-4 text-xs font-bold text-muted-foreground sm:px-6">
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingClinicians ? <TableSkeleton columns={6} rows={5} /> : null}
              {!isLoadingClinicians && clinicians.map((clinician) => {
                const tone = getUtilizationTone(clinician.utilization);

                return (
                  <TableRow key={clinician.id || `${clinician.name}-${clinician.department}`} className="border-0 hover:bg-transparent">
                    <TableCell className="px-6 py-5 font-medium text-foreground/80">{clinician.name}</TableCell>
                    <TableCell className="px-6 py-5 text-foreground/80">{clinician.department}</TableCell>
                    <TableCell className="px-6 py-5 text-foreground/80">{clinician.schedule}</TableCell>
                    <TableCell className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", utilizationClasses[tone].bar)}
                            style={{ width: `${clinician.utilization}%` }}
                          />
                        </div>
                        <span className={cn("text-sm font-bold", utilizationClasses[tone].text)}>
                          {clinician.utilization}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", statusClasses[clinician.status] ?? statusClasses.unavailable)}>
                        {formatStatus(clinician.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <div className="flex gap-4 text-sm font-bold">
                        <button type="button" onClick={() => void openClinicianProfile(clinician.id)} className="text-primary">
                          View
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoadingClinicians && clinicians.length === 0 ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={6} className="px-6 py-8 text-center text-sm font-medium text-muted-foreground">No clinicians found.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex flex-col items-center gap-4 border-t border-border px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <p className="text-center text-xs font-medium text-muted-foreground sm:text-sm lg:text-left">
            Showing {clinicianStart}-{clinicianEnd} of {clinicianMeta.total} Clinicians
          </p>
          <div className="flex max-w-full items-center gap-2 overflow-x-auto py-1">
            <Button
              variant="outline"
              size="icon"
              disabled={clinicianPage <= 1 || isLoadingClinicians}
              onClick={() => setClinicianPage((page) => Math.max(page - 1, 1))}
              className="h-8 w-8 shrink-0 rounded-lg border-border text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {getPaginationItems(clinicianPage, clinicianMeta.totalPages).map((page, index) => (
              typeof page === "number" ? (
                <PageButton key={page} page={page} active={page === clinicianPage} onClick={() => setClinicianPage(page)} />
              ) : (
                <PageButton key={`${page}-${index}`} page={page.trim()} active={false} />
              )
            ))}
            <Button
              variant="outline"
              size="icon"
              disabled={clinicianPage >= clinicianMeta.totalPages || isLoadingClinicians}
              onClick={() => setClinicianPage((page) => Math.min(page + 1, clinicianMeta.totalPages))}
              className="h-8 w-8 shrink-0 rounded-lg border-primary text-primary"
            >
              {isLoadingClinicians ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>

      <AddClinicianScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => { setIsScheduleModalOpen(false); refreshAll(); }}
      />

      <ClinicianProfileDrawer
        isOpen={isProfileDrawerOpen}
        clinicianId={selectedClinicianId}
        onClose={() => {
          setIsProfileDrawerOpen(false);
          refreshAll();
        }}
      />

      <AssignAppointmentDrawer
        isOpen={isAssignDrawerOpen}
        appointmentId={selectedAppointmentId}
        onClose={() => { setIsAssignDrawerOpen(false); refreshAll(); }}
      />
    </div>
  );
}
