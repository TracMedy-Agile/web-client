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
  MessageSquare,
  Minus,
  Phone,
  Pill,
  Stethoscope,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  asRecord,
  closeCareEpisode,
  getCareEpisodeById,
  getCareEpisodeDailyVitals,
  getCareEpisodeForecast,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeTimelinePage,
  getNumber,
  getRecordArray,
  getString,
  type ApiRecord,
  type CareEpisodeDetail,
  type DailyVitalsRecord,
  type EpisodeForecast,
  type MedicationAdherenceRecord,
} from "@/lib/api/care-episodes";
import {
  BIOMETRIC_METRICS,
  BIOMETRIC_RANGES,
  buildBiometricData,
  humanizeSlug,
  type BiometricMetric,
  type BiometricPoint,
  type BiometricRange,
} from "./_shared/utils";
import { CloseCareEpisodeModal, type CloseCareEpisodePayload, type EpisodeOutcomeSummary } from "./components/CloseCareEpisodeModal";

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

function getProgressPercent(dayStart: number | null, expectedDurationDays: number | null) {
  if (!dayStart || !expectedDurationDays) return 0;
  return clamp(Math.round((dayStart / expectedDurationDays) * 100));
}

function getHeaderRiskBadge(riskCategory: string | null) {
  const value = (riskCategory ?? "").toLowerCase();
  if (value === "critical") return { label: "Critical", className: "bg-red-50 text-red-700" };
  if (value === "high") return { label: "High", className: "bg-red-50 text-red-500" };
  if (value === "medium") return { label: "Moderate", className: "bg-amber-50 text-amber-500" };
  if (value === "low") return { label: "Low", className: "bg-emerald-50 text-emerald-500" };
  return { label: "Unrated", className: "bg-slate-100 text-slate-500" };
}

function getRiskFactors(riskData: ApiRecord | null) {
  if (!riskData) return [];
  for (const key of ["triggerFactors", "contributingFactors", "riskFactors", "factors"]) {
    const value = riskData[key];
    if (!Array.isArray(value)) continue;
    return value.map((item) => {
      if (typeof item === "string") return item;
      const record = asRecord(item);
      return getString(record, ["label", "reason", "description", "name"]);
    }).filter(Boolean);
  }
  return [];
}

function formatLongDate(value: string) {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function formatTime(value: string) {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(parsed));
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

function isTaskMissed(task: ApiRecord) {
  const status = getString(task, ["status"]).toLowerCase();
  return status === "missed" || status === "overdue" || task.missed === true;
}

function isTaskCompleted(task: ApiRecord) {
  const status = getString(task, ["status"]).toLowerCase();
  return status === "completed" || status === "done" || task.completed === true;
}

function isMedicationAdherent(medication: ApiRecord) {
  const status = getString(medication, ["status", "adherenceStatus"]).toLowerCase();
  if (status) return status === "taken" || status === "adherent" || status === "completed";
  return medication.adherent === true || medication.taken === true;
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

function normalizeTimelineEntry(event: ApiRecord, index: number): TimelineEntry {
  const eventType = getString(event, ["eventType", "type"], "update");
  const payload = asRecord(event.payload) ?? {};
  return {
    id: getString(event, ["id", "_id"]) || `event-${index}`,
    title: getString(payload, ["message", "title"]) || humanizeSlug(eventType) || "Update",
    description: getString(payload, ["details", "description", "note", "summary"]),
    status: getString(event, ["status"], "Completed"),
    type: humanizeSlug(eventType) || "Update",
    source: getString(event, ["source"], "System"),
    time: getString(event, ["timestamp", "time", "createdAt"]),
    category: getTimelineCategory(event),
  };
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
    <Card className="rounded-xl border-border bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.04em] text-slate-500">{label}</p>
          {trend ? (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", trend.className)}>
              <trend.Icon className="h-3 w-3" />
              {trend.label}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
          {isLoading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-slate-100" /> : value}
        </p>
        {children}
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
  const [medicationRecords, setMedicationRecords] = useState<MedicationAdherenceRecord[]>([]);
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
        const detail = await getCareEpisodeById(episodeId);
        if (ignore) return;
        setEpisode(detail);

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
  const biometricData = useMemo(
    () => buildBiometricData(biometricMetric, dailyVitals),
    [biometricMetric, dailyVitals],
  );
  const biometricUnit = BIOMETRIC_METRICS.find((item) => item.label === biometricMetric)?.unit ?? "";

  const monitoring = useMemo(() => {
    if (!episode) return null;

    const checkin = episode.latestCheckin;
    const checkInConsistency = getPercentField(checkin, ["consistency", "checkInConsistency", "consistencyScore", "score", "rate"]) ?? 0;
    const checkInTrend = getTrendMeta(getString(checkin, ["trend", "consistencyTrend"]));

    const medications = getRecordArray(episode.currentCarePlan, ["medications"]);
    const fallbackAdherentCount = medications.filter(isMedicationAdherent).length;
    const fallbackAdherence = medications.length > 0 ? clamp(Math.round((fallbackAdherentCount / medications.length) * 100)) : 0;
    const medicationAdherence = medicationRecords.length > 0
      ? clamp(Math.round(medicationRecords.reduce((total, medication) => total + medication.adherencePercentage, 0) / medicationRecords.length))
      : fallbackAdherence;
    const medicationTrend = getTrendMeta(getString(episode.currentCarePlan, ["medicationTrend", "adherenceTrend"]));

    const tasks = getRecordArray(episode.currentCarePlan, ["tasks"]);
    const missedTasks = tasks.filter(isTaskMissed);
    const lastMissed = missedTasks[missedTasks.length - 1];
    const lastMissedLabel = lastMissed ? getString(lastMissed, ["title", "name", "label"], "Task") : "";

    const completedTasks = tasks.filter(isTaskCompleted).length;
    const engagementScore = clamp(Math.round((checkInConsistency + medicationAdherence) / 2));
    const engagementTier = engagementScore >= 75 ? "High" : engagementScore >= 45 ? "Moderate" : "Low";
    const engagementTrend = getTrendMeta(getString(episode.riskData, ["engagementTrend"]));

    return {
      checkInConsistency,
      checkInTrend,
      medicationAdherence,
      medicationTrend,
      missedTasksCount: missedTasks.length,
      lastMissedLabel,
      completedTasks,
      engagementScore,
      engagementTier,
      engagementTrend,
    };
  }, [episode, medicationRecords]);

  const outcomes = useMemo(() => {
    const riskScore = episode?.riskScore ?? null;
    const fallbackDeteriorationRisk = riskScore === null ? null : clamp(Math.round(riskScore));
    const fallbackRecoveryProbability = fallbackDeteriorationRisk === null ? null : clamp(100 - fallbackDeteriorationRisk);
    const recoveryProbability = episodeForecast?.recoveryProbability ?? episodeForecast?.recoveryForecast.currentRecoveryPercentage ?? fallbackRecoveryProbability;
    const deteriorationRisk = episodeForecast?.deteriorationRisk ?? episodeForecast?.deterioration.probabilityPercent ?? fallbackDeteriorationRisk;
    const relapseRisk = episodeForecast?.relapseRisk ?? episodeForecast?.relapse.probabilityPercent ?? null;

    return { recoveryProbability, deteriorationRisk, relapseRisk };
  }, [episode, episodeForecast]);

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
  const riskBadge = getHeaderRiskBadge(episode.riskCategory);
  const progressPercent = episode.dayProgress ?? getProgressPercent(episode.dayStart, episode.expectedDurationDays);
  const visibleCareTeam = episode.careTeam.slice(0, 3);
  const extraCareTeamCount = Math.max(episode.careTeam.length - visibleCareTeam.length, 0);
  const riskFactors = getRiskFactors(episode.riskData);
  const riskWindow = getString(
    episode.riskData,
    ["timeToIntervention", "recommendedInterventionWindow", "interventionWindow"],
    "Not provided",
  );
  const displayedRiskScore = episode.riskScore === null ? null : clamp(Math.round(episode.riskScore));

  return (
    <div className="space-y-6">
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
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
                {getInitials(patientName)}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 md:text-xl">{patientName}</h1>
                  <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                    {riskBadge.label}
                  </span>
                  {visibleCareTeam.length > 0 ? (
                    <div className="flex items-center -space-x-2">
                      {visibleCareTeam.map((member) => (
                        <span
                          key={member.id || member.name}
                          title={member.name}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-50 text-[10px] font-bold text-primary"
                        >
                          {getInitials(member.name)}
                        </span>
                      ))}
                      {extraCareTeamCount > 0 ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500">
                          +{extraCareTeamCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <p className="text-sm font-medium text-slate-500">
                  Hospital ID: {patient?.hospitalId || "--"} - Age: {patient?.age ?? "--"} - {patient?.gender || "--"}
                </p>
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Episode started {formatLongDate(episode.createdAt)}
                </p>

                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-slate-500">
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

                {patient?.emergencyContactName || patient?.emergencyContactPhone ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-500">
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

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col">

                <Button
                  asChild
                  onClick={() => capturePostHogEvent("patient_insights_opened", { episode_id: episode.id })}
                  className="h-11 gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90"
                >
                  <Link href={`/dashboard/care-episodes/${episode.id}/insights`}>
                    <TrendingUp className="h-4 w-4" />
                    Patients Insights
                  </Link>
                </Button>

              <Button
                asChild
                variant="outline"
                className="h-11 gap-2 rounded-xl border-border bg-white px-5 text-sm font-bold text-slate-900 hover:bg-slate-50"
              >
                <Link href={`/dashboard/care-episodes/${episode.id}/recovery`}>
                  <TrendingUp className="h-4 w-4" />
                  Recovery
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-2 rounded-xl border-border bg-white px-5 text-sm font-bold text-slate-900 hover:bg-slate-50"
                  >
                    Actions
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-lg border-border p-1.5">
                  <DropdownMenuItem
                    asChild
                    onSelect={() => capturePostHogEvent("care_episode_message_opened", { episode_id: episode.id })}
                    className="cursor-pointer gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-900"
                  >
                    <Link
                      href={`/dashboard/messages?${new URLSearchParams({
                        episodeId: episode.id,
                        patientId: episode.patientId,
                        patientName,
                      })}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Send Message
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      capturePostHogEvent("care_episode_close_opened", { episode_id: episode.id });
                      setCloseDialogOpen(true);
                    }}
                    className="cursor-pointer gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-600"
                  >
                    <X className="h-4 w-4" />
                    Close Care Episode
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-lg bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-700">
              <span className="font-bold text-primary">CARE EPISODE:</span> {episode.carePhase || episode.diagnosis || "--"}
              <span className="mx-3 text-slate-500">|</span>
              Recovery Day {episode.dayStart ?? 0} of {episode.expectedDurationDays ?? 0}
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

      <section>
        <h2 className="mb-4 text-base font-bold text-slate-900">Monitoring &amp; Analytics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Check-in Consistency"
            value={`${monitoring?.checkInConsistency ?? 0}%`}
            trend={monitoring?.checkInTrend}
            isLoading={isLoading}
          >
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${monitoring?.checkInConsistency ?? 0}%` }} />
            </div>
          </MetricCard>

          <MetricCard
            label="Medication Adherence"
            value={`${monitoring?.medicationAdherence ?? 0}%`}
            trend={monitoring?.medicationTrend}
            isLoading={isLoading}
          >
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary" style={{ width: `${monitoring?.medicationAdherence ?? 0}%` }} />
            </div>
          </MetricCard>

          <MetricCard
            label="Missed Tasks"
            value={String(monitoring?.missedTasksCount ?? 0).padStart(2, "0")}
            trend={
              (monitoring?.missedTasksCount ?? 0) > 0
                ? { label: "Warning", className: "bg-red-50 text-red-500", Icon: AlertTriangle }
                : undefined
            }
            isLoading={isLoading}
          >
            <p className="mt-3 text-xs font-medium text-slate-500">
              {monitoring?.lastMissedLabel ? `Last missed: ${monitoring.lastMissedLabel}` : "No missed tasks recorded"}
            </p>
          </MetricCard>

          <MetricCard
            label="Engagement Score"
            value={`${monitoring?.engagementScore ?? 0}%`}
            trend={monitoring?.engagementTrend}
            isLoading={isLoading}
          >
            <p className="mt-3 text-xs font-medium text-slate-500">{monitoring?.engagementTier ?? "Moderate"} engagement last week</p>
          </MetricCard>
        </div>
      </section>

      <Card id="risk-intelligence" className="scroll-mt-24 rounded-xl border-border bg-card shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-foreground">Risk Intelligence</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Clinical decision support from the latest episode risk assessment.</p>
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="h-10 rounded-lg border-border bg-card text-sm font-semibold text-foreground">
              <Link href="/dashboard/alerts">View all alerts</Link>
            </Button>
          </div>

          {displayedRiskScore === null && !episode.riskCategory && !episode.riskTrend && riskFactors.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">No risk assessment recorded</p>
              <p className="mt-1 text-sm text-muted-foreground">Risk intelligence will appear when the backend adds risk data to this episode.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current risk score</p>
                    <p className="mt-2 text-4xl font-bold text-foreground">{displayedRiskScore === null ? "Ã¢â‚¬â€" : displayedRiskScore}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>{riskBadge.label}</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      (displayedRiskScore ?? 0) >= 70 ? "bg-red-500" : (displayedRiskScore ?? 0) >= 40 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${displayedRiskScore ?? 0}%` }}
                  />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trend</dt>
                    <dd className="mt-1 text-sm font-semibold capitalize text-foreground">{episode.riskTrend || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intervention window</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">{riskWindow}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk history</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">{episode.riskHistory.length} assessment{episode.riskHistory.length === 1 ? "" : "s"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-border p-5">
                <h3 className="text-sm font-bold text-foreground">Contributing factors</h3>
                {riskFactors.length > 0 ? (
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {riskFactors.map((factor, index) => (
                      <li key={`${factor}-${index}`} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-3 text-sm font-medium text-foreground">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">No contributing factors were supplied with this assessment.</p>
                )}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Review the patientÃ¢â‚¬â„¢s current episode and clinical context before acting on any risk signal.
                </p>
              </div>
            </div>
          )}
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
          <div className="mt-6" style={{ width: "100%", height: 300 }}>
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
          <div className="mt-4 flex items-center gap-5 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Primary Metric
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Abnormal Spike Detected
            </span>
          </div>
          ) : null}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-base font-bold text-slate-900">Recovery Outcomes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="rounded-xl border-border bg-white shadow-sm">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Recovery Probability</p>
              <CircularProgress percent={outcomes.recoveryProbability} trackColor="var(--color-blue-50)" progressColor="var(--color-primary)" />
              <p className="mt-4 text-xs font-medium text-slate-500">{episodeForecast ? `${episodeForecast.recoveryForecast.confidence}% confidence` : forecastError || "Derived from current risk score"}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border bg-white shadow-sm">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Risk of Deterioration</p>
              <CircularProgress percent={outcomes.deteriorationRisk} trackColor="var(--color-red-50)" progressColor="var(--color-red-500)" />
              <p className="mt-4 text-xs font-medium text-slate-500">{episodeForecast ? `${episodeForecast.deterioration.horizonDays}-day forecast` : forecastError || "Current episode risk score"}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border bg-white shadow-sm">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Relapse Risk Forecast</p>
              <CircularProgress percent={outcomes.relapseRisk} trackColor="var(--color-red-50)" progressColor="var(--color-red-500)" />
              <p className="mt-4 text-xs font-medium text-slate-500">{episodeForecast ? `${episodeForecast.relapse.horizonDays}-day forecast` : forecastError || "Forecast unavailable"}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Unified Care Timeline</h2>
            <Link href={`/dashboard/care-episodes/${episode.id}/timeline`} className="text-sm font-bold text-primary">
              View full page
            </Link>
          </div>

          {timeline.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-500">No timeline events recorded yet.</p>
          ) : (
            <>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Today</p>
              <div className="space-y-4">
                {timeline.map((event) => {
                  const iconMeta = TIMELINE_ICON[event.category];
                  return (
                    <div key={event.id} className="flex gap-3 rounded-lg border border-slate-200 p-4">
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

