"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
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
import { RoleGate } from "@/components/auth/RoleGate";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getOpenAlertsForEpisode, type ClinicalAlert } from "@/lib/api/alerts";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getAssessmentHistory } from "@/lib/api/careTeamAndPlan.api";
import {
  getCareEpisodeById,
  getCareEpisodeDailyVitals,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeTaskCompletion,
  getCareEpisodeTimelinePage,
  getRecordArray,
  getString,
  type ApiRecord,
  type CareEpisodeDetail,
  type DailyVitalsRecord,
  type MedicationAdherenceRecord,
  type TaskCompletionRecord,
} from "@/lib/api/care-episodes";
import { SubHeaderSkeleton } from "../_shared/SubHeader";
import { CircularProgress } from "../_shared/CircularProgress";
import { clamp, formatLongDate, formatRelativeTime, getHeaderRiskBadge, getProgressPercent } from "../_shared/utils";
import { ReviewImpactModal, type ReviewImpactData } from "../components/ReviewImpactModal";

const CLINICIAN_ROLE = ["clinician"] as const;

type ProgressionPoint = { day: string; expected: number; actual: number | null };
type DailyTask = { id: string; label: string; sub: string; done: boolean };

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, amount: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return localDateKey(next);
}

type RecoveryAlert = {
  id: string;
  severity: string;
  title: string;
  description: string;
  meta: string;
};

function buildExpectedProgression(totalDays: number): ProgressionPoint[] {
  const total = Math.max(totalDays, 1);
  return Array.from({ length: total }, (_, index) => ({
    day: `DAY ${index + 1}`,
    expected: clamp(Math.round(((index + 1) / total) * 100)),
    actual: null,
  }));
}

function isTaskCompleted(task: ApiRecord) {
  const status = getString(task, ["status"]).toLowerCase();
  return status === "completed" || status === "done" || task.completed === true;
}

function buildDailyTasks(carePlan: ApiRecord | null): DailyTask[] {
  return getRecordArray(carePlan, ["tasks"]).map((task, index) => ({
    id: getString(task, ["id", "_id", "taskId"]) || `task-${index}`,
    label: getString(task, ["title", "name", "label"], "Task"),
    sub: getString(task, ["frequency", "schedule", "dueAt", "scheduledAt", "dueDate"]),
    done: isTaskCompleted(task),
  }));
}

function buildRecoveryAlerts(alerts: ClinicalAlert[]): RecoveryAlert[] {
  return alerts.map((alert) => ({
    id: alert.id,
    severity: alert.severity,
    title: alert.reason,
    description: `Triggered by ${alert.triggerSource}.`,
    meta: formatRelativeTime(alert.timestamp),
  }));
}
function vitalMetricForAlert(alert: RecoveryAlert, records: DailyVitalsRecord[]) {
  const text = `${alert.title} ${alert.description}`.toLowerCase();
  const candidates = text.includes("oxygen") || text.includes("spo2")
    ? [{ key: "spo2" as const, label: "SpO₂", unit: "%" }]
    : text.includes("heart") || text.includes("pulse")
      ? [{ key: "heartRate" as const, label: "Heart rate", unit: " bpm" }]
      : text.includes("blood pressure")
        ? [{ key: "bloodPressureSystolic" as const, label: "Systolic blood pressure", unit: " mmHg" }]
        : [
            { key: "spo2" as const, label: "SpO₂", unit: "%" },
            { key: "heartRate" as const, label: "Heart rate", unit: " bpm" },
            { key: "bloodPressureSystolic" as const, label: "Systolic blood pressure", unit: " mmHg" },
          ];

  for (const candidate of candidates) {
    const entries = records
      .filter((record) => record.hasEntry && record.vitals[candidate.key] != null)
      .map((record) => ({ date: record.date, value: record.vitals[candidate.key] as number }));
    if (entries.length > 0) return { ...candidate, entries };
  }
  return null;
}

function buildReviewImpact(alert: RecoveryAlert, vitals: DailyVitalsRecord[], medications: MedicationAdherenceRecord[]): ReviewImpactData {
  const metric = vitalMetricForAlert(alert, vitals);
  const evidence: ReviewImpactData["evidence"] = [];
  if (metric) {
    for (const entry of metric.entries.slice(-3)) {
      evidence.push({
        label: entry.date ? formatLongDate(entry.date) : "Recorded vital",
        value: `${entry.value}${metric.unit}`,
        status: "RECORDED",
      });
    }
  }
  const totalDoses = medications.reduce((total, item) => total + item.totalDoses, 0);
  const takenDoses = medications.reduce((total, item) => total + item.takenCount, 0);
  if (totalDoses > 0) evidence.push({ label: "Medication adherence", value: `${takenDoses} of ${totalDoses} doses`, status: "LINKED" });

  const latest = metric?.entries.at(-1)?.value;
  const first = metric?.entries.at(0)?.value;
  const delta = latest != null && first != null ? latest - first : null;
  const metricEntries = metric?.entries ?? [];
  const trend = delta == null || metricEntries.length === 1
    ? "Insufficient readings to calculate a trend"
    : delta === 0
      ? `Stable across ${metricEntries.length} readings`
      : `${delta > 0 ? "Rising" : "Falling"} by ${Math.abs(delta)}${metric?.unit.trim() ?? ""} across ${metricEntries.length} readings`;

  return {
    title: alert.title,
    subtitle: "Reviewing evidence available for this care episode",
    expectedLabel: "Alert threshold",
    expected: "Not supplied by API",
    actualLabel: metric ? `Latest ${metric.label.toLowerCase()}` : "Latest recorded value",
    actual: latest != null && metric ? `${latest}${metric.unit}` : "No linked vital available",
    trend,
    evidence,
  };
}

function latestVitalsSummary(records: DailyVitalsRecord[]) {
  const latest = records.filter((record) => record.hasEntry).at(-1);
  if (!latest) return "No daily vitals recorded";
  const values = [
    latest.vitals.spo2 != null ? `SpO₂ ${latest.vitals.spo2}%` : "",
    latest.vitals.heartRate != null ? `HR ${latest.vitals.heartRate} bpm` : "",
    latest.vitals.bloodPressureSystolic != null
      ? `BP ${latest.vitals.bloodPressureSystolic}/${latest.vitals.bloodPressureDiastolic ?? "--"}`
      : "",
  ].filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "Vitals entry has no supported measurements";
}

export default function CareEpisodeRecoveryPage() {
  const params = useParams<{ id: string }>();
  const { role } = useDashboardUser();
  const router = useRouter();
  const episodeId = params?.id ?? "";
  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [medications, setMedications] = useState<MedicationAdherenceRecord[]>([]);
  const [dailyVitals, setDailyVitals] = useState<DailyVitalsRecord[]>([]);
  const [timeline, setTimeline] = useState<ApiRecord[]>([]);
  const [alerts, setAlerts] = useState<RecoveryAlert[]>([]);
  const [assessmentDates, setAssessmentDates] = useState<string[]>([]);
  const [taskDate, setTaskDate] = useState(() => localDateKey(new Date()));
  const [taskCompletion, setTaskCompletion] = useState<TaskCompletionRecord | null>(null);
  const [reviewAlertId, setReviewAlertIdState] = useState<string | null>(null);
  const setReviewAlertId = (alertId: string | null) => {
    if (alertId === null || role === "clinician") setReviewAlertIdState(alertId);
  };
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertsError, setAlertsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (episodeId) capturePostHogEvent("recovery_outcomes_viewed", { episode_id: episodeId });
  }, [episodeId]);

  useEffect(() => {
    if (!episodeId) return;
    let active = true;
    void (async () => {
      const [episodeResult, medicationResult, vitalsResult, timelineResult, assessmentResult] = await Promise.allSettled([
        getCareEpisodeById(episodeId),
        getCareEpisodeMedicationAdherence(episodeId),
        getCareEpisodeDailyVitals(episodeId, 7),
        getCareEpisodeTimelinePage(episodeId, { limit: 100 }),
        getAssessmentHistory(episodeId),
      ]);
      if (!active) return;

      let nextAlerts: RecoveryAlert[] = [];
      if (episodeResult.status === "fulfilled") {
        try {
          const openAlerts = await getOpenAlertsForEpisode(
            episodeId,
            episodeResult.value.patientId,
          );
          nextAlerts = buildRecoveryAlerts(openAlerts);
          setAlertsError("");
        } catch (requestError) {
          if (active) {
            setAlertsError(
              requestError instanceof Error
                ? requestError.message
                : "Unable to load open alerts.",
            );
          }
        }
      }
      if (!active) return;

      if (episodeResult.status === "fulfilled") {
        setEpisode(episodeResult.value);
        setTimeline(episodeResult.value.recentTimeline);
      } else {
        setEpisode(null);
        setError(episodeResult.reason instanceof Error ? episodeResult.reason.message : "Failed to load care episode.");
      }
      setAlerts(nextAlerts);
      setMedications(medicationResult.status === "fulfilled" ? medicationResult.value : []);
      setDailyVitals(vitalsResult.status === "fulfilled" ? vitalsResult.value : []);
      if (timelineResult.status === "fulfilled") setTimeline(timelineResult.value.data.map((event) => ({ ...event })));
      setAssessmentDates(assessmentResult.status === "fulfilled" ? assessmentResult.value.map((assessment) => assessment.date) : []);
      setIsLoading(false);
    })();

    return () => { active = false; };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    getCareEpisodeTaskCompletion(episodeId, taskDate)
      .then((result) => { if (!ignore) setTaskCompletion(result); })
      .catch(() => { if (!ignore) setTaskCompletion(null); });
    return () => { ignore = true; };
  }, [episodeId, taskDate]);

  const dailyTasks = useMemo(() => buildDailyTasks(episode?.currentCarePlan ?? null), [episode]);
  const selectedAlert = alerts.find((alert) => alert.id === reviewAlertId) ?? null;
  const reviewImpact = selectedAlert ? buildReviewImpact(selectedAlert, dailyVitals, medications) : null;
  const adherence = medications.length > 0
    ? clamp(Math.round(medications.reduce((total, medication) => total + medication.adherencePercentage, 0) / medications.length))
    : null;
  const missedDoseCount = medications.reduce((total, medication) => total + medication.missedCount, 0);
  const completedTaskCount = dailyTasks.filter((task) => task.done).length;
  const displayedCompletedCount = taskCompletion?.completed ?? completedTaskCount;
  const displayedTaskCount = taskCompletion?.totalDue ?? dailyTasks.length;
  const taskCompletionPercent = taskCompletion
    ? taskCompletion.completionRate * 100
    : displayedTaskCount > 0 ? (displayedCompletedCount / displayedTaskCount) * 100 : 0;
  const todayKey = localDateKey(new Date());
  const assessmentCount = assessmentDates.length;
  const lastAssessment = assessmentDates.at(0) ?? assessmentDates.at(-1) ?? "";

  if (isLoading && !episode) return <SubHeaderSkeleton episodeId={episodeId} />;
  if (error && !episode) {
    return <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center"><AlertCircle className="h-8 w-8 text-destructive" /><p className="text-sm font-semibold text-destructive">{error}</p><Button type="button" variant="outline" onClick={() => { setIsLoading(true); setError(""); setRefreshKey((key) => key + 1); }}>Try Again</Button></div>;
  }
  if (!episode) return null;

  const patient = episode.patient;
  const riskBadge = getHeaderRiskBadge(episode.riskCategory);
  const overallProgress = episode.dayProgress ?? getProgressPercent(episode.dayStart, episode.expectedDurationDays);
  const expectedRecoveryDate = (() => {
    if (!episode.createdAt || !episode.expectedDurationDays) return "--";
    const date = new Date(episode.createdAt);
    if (Number.isNaN(date.getTime())) return "--";
    date.setDate(date.getDate() + episode.expectedDurationDays);
    return formatLongDate(date.toISOString());
  })();
  const daysRemaining = episode.expectedDurationDays == null || episode.dayStart == null
    ? null
    : Math.max(episode.expectedDurationDays - episode.dayStart, 0);
  const progression = buildExpectedProgression(episode.expectedDurationDays ?? 1);
  const latestVitals = latestVitalsSummary(dailyVitals);
  const summary = [
    episode.riskCategory ? `Current risk is ${episode.riskCategory.toLowerCase()}${episode.riskScore != null ? ` (${episode.riskScore})` : ""}.` : "No current risk classification is available.",
    adherence != null ? `Medication adherence is ${adherence}% with ${missedDoseCount} missed dose${missedDoseCount === 1 ? "" : "s"}.` : "No medication-adherence records are available.",
    `${latestVitals}.`,
  ].join(" ");

  const openAction = (action: string, href: string) => {
    capturePostHogEvent("recovery_action_opened", { episode_id: episodeId, action });
    router.push(href);
  };

  return (
    <div className="space-y-6 pb-8">
      <button type="button" aria-label="Back to care episode" onClick={() => router.push(`/dashboard/care-episodes/${episodeId}`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"><ArrowLeft className="h-4 w-4" /></button>

      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-foreground">Recovery &amp; Outcomes</h1><span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>{riskBadge.label === "High" ? "AT RISK" : riskBadge.label.toUpperCase()}</span></div>
        <p className="mt-1 text-sm font-medium text-muted-foreground">A comprehensive intelligence overview for patient {patient?.name || "Unknown Patient"} ({patient?.hospitalId || "--"})</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Expected Recovery" value={expectedRecoveryDate} detail={daysRemaining == null ? "Duration unavailable" : `${daysRemaining} days remaining`} />
        <MetricCard label="Recovery Phase" value={episode.carePhase || "--"} detail="Care phase from episode API" valueClassName="text-destructive" />
        <MetricCard label="Care Plan Adherence" value={adherence == null ? "--" : `${adherence}%`} detail={adherence == null ? "No adherence records" : `${missedDoseCount} missed dose${missedDoseCount === 1 ? "" : "s"}`} progress={adherence} />
        <MetricCard label="Overall Progress" value={`${overallProgress}%`} detail="Elapsed episode duration" progress={overallProgress} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-base font-bold text-foreground">Recovery Intelligence</h2></div>
            <p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Episode data summary</p>
            <div className="mt-4 rounded-lg bg-primary/5 p-4"><p className="mb-1 text-xs font-bold uppercase text-primary">Clinical data summary</p><p className="text-sm font-medium text-foreground/80">{summary}</p></div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Recovery Progression Over Time</p><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-0.5 w-3 border-t-2 border-dashed border-muted-foreground" />Expected schedule</span></div>
            <div className="mt-4 h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={progression}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={30} /><Tooltip /><Line type="monotone" dataKey="expected" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer></div>
            <p className="mt-2 text-xs text-muted-foreground">The API does not provide an actual recovery trajectory, so only the expected schedule is shown.</p>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Contributing Factors</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FactorCard title="Care Plan Adherence" value={adherence == null ? "--" : `${adherence}%`} detail={adherence == null ? "No medication logs" : `${missedDoseCount} missed dose${missedDoseCount === 1 ? "" : "s"}`} />
              <FactorCard title="Biometric Trends" value={`${dailyVitals.filter((item) => item.hasEntry).length} entries`} detail={latestVitals} />
              <FactorCard title="Clinical Inputs" value={`${assessmentCount} assessments`} detail={lastAssessment ? `Last ${formatLongDate(lastAssessment)}` : "No assessments recorded"} />
              <FactorCard title="Recent Interventions" value={`${timeline.length} events`} detail="From the care-episode timeline" />
            </div>
          </CardContent></Card>

          <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><h2 className="text-base font-bold text-foreground">Clinical Assessment</h2></div>
            <div className="mt-4 flex flex-wrap items-center gap-8"><div><p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Last Assessment</p><p className="mt-1 text-sm font-bold text-foreground">{lastAssessment ? formatLongDate(lastAssessment) : "--"}</p></div><div><p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Assessments Completed</p><p className="mt-1 text-sm font-bold text-foreground">{assessmentCount}</p></div></div>
            <RoleGate allowedRoles={CLINICIAN_ROLE}><div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={() => openAction("new_assessment", `/dashboard/care-episodes/${episodeId}/assessment`)}><Plus className="h-4 w-4" />New Assessment</Button><Button type="button" variant="outline" onClick={() => openAction("assessment_history", `/dashboard/care-episodes/${episodeId}/assessment-history`)}><History className="h-4 w-4" />View History</Button></div></RoleGate>
          </CardContent></Card>

          <section><h2 className="mb-4 text-base font-bold text-foreground">Recovery Outcomes</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OutcomeCard label="Recovery Probability" detail="Forecast unavailable" />
            <OutcomeCard label="Risk of Deterioration" detail="7-day forecast unavailable" />
            <OutcomeCard label="Relapse Risk Forecast" detail="30-day forecast unavailable" />
          </div></section>
        </div>

        <div className="space-y-6">
          <RoleGate allowedRoles={CLINICIAN_ROLE}>
          <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-5"><h2 className="text-base font-bold text-foreground">Clinical Action Workspace</h2><p className="mt-1 text-sm font-medium text-muted-foreground">Initiate interventions based on recovery insights.</p><div className="mt-4 space-y-3">
            <ActionButton icon={<Pencil className="h-4 w-4" />} title="Adjust Care Plan" detail="Open care plan editor" onClick={() => openAction("adjust_care_plan", `/dashboard/care-episodes/${episodeId}/recovery/adjust-plan`)} />
            <ActionButton icon={<CalendarPlus className="h-4 w-4" />} title="Schedule Follow-up" detail="Open appointments" onClick={() => openAction("schedule_follow_up", `/dashboard/appointments?patientId=${encodeURIComponent(episode.patientId)}`)} />
            <ActionButton icon={<Send className="h-4 w-4" />} title="Send Patient Instruction" detail="Open messaging module" onClick={() => openAction("send_instruction", `/dashboard/messages?${new URLSearchParams({ episodeId, patientId: episode.patientId, patientName: patient?.name || "Patient" })}`)} />
          </div></CardContent></Card>
          </RoleGate>

          <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-foreground">Daily Care Tasks</h2><p className="text-xs font-medium text-muted-foreground">{patient?.name || "Patient"} · Day {episode.dayStart ?? "--"} of {episode.expectedDurationDays ?? "--"}</p></div><div className="flex items-center gap-1 text-muted-foreground"><button type="button" aria-label="Previous care-task day" onClick={() => setTaskDate((date) => shiftDate(date, -1))} className="rounded p-1 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-20 text-center text-xs font-bold text-foreground/80">{taskDate === todayKey ? "Today" : formatLongDate(taskDate)}</span><button type="button" aria-label="Next care-task day" disabled={taskDate >= todayKey} onClick={() => setTaskDate((date) => shiftDate(date, 1))} className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-muted-foreground"><p>Daily Check-ins</p><p>{displayedCompletedCount} / {displayedTaskCount} completed</p></div><div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${taskCompletionPercent}%` }} /></div>
            <div className="mt-4 space-y-3">{dailyTasks.length === 0 ? <p className="py-4 text-center text-sm font-medium text-muted-foreground">No care-plan tasks configured yet.</p> : null}{dailyTasks.map((task) => <div key={task.id} className="flex items-center gap-3"><Checkbox checked={task.done} disabled aria-label={`${task.label}: ${task.done ? "completed" : "not completed"} (read only)`} className="disabled:cursor-default disabled:opacity-100" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-foreground">{task.label}</span><span className="block text-xs font-medium text-muted-foreground">{task.sub || "No schedule supplied"}</span></span></div>)}</div>
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Last synced {formatRelativeTime(episode.updatedAt)}</p>
          </CardContent></Card>

          <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-base font-bold text-foreground"><AlertTriangle className="h-4 w-4 text-destructive" />Open Alerts</h2><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">{alerts.length} OPEN</span></div><div className="mt-4 space-y-3">{alertsError ? <p className="py-4 text-center text-sm font-medium text-destructive">{alertsError}</p> : alerts.length === 0 ? <p className="py-4 text-center text-sm font-medium text-muted-foreground">No open alerts for this care episode.</p> : null}{alerts.map((alert) => <div key={alert.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase text-muted-foreground">{alert.severity}</span><span className="rounded-full bg-destructive px-2.5 py-0.5 text-[10px] font-bold text-destructive-foreground">OPEN</span></div><p className="mt-1.5 text-sm font-bold text-foreground">{alert.title}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{alert.description}</p><p className="mt-2 text-xs font-medium text-muted-foreground">{alert.meta}</p><Button type="button" variant="outline" onClick={() => { setReviewAlertId(alert.id); capturePostHogEvent("recovery_alert_impact_opened", { episode_id: episodeId, alert_id: alert.id }); }} className="mt-3 h-9 w-full border-destructive/30 text-xs font-bold text-destructive hover:bg-destructive/10">Review Impact</Button></div>)}</div></CardContent></Card>
        </div>
      </div>

      <ReviewImpactModal
        open={Boolean(reviewAlertId)}
        alert={reviewImpact}
        onOpenChange={(open) => { if (!open) setReviewAlertId(null); }}
        onAcknowledge={() => undefined}
        careEpisodeHref={`/dashboard/care-episodes/${episodeId}#risk-intelligence`}
      />
    </div>
  );
}

function MetricCard({ label, value, detail, progress, valueClassName }: { label: string; value: string; detail: string; progress?: number | null; valueClassName?: string }) {
  return <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">{label}</p><p className={cn("mt-2 text-xl font-bold text-foreground", valueClassName)}>{value}</p>{progress != null ? <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div> : null}<p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p></CardContent></Card>;
}

function FactorCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-border p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-foreground">{title}</p><p className="shrink-0 text-sm font-bold text-primary">{value}</p></div><p className="mt-2 text-xs font-medium text-muted-foreground">{detail}</p></div>;
}

function OutcomeCard({ label, detail }: { label: string; detail: string }) {
  return <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="flex flex-col items-center p-6 text-center"><p className="mb-4 text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">{label}</p><CircularProgress percent={null} trackColor="hsl(var(--muted))" progressColor="hsl(var(--primary))" /><p className="mt-4 text-xs font-medium text-muted-foreground">{detail}</p></CardContent></Card>;
}

function ActionButton({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg bg-muted/60 p-3 text-left hover:bg-muted"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-foreground">{title}</span><span className="block text-xs font-medium text-muted-foreground">{detail}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>;
}
