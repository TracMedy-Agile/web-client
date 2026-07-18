import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { CareEpisodeDetail } from "@/lib/api/care-episodes";

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
    dayProgress: null,
  };
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_COLORS = ["#023E8A", "#0F9D6C", "#B45309", "#7C3AED", "#B91C1C", "#0369A1"];

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
  if (value === "high") return { label: "High", className: "bg-[#FFECEC] text-[#EF4444]" };
  if (value === "medium") return { label: "Moderate", className: "bg-[#FFF4E5] text-[#F59E0B]" };
  if (value === "low") return { label: "Low", className: "bg-[#DFFBF0] text-[#10B981]" };
  return { label: "Unrated", className: "bg-[#F3F4F6] text-[#71809B]" };
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
    return { label: "Increase", className: "bg-[#DFFBF0] text-[#10B981]", Icon: ArrowUp };
  }
  if (value.includes("down") || value.includes("decreas") || value.includes("declin") || value.includes("worsen")) {
    return { label: "Decrease", className: "bg-[#FFECEC] text-[#EF4444]", Icon: ArrowDown };
  }
  return { label: "Stable", className: "bg-[#E7F2FF] text-[#023E8A]", Icon: Minus };
}

export type BiometricMetric = "Blood Pressure" | "Heart Rate" | "SpO2";
export type BiometricRange = "7d" | "14d" | "30d";

export type BiometricPoint = {
  date: string;
  value: number;
  abnormal: boolean;
};

export const BIOMETRIC_METRICS: { label: BiometricMetric; unit: string; base: number; spread: number }[] = [
  { label: "Blood Pressure", unit: "MMHG", base: 118, spread: 18 },
  { label: "Heart Rate", unit: "BPM", base: 78, spread: 14 },
  { label: "SpO2", unit: "%", base: 96, spread: 3 },
];

export const BIOMETRIC_RANGES: { key: BiometricRange; days: number }[] = [
  { key: "7d", days: 7 },
  { key: "14d", days: 14 },
  { key: "30d", days: 30 },
];

function seededRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

export function buildBiometricData(metric: BiometricMetric, range: BiometricRange, episodeId: string): BiometricPoint[] {
  const config = BIOMETRIC_METRICS.find((item) => item.label === metric) ?? BIOMETRIC_METRICS[0];
  const days = BIOMETRIC_RANGES.find((item) => item.key === range)?.days ?? 7;
  const seedBase = episodeId.length + metric.length + range.length;
  const points: BiometricPoint[] = [];
  const abnormalIndex = Math.floor(seededRandom(seedBase) * days);

  for (let index = 0; index < days; index += 1) {
    const noise = (seededRandom(seedBase + index * 3.17) - 0.5) * config.spread;
    const wave = Math.sin(index / 2.4) * (config.spread / 2.2);
    const value = Math.round(config.base + wave + noise);
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));

    points.push({
      date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date).toUpperCase(),
      value,
      abnormal: index === abnormalIndex,
    });
  }

  return points;
}
