"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Mail,
  Minus,
  Phone,
  Pill,
  Stethoscope,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  asRecord,
  closeCareEpisode,
  buildDailyVitalsFromCheckins,
  getCareEpisodeById,
  getCareEpisodeCheckins,
  getCareEpisodeDailyVitals,
  getCareEpisodeForecast,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeTaskCompletion,
  getCareEpisodeTaskCompletionLog,
  getCareEpisodeTimelinePage,
  getNumber,
  getString,
  type ApiRecord,
  type CareEpisodeDetail,
  type CheckInHistoryRecord,
  type DailyVitalsRecord,
  type EpisodeForecast,
  type MedicationAdherenceRecord,
  type TaskCompletionLog,
  type TaskCompletionRecord,
} from "@/lib/api/care-episodes";
import {
  BIOMETRIC_METRICS,
  BIOMETRIC_RANGES,
  buildBiometricData,
  formatLongDate,
  formatTime,
  humanizeSlug,
  type BiometricMetric,
  type BiometricPoint,
  type BiometricRange,
} from "./_shared/utils";
import { CloseCareEpisodeModal, type CloseCareEpisodePayload, type EpisodeOutcomeSummary } from "./components/CloseCareEpisodeModal";
import {
  buildCareTaskRows,
  buildMedicationCompletionTimelineEvents,
} from "./_shared/taskCompletion";

type TimelineEntry = {
  id: string;
  title: string;
  description: string;
  status: string;
  type: string;
  source: string;
  time: string;
  category: "critical" | "completed" | "clinician" | "missed";
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatPatientGender(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "--";
  if (normalized === "prefer_not_to_say" || normalized === "prefer not to say") return "Prefer not to say";
  return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function getProgressPercent(recoveryDay: number | null, expectedDurationDays: number | null) {
  if (!recoveryDay || !expectedDurationDays) return 0;
  return clamp(Math.round((recoveryDay / expectedDurationDays) * 100));
}

function getCurrentRecoveryDay(currentDay: number | null, createdAt: string, expectedDurationDays: number | null) {
  const apiDay = currentDay != null && Number.isFinite(currentDay) ? Math.max(1, Math.round(currentDay)) : null;
  if (apiDay != null) return expectedDurationDays == null ? apiDay : Math.min(apiDay, Math.max(1, Math.round(expectedDurationDays)));

  const startedAt = Date.parse(createdAt);
  if (!Number.isFinite(startedAt)) return null;
  const elapsedDays = Math.floor(Math.max(0, Date.now() - startedAt) / 86_400_000) + 1;
  return expectedDurationDays == null ? elapsedDays : Math.min(elapsedDays, Math.max(1, Math.round(expectedDurationDays)));
}
function getHeaderRiskBadge(riskCategory: string | null) {
  const value = (riskCategory ?? "").toLowerCase();
  if (value === "critical") return { label: "Critical", className: "bg-red-50 text-red-700" };
  if (value === "high") return { label: "High", className: "bg-red-50 text-red-500" };
  if (value === "medium") return { label: "Moderate", className: "bg-amber-50 text-amber-500" };
  if (value === "low") return { label: "Low", className: "bg-emerald-50 text-emerald-500" };
  return { label: "Unrated", className: "bg-slate-100 text-slate-500" };
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPercentField(record: ApiRecord | null, keys: string[]): number | null {
  const value = getNumber(record, keys);
  if (value === null) return null;
  return clamp(value <= 1 ? Math.round(value * 100) : Math.round(value));
}


function getTrendMeta(trend: string | null) {
  const value = (trend ?? "").toLowerCase();
  if (value.includes("up") || value.includes("increas") || value.includes("improv")) {
    return { label: "Increase", className: "bg-emerald-50 text-emerald-500", Icon: ArrowUp };
  }
  if (value.includes("down") || value.includes("decreas") || value.includes("declin") || value.includes("worsen")) {
    return { label: "Decrease", className: "bg-red-50 text-red-500", Icon: ArrowDown };
  }
  return { label: "Stable", className: "bg-blue-50 text-primary", Icon: Minus };
}

function getTimelineCategory(event: ApiRecord): TimelineEntry["category"] {
  const status = getString(event, ["status"]).toLowerCase();
  const type = getString(event, ["eventType", "type", "category"]).toLowerCase();
  const source = getString(event, ["source"]).toLowerCase();

  if (status.includes("critical") || type.includes("alert")) return "critical";
  if (status.includes("miss")) return "missed";
  if (type.includes("clinician") || type.includes("care plan") || source.includes("clinician")) return "clinician";
  return "completed";
}

function hasMeaningfulTimelineValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMeaningfulTimelineValue);
  if (value && typeof value === "object") {
    return Object.values(value as ApiRecord).some(hasMeaningfulTimelineValue);
  }
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return Boolean(normalized) && !["0", "false", "none", "null", "n/a", "na"].includes(normalized);
  }
  return false;
}

function hasPositiveSummaryCount(summary: string, terms: string[]) {
  for (const term of terms) {
    const match = summary.match(new RegExp("(\\d+)\\s+" + term));
    if (match) return Number(match[1]) > 0;
  }
  return null;
}

function normalizeCheckinTitle(payload: ApiRecord, summary: string) {
  const symptomsFromPayload = ["symptoms", "symptomCount", "symptomsCount"].some((key) => hasMeaningfulTimelineValue(payload[key]));
  const vitalsFromPayload = ["vitals", "vitalCount", "vitalsCount"].some((key) => hasMeaningfulTimelineValue(payload[key]));
  const symptomsFromSummary = hasPositiveSummaryCount(summary, ["symptoms?", "symptom"]);
  const vitalsFromSummary = hasPositiveSummaryCount(summary, ["vitals?", "vital"]);
  const hasSymptoms = symptomsFromPayload || symptomsFromSummary === true ||
    (symptomsFromSummary === null && summary.includes("symptom") && !summary.includes("no symptom"));
  const hasVitals = vitalsFromPayload || vitalsFromSummary === true ||
    (vitalsFromSummary === null && summary.includes("vital") && !summary.includes("no vital"));

  if (hasSymptoms && hasVitals) return "Symptom and vitals check-in submitted";
  if (hasSymptoms) return "Symptom check-in submitted";
  if (hasVitals) return "Vitals submitted";
  return "Daily check-in submitted";
}

function normalizeTimelineEntry(event: ApiRecord, index: number): TimelineEntry {
  const eventType = getString(event, ["eventType", "type"], "update");
  const payload = asRecord(event.payload) ?? {};
  const payloadSummary = getString(payload, ["message", "title", "details", "description", "summary"]);
  const eventKey = eventType.toLowerCase().replace(/[\s-]+/g, "_");
  const summary = `${eventKey} ${payloadSummary}`.toLowerCase();
  const isPatientNote = eventKey.includes("patient_note") || summary.includes("patient note");
  const isCheckin = eventKey.includes("checkin") || eventKey.includes("check_in") ||
    summary.includes("daily check-in") || summary.includes("daily check in");
  const title = isPatientNote
    ? "Patient note added"
    : isCheckin
      ? normalizeCheckinTitle(payload, summary)
      : getString(payload, ["message", "title"]) || humanizeSlug(eventType) || "Update";
  return {
    id: getString(event, ["id", "_id"]) || `event-${index}`,
    title,
    description: isPatientNote || isCheckin ? "" : getString(payload, ["details", "description", "note", "summary"]),
    status: getString(event, ["status"], "Completed"),
    type: humanizeSlug(eventType) || "Update",
    source: getString(event, ["source"], "System"),
    time: getString(event, ["timestamp", "time", "createdAt"]),
    category: getTimelineCategory(event),
  };
}

function timelineEntrySortValue(event: TimelineEntry) {
  const parsed = Date.parse(event.time);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeTimelineEntries(base: TimelineEntry[], additions: TimelineEntry[]) {
  const seen = new Set<string>();
  return [...additions, ...base]
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((a, b) => timelineEntrySortValue(b) - timelineEntrySortValue(a));
}

const TIMELINE_ICON: Record<TimelineEntry["category"], { Icon: typeof AlertCircle; className: string }> = {
  critical: { Icon: AlertCircle, className: "bg-red-50 text-red-500" },
  completed: { Icon: CheckCircle2, className: "bg-emerald-50 text-emerald-500" },
  clinician: { Icon: Stethoscope, className: "bg-blue-50 text-primary" },
  missed: { Icon: Pill, className: "bg-amber-50 text-amber-500" },
};

const TIMELINE_BADGE: Record<TimelineEntry["category"], string> = {
  critical: "bg-red-50 text-red-500",
  completed: "bg-emerald-50 text-emerald-500",
  clinician: "bg-blue-50 text-primary",
  missed: "bg-amber-50 text-amber-500",
};

function CircularProgress({
  percent,
  trackColor,
  progressColor,
  size = 128,
}: {
  percent: number | null;
  trackColor: string;
  progressColor: string;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamp(percent ?? 0) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{percent === null ? "--" : percent + "%"}</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  trend,
  isLoading,
  children,
}: {
  label: string;
  value: string;
  trend?: { label: string; className: string; Icon: typeof ArrowUp };
  isLoading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="h-full rounded-xl border-border bg-white shadow-sm">
      <CardContent className="flex h-full min-h-[132px] flex-col p-4">
        <div className="flex min-h-8 items-start justify-between gap-2">
          <p className="text-[10px] font-bold uppercase leading-4 tracking-[0.04em] text-slate-500">{label}</p>
          {trend ? (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", trend.className)}>
              <trend.Icon className="h-3 w-3" />
              {trend.label}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          {isLoading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-slate-100" /> : value}
        </p>
        {children ? <div className="mt-auto pt-3">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-slate-100" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-52 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-xl border-border bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-7 w-16 animate-pulse rounded bg-slate-100" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="h-64 w-full animate-pulse rounded bg-slate-100" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CareEpisodeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [closureTimeline, setClosureTimeline] = useState<TimelineEntry[]>([]);
  const [dailyVitals, setDailyVitals] = useState<DailyVitalsRecord[]>([]);
  const [episodeForecast, setEpisodeForecast] = useState<EpisodeForecast | null>(null);
  const [forecastError, setForecastError] = useState("");
  const [checkinHistory, setCheckinHistory] = useState<CheckInHistoryRecord[]>([]);
  const [medicationRecords, setMedicationRecords] = useState<MedicationAdherenceRecord[]>([]);
  const [taskCompletion, setTaskCompletion] = useState<TaskCompletionRecord | null>(null);
  const [taskCompletionLog, setTaskCompletionLog] = useState<TaskCompletionLog | null>(null);
  const [vitalsLoading, setVitalsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [biometricMetric, setBiometricMetric] = useState<BiometricMetric>("Blood Pressure");
  const [biometricRange, setBiometricRange] = useState<BiometricRange>("14d");
  const [metricMenuOpen, setMetricMenuOpen] = useState(false);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    capturePostHogEvent("care_episode_viewed", { episode_id: episodeId });
  }, [episodeId]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const [detail, history] = await Promise.all([
          getCareEpisodeById(episodeId),
          getCareEpisodeCheckins(episodeId, { page: 1, limit: 500 }).catch(() => []),
        ]);
        if (ignore) return;
        setEpisode(detail);
        setCheckinHistory(history);

        try {
          const timelinePage = await getCareEpisodeTimelinePage(episodeId, { limit: 100 });
          if (ignore) return;
          const events = (timelinePage.data.length > 0 ? timelinePage.data : detail.recentTimeline) as unknown as ApiRecord[];
          const normalizedEvents = events.map(normalizeTimelineEntry);
          setClosureTimeline(normalizedEvents);
          setTimeline(normalizedEvents.slice(0, 5));
        } catch {
          if (!ignore) {
            const normalizedEvents = detail.recentTimeline.map(normalizeTimelineEntry);
            setClosureTimeline(normalizedEvents);
            setTimeline(normalizedEvents.slice(0, 5));
          }
        }
      } catch (requestError) {
        if (ignore) return;
        setEpisode(null);
        setError(requestError instanceof Error ? requestError.message : "Failed to load care episode.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    const days = BIOMETRIC_RANGES.find((range) => range.key === biometricRange)?.days ?? 14;

    (async () => {
      setVitalsLoading(true);
      try {
        const records = await getCareEpisodeDailyVitals(episodeId, days);
        if (!ignore) setDailyVitals(records);
      } catch {
        if (!ignore) setDailyVitals([]);
      } finally {
        if (!ignore) setVitalsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [biometricRange, episodeId]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    getCareEpisodeMedicationAdherence(episodeId)
      .then((records) => {
        if (!ignore) setMedicationRecords(records);
      })
      .catch(() => {
        if (!ignore) setMedicationRecords([]);
      });
    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    const today = localDateKey(new Date());

    Promise.allSettled([
      getCareEpisodeTaskCompletion(episodeId, today),
      getCareEpisodeTaskCompletionLog(episodeId, today),
    ]).then(([completionResult, logResult]) => {
      if (ignore) return;
      setTaskCompletion(completionResult.status === "fulfilled" ? completionResult.value : null);
      setTaskCompletionLog(logResult.status === "fulfilled" ? logResult.value : null);
    });

    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    getCareEpisodeForecast(episodeId)
      .then((forecast) => {
        if (!ignore) {
          setEpisodeForecast(forecast);
          setForecastError("");
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setEpisodeForecast(null);
          setForecastError(requestError instanceof Error ? requestError.message : "Forecast unavailable");
        }
      });
    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);
  const biometricDays = BIOMETRIC_RANGES.find((range) => range.key === biometricRange)?.days ?? 14;
  const fallbackVitals = useMemo(
    () => buildDailyVitalsFromCheckins(checkinHistory, biometricDays),
    [biometricDays, checkinHistory],
  );
  const biometricData = useMemo(() => {
    const currentData = buildBiometricData(biometricMetric, dailyVitals);
    return currentData.length > 0 || fallbackVitals.length === 0
      ? currentData
      : buildBiometricData(biometricMetric, fallbackVitals);
  }, [biometricMetric, dailyVitals, fallbackVitals]);
  const biometricUnit = BIOMETRIC_METRICS.find((item) => item.label === biometricMetric)?.unit ?? "";
  const todayKey = localDateKey(new Date());
  const careTaskRows = useMemo(
    () => buildCareTaskRows(episode?.currentCarePlan ?? null, { date: todayKey, completionLog: taskCompletionLog, medicationRecords }),
    [episode, medicationRecords, taskCompletionLog, todayKey],
  );

  const monitoring = useMemo(() => {
    if (!episode) return null;

    const latestCheckin = episode.latestCheckin;
    const checkinDates = new Set([
      ...checkinHistory.map((checkin) => checkin.submittedAt),
      ...(checkinHistory.length === 0 ? [getString(latestCheckin, ["submittedAt"])] : []),
    ].map((submittedAt) => {
      const parsed = Date.parse(submittedAt);
      return Number.isFinite(parsed) ? localDateKey(new Date(parsed)) : "";
    }).filter(Boolean));
    const currentRecoveryDay = getCurrentRecoveryDay(episode.currentDay ?? episode.dayStart, episode.createdAt, episode.expectedDurationDays);
    const expectedCheckins = Math.max(1, currentRecoveryDay ?? checkinDates.size);
    const checkInConsistency = clamp(Math.round((Math.min(checkinDates.size, expectedCheckins) / expectedCheckins) * 100));
    const checkInTrend = getTrendMeta(getString(latestCheckin, ["trend", "consistencyTrend"]));

    const totalMedicationDoses = medicationRecords.reduce((total, medication) => total + medication.totalDoses, 0);
    const takenMedicationDoses = medicationRecords.reduce((total, medication) => total + medication.takenCount, 0);
    const medicationAdherence = totalMedicationDoses > 0
      ? clamp(Math.round((takenMedicationDoses / totalMedicationDoses) * 100))
      : null;
    const medicationTrend = getTrendMeta(getString(episode.currentCarePlan, ["medicationTrend", "adherenceTrend"]));

    const missedTasks = careTaskRows.filter((task) => task.missed && !task.done);
    const lastMissed = missedTasks[missedTasks.length - 1];
    const lastMissedLabel = lastMissed?.label ?? "";

    const completedTasks = taskCompletion?.completed ?? careTaskRows.filter((task) => task.done).length;
    const engagementScore = getPercentField(episode.riskData, ["engagementScore", "engagement", "engagementRate"]);
    const engagementTier = engagementScore === null ? "Unavailable" : engagementScore >= 75 ? "High" : engagementScore >= 45 ? "Moderate" : "Low";
    const engagementTrend = getTrendMeta(getString(episode.riskData, ["engagementTrend"]));

    return {
      checkInConsistency,
      checkInTrend,
      medicationAdherence,
      medicationTrend,
      missedTasksCount: taskCompletion?.missed ?? missedTasks.length,
      lastMissedLabel,
      completedTasks,
      engagementScore,
      engagementTier,
      engagementTrend,
    };
  }, [careTaskRows, checkinHistory, episode, medicationRecords, taskCompletion]);

  const medicationCompletionTimeline = useMemo(() => {
    if (!episode) return [];
    return buildMedicationCompletionTimelineEvents(episode.id || episodeId, episode.currentCarePlan, taskCompletionLog, medicationRecords, todayKey)
      .map((event, index) => normalizeTimelineEntry(event as unknown as ApiRecord, timeline.length + index));
  }, [episode, episodeId, medicationRecords, taskCompletionLog, timeline.length, todayKey]);
  const displayedTimeline = useMemo(
    () => mergeTimelineEntries(timeline, medicationCompletionTimeline).slice(0, 5),
    [medicationCompletionTimeline, timeline],
  );


  const outcomes = useMemo(() => {
    const recoveryProbability = episodeForecast?.recoveryForecast.dataSufficiency === "insufficient"
      ? null
      : episodeForecast?.recoveryProbability ?? episodeForecast?.recoveryForecast.currentRecoveryPercentage ?? null;
    const deteriorationRisk = episodeForecast?.deteriorationRisk ?? episodeForecast?.deterioration.probabilityPercent ?? null;
    const relapseRisk = episodeForecast?.relapseRisk ?? episodeForecast?.relapse.probabilityPercent ?? null;

    return { recoveryProbability, deteriorationRisk, relapseRisk };
  }, [episodeForecast]);

  const closureSummary = useMemo<EpisodeOutcomeSummary>(() => {
    if (!episode) return { checkInCompletion: null, goalAchievementPercent: null, missedTasksCount: null };
    const timelineCheckIns = closureTimeline.filter((entry) => entry.type.toLowerCase().includes("check")).length;
    const completedCheckIns = Math.max(timelineCheckIns, episode.latestCheckin ? 1 : 0);
    const totalCheckIns = Math.max(episode.dayStart ?? completedCheckIns, completedCheckIns, 1);
    return {
      checkInCompletion: { completed: completedCheckIns, total: totalCheckIns },
      goalAchievementPercent: null,
      missedTasksCount: episode.currentCarePlan ? monitoring?.missedTasksCount ?? null : null,
    };
  }, [closureTimeline, episode, monitoring]);

  const handleCloseEpisode = async (payload: CloseCareEpisodePayload) => {
    if (!episode) return;
    setIsClosing(true);
    try {
      await closeCareEpisode(episode.id, payload);
      capturePostHogEvent("care_episode_closed", { episode_id: episode.id, reason: payload.closureReason, outcome: payload.outcomeStatus });
      toast.success("Care episode closed.");
      setCloseDialogOpen(false);
      router.push(`/dashboard/care-episodes/${episode.id}/closed-summary`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to close care episode.");
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading && !episode) {
    return <DetailSkeleton />;
  }

  if (error && !episode) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/care-episodes"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Care Episodes
        </Link>
        <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-red-600">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="rounded-lg border-red-300 text-red-600 hover:bg-red-100"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!episode) return null;

  const patient = episode.patient;
  const patientName = patient?.name || "Unknown Patient";
  const patientGender = formatPatientGender(patient?.gender);
  const riskBadge = getHeaderRiskBadge(episode.riskCategory);
  const recoveryDay = getCurrentRecoveryDay(episode.currentDay, episode.createdAt, episode.expectedDurationDays);
  const progressPercent = getProgressPercent(recoveryDay, episode.expectedDurationDays);
  const visibleCareTeam = episode.careTeam.slice(0, 3);
  const extraCareTeamCount = Math.max(episode.careTeam.length - visibleCareTeam.length, 0);

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/care-episodes"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Care Episodes
      </Link>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
      ) : null}

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <span
                aria-label={`${patientName} profile picture`}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary bg-cover bg-center text-xl font-bold text-white"
                style={patient?.avatarUrl ? { backgroundImage: `url(${patient.avatarUrl})` } : undefined}
              >
                {patient?.avatarUrl ? null : getInitials(patientName)}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 md:text-lg">{patientName}</h1>
                  <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                    {riskBadge.label}
                  </span>
                  {visibleCareTeam.length > 0 ? (
                    <div className="flex items-center -space-x-2">
                      {visibleCareTeam.map((member) => (
                        <span
                          key={member.id || member.name}
                          title={member.name}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-50 bg-cover bg-center text-[10px] font-bold text-primary"
                          style={member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : undefined}
                        >
                          {member.avatarUrl ? null : getInitials(member.name)}
                        </span>
                      ))}
                      {extraCareTeamCount > 0 ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500">
                          +{extraCareTeamCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <Link
                    href={`/dashboard/care-episodes/${episode.id}/care-team`}
                    aria-label="View care team"
                    title="View care team"
                    onClick={() => capturePostHogEvent("care_team_opened", { episode_id: episode.id, source: "episode_header" })}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-primary hover:bg-blue-100"
                  >
                    <UsersRound className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <p className="text-xs font-medium text-slate-500">
                  Hospital ID: {patient?.hospitalId || "--"} <span className="mx-2 text-slate-400">•</span> Age: {patient?.age ?? "--"} <span className="mx-2 text-slate-400">•</span> {patientGender}
                </p>

                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                  <span className="font-bold text-slate-700">Contact Information:</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {patient?.phone || "--"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {patient?.email || "--"}
                  </span>
                </p>

                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Episode started {formatLongDate(episode.createdAt)}
                </p>

                {patient?.emergencyContactName || patient?.emergencyContactPhone ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
                    <span className="font-bold text-slate-700">Emergency Contact:</span>
                    {patient?.emergencyContactName || "--"}
                    {patient?.emergencyContactPhone ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {patient.emergencyContactPhone}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row lg:items-end lg:flex-col">

                <Button
                  asChild
                  variant="outline"
                  onClick={() => capturePostHogEvent("patient_insights_opened", { episode_id: episode.id })}
                  className="h-10 w-full gap-1.5 rounded-lg border-border bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50 sm:w-auto"
                >
                  <Link href={`/dashboard/care-episodes/${episode.id}/insights`}>
                    <Stethoscope className="h-3.5 w-3.5" />
                    Patient Insights
                  </Link>
                </Button>

              <Button
                asChild
                variant="outline"
                className="h-10 w-full gap-1.5 rounded-lg border-border bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50 sm:w-auto"
              >
                <Link href={`/dashboard/care-episodes/${episode.id}/recovery`}>
                  <TrendingUp className="h-3.5 w-3.5" />
                  Recovery
                </Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  capturePostHogEvent("care_episode_close_opened", { episode_id: episode.id });
                  setCloseDialogOpen(true);
                }}
                className="h-10 w-full gap-1.5 rounded-lg border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 sm:w-auto"
              >
                <X className="h-3.5 w-3.5" />
                Close Episode
              </Button>

            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 rounded-lg bg-blue-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-700">
              <span className="font-bold text-primary">CARE EPISODE:</span> {episode.diagnosis || "--"}
              <span className="mx-3 text-slate-500">|</span>
              Recovery Day {recoveryDay ?? "--"} of {episode.expectedDurationDays ?? "--"}
            </p>
            <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="whitespace-nowrap text-xs font-bold text-slate-700">{progressPercent}% Complete</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <h2 className="mb-4 text-base font-bold text-slate-900">Monitoring &amp; Analytics</h2>
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Check-in Consistency"
            value={`${monitoring?.checkInConsistency ?? 0}%`}
            trend={monitoring?.checkInTrend}
            isLoading={isLoading}
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${monitoring?.checkInConsistency ?? 0}%` }} />
            </div>
          </MetricCard>

          <MetricCard
            label="Medication Adherence"
            value={monitoring?.medicationAdherence == null ? "--" : `${monitoring.medicationAdherence}%`}
            trend={monitoring?.medicationTrend}
            isLoading={isLoading}
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary" style={{ width: `${monitoring?.medicationAdherence ?? 0}%` }} />
            </div>
          </MetricCard>

          <MetricCard
            label="Missed Tasks"
            value={String(monitoring?.missedTasksCount ?? 0)}
            trend={
              (monitoring?.missedTasksCount ?? 0) > 0
                ? { label: "Warning", className: "bg-red-50 text-red-500", Icon: AlertTriangle }
                : undefined
            }
            isLoading={isLoading}
          >
            <p className="text-xs font-medium text-slate-500">
              {monitoring?.lastMissedLabel ? `Last missed: ${monitoring.lastMissedLabel}` : "No missed tasks recorded"}
            </p>
          </MetricCard>

          <MetricCard
            label="Engagement Score"
            value={monitoring?.engagementScore == null ? "--" : `${monitoring.engagementScore}%`}
            trend={monitoring?.engagementTrend}
            isLoading={isLoading}
          >
            <p className="text-xs font-medium text-slate-500">{monitoring?.engagementScore == null ? "Engagement formula unavailable" : `${monitoring.engagementTier} engagement`}</p>
          </MetricCard>
        </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-slate-900">Biometric Trends</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMetricMenuOpen((open) => !open)}
                  aria-label="Select biometric"
                  aria-expanded={metricMenuOpen}
                  className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  {biometricMetric}
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
                {metricMenuOpen ? (
                  <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
                    {BIOMETRIC_METRICS.map((metric) => (
                      <button
                        key={metric.label}
                        type="button"
                        onClick={() => {
                          setBiometricMetric(metric.label);
                          setMetricMenuOpen(false);
                        }}
                        className={cn(
                          "block w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-100",
                          biometricMetric === metric.label ? "text-primary" : "text-slate-700",
                        )}
                      >
                        {metric.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
                {BIOMETRIC_RANGES.map((range) => (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setBiometricRange(range.key)}
                    aria-label={`Show ${range.key} biometric range`}
                    aria-pressed={biometricRange === range.key}
                    className={cn(
                      "rounded-md px-3 py-1.5 transition-colors",
                      biometricRange === range.key ? "bg-primary text-white" : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    {range.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {vitalsLoading ? (
            <div className="mt-6 h-75 animate-pulse rounded-xl bg-slate-100" />
          ) : biometricData.length === 0 ? (
            <div className="mt-6 flex h-75 items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 px-6 text-center">
              <p className="text-sm font-medium text-slate-500">No {biometricMetric.toLowerCase()} readings are available for this period.</p>
            </div>
          ) : (
          <div className="mt-6 h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={biometricData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="biometricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-slate-100)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value) => `${value} ${biometricUnit}`}
                  width={70}
                />
                <Tooltip formatter={(value) => [`${value} ${biometricUnit}`, biometricMetric]} />
                {biometricMetric === "Blood Pressure" ? (
                  <Line
                    type="monotone"
                    dataKey="secondaryValue"
                    stroke="var(--color-sky-600)"
                    strokeWidth={2}
                    dot={(dotProps: { cx?: number; cy?: number; payload?: BiometricPoint; index?: number }) => {
                      const { cx, cy, payload, index } = dotProps;
                      if (cx === undefined || cy === undefined) return <g key={index} />;
                      return (
                        <circle
                          key={index}
                          cx={cx}
                          cy={cy}
                          r={payload?.secondaryAbnormal ? 5 : 3}
                          fill={payload?.secondaryAbnormal ? "var(--color-red-500)" : "var(--color-sky-600)"}
                          stroke="var(--color-card)"
                          strokeWidth={1.5}
                        />
                      );
                    }}
                    activeDot={{ r: 5 }}
                  />
                ) : null}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#biometricFill)"
                  dot={(dotProps: { cx?: number; cy?: number; payload?: BiometricPoint; index?: number }) => {
                    const { cx, cy, payload, index } = dotProps;
                    if (cx === undefined || cy === undefined) return <g key={index} />;
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={payload?.abnormal ? 5 : 3}
                        fill={payload?.abnormal ? "var(--color-red-500)" : "var(--color-primary)"}
                        stroke="var(--color-card)"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}

          {biometricData.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {biometricMetric === "Blood Pressure" ? "Systolic" : "Primary Metric"}
            </span>
            {biometricMetric === "Blood Pressure" ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-600" />
                Diastolic
              </span>
            ) : null}
{biometricData.some((point) => point.abnormal || point.secondaryAbnormal) ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Abnormal Spike Detected
              </span>
            ) : null}
          </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <h2 className="mb-4 text-base font-bold text-slate-900">Recovery Outcomes</h2>
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
            <Card className="h-full rounded-xl border-border bg-slate-50/60 shadow-none">
              <CardContent className="flex h-full min-h-[220px] flex-col items-center p-6 text-center">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Recovery Probability</p>
                <CircularProgress percent={outcomes.recoveryProbability} trackColor="var(--color-blue-50)" progressColor="var(--color-primary)" />
                <p className="mt-4 text-xs font-medium text-slate-500">
                  {!episodeForecast
                    ? forecastError || "Forecast unavailable"
                    : episodeForecast.recoveryForecast.dataSufficiency === "insufficient"
                      ? "Insufficient data"
                      : `${episodeForecast.recoveryForecast.confidence}% confidence`}
                </p>
              </CardContent>
            </Card>
            <Card className="h-full rounded-xl border-border bg-slate-50/60 shadow-none">
              <CardContent className="flex h-full min-h-[220px] flex-col items-center p-6 text-center">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Risk of Deterioration</p>
                <CircularProgress percent={outcomes.deteriorationRisk} trackColor="var(--color-red-50)" progressColor="var(--color-red-500)" />
                <p className="mt-4 text-xs font-medium text-slate-500">
                  {!episodeForecast
                    ? forecastError || "Forecast unavailable"
                    : `${episodeForecast.deterioration.horizonDays}-day forecast · ${episodeForecast.deterioration.confidence}% confidence`}
                </p>
              </CardContent>
            </Card>
            <Card className="h-full rounded-xl border-border bg-slate-50/60 shadow-none">
              <CardContent className="flex h-full min-h-[220px] flex-col items-center p-6 text-center">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Relapse Risk Forecast</p>
                <CircularProgress percent={outcomes.relapseRisk} trackColor="var(--color-red-50)" progressColor="var(--color-red-500)" />
                <p className="mt-4 text-xs font-medium text-slate-500">
                  {!episodeForecast
                    ? forecastError || "Forecast unavailable"
                    : outcomes.relapseRisk == null || episodeForecast.relapse.dataSufficiency === "insufficient"
                      ? "Insufficient data"
                      : `${episodeForecast.relapse.horizonDays}-day forecast · ${episodeForecast.relapse.confidence}% confidence`}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Unified Care Timeline</h2>
            <Link href={`/dashboard/care-episodes/${episode.id}/timeline`} className="text-sm font-bold text-primary underline underline-offset-2">
              View full page
            </Link>
          </div>

          {displayedTimeline.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-500">No timeline events recorded yet.</p>
          ) : (
            <>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Today</p>
              <div className="space-y-3">
                {displayedTimeline.map((event) => {
                  const iconMeta = TIMELINE_ICON[event.category];
                  return (
                    <div key={event.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconMeta.className)}>
                        <iconMeta.Icon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{event.title}</p>
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", TIMELINE_BADGE[event.category])}>
                            {event.status}
                          </span>
                        </div>
                        {event.description ? (
                          <p className="mt-1 text-sm font-medium text-slate-500">{event.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                          <span>{formatTime(event.time)}</span>
                          {event.source ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="h-1 w-1 rounded-full bg-slate-500" />
                              {event.source}
                            </span>
                          ) : null}
                          {event.type ? (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-500">{event.type}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CloseCareEpisodeModal
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        patientName={patientName}
        isClosing={isClosing}
        summary={closureSummary}
        onConfirm={(payload) => void handleCloseEpisode(payload)}
      />
    </div>
  );
}

