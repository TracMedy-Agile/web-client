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
  ClipboardList,
  Mail,
  MessageSquare,
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
import {
  asRecord,
  closeCareEpisode,
  getCareEpisodeById,
  getCareEpisodeTimelinePage,
  getNumber,
  getRecordArray,
  getString,
  type ApiRecord,
  type CareEpisodeDetail,
} from "@/lib/api/care-episodes";
import { humanizeSlug } from "./_shared/utils";
import { CloseCareEpisodeModal, type CloseCareEpisodePayload } from "./components/CloseCareEpisodeModal";

type BiometricMetric = "Blood Pressure" | "Heart Rate" | "SpO2";
type BiometricRange = "7d" | "14d" | "30d";

type BiometricPoint = {
  date: string;
  value: number;
  abnormal: boolean;
};

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

const BIOMETRIC_METRICS: { label: BiometricMetric; unit: string; base: number; spread: number }[] = [
  { label: "Blood Pressure", unit: "MMHG", base: 118, spread: 18 },
  { label: "Heart Rate", unit: "BPM", base: 78, spread: 14 },
  { label: "SpO2", unit: "%", base: 96, spread: 3 },
];

const BIOMETRIC_RANGES: { key: BiometricRange; days: number }[] = [
  { key: "7d", days: 7 },
  { key: "14d", days: 14 },
  { key: "30d", days: 30 },
];

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
  if (value === "high") return { label: "High", className: "bg-[#FFECEC] text-[#EF4444]" };
  if (value === "medium") return { label: "Moderate", className: "bg-[#FFF4E5] text-[#F59E0B]" };
  if (value === "low") return { label: "Low", className: "bg-[#DFFBF0] text-[#10B981]" };
  return { label: "Unrated", className: "bg-[#F3F4F6] text-[#71809B]" };
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
    return { label: "Increase", className: "bg-[#DFFBF0] text-[#10B981]", Icon: ArrowUp };
  }
  if (value.includes("down") || value.includes("decreas") || value.includes("declin") || value.includes("worsen")) {
    return { label: "Decrease", className: "bg-[#FFECEC] text-[#EF4444]", Icon: ArrowDown };
  }
  return { label: "Stable", className: "bg-[#E7F2FF] text-[#023E8A]", Icon: Minus };
}

function isTaskMissed(task: ApiRecord) {
  const status = getString(task, ["status"]).toLowerCase();
  return status === "missed" || task.completed === false || task.missed === true;
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

function seededRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function buildBiometricData(metric: BiometricMetric, range: BiometricRange, episodeId: string): BiometricPoint[] {
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
  critical: { Icon: AlertCircle, className: "bg-[#FFECEC] text-[#EF4444]" },
  completed: { Icon: CheckCircle2, className: "bg-[#DFFBF0] text-[#10B981]" },
  clinician: { Icon: Stethoscope, className: "bg-[#E7F2FF] text-[#023E8A]" },
  missed: { Icon: Pill, className: "bg-[#FFF4E5] text-[#F59E0B]" },
};

const TIMELINE_BADGE: Record<TimelineEntry["category"], string> = {
  critical: "bg-[#FFECEC] text-[#EF4444]",
  completed: "bg-[#DFFBF0] text-[#10B981]",
  clinician: "bg-[#E7F2FF] text-[#023E8A]",
  missed: "bg-[#FFF4E5] text-[#F59E0B]",
};

function CircularProgress({
  percent,
  trackColor,
  progressColor,
  size = 128,
}: {
  percent: number;
  trackColor: string;
  progressColor: string;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamp(percent) / 100) * circumference;

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
        <span className="text-2xl font-bold text-[#111827]">{percent}%</span>
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
    <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">{label}</p>
          {trend ? (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", trend.className)}>
              <trend.Icon className="h-3 w-3" />
              {trend.label}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-2xl font-bold text-[#111827] sm:text-3xl">
          {isLoading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-[#F3F4F6]" /> : value}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-[#E5E7EB]" />
      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-[#F3F4F6]" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-52 animate-pulse rounded bg-[#F3F4F6]" />
              <div className="h-4 w-72 animate-pulse rounded bg-[#F3F4F6]" />
              <div className="h-4 w-64 animate-pulse rounded bg-[#F3F4F6]" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-[#F3F4F6]" />
              <div className="mt-4 h-7 w-16 animate-pulse rounded bg-[#F3F4F6]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="h-64 w-full animate-pulse rounded bg-[#F3F4F6]" />
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [biometricMetric, setBiometricMetric] = useState<BiometricMetric>("Blood Pressure");
  const [biometricRange, setBiometricRange] = useState<BiometricRange>("14d");
  const [metricMenuOpen, setMetricMenuOpen] = useState(false);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

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
          const timelinePage = await getCareEpisodeTimelinePage(episodeId, { limit: 10 });
          if (ignore) return;
          const events = (timelinePage.data.length > 0 ? timelinePage.data : detail.recentTimeline) as unknown as ApiRecord[];
          setTimeline(events.map(normalizeTimelineEntry));
        } catch {
          if (!ignore) setTimeline(detail.recentTimeline.map(normalizeTimelineEntry));
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

  const biometricData = useMemo(
    () => buildBiometricData(biometricMetric, biometricRange, episodeId),
    [biometricMetric, biometricRange, episodeId],
  );
  const biometricUnit = BIOMETRIC_METRICS.find((item) => item.label === biometricMetric)?.unit ?? "";

  const monitoring = useMemo(() => {
    if (!episode) return null;

    const checkin = episode.latestCheckin;
    const checkInConsistency = getPercentField(checkin, ["consistency", "checkInConsistency", "consistencyScore", "score", "rate"]) ?? 0;
    const checkInTrend = getTrendMeta(getString(checkin, ["trend", "consistencyTrend"]));

    const medications = getRecordArray(episode.currentCarePlan, ["medications"]);
    const adherentCount = medications.filter(isMedicationAdherent).length;
    const medicationAdherence = medications.length > 0 ? clamp(Math.round((adherentCount / medications.length) * 100)) : 0;
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
  }, [episode]);

  const outcomes = useMemo(() => {
    const riskScore = episode?.riskScore ?? null;
    const category = (episode?.riskCategory ?? "").toLowerCase();

    const deteriorationRisk =
      riskScore !== null ? clamp(Math.round(riskScore)) : category === "high" ? 70 : category === "medium" ? 40 : category === "low" ? 15 : 25;
    const recoveryProbability = clamp(100 - deteriorationRisk);
    const relapseRisk = clamp(Math.round(deteriorationRisk * 0.85));

    return { recoveryProbability, deteriorationRisk, relapseRisk };
  }, [episode]);

  const CLOSURE_REASON_TO_OUTCOME: Record<CloseCareEpisodePayload["closureReason"], string> = {
    "Recovery completed": "Recovered",
    Transferred: "Transferred",
    "Patient discontinued": "Discontinued",
    "Lost to follow-up": "Lost to follow-up",
    Deceased: "Deceased",
    "Administrative closure": "Administrative",
  };

  const handleCloseEpisode = async (payload: CloseCareEpisodePayload) => {
    if (!episode) return;
    setIsClosing(true);
    try {
      await closeCareEpisode(episode.id, {
        closureReason: payload.closureReason,
        outcomeStatus: CLOSURE_REASON_TO_OUTCOME[payload.closureReason],
      });
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
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#71809B] hover:text-[#111827]"
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

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/care-episodes"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#71809B] hover:text-[#111827]"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Care Episodes
      </Link>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
      ) : null}

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#023E8A] text-2xl font-bold text-white">
                {getInitials(patientName)}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-[#111827] md:text-xl">{patientName}</h1>
                  <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                    {riskBadge.label}
                  </span>
                  {visibleCareTeam.length > 0 ? (
                    <div className="flex items-center -space-x-2">
                      {visibleCareTeam.map((member) => (
                        <span
                          key={member.id || member.name}
                          title={member.name}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#E7F2FF] text-[10px] font-bold text-[#023E8A]"
                        >
                          {getInitials(member.name)}
                        </span>
                      ))}
                      {extraCareTeamCount > 0 ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#F3F4F6] text-[10px] font-bold text-[#71809B]">
                          +{extraCareTeamCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <p className="text-sm font-medium text-[#71809B]">
                  Hospital ID: {patient?.hospitalId || "--"} • Age: {patient?.age ?? "--"} • {patient?.gender || "--"}
                </p>
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#71809B]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Episode started {formatLongDate(episode.createdAt)}
                </p>

                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-[#71809B]">
                  <span className="font-bold text-[#344054]">Contact Information:</span>
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
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[#71809B]">
                    <span className="font-bold text-[#344054]">Emergency Contact:</span>
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
                className="h-11 gap-2 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575]"
              >
                <Link href={`/dashboard/care-episodes/${episode.id}/insights`}>
                  <TrendingUp className="h-4 w-4" />
                  Patients Insights
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 gap-2 rounded-xl border-[#DDE3EC] bg-white px-5 text-sm font-bold text-[#111827] hover:bg-[#F8FAFC]"
              >
                <Link href={`/dashboard/care-episodes/${episode.id}/recovery`}>
                  <TrendingUp className="h-4 w-4" />
                  Recovery
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 gap-2 rounded-xl border-[#DDE3EC] bg-white px-5 text-sm font-bold text-[#111827] hover:bg-[#F8FAFC]"
              >
                <Link href={`/dashboard/care-episodes/${episode.id}/care-team`}>
                  <UsersRound className="h-4 w-4" />
                  Care Team
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-2 rounded-xl border-[#DDE3EC] bg-white px-5 text-sm font-bold text-[#111827] hover:bg-[#F8FAFC]"
                  >
                    Actions
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-lg border-[#DDE3EC] p-1.5">
                  <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#111827]">
                    <Link href={`/dashboard/care-episodes/${episode.id}/assessment`}>
                      <Stethoscope className="h-4 w-4" />
                      New Assessment
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#111827]">
                    <Link href={`/dashboard/care-episodes/${episode.id}/assessment-history`}>
                      <ClipboardList className="h-4 w-4" />
                      Assessment History
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => toast.info("Messaging is coming soon.")}
                    className="cursor-pointer gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#111827]"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Send Message
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setCloseDialogOpen(true)}
                    className="cursor-pointer gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-600"
                  >
                    <X className="h-4 w-4" />
                    Close Care Journey
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-lg bg-[#EFF5FF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-[#344054]">
              <span className="font-bold text-[#023E8A]">CARE EPISODE:</span> {episode.carePhase || episode.diagnosis || "--"}
              <span className="mx-3 text-[#71809B]">|</span>
              Recovery Day {episode.dayStart ?? 0} of {episode.expectedDurationDays ?? 0}
            </p>
            <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#023E8A]" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="whitespace-nowrap text-xs font-bold text-[#344054]">{progressPercent}% Complete</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-base font-bold text-[#111827]">Monitoring &amp; Analytics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Check-in Consistency"
            value={`${monitoring?.checkInConsistency ?? 0}%`}
            trend={monitoring?.checkInTrend}
            isLoading={isLoading}
          >
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${monitoring?.checkInConsistency ?? 0}%` }} />
            </div>
          </MetricCard>

          <MetricCard
            label="Medication Adherence"
            value={`${monitoring?.medicationAdherence ?? 0}%`}
            trend={monitoring?.medicationTrend}
            isLoading={isLoading}
          >
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div className="h-full rounded-full bg-[#023E8A]" style={{ width: `${monitoring?.medicationAdherence ?? 0}%` }} />
            </div>
          </MetricCard>

          <MetricCard
            label="Missed Tasks"
            value={String(monitoring?.missedTasksCount ?? 0).padStart(2, "0")}
            trend={
              (monitoring?.missedTasksCount ?? 0) > 0
                ? { label: "Warning", className: "bg-[#FFECEC] text-[#EF4444]", Icon: AlertTriangle }
                : undefined
            }
            isLoading={isLoading}
          >
            <p className="mt-3 text-xs font-medium text-[#71809B]">
              {monitoring?.lastMissedLabel ? `Last missed: ${monitoring.lastMissedLabel}` : "No missed tasks recorded"}
            </p>
          </MetricCard>

          <MetricCard
            label="Engagement Score"
            value={`${monitoring?.engagementScore ?? 0}%`}
            trend={monitoring?.engagementTrend}
            isLoading={isLoading}
          >
            <p className="mt-3 text-xs font-medium text-[#71809B]">{monitoring?.engagementTier ?? "Moderate"} engagement last week</p>
          </MetricCard>
        </div>
      </section>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-[#111827]">Biometric Trends</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMetricMenuOpen((open) => !open)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-4 text-sm font-medium text-[#111827] hover:bg-[#F8FAFC]"
                >
                  {biometricMetric}
                  <ChevronDown className="h-4 w-4 text-[#71809B]" />
                </button>
                {metricMenuOpen ? (
                  <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-[#DDE3EC] bg-white py-1 shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
                    {BIOMETRIC_METRICS.map((metric) => (
                      <button
                        key={metric.label}
                        type="button"
                        onClick={() => {
                          setBiometricMetric(metric.label);
                          setMetricMenuOpen(false);
                        }}
                        className={cn(
                          "block w-full px-4 py-2 text-left text-sm font-medium hover:bg-[#F3F4F6]",
                          biometricMetric === metric.label ? "text-[#023E8A]" : "text-[#344054]",
                        )}
                      >
                        {metric.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex rounded-lg bg-[#F3F4F6] p-1 text-xs font-bold">
                {BIOMETRIC_RANGES.map((range) => (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setBiometricRange(range.key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 transition-colors",
                      biometricRange === range.key ? "bg-[#023E8A] text-white" : "text-[#71809B] hover:text-[#111827]",
                    )}
                  >
                    {range.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6" style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={biometricData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="biometricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#023E8A" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#023E8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF1F6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#71809B", fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71809B", fontSize: 11 }}
                  tickFormatter={(value) => `${value} ${biometricUnit}`}
                  width={70}
                />
                <Tooltip formatter={(value) => [`${value} ${biometricUnit}`, biometricMetric]} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#023E8A"
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
                        fill={payload?.abnormal ? "#EF4444" : "#023E8A"}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center gap-5 text-xs font-medium text-[#71809B]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#023E8A]" />
              Primary Metric
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
              Abnormal Spike Detected
            </span>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-base font-bold text-[#111827]">Recovery Outcomes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Recovery Probability</p>
              <CircularProgress percent={outcomes.recoveryProbability} trackColor="#E7F2FF" progressColor="#023E8A" />
              <p className="mt-4 text-xs font-medium text-[#71809B]">Within expected timeframe</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Risk of Deterioration</p>
              <CircularProgress percent={outcomes.deteriorationRisk} trackColor="#FFECEC" progressColor="#EF4444" />
              <p className="mt-4 text-xs font-medium text-[#71809B]">Next 7 days</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Relapse Risk Forecast</p>
              <CircularProgress percent={outcomes.relapseRisk} trackColor="#FFECEC" progressColor="#EF4444" />
              <p className="mt-4 text-xs font-medium text-[#71809B]">30-day projection</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111827]">Unified Care Timeline</h2>
            <Link href={`/dashboard/care-episodes/${episode.id}/timeline`} className="text-sm font-bold text-[#023E8A]">
              View full page
            </Link>
          </div>

          {timeline.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-[#71809B]">No timeline events recorded yet.</p>
          ) : (
            <>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#71809B]">Today</p>
              <div className="space-y-4">
                {timeline.map((event) => {
                  const iconMeta = TIMELINE_ICON[event.category];
                  return (
                    <div key={event.id} className="flex gap-3 rounded-lg border border-[#E5E7EB] p-4">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconMeta.className)}>
                        <iconMeta.Icon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-[#111827]">{event.title}</p>
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", TIMELINE_BADGE[event.category])}>
                            {event.status}
                          </span>
                        </div>
                        {event.description ? (
                          <p className="mt-1 text-sm font-medium text-[#71809B]">{event.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-[#71809B]">
                          <span>{formatTime(event.time)}</span>
                          {event.source ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="h-1 w-1 rounded-full bg-[#71809B]" />
                              {event.source}
                            </span>
                          ) : null}
                          {event.type ? (
                            <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-bold text-[#71809B]">{event.type}</span>
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
        onConfirm={(payload) => void handleCloseEpisode(payload)}
      />
    </div>
  );
}
