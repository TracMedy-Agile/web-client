import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { getAppointments } from "@/lib/api/appointments";
import { cn } from "@/lib/utils";
import type { AppointmentListFilters } from "./AppointmentFilters";
import AppointmentEmptyState from "./AppointmentEmptyState";

type AppointmentStatus = "Confirmed" | "Pending" | "Canceled" | "Rescheduled" | "No Shows";

type Appointment = {
  patientName: string;
  id: string;
  routeId: string;
  date: string;
  time: string;
  type: string;
  department: string;
  service: string;
  status: AppointmentStatus;
};

type AppointmentTableProps = {
  filters: AppointmentListFilters;
  refreshKey?: number;
  exportRequestKey?: number;
};

type AppointmentRecord = Record<string, unknown>;

const PAGE_LIMIT = 20;

const statusStyles: Record<AppointmentStatus, string> = {
  Confirmed: "text-emerald-500 before:bg-emerald-500",
  Pending: "text-amber-500 before:bg-amber-500",
  Canceled: "text-red-500 before:bg-red-500",
  Rescheduled: "text-[#344054] before:bg-[#344054]",
  "No Shows": "text-[#7A8BA6] before:bg-[#7A8BA6]",
};

function asRecord(value: unknown): AppointmentRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AppointmentRecord : null;
}

function getString(record: AppointmentRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return fallback;
}

function getNestedString(record: AppointmentRecord, parentKey: string, keys: string[], fallback = "") {
  const parent = asRecord(record[parentKey]);
  return parent ? getString(parent, keys, fallback) : fallback;
}

function formatDate(value: string) {
  if (!value) return "--";

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

function minutesToDisplayTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")}${period}`;
}

function formatTime(value: string) {
  if (!value) return "--";

  const parsed = Date.parse(value);
  if (value.includes("T") && Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return minutesToDisplayTime(date.getHours() * 60 + date.getMinutes());
  }

  const timeMatch = value.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const [, rawHour, rawMinute] = timeMatch;
    return minutesToDisplayTime(Number(rawHour) * 60 + Number(rawMinute));
  }

  return value;
}

function mapType(type: string) {
  const normalized = type.toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("tele")) return "Teleconsultation";
  if (normalized.includes("nurse")) return "Nurse Check-in";
  return "Physical Visit";
}

function mapStatus(status: string): AppointmentStatus {
  const normalized = status.toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("cancel")) return "Canceled";
  if (normalized.includes("rescheduled")) return "Rescheduled";
  if (normalized.includes("no show")) return "No Shows";
  if (normalized.includes("pending")) return "Pending";
  return "Confirmed";
}

function getAppointmentItems(payload: unknown): AppointmentRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));

  const record = asRecord(payload);
  if (!record) return [];

  if (Array.isArray(record.data)) return record.data.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));

  const data = asRecord(record.data);
  if (data) {
    if (Array.isArray(data.appointments)) return data.appointments.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));
    if (Array.isArray(data.items)) return data.items.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));
    if (Array.isArray(data.results)) return data.results.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));
  }

  if (Array.isArray(record.appointments)) return record.appointments.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));
  if (Array.isArray(record.items)) return record.items.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));
  if (Array.isArray(record.results)) return record.results.filter((item): item is AppointmentRecord => Boolean(asRecord(item)));

  return [];
}

function getNumberFromPayload(payload: unknown, keys: string[]) {
  const record = asRecord(payload);
  const data = record ? asRecord(record.data) : null;
  const records = [
    record,
    data,
    record ? asRecord(record.meta) : null,
    record ? asRecord(record.pagination) : null,
    data ? asRecord(data.meta) : null,
    data ? asRecord(data.pagination) : null,
  ];

  for (const key of keys) {
    for (const candidateRecord of records) {
      const value = candidateRecord?.[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }

  return null;
}

function getTotalCount(payload: unknown, fallback: number) {
  return getNumberFromPayload(payload, ["total", "totalCount", "count"]) ?? fallback;
}

function getTotalPages(payload: unknown, totalCount: number, limit: number) {
  return getNumberFromPayload(payload, ["totalPages", "pageCount", "pages", "lastPage"]) ?? Math.max(1, Math.ceil(totalCount / limit));
}

function normalizeAppointment(record: AppointmentRecord): Appointment {
  const date = getString(record, ["date", "appointmentDate", "scheduledDate", "startsAt", "startTime", "createdAt"]);
  const time = getString(record, ["time", "appointmentTime", "scheduledTime", "startsAt", "startTime"]);
  const type = getString(record, ["type", "appointmentType"], "in_person");
  const patientName = getString(record, ["patientName", "patient"], "") || getNestedString(record, "patient", ["name", "fullName"]);
  const department = getString(record, ["department", "location"], "") || getNestedString(record, "department", ["name"]);
  const service = getString(record, ["service", "reason"], "") || getNestedString(record, "service", ["name"]);

  return {
    patientName: patientName || "Unknown Patient",
    id: getString(record, ["appointmentId", "code", "id"], "--"),
    routeId: getString(record, ["id", "appointmentId", "code"], "--"),
    date: formatDate(date),
    time: formatTime(time),
    type: mapType(type),
    department: department || "Unassigned",
    service: service || "--",
    status: mapStatus(getString(record, ["status"], "confirmed")),
  };
}

function AppointmentTableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 5 }, (_, index) => (
        <tr key={index} className="text-sm text-[#344054]">
          {Array.from({ length: 7 }, (_item, cellIndex) => (
            <td key={cellIndex} className="px-6 py-4">
              <div className="h-4 w-full max-w-[150px] animate-pulse rounded bg-[#EEF2F7]" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function escapeCsvValue(value: string) {
  return '"' + value.replace(/"/g, '""') + '"';
}

function downloadAppointmentsCsv(appointments: Appointment[]) {
  const headers = ["Patient Name", "Appointment ID", "Date", "Time", "Appointment Type", "Department", "Service", "Status"];
  const rows = appointments.map((appointment) => [
    appointment.patientName,
    appointment.id,
    appointment.date,
    appointment.time,
    appointment.type,
    appointment.department,
    appointment.service,
    appointment.status,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "appointments.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AppointmentTable({ filters, refreshKey = 0, exportRequestKey = 0 }: AppointmentTableProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadAppointments = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError("");

    try {
      const payload = await getAppointments({
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        facilityId: filters.facilityId,
        search: filters.search,
        department: filters.department,
        type: filters.type,
        page,
        limit: PAGE_LIMIT,
      });
      const items = getAppointmentItems(payload);
      const normalizedAppointments = items.map(normalizeAppointment);
      const nextTotalCount = getTotalCount(payload, normalizedAppointments.length);
      const nextPageCount = getTotalPages(payload, nextTotalCount, PAGE_LIMIT);

      if (requestIdRef.current === requestId) {
        setAppointments(normalizedAppointments);
        setTotalCount(nextTotalCount);
        setPageCount(nextPageCount);
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setAppointments([]);
        setTotalCount(0);
        setPageCount(1);
        setError("Failed to load appointments. Please try again.");
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [filters, page]);


  useEffect(() => {
    void Promise.resolve().then(loadAppointments);
  }, [loadAppointments, refreshKey]);

  useEffect(() => {
    if (exportRequestKey > 0) {
      downloadAppointmentsCsv(appointments);
    }
  }, [appointments, exportRequestKey]);

  if (!isLoading && !error && totalCount === 0) {
    return <AppointmentEmptyState onRefresh={() => loadAppointments()} />;
  }

  const totalPages = Math.max(1, pageCount);
  const startItem = totalCount === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(startItem + appointments.length - 1, totalCount);

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="bg-[#EEF4FF] text-xs font-semibold uppercase text-[#71809B]">
              <th className="rounded-l-sm px-4 sm:px-6 py-4">Patient Name</th>
              <th className="px-6 py-4">Appointment ID</th>
              <th className="px-6 py-4">Date &amp; Time</th>
              <th className="px-6 py-4">Appointment Type</th>
              <th className="px-6 py-4">Department / Service</th>
              <th className="px-6 py-4">Status</th>
              <th className="rounded-r-sm px-4 sm:px-6 py-4">Action</th>
            </tr>
          </thead>
          {isLoading ? (
            <AppointmentTableSkeleton />
          ) : (
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="text-sm text-[#344054]">
                  <td className="px-6 py-3 font-semibold text-[#111827]">{appointment.patientName}</td>
                  <td className="px-6 py-3 font-medium text-[#344054]">{appointment.id}</td>
                  <td className="px-6 py-3">
                    <p className="font-bold">{appointment.date}</p>
                    <p>{appointment.time}</p>
                  </td>
                  <td className="px-6 py-3 font-medium">{appointment.type}</td>
                  <td className="px-6 py-3">
                    <p className="font-semibold">{appointment.department}</p>
                    <p className="font-medium text-[#71809B]">{appointment.service}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:content-['']",
                        statusStyles[appointment.status],
                      )}
                    >
                      {appointment.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/dashboard/appointments/${encodeURIComponent(appointment.routeId)}`} className="flex items-center gap-1.5 text-sm font-bold text-primary">
                      <Eye className="h-5 w-5" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      <div className="mt-8 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-[#71809B]">Showing {startItem}-{endItem} of {totalCount} Appointments</p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page === 1 || isLoading}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-[#CBD5E1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary px-2 text-sm font-bold text-white">
            {page}
          </button>
          <span className="flex h-8 items-center justify-center px-2 text-sm font-semibold text-[#111827]">
            of {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}















