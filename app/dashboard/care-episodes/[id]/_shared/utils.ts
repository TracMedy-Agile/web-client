import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { getRecordArray, getString, type ApiRecord, type CareEpisodeDetail, type DailyVitalsRecord } from "@/lib/api/care-episodes";

export function createPlaceholderEpisode(episodeId: string): CareEpisodeDetail {
  return {
    id: episodeId,
    patientId: "",
    facilityId: "",
    clinicianId: "",
    diagnosis: "",
    status: "",
    carePhase: null,
    dayStart: null,
    expectedDurationDays: null,
    riskScore: null,
    riskCategory: null,
    riskTrend: null,
    closureReason: null,
    outcomeStatus: null,
    encounterType: null,
    conditionSeverity: null,
    createdAt: "",
    updatedAt: "",
    currentCarePlan: null,
    patient: null,
    careTeam: [],
    latestCheckin: null,
    recentTimeline: [],
    riskData: null,
    riskHistory: [],
    dayProgress: null,
    facility: null,
    closure: null,
  };
}


export type SavedWarningSign = {
  id: string;
  title: string;
  detail: string;
  response: string;
  severity: string;
  threshold: string;
};

function thresholdLabel(record: ApiRecord) {
  const min = typeof record.min === "number" ? record.min : null;
  const max = typeof record.max === "number" ? record.max : null;
  if (min !== null && max !== null) return `${min} - ${max}`;
  if (min !== null) return `Below ${min}`;
  if (max !== null) return `Above ${max}`;
  return "No threshold supplied";
}

export function getSavedWarningSignsFromPlan(carePlan: ApiRecord | null): SavedWarningSign[] {
  const warningSigns = getRecordArray(carePlan, ["warningSigns"]);
  const source = warningSigns.length > 0
    ? warningSigns
    : getRecordArray(carePlan, ["monitoringRules"]).filter((rule) => getString(rule, ["warningMessage"]));

  return source.map((warning, index) => {
    const metric = getString(warning, ["metric", "type"], "warning sign");
    const message = getString(warning, ["warningMessage", "message", "title"]);
    return {
      id: getString(warning, ["carePlanRuleId", "id", "taskId"], `warning-${index}`),
      title: message || `${humanizeSlug(metric)} warning`,
      detail: humanizeSlug(metric),
      response: getString(warning, ["responseInstruction", "response", "instructions"]),
      severity: getString(warning, ["severity"], "warning"),
      threshold: thresholdLabel(warning),
    };
  });
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_COLORS = ["var(--color-primary)", "var(--color-emerald-600)", "var(--color-amber-700)", "var(--color-violet-600)", "var(--color-red-700)", "var(--color-sky-700)"];

export function getAvatarColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getProgressPercent(dayStart: number | null, expectedDurationDays: number | null) {
  if (!dayStart || !expectedDurationDays) return 0;
  return clamp(Math.round((dayStart / expectedDurationDays) * 100));
}

export function getHeaderRiskBadge(riskCategory: string | null) {
  const value = (riskCategory ?? "").toLowerCase();
  if (value === "high") return { label: "High", className: "bg-red-50 text-red-500" };
  if (value === "medium") return { label: "Moderate", className: "bg-amber-50 text-amber-500" };
  if (value === "low") return { label: "Low", className: "bg-emerald-50 text-emerald-500" };
  return { label: "Unrated", className: "bg-slate-100 text-slate-500" };
}

export function formatLongDate(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

export function formatTime(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(parsed));
}

export function formatRelativeTime(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "recently";
  const diffMs = Date.now() - parsed;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function humanizeSlug(value: string) {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getTrendMeta(trend: string | null) {
  const value = (trend ?? "").toLowerCase();
  if (value.includes("up") || value.includes("increas") || value.includes("improv")) {
    return { label: "Increase", className: "bg-emerald-50 text-emerald-500", Icon: ArrowUp };
  }
  if (value.includes("down") || value.includes("decreas") || value.includes("declin") || value.includes("worsen")) {
    return { label: "Decrease", className: "bg-red-50 text-red-500", Icon: ArrowDown };
  }
  return { label: "Stable", className: "bg-blue-50 text-primary", Icon: Minus };
}

export type BiometricMetric = "Blood Pressure" | "Heart Rate" | "SpO2" | "Temperature" | "Weight" | "Blood Sugar";
export type BiometricRange = "7d" | "14d" | "30d";

export type BiometricPoint = {
  date: string;
  value: number;
  abnormal: boolean;
};

export const BIOMETRIC_METRICS: { label: BiometricMetric; unit: string }[] = [
  { label: "Blood Pressure", unit: "MMHG" },
  { label: "Heart Rate", unit: "BPM" },
  { label: "SpO2", unit: "%" },
  { label: "Temperature", unit: "DEG C" },
  { label: "Weight", unit: "KG" },
  { label: "Blood Sugar", unit: "MG/DL" },
];

export const BIOMETRIC_RANGES: { key: BiometricRange; days: number }[] = [
  { key: "7d", days: 7 },
  { key: "14d", days: 14 },
  { key: "30d", days: 30 },
];

export function buildBiometricData(metric: BiometricMetric, records: DailyVitalsRecord[]): BiometricPoint[] {
  return records.flatMap((record) => {
    let value: number | null = null;
    let abnormal = false;

    if (metric === "Blood Pressure") {
      value = record.vitals.bloodPressureSystolic;
      abnormal = value !== null && (value < 90 || value >= 130);
    } else if (metric === "Heart Rate") {
      value = record.vitals.heartRate;
      abnormal = value !== null && (value < 60 || value > 100);
    } else if (metric === "SpO2") {
      value = record.vitals.spo2;
      abnormal = value !== null && value < 95;
    } else if (metric === "Temperature") {
      value = record.vitals.temperature;
      abnormal = value !== null && (value < 36.1 || value > 37.5);
    } else if (metric === "Weight") {
      value = record.vitals.weight;
      abnormal = false;
    } else {
      value = record.vitals.bloodSugar;
      abnormal = value !== null && (value < 70 || value > 140);
    }

    if (!record.hasEntry || value === null) return [];
    const parsed = Date.parse(record.date);
    const date = Number.isFinite(parsed)
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(parsed)).toUpperCase()
      : record.date;
    return [{ date, value, abnormal }];
  });
}
