"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  History,
  Pencil,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  asRecord,
  completeCareEpisodeTask,
  getCareEpisodeById,
  getCareEpisodeMedicationAdherence,
  getRecordArray,
  getString,
  type ApiRecord,
  type CareEpisodeDetail,
  type MedicationAdherenceRecord,
} from "@/lib/api/care-episodes";
import { CareEpisodeSubHeader, SubHeaderSkeleton } from "../_shared/SubHeader";
import { CircularProgress } from "../_shared/CircularProgress";
import { clamp, formatLongDate, formatRelativeTime, getHeaderRiskBadge, getProgressPercent, humanizeSlug } from "../_shared/utils";
import { ReviewImpactModal, type ReviewImpactData } from "../components/ReviewImpactModal";

type ProgressionPoint = { day: string; expected: number; actual: number | null };

function seededRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function buildRecoveryProgression(dayStart: number, totalDays: number, episodeId: string): ProgressionPoint[] {
  const total = Math.max(totalDays, dayStart, 1);
  const points: ProgressionPoint[] = [];
  const seedBase = episodeId.length;

  for (let day = 1; day <= total; day += 1) {
    const expected = clamp(Math.round((day / total) * 100));
    let actual: number | null = null;
    if (day <= dayStart) {
      const noise = (seededRandom(seedBase + day * 2.7) - 0.5) * 8;
      actual = clamp(Math.round(expected * 0.78 + noise));
    }
    points.push({ day: `DAY ${day}`, expected, actual });
  }

  return points;
}

type DailyTask = { id: string; label: string; sub: string; done: boolean };

function isTaskCompleted(task: ApiRecord) {
  const status = getString(task, ["status"]).toLowerCase();
  return status === "completed" || status === "done" || task.completed === true;
}

// currentCarePlan.tasks is an untyped JSON blob in the API; only arrays of task-like
// objects are recognized, matching the same defensive pattern used on the episode detail page.
function buildDailyTasks(carePlan: ApiRecord | null): DailyTask[] {
  return getRecordArray(carePlan, ["tasks"]).map((task, index) => ({
    id: getString(task, ["id", "_id", "taskId"]) || `task-${index}`,
    label: getString(task, ["title", "name", "label"], "Task"),
    sub: getString(task, ["frequency", "schedule", "dueAt", "scheduledAt"]),
    done: isTaskCompleted(task),
  }));
}

function isAlertEvent(event: ApiRecord) {
  const status = getString(event, ["status"]).toLowerCase();
  const eventType = getString(event, ["eventType", "type"]).toLowerCase();
  return status.includes("critical") || status.includes("alert") || eventType.includes("alert") || eventType.includes("escalation");
}

type RecoveryAlert = {
  id: string;
  severity: string;
  tag: string;
  tagClassName: string;
  title: string;
  description: string;
  meta: string;
  className: string;
};

// The care-episode API has no dedicated "alerts" endpoint — alerts are derived from
// timeline events whose status/eventType indicate a critical/escalation condition.
// Acknowledgement is not persisted server-side (no such endpoint exists), so it stays local.
function buildAlertsFromTimeline(timeline: ApiRecord[]): RecoveryAlert[] {
  return timeline.filter(isAlertEvent).map((event, index) => {
    const payload = asRecord(event.payload) ?? {};
    return {
      id: getString(event, ["id", "_id"]) || `alert-${index}`,
      severity: getString(payload, ["severity"], "Medium"),
      tag: "CRITICAL",
      tagClassName: "bg-[#EF4444] text-white",
      title: getString(payload, ["message", "title"]) || humanizeSlug(getString(event, ["eventType", "type"])) || "Alert",
      description: getString(payload, ["details", "description", "note", "summary"]),
      meta: formatRelativeTime(getString(event, ["timestamp"])),
      className: "border-[#FFECEC] bg-[#FFF5F5]",
    };
  });
}

const REVIEW_IMPACT_DATA: ReviewImpactData = {
  title: "Vitals - Resting Heart Rate",
  subtitle: "Reviewing 72-hour clinical trajectory",
  expected: "<85 bpm",
  actual: "104 bpm",
  trend: "worsening (+3 bpm/day over 3 readings)",
  evidence: [
    { label: "Day 2 reading", value: "98 bpm", status: "ELEVATED" },
    { label: "Day 3 reading", value: "101 bpm", status: "HIGH" },
    { label: "Day 4 reading", value: "104 bpm", status: "HIGH" },
    { label: "Cohort benchmark (Day 4)", value: "78-85 bpm", status: "NORMAL RANGE" },
    { label: "Medication adherence", value: "0 of 8 doses", status: "LINKED" },
  ],
};

export default function CareEpisodeRecoveryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [medications, setMedications] = useState<MedicationAdherenceRecord[]>([]);
  const [taskState, setTaskState] = useState<Record<string, boolean>>({});

  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(new Set());
  const [reviewAlertId, setReviewAlertId] = useState<string | null>(null);

  const dailyTasks = useMemo(() => buildDailyTasks(episode?.currentCarePlan ?? null), [episode]);

  useEffect(() => {
    setTaskState(Object.fromEntries(dailyTasks.map((task) => [task.id, task.done])));
  }, [dailyTasks]);

  const handleTaskToggle = async (taskId: string, checked: boolean) => {
    setTaskState((prev) => ({ ...prev, [taskId]: checked }));
    if (!checked) return;
    try {
      await completeCareEpisodeTask(episodeId, taskId);
    } catch (requestError) {
      setTaskState((prev) => ({ ...prev, [taskId]: false }));
      toast.error(requestError instanceof Error ? requestError.message : "Failed to complete task.");
    }
  };

  const timelineAlerts = useMemo(() => buildAlertsFromTimeline(episode?.recentTimeline ?? []), [episode]);
  const alerts = useMemo(
    () =>
      timelineAlerts.map((alert) =>
        acknowledgedAlertIds.has(alert.id)
          ? { ...alert, tag: "ACKNOWLEDGED", tagClassName: "bg-[#DFFBF0] text-[#10B981]", className: "border-[#DFFBF0] bg-[#F3FCF9]" }
          : alert,
      ),
    [timelineAlerts, acknowledgedAlertIds],
  );

  const acknowledgeAlert = (id: string) => {
    setAcknowledgedAlertIds((prev) => new Set(prev).add(id));
  };

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const detail = await getCareEpisodeById(episodeId);
        if (!ignore) setEpisode(detail);
      } catch (requestError) {
        if (!ignore) {
          setEpisode(null);
          setError(requestError instanceof Error ? requestError.message : "Failed to load care episode.");
        }
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

    (async () => {
      try {
        const list = await getCareEpisodeMedicationAdherence(episodeId);
        if (!ignore) setMedications(list);
      } catch {
        if (!ignore) setMedications([]);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  const carePlanAdherence = useMemo(() => {
    if (medications.length === 0) return 0;
    const total = medications.reduce((sum, medication) => sum + medication.adherencePercentage, 0);
    return clamp(Math.round(total / medications.length));
  }, [medications]);

  const missedDoseCount = useMemo(() => medications.reduce((sum, medication) => sum + medication.missedCount, 0), [medications]);

  const overallProgress = episode?.dayProgress ?? getProgressPercent(episode?.dayStart ?? null, episode?.expectedDurationDays ?? null);

  const expectedRecoveryDate = useMemo(() => {
    if (!episode?.createdAt || !episode.expectedDurationDays) return "--";
    const parsed = Date.parse(episode.createdAt);
    if (!Number.isFinite(parsed)) return "--";
    const date = new Date(parsed);
    date.setDate(date.getDate() + episode.expectedDurationDays);
    return formatLongDate(date.toISOString());
  }, [episode]);

  const daysRemaining = Math.max((episode?.expectedDurationDays ?? 0) - (episode?.dayStart ?? 0), 0);

  const outcomes = useMemo(() => {
    const riskScore = episode?.riskScore ?? null;
    const category = (episode?.riskCategory ?? "").toLowerCase();
    const deteriorationRisk =
      riskScore !== null ? clamp(Math.round(riskScore)) : category === "high" ? 70 : category === "medium" ? 40 : category === "low" ? 15 : 25;
    const recoveryProbability = clamp(100 - deteriorationRisk);
    const relapseRisk = clamp(Math.round(deteriorationRisk * 0.85));
    return { recoveryProbability, deteriorationRisk, relapseRisk };
  }, [episode]);

  const progression = useMemo(
    () => buildRecoveryProgression(episode?.dayStart ?? 1, episode?.expectedDurationDays ?? 14, episodeId),
    [episode, episodeId],
  );

  const biometricTrendsValue = clamp(100 - outcomes.deteriorationRisk - 20);

  const completedTaskCount = dailyTasks.filter((task) => taskState[task.id]).length;

  if (isLoading && !episode) {
    return <SubHeaderSkeleton />;
  }

  if (error && !episode) {
    return (
      <div className="space-y-6">
        <SubHeaderSkeleton />
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
  const riskBadge = getHeaderRiskBadge(episode.riskCategory);
  const recoveryPhaseLabel = episode.carePhase || "--";

  return (
    <div className="space-y-6">
      <CareEpisodeSubHeader episodeId={episodeId} episode={episode} />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-[#111827]">Recovery &amp; Outcomes</h1>
          <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
            {riskBadge.label === "High" ? "AT RISK" : riskBadge.label.toUpperCase()}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-[#71809B]">
          A comprehensive intelligence overview for patient {patient?.name || "Unknown Patient"} ({patient?.hospitalId || "--"})
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Expected Recovery</p>
            <p className="mt-2 text-xl font-bold text-[#111827]">{expectedRecoveryDate}</p>
            <p className="mt-1 text-xs font-medium text-[#71809B]">{daysRemaining} days remaining</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Recovery Phase</p>
            <p className="mt-2 text-xl font-bold text-[#EF4444]">{recoveryPhaseLabel}</p>
            <p className="mt-1 text-xs font-medium text-[#71809B]">System-classified phase</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Care Plan Adherence</p>
            <p className="mt-2 text-xl font-bold text-[#10B981]">{carePlanAdherence}%</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${carePlanAdherence}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Overall Progress</p>
            <p className="mt-2 text-xl font-bold text-[#023E8A]">{overallProgress}%</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div className="h-full rounded-full bg-[#023E8A]" style={{ width: `${overallProgress}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#023E8A]" />
                <h2 className="text-base font-bold text-[#111827]">Recovery Intelligence</h2>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">System-Generated Insights</p>

              <div className="mt-4 rounded-lg bg-[#EFF5FF] p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-[#023E8A]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Trajectory Summary
                </p>
                <p className="text-sm font-medium text-[#344054]">
                  Recovery is slower than expected due to low evening medication adherence and a recent{" "}
                  <span className="font-bold text-[#EF4444]">SpO2 drop to 88%</span>. Clinical intervention is advised to recalibrate
                  the care plan.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#71809B]">Recovery Progression Over Time</p>
                <div className="flex items-center gap-4 text-xs font-medium text-[#71809B]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3 border-t-2 border-dashed border-[#9CA3AF]" />
                    Expected
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded-full bg-[#023E8A]" />
                    Actual
                  </span>
                </div>
              </div>

              <div className="mt-4" style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progression}>
                    <CartesianGrid vertical={false} stroke="#EEF1F6" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#71809B", fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71809B", fontSize: 11 }} width={30} />
                    <Tooltip />
                    <Line type="monotone" dataKey="expected" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="actual" stroke="#023E8A" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.08em] text-[#71809B]">Contributing Factors</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#111827]">Care Plan Adherence</p>
                    <p className="text-sm font-bold text-[#EF4444]">{carePlanAdherence}%</p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${carePlanAdherence}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#71809B]">
                    {missedDoseCount > 0 ? `${missedDoseCount} missed evening doses` : "All doses on schedule"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#111827]">Biometric Trends</p>
                    <p className="text-sm font-bold text-[#EF4444]">{biometricTrendsValue}%</p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${biometricTrendsValue}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#71809B]">--</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#111827]">Clinical Inputs</p>
                    <p className="text-sm font-bold text-[#023E8A]">--</p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#023E8A]" style={{ width: "0%" }} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#71809B]">--</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#111827]">Recent Interventions</p>
                    <p className="text-sm font-bold text-[#023E8A]">--</p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full rounded-full bg-[#023E8A]" style={{ width: "0%" }} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#71809B]">--</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-[#023E8A]" />
                <h2 className="text-base font-bold text-[#111827]">Clinical Assessment</h2>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Last Assessment</p>
                  <p className="mt-1 text-sm font-bold text-[#111827]">{formatLongDate(episode.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Assessments Completed</p>
                  <p className="mt-1 text-sm font-bold text-[#111827]">--</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => toast.info("New assessment workflow is coming soon.")}
                  className="h-10 gap-2 rounded-lg bg-[#023E8A] px-4 text-sm font-bold text-white hover:bg-[#023575]"
                >
                  <Plus className="h-4 w-4" />
                  New Assessment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toast.info("Assessment history is coming soon.")}
                  className="h-10 gap-2 rounded-lg border-[#DDE3EC] px-4 text-sm font-bold text-[#111827] hover:bg-[#F8FAFC]"
                >
                  <History className="h-4 w-4" />
                  View History
                </Button>
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
        </div>

        <div className="space-y-6">
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-base font-bold text-[#111827]">Clinical Action Workspace</h2>
              <p className="mt-1 text-sm font-medium text-[#71809B]">Initiate interventions based on recovery insights.</p>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/care-episodes/${episodeId}/recovery/adjust-plan`)}
                  className="flex w-full items-center gap-3 rounded-lg bg-[#F8FAFC] p-3 text-left hover:bg-[#F1F5F9]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7F2FF] text-[#023E8A]">
                    <Pencil className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#111827]">Adjust Care Plan</p>
                    <p className="text-xs font-medium text-[#71809B]">Open care plan editor</p>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#71809B]" />
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("Appointment scheduling is coming soon.")}
                  className="flex w-full items-center gap-3 rounded-lg bg-[#F8FAFC] p-3 text-left hover:bg-[#F1F5F9]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7F2FF] text-[#023E8A]">
                    <CalendarPlus className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#111827]">Schedule Follow-up</p>
                    <p className="text-xs font-medium text-[#71809B]">Create appointment</p>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#71809B]" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/care-episodes/${episodeId}/recovery/send-instruction`)}
                  className="flex w-full items-center gap-3 rounded-lg bg-[#F8FAFC] p-3 text-left hover:bg-[#F1F5F9]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7F2FF] text-[#023E8A]">
                    <Send className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#111827]">Send Patient Instruction</p>
                    <p className="text-xs font-medium text-[#71809B]">Open messaging module</p>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#71809B]" />
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#111827]">Daily Care Tasks</h2>
                  <p className="text-xs font-medium text-[#71809B]">
                    {patient?.name || "Patient"} · Day {episode.dayStart ?? 0} of {episode.expectedDurationDays ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[#71809B]">
                  <button type="button" className="rounded p-1 hover:bg-[#F3F4F6]">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-[#344054]">Today</span>
                  <button type="button" className="rounded p-1 hover:bg-[#F3F4F6]">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-bold text-[#71809B]">
                <p>Daily Check-ins</p>
                <p>
                  {completedTaskCount} / {dailyTasks.length} completed
                </p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className="h-full rounded-full bg-[#023E8A]"
                  style={{ width: `${dailyTasks.length > 0 ? (completedTaskCount / dailyTasks.length) * 100 : 0}%` }}
                />
              </div>

              <div className="mt-4 space-y-3">
                {dailyTasks.length === 0 ? (
                  <p className="py-4 text-center text-sm font-medium text-[#71809B]">No care-plan tasks configured yet.</p>
                ) : null}
                {dailyTasks.map((task) => (
                  <label key={task.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={taskState[task.id]}
                      onCheckedChange={(checked) => void handleTaskToggle(task.id, Boolean(checked))}
                    />
                    <span className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#111827]">{task.label}</p>
                      <p className="text-xs font-medium text-[#71809B]">{task.sub || "--"}</p>
                    </span>
                  </label>
                ))}
              </div>

              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#10B981]">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                Last synced {formatRelativeTime(episode.updatedAt)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-base font-bold text-[#111827]">
                  <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
                  Open Alerts
                </h2>
                <span className="rounded-full bg-[#FFECEC] px-2.5 py-0.5 text-xs font-bold text-[#EF4444]">
                  {alerts.length} OPEN
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {alerts.length === 0 ? (
                  <p className="py-4 text-center text-sm font-medium text-[#71809B]">No open alerts.</p>
                ) : null}
                {alerts.map((alert) => (
                  <div key={alert.id} className={cn("rounded-lg border p-4", alert.className)}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-[#71809B]">{alert.severity}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold", alert.tagClassName)}>{alert.tag}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-[#111827]">{alert.title}</p>
                    <p className="mt-1 text-xs font-medium text-[#71809B]">{alert.description}</p>
                    <div className="mt-2 flex items-center justify-between text-xs font-medium text-[#71809B]">
                      <span>{alert.meta}</span>
                    </div>
                    {alert.tag === "CRITICAL" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setReviewAlertId(alert.id)}
                        className="mt-3 h-9 w-full rounded-lg border-[#EF4444] text-xs font-bold text-[#EF4444] hover:bg-red-50"
                      >
                        Review Impact
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ReviewImpactModal
        open={Boolean(reviewAlertId)}
        alert={reviewAlertId ? REVIEW_IMPACT_DATA : null}
        onOpenChange={(open) => {
          if (!open) setReviewAlertId(null);
        }}
        onAcknowledge={() => {
          if (reviewAlertId) acknowledgeAlert(reviewAlertId);
        }}
      />
    </div>
  );
}
