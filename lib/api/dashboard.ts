import type { components } from "@/docs/types/api";
import type { LiveAlert } from "@/components/dashboard/LiveAlerts";
import type { ClinicianWorkload as DashboardClinicianWorkload } from "@/components/dashboard/WorkloadStatus";
import { getAlertsSnapshot } from "@/lib/api/alerts";
import { getReportsDateRange, getReportsSnapshot } from "@/lib/api/reports";
import { apiClient } from "@/lib/services/auth/api-client";

type FacilityForecastSummary = components["schemas"]["FacilityForecastSummaryDto"];

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

export async function getDashboardLiveAlerts(limit = 3): Promise<LiveAlert[]> {
  const snapshot = await getAlertsSnapshot();
  return snapshot.active.slice(0, limit).map((alert) => ({
    id: alert.id,
    patientName: alert.patientName,
    severity: alert.severity === "critical" ? "critical" : "moderate",
    description: alert.reason,
    time: relativeTime(alert.timestamp),
    actionLabel: alert.severity === "critical" ? "Review" : "View Details",
  }));
}

function normalizeLoad(value: string): DashboardClinicianWorkload["load"] {
  const normalized = value.toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "moderate") return "moderate";
  return "low";
}

export async function getDashboardClinicianWorkload(limit = 4): Promise<DashboardClinicianWorkload[]> {
  const snapshot = await getReportsSnapshot(getReportsDateRange(30));
  return snapshot.clinicians.slice(0, limit).map((clinician) => ({
    id: clinician.id,
    name: clinician.name,
    load: normalizeLoad(clinician.status),
    episodes: clinician.episodes,
    alerts: clinician.alerts,
    avgMinutes: clinician.responseMinutes ?? 0,
  }));
}
