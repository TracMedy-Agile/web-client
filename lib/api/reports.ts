import type { components } from "@/docs/types/api";
import {
  getHospitalFacility,
  type HospitalFacility,
} from "@/lib/api/connected-patients";

type ApiAppointment = components["schemas"]["AppointmentResponseDto"];
type ApiCareEpisode = components["schemas"]["CareEpisodeSummaryDto"];
type ApiRecord = Record<string, unknown>;

export type WorkloadStatus = "Low" | "Moderate" | "High";

export type ReportsDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type ReportAppointment = {
  id: ApiAppointment["id"];
  facilityId: ApiAppointment["facilityId"];
  clinicianId: string;
  patientId: ApiAppointment["patientId"];
  type: string;
  status: string;
  date: string;
  department: string;
};

export type ReportAlert = {
  id: string;
  episodeId: string;
  facilityId: string;
  severity: string;
  status: string;
  createdAt: string;
  acknowledgedAt: string;
  acknowledgedById: string;
  acknowledgedByName: string;
};

export type ReportCareEpisode = {
  id: ApiCareEpisode["id"];
  patientId: ApiCareEpisode["patientId"];
  facilityId: ApiCareEpisode["facilityId"];
  clinicianId: string;
  diagnosis: string;
  status: string;
  riskCategory: string;
  closureReason: string;
  outcomeStatus: string;
  createdAt: string;
  closedAt: string;
};

export type ClinicianWorkload = {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  episodes: number;
  alerts: number;
  status: WorkloadStatus;
  responseTime: string;
  responseMinutes: number | null;
  capacityUtilization: number;
};

export type AlertPerformancePoint = {
  key: string;
  label: string;
  handled: number;
  responseMinutes: number | null;
};

export type ConsultationTrendPoint = {
  key: string;
  label: string;
  physical: number;
  teleconsultations: number;
};

export type ReportsSnapshot = {
  facility: HospitalFacility;
  range: ReportsDateRange;
  averageAlertResponseMinutes: number | null;
  previousAverageAlertResponseMinutes: number | null;
  appointmentCount: number;
  previousAppointmentCount: number;
  activeClinicianCount: number;
  alertPerformance: AlertPerformancePoint[];
  consultationTrend: ConsultationTrendPoint[];
  clinicians: ClinicianWorkload[];
  appointments: ReportAppointment[];
  alerts: ReportAlert[];
  careEpisodes: ReportCareEpisode[];
  hasClinicalData: boolean;
  warnings: string[];
};

const BASE = process.env.NEXT_PUBLIC_API_URL;
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ApiRecord
    : null;
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
  }
  return fallback;
}

function formatLocalDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, amount: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + amount);
  return formatLocalDate(date);
}

function differenceInDays(range: ReportsDateRange) {
  const milliseconds = parseLocalDate(range.dateTo).getTime() - parseLocalDate(range.dateFrom).getTime();
  return Math.max(1, Math.round(milliseconds / 86_400_000) + 1);
}

export function getReportsDateRange(days: number, dateTo = formatLocalDate(new Date())): ReportsDateRange {
  return {
    dateFrom: addDays(dateTo, -(Math.max(1, days) - 1)),
    dateTo,
  };
}

export function getPreviousReportsDateRange(range: ReportsDateRange): ReportsDateRange {
  const days = differenceInDays(range);
  const dateTo = addDays(range.dateFrom, -1);
  return getReportsDateRange(days, dateTo);
}

export function getExportDateRange(timeRange: string): ReportsDateRange {
  if (timeRange === "Last 7 days") return getReportsDateRange(7);
  if (timeRange === "Last 90 days") return getReportsDateRange(90);
  if (timeRange === "Last 12 months") return getReportsDateRange(365);
  return getReportsDateRange(30);
}

async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/get-token");
    const payload: unknown = await response.json();
    return getString(asRecord(payload), ["accessToken"]) || null;
  } catch {
    return null;
  }
}

async function request(path: string, query: URLSearchParams): Promise<unknown> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}${path}?${query.toString()}`, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = getString(asRecord(payload), ["message"], "Unable to load report data.");
    throw new Error(message);
  }

  return payload;
}

function parsePage(payload: unknown) {
  const root = asRecord(payload) ?? {};
  const rootData = root.data;
  const nested = asRecord(rootData);
  const body = Array.isArray(rootData) ? root : nested ?? root;
  const rawItems = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body.items)
      ? body.items
      : Array.isArray(rootData)
        ? rootData
        : [];
  const meta = asRecord(body.meta);

  return {
    items: rawItems.map(asRecord).filter((item): item is ApiRecord => Boolean(item)),
    totalPages: Math.min(
      MAX_PAGES,
      Math.max(1, getNumber(meta, ["totalPages"], getNumber(body, ["totalPages"], 1))),
    ),
  };
}

async function fetchAll(path: string, filters: Record<string, string | undefined>) {
  const makeQuery = (page: number) => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return query;
  };

  const firstPage = parsePage(await request(path, makeQuery(1)));
  if (firstPage.totalPages === 1) return firstPage.items;

  const remaining = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      request(path, makeQuery(index + 2)).then(parsePage),
    ),
  );
  return [firstPage, ...remaining].flatMap((page) => page.items);
}

function normalizeAppointment(record: ApiRecord): ReportAppointment {
  return {
    id: getString(record, ["id"]),
    facilityId: getString(record, ["facilityId"]),
    clinicianId: getString(record, ["clinicianId"]),
    patientId: getString(record, ["patientId"]),
    type: getString(record, ["type"], "in_person"),
    status: getString(record, ["status"], "pending"),
    date: getString(record, ["date"]),
    department: getString(record, ["department"], "Unassigned"),
  };
}

function normalizeClinician(record: ApiRecord) {
  return {
    id: getString(record, ["id"]),
    name: getString(record, ["name"], "Unnamed clinician"),
    specialty: getString(record, ["department"], "Unassigned"),
    backendStatus: getString(record, ["status"], "available"),
    capacityUtilization: getNumber(record, ["capacityUtilization"]),
  };
}

function normalizeAlert(record: ApiRecord): ReportAlert {
  const acknowledgedBy = asRecord(record.acknowledgedBy);
  return {
    id: getString(record, ["id"]),
    episodeId: getString(record, ["episodeId"]),
    facilityId: getString(record, ["facilityId"]),
    severity: getString(record, ["severity"], "low").toLowerCase(),
    status: getString(record, ["status"], "open").toLowerCase(),
    createdAt: getString(record, ["createdAt"]),
    acknowledgedAt: getString(record, [
      "acknowledgedAt",
      "acknowledgementTimestamp",
      "resolvedAt",
    ]),
    acknowledgedById:
      getString(acknowledgedBy, ["id", "clinicianId", "userId"]) ||
      getString(record, ["acknowledgedById", "clinicianId", "acknowledgedBy"]),
    acknowledgedByName:
      getString(acknowledgedBy, ["name", "clinicianName"]) ||
      getString(record, ["acknowledgedByName", "clinicianName"]),
  };
}

function normalizeCareEpisode(record: ApiRecord): ReportCareEpisode {
  return {
    id: getString(record, ["id"]),
    patientId: getString(record, ["patientId"]),
    facilityId: getString(record, ["facilityId"]),
    clinicianId: getString(record, ["clinicianId"]),
    diagnosis: getString(record, ["diagnosis"], "Not recorded"),
    status: getString(record, ["status"]),
    riskCategory: getString(record, ["riskCategory"], "Not recorded"),
    closureReason: getString(record, ["closureReason"], "Not recorded"),
    outcomeStatus: getString(record, ["outcomeStatus"], "Not recorded"),
    createdAt: getString(record, ["createdAt"]),
    closedAt: getString(record, ["closedAt", "updatedAt"]),
  };
}

function minutesBetween(start: string, end: string): number | null {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return Math.round((endTime - startTime) / 60_000);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function alertResponseMinutes(alert: ReportAlert) {
  return alert.acknowledgedAt ? minutesBetween(alert.createdAt, alert.acknowledgedAt) : null;
}

function formatResponseTime(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"}`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} hr${hours === 1 ? "" : "s"}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CL";
}

function getWorkloadStatus(
  backendStatus: string,
  capacityUtilization: number,
  episodes: number,
  alerts: number,
): WorkloadStatus {
  if (
    backendStatus === "full" ||
    backendStatus === "near_capacity" ||
    capacityUtilization >= 80 ||
    alerts >= 10
  ) return "High";
  if (capacityUtilization >= 50 || alerts >= 5 || episodes >= 10 || backendStatus === "covering") {
    return "Moderate";
  }
  return "Low";
}

function dateKey(value: string) {
  return value.length >= 10 ? value.slice(0, 10) : "";
}

function monthKey(value: string) {
  return value.length >= 7 ? value.slice(0, 7) : "";
}

function buildBuckets(range: ReportsDateRange) {
  const days = differenceInDays(range);
  if (days <= 62) {
    return Array.from({ length: days }, (_, index) => {
      const key = addDays(range.dateFrom, index);
      const date = parseLocalDate(key);
      return {
        key,
        label: days <= 7
          ? date.toLocaleDateString("en", { weekday: "short" })
          : `D${index + 1}`,
      };
    });
  }

  const start = parseLocalDate(range.dateFrom);
  const end = parseLocalDate(range.dateTo);
  const buckets: Array<{ key: string; label: string }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    buckets.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleDateString("en", { month: "short" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function buildAlertPerformance(alerts: ReportAlert[], range: ReportsDateRange): AlertPerformancePoint[] {
  const useMonths = differenceInDays(range) > 62;
  return buildBuckets(range).map((bucket) => {
    const matching = alerts.filter((alert) => {
      const timestamp = alert.acknowledgedAt || alert.createdAt;
      return (useMonths ? monthKey(timestamp) : dateKey(timestamp)) === bucket.key;
    });
    const responses = matching
      .map(alertResponseMinutes)
      .filter((value): value is number => value !== null);
    return {
      ...bucket,
      handled: matching.length,
      responseMinutes: average(responses),
    };
  });
}

function buildConsultationTrend(
  appointments: ReportAppointment[],
  range: ReportsDateRange,
): ConsultationTrendPoint[] {
  const useMonths = differenceInDays(range) > 62;
  return buildBuckets(range).map((bucket) => {
    const matching = appointments.filter((appointment) =>
      (useMonths ? monthKey(appointment.date) : dateKey(appointment.date)) === bucket.key
    );
    return {
      ...bucket,
      physical: matching.filter((appointment) => appointment.type === "in_person").length,
      teleconsultations: matching.filter((appointment) => appointment.type === "teleconsultation").length,
    };
  });
}

async function settleRecords(
  label: string,
  promise: Promise<ApiRecord[]>,
  warnings: string[],
) {
  try {
    return await promise;
  } catch (error) {
    warnings.push(`${label}: ${error instanceof Error ? error.message : "Unavailable"}`);
    return [];
  }
}

export async function getReportsSnapshot(range: ReportsDateRange): Promise<ReportsSnapshot> {
  const facility = await getHospitalFacility();
  if (!facility.id) throw new Error("Unable to determine your facility. Please sign in again.");

  const previousRange = getPreviousReportsDateRange(range);
  const warnings: string[] = [];
  const [
    clinicianRecords,
    appointmentRecords,
    previousAppointmentRecords,
    alertHistoryRecords,
    previousAlertHistoryRecords,
    openAlertRecords,
    careEpisodeRecords,
  ] = await Promise.all([
    settleRecords("Clinicians", fetchAll("/clinicians", {}), warnings),
    settleRecords("Appointments", fetchAll("/appointments", {
      facilityId: facility.id,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    }), warnings),
    settleRecords("Previous appointments", fetchAll("/appointments", {
      facilityId: facility.id,
      dateFrom: previousRange.dateFrom,
      dateTo: previousRange.dateTo,
    }), warnings),
    settleRecords("Alert history", fetchAll("/alerts/history", {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    }), warnings),
    settleRecords("Previous alert history", fetchAll("/alerts/history", {
      dateFrom: previousRange.dateFrom,
      dateTo: previousRange.dateTo,
    }), warnings),
    settleRecords("Open alerts", fetchAll("/alerts", { status: "open" }), warnings),
    settleRecords("Care episodes", fetchAll("/care-episodes", {
      facilityId: facility.id,
    }), warnings),
  ]);

  const appointments = appointmentRecords
    .map(normalizeAppointment)
    .filter((appointment) => appointment.id && appointment.facilityId === facility.id);
  const previousAppointments = previousAppointmentRecords
    .map(normalizeAppointment)
    .filter((appointment) => appointment.id && appointment.facilityId === facility.id);
  const careEpisodes = careEpisodeRecords
    .map(normalizeCareEpisode)
    .filter((episode) => episode.id && episode.facilityId === facility.id);
  const episodesById = new Map(careEpisodes.map((episode) => [episode.id, episode]));
  const isFacilityAlert = (alert: ReportAlert) =>
    alert.facilityId === facility.id || Boolean(alert.episodeId && episodesById.has(alert.episodeId));
  const alerts = alertHistoryRecords.map(normalizeAlert).filter((alert) => alert.id && isFacilityAlert(alert));
  const previousAlerts = previousAlertHistoryRecords
    .map(normalizeAlert)
    .filter((alert) => alert.id && isFacilityAlert(alert));
  const openAlerts = openAlertRecords
    .map(normalizeAlert)
    .filter((alert) => alert.id && isFacilityAlert(alert));
  const clinicians = clinicianRecords.map(normalizeClinician).filter((clinician) => clinician.id);

  const currentResponseMinutes = alerts
    .map(alertResponseMinutes)
    .filter((value): value is number => value !== null);
  const previousResponseMinutes = previousAlerts
    .map(alertResponseMinutes)
    .filter((value): value is number => value !== null);

  const workload = clinicians.map((clinician): ClinicianWorkload => {
    const clinicianEpisodes = careEpisodes.filter(
      (episode) => episode.status === "active" && episode.clinicianId === clinician.id,
    );
    const clinicianAlerts = openAlerts.filter((alert) => {
      const episode = episodesById.get(alert.episodeId);
      return alert.acknowledgedById === clinician.id || episode?.clinicianId === clinician.id;
    });
    const clinicianResponses = alerts
      .filter((alert) => {
        const episode = episodesById.get(alert.episodeId);
        return alert.acknowledgedById === clinician.id || episode?.clinicianId === clinician.id;
      })
      .map(alertResponseMinutes)
      .filter((value): value is number => value !== null);
    const responseMinutes = average(clinicianResponses);
    return {
      id: clinician.id,
      name: clinician.name,
      initials: getInitials(clinician.name),
      specialty: clinician.specialty,
      episodes: clinicianEpisodes.length,
      alerts: clinicianAlerts.length,
      status: getWorkloadStatus(
        clinician.backendStatus,
        clinician.capacityUtilization,
        clinicianEpisodes.length,
        clinicianAlerts.length,
      ),
      responseTime: formatResponseTime(responseMinutes),
      responseMinutes,
      capacityUtilization: clinician.capacityUtilization,
    };
  });

  return {
    facility,
    range,
    averageAlertResponseMinutes: average(currentResponseMinutes),
    previousAverageAlertResponseMinutes: average(previousResponseMinutes),
    appointmentCount: appointments.length,
    previousAppointmentCount: previousAppointments.length,
    activeClinicianCount: clinicians.filter(
      (clinician) => !["off_duty", "unavailable"].includes(clinician.backendStatus),
    ).length,
    alertPerformance: buildAlertPerformance(alerts, range),
    consultationTrend: buildConsultationTrend(appointments, range),
    clinicians: workload,
    appointments,
    alerts,
    careEpisodes,
    hasClinicalData:
      appointments.length > 0 ||
      alerts.length > 0 ||
      openAlerts.length > 0 ||
      careEpisodes.length > 0,
    warnings,
  };
}
