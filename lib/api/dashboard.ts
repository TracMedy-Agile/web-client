import type { components } from "@/docs/types/api";
import type { LiveAlert } from "@/components/dashboard/LiveAlerts";
import type { RecoveryTrendPoint } from "@/components/dashboard/RecoveryTrend";
import type { ClinicianWorkload as DashboardClinicianWorkload } from "@/components/dashboard/WorkloadStatus";
import { getAlertsSnapshot } from "@/lib/api/alerts";
import { getCareEpisodes } from "@/lib/api/care-episodes";
import { getReportsDateRange, getReportsSnapshot, type ReportsDateRange } from "@/lib/api/reports";
import { sharedRequest } from "@/lib/api/request-cache";
import { apiClient } from "@/lib/services/auth/api-client";

// The dashboard's metric cards and panels load the same heavy bundles on the same 60s cycle;
// sharing them for a few seconds collapses the duplicate fan-out into one set of requests.
const DASHBOARD_SHARE_MS = 15_000;

export function getDashboardAlertsSnapshot() {
  return sharedRequest("dashboard:alerts", DASHBOARD_SHARE_MS, getAlertsSnapshot);
}

export function getDashboardReportsSnapshot(range: ReportsDateRange = getReportsDateRange(30)) {
  return sharedRequest(`dashboard:reports:${range.dateFrom}:${range.dateTo}`, DASHBOARD_SHARE_MS, () => getReportsSnapshot(range));
}

export function getDashboardEpisodes() {
  return sharedRequest("dashboard:episodes", DASHBOARD_SHARE_MS, () => getCareEpisodes({ page: 1, limit: 500 }));
}

type FacilityForecastSummary = components["schemas"]["FacilityForecastSummaryDto"];
type FacilityRecoveryTrend = components["schemas"]["FacilityRecoveryTrendDto"];
export type DashboardRecoveryTrendRange = FacilityRecoveryTrend["range"];

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function unwrapData(value: unknown): unknown {
  let current = value;
  for (let index = 0; index < 2; index += 1) {
    const record = asRecord(current);
    if (!record || !("data" in record)) break;
    current = record.data;
  }
  return current;
}

async function readJson(response: Response, fallbackMessage: string): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = asRecord(payload)?.message;
    throw new Error(typeof message === "string" ? message : fallbackMessage);
  }
  return unwrapData(payload);
}

export async function getFacilityForecastSummary(): Promise<FacilityForecastSummary> {
  const response = await apiClient("/forecasts/facility/summary", { cache: "no-store" });
  const payload = await readJson(response, "Unable to load facility forecast summary.");
  if (!asRecord(payload)) throw new Error("The facility forecast summary response was invalid.");
  return payload as FacilityForecastSummary;
}
export async function getDashboardRecoveryTrend(range: DashboardRecoveryTrendRange = "7d"): Promise<RecoveryTrendPoint[]> {
  const query = new URLSearchParams({ range });
  const response = await apiClient(`/forecasts/facility/recovery-trend?${query.toString()}`, { cache: "no-store" });
  const payload = await readJson(response, "Unable to load facility recovery trend.");
  const trend = asRecord(payload) ? payload as FacilityRecoveryTrend : null;
  return trend?.points?.map((point) => ({
    day: point.day,
    active: point.active,
    mean: point.mean,
  })) ?? [];
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function getDashboardLiveAlerts(limit = 6, clinicianId?: string): Promise<LiveAlert[]> {
  const snapshot = await getDashboardAlertsSnapshot();
  let activeAlerts = snapshot.active;
  if (clinicianId) {
    const episodes = await getDashboardEpisodes().catch(() => null);
    if (!episodes) return [];
    const assignedEpisodeIds = new Set(episodes.data.filter((episode) => episode.clinicianId === clinicianId).map((episode) => episode.id));
    activeAlerts = activeAlerts.filter((alert) => assignedEpisodeIds.has(alert.episodeId));
  }
  return activeAlerts.slice(0, limit).map((alert) => ({
    id: alert.id,
    patientName: alert.patientName,
    severity: alert.severity === "critical" ? "critical" : "moderate",
    description: alert.reason,
    time: relativeTime(alert.timestamp),
    actionLabel: alert.severity === "critical" ? "Review" : "View Details",
    episodeId: alert.episodeId,
    triggerSource: alert.triggerSource,
    clinicalAlert: alert,
  }));
}

function normalizeLoad(value: string): DashboardClinicianWorkload["load"] {
  const normalized = value.toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "moderate") return "moderate";
  return "low";
}

export async function getDashboardClinicianWorkload(limit = 4, clinicianId?: string, clinicianName?: string): Promise<DashboardClinicianWorkload[]> {
  try {
    const snapshot = await getDashboardReportsSnapshot();
    const clinicians = clinicianId ? snapshot.clinicians.filter((clinician) => clinician.id === clinicianId) : snapshot.clinicians;
    if (clinicians.length > 0 || !clinicianId) {
      return clinicians.slice(0, limit).map((clinician) => ({
        id: clinician.id,
        name: clinician.name,
        load: normalizeLoad(clinician.status),
        episodes: clinician.episodes,
        alerts: clinician.alerts,
        avgMinutes: clinician.responseMinutes ?? 0,
      }));
    }
  } catch {
    if (!clinicianId) throw new Error("Unable to load clinician workload.");
  }

  if (!clinicianId) return [];
  const [episodes, alerts] = await Promise.all([
    getDashboardEpisodes().catch(() => null),
    getDashboardAlertsSnapshot().catch(() => null),
  ]);
  const assignedEpisodes = episodes?.data.filter((episode) => episode.clinicianId === clinicianId && episode.status.toLowerCase() === "active") ?? [];
  const assignedEpisodeIds = new Set(assignedEpisodes.map((episode) => episode.id));
  const openAlertCount = alerts?.active.filter((alert) => assignedEpisodeIds.has(alert.episodeId)).length ?? 0;
  const load = openAlertCount >= 3 || assignedEpisodes.length >= 10 ? "high" : openAlertCount > 0 || assignedEpisodes.length >= 5 ? "moderate" : "low";
  return [{
    id: clinicianId,
    name: clinicianName || "Current clinician",
    load,
    episodes: assignedEpisodes.length,
    alerts: openAlertCount,
    avgMinutes: 0,
  }];
}
