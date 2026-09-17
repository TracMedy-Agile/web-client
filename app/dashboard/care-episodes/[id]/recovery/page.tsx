"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  BrainCircuit,
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  HeartPulse,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Pencil,
  Plus,
  Send,
  TrendingUp,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { acknowledgeAlert, getOpenAlertsForEpisode, type ClinicalAlert } from "@/lib/api/alerts";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getAssessmentHistory } from "@/lib/api/careTeamAndPlan.api";
import {
  getCareEpisodeById,
  getHumanReadableCareEpisodeReference,
  getCareEpisodeDailyVitals,
  getCareEpisodeForecast,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeTaskCompletion,
  getCareEpisodeTaskCompletionLog,
  getCareEpisodeTimelinePage,
  type ApiRecord,
  type CareEpisodeDetail,
  type DailyVitalsRecord,
  type EpisodeForecast,
  type MedicationAdherenceRecord,
  type TaskCompletionLog,
  type TaskCompletionRecord,
} from "@/lib/api/care-episodes";
import { SubHeaderSkeleton } from "../_shared/SubHeader";
import { CircularProgress } from "../_shared/CircularProgress";
import { clamp, formatLongDate, formatRelativeTime, getHeaderRiskBadge, getProgressPercent, getSavedWarningSignsFromPlan } from "../_shared/utils";
import { ReviewImpactModal, type ReviewImpactData } from "../components/ReviewImpactModal";
import { buildCareTaskRows, type CareTaskRow } from "../_shared/taskCompletion";
import ScheduleAppointmentModal, { type ScheduledAppointmentResult } from "@/app/dashboard/appointments/components/ScheduleAppointmentModal";

type ProgressionPoint = { day: string; expected: number; actual: number | null };
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
  triggerSource: string;
  status: ClinicalAlert["status"];
  acknowledgedAt: string | null;
  acknowledgedBy: string;
  thresholdDetails: ClinicalAlert["thresholdDetails"];
};

function buildRecoveryProgression(totalDays: number, currentDay: number | null, actualRecovery: number | null): ProgressionPoint[] {
  const total = Math.max(totalDays, 1);
  const actualDay = currentDay == null ? null : Math.min(Math.max(Math.round(currentDay), 1), total);
  return Array.from({ length: total }, (_, index) => ({
    day: "DAY " + (index + 1),
    expected: clamp(Math.round(((index + 1) / total) * 100)),
    actual: actualRecovery != null && actualDay === index + 1 ? clamp(Math.round(actualRecovery)) : null,
  }));
}

function buildRecoveryAlerts(alerts: ClinicalAlert[]): RecoveryAlert[] {
  return alerts.map((alert) => {
    const threshold = alert.thresholdDetails[0];
    return {
      id: alert.id,
      severity: alert.severity,
      title: alert.reason,
      description: threshold?.warningMessage || `Triggered by ${alert.triggerSource}.`,
      meta: formatRelativeTime(alert.timestamp),
      triggerSource: alert.triggerSource,
      status: alert.status,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedBy: alert.acknowledgedBy,
      thresholdDetails: alert.thresholdDetails,
    };
  });
}

function formatTaskClock(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(parsed));
}

function formatTaskSchedule(value: string) {
  const schedule = value.trim();
  if (!schedule) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(schedule)) {
    const date = new Date(`${schedule}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? schedule
      : `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
  }

  if (/^\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(schedule)) return `Due at ${schedule}`;

  const parsed = Date.parse(schedule);
  if (Number.isFinite(parsed)) {
    const hasTime = /[T ]\d{1,2}:\d{2}/.test(schedule) || /Z$/i.test(schedule);
    if (hasTime) return `Due at ${formatTaskClock(schedule)}`;
    return `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed))}`;
  }

  return `Schedule: ${schedule}`;
}

function formatTaskSyncAge(value: string | null) {
  if (!value) return "awaiting sync";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "awaiting sync";
  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ago`;
}

function taskDetailText(task: CareTaskRow) {
  const completedAt = task.completedAt ? formatTaskClock(task.completedAt) : null;
  const schedule = formatTaskSchedule(task.sub);
  const note = task.completion?.notes?.trim();
  if (note) return `Logged ${note}${completedAt ? ` · ${completedAt}` : ""}`;
  if (task.kind === "medication" && completedAt) return `Taken at: ${completedAt}${schedule ? ` · ${schedule}` : ""}`;
  if (schedule && completedAt) return `${schedule} · Completed at ${completedAt}`;
  if (schedule) return schedule;
  if (completedAt) return `Completed at: ${completedAt}`;
  return "Schedule not supplied";
}

function alertTone(alert: RecoveryAlert) {
  const statusLabel = alert.status === "active" ? "Open" : "Acknowledged";
  const statusBadge = alert.status === "active"
    ? "border border-current/20 bg-white/70 text-current"
    : "bg-emerald-100 text-emerald-700";
  const severity = alert.severity.toLowerCase();
  const severityLabel = severity === "critical" ? "Critical" : severity === "moderate" ? "Moderate" : "Low";

  if (alert.status !== "active") return { card: "border-emerald-200 bg-emerald-50/60", badge: "bg-emerald-100 text-emerald-700", label: severityLabel, statusBadge, statusLabel };
  if (severity === "critical") return { card: "border-red-200 bg-red-50/70", badge: "bg-red-600 text-white", label: "Critical", statusBadge, statusLabel };
  if (severity === "moderate") return { card: "border-amber-200 bg-amber-50/70", badge: "bg-amber-100 text-amber-800", label: "Moderate", statusBadge, statusLabel };
  return { card: "border-blue-200 bg-blue-50/70", badge: "bg-blue-100 text-blue-700", label: "Low", statusBadge, statusLabel };
}

function vitalMetricForAlert(alert: RecoveryAlert, records: DailyVitalsRecord[]) {
  const text = `${alert.title} ${alert.description}`.toLowerCase();
  const candidates = text.includes("oxygen") || text.includes("spo2")
    ? [{ key: "spo2" as const, label: "SpO2", unit: "%" }]
    : text.includes("heart") || text.includes("pulse")
      ? [{ key: "heartRate" as const, label: "Heart rate", unit: " bpm" }]
      : text.includes("blood pressure")
        ? [{ key: "bloodPressureSystolic" as const, label: "Systolic blood pressure", unit: " mmHg" }]
        : [
            { key: "spo2" as const, label: "SpO2", unit: "%" },
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
  const thresholdDetail = alert.thresholdDetails[0] ?? null;
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
    expectedLabel: thresholdDetail ? "Configured threshold" : "Alert threshold",
    expected: thresholdDetail?.threshold ?? "Not supplied by API",
    actualLabel: thresholdDetail ? "Breached value" : metric ? `Latest ${metric.label.toLowerCase()}` : "Latest recorded value",
    actual: thresholdDetail ? `${thresholdDetail.label}: ${thresholdDetail.value}` : latest != null && metric ? `${latest}${metric.unit}` : "No linked vital available",
    trend,
    analysisSummary: thresholdDetail?.warningMessage,
    thresholdDetails: alert.thresholdDetails,
    evidence,
  };
}

function appointmentTypeLabel(type: ScheduledAppointmentResult["type"]) {
  if (type === "teleconsultation") return "Teleconsultation";
  if (type === "nurse_checkin") return "Nurse Check-in";
  return "Physical Visit";
}

function latestVitalsSummary(records: DailyVitalsRecord[]) {
  const latest = records.filter((record) => record.hasEntry).at(-1);
  if (!latest) return "No daily vitals recorded";
  const values = [
    latest.vitals.spo2 != null ? `SpO2 ${latest.vitals.spo2}%` : "",
    latest.vitals.heartRate != null ? `HR ${latest.vitals.heartRate} bpm` : "",
    latest.vitals.bloodPressureSystolic != null
      ? `BP ${latest.vitals.bloodPressureSystolic}/${latest.vitals.bloodPressureDiastolic ?? "--"}`
      : "",
  ].filter(Boolean);
  return values.length > 0 ? values.join(" - ") : "Vitals entry has no supported measurements";
}

function formatPhaseLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function coveragePercent(value: number, total: number | null) {
  if (total == null || total <= 0) return null;
  return clamp(Math.round((value / total) * 100));
}
export default function CareEpisodeRecoveryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";
  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [medications, setMedications] = useState<MedicationAdherenceRecord[]>([]);
  const [dailyVitals, setDailyVitals] = useState<DailyVitalsRecord[]>([]);
  const [episodeForecast, setEpisodeForecast] = useState<EpisodeForecast | null>(null);
  const [forecastError, setForecastError] = useState("");
  const [timeline, setTimeline] = useState<ApiRecord[]>([]);
  const [alerts, setAlerts] = useState<RecoveryAlert[]>([]);
  const [assessmentDates, setAssessmentDates] = useState<string[]>([]);
  const [taskDate, setTaskDate] = useState(() => localDateKey(new Date()));
  const [taskCompletion, setTaskCompletion] = useState<TaskCompletionRecord | null>(null);
  const [taskCompletionLog, setTaskCompletionLog] = useState<TaskCompletionLog | null>(null);
  const [lastTaskSyncAt, setLastTaskSyncAt] = useState<string | null>(null);
  const [reviewAlertId, setReviewAlertIdState] = useState<string | null>(null);
  const setReviewAlertId = (alertId: string | null) => setReviewAlertIdState(alertId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertsError, setAlertsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
  const [scheduledFollowUp, setScheduledFollowUp] = useState<ScheduledAppointmentResult | null>(null);

  useEffect(() => {
    if (episodeId) capturePostHogEvent("recovery_outcomes_viewed", { episode_id: episodeId });
  }, [episodeId]);

  useEffect(() => {
    if (!episodeId) return;
    let active = true;
    void (async () => {
      const [episodeResult, medicationResult, vitalsResult, timelineResult, assessmentResult, forecastResult] = await Promise.allSettled([
        getCareEpisodeById(episodeId),
        getCareEpisodeMedicationAdherence(episodeId),
        getCareEpisodeDailyVitals(episodeId, 7),
        getCareEpisodeTimelinePage(episodeId, { limit: 100 }),
        getAssessmentHistory(episodeId),
        getCareEpisodeForecast(episodeId),
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
      if (forecastResult.status === "fulfilled") {
        setEpisodeForecast(forecastResult.value);
        setForecastError("");
      } else {
        setEpisodeForecast(null);
        setForecastError(forecastResult.reason instanceof Error ? forecastResult.reason.message : "Forecast unavailable");
      }
      if (timelineResult.status === "fulfilled") setTimeline(timelineResult.value.data.map((event) => ({ ...event })));
      setAssessmentDates(assessmentResult.status === "fulfilled" ? assessmentResult.value.map((assessment) => assessment.date) : []);
      setIsLoading(false);
    })();

    return () => { active = false; };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    Promise.allSettled([
      getCareEpisodeTaskCompletion(episodeId, taskDate),
      getCareEpisodeTaskCompletionLog(episodeId, taskDate),
    ]).then(([completionResult, logResult]) => {
      if (ignore) return;
      setTaskCompletion(completionResult.status === "fulfilled" ? completionResult.value : null);
      setTaskCompletionLog(logResult.status === "fulfilled" ? logResult.value : null);
      if (completionResult.status === "fulfilled" || logResult.status === "fulfilled") setLastTaskSyncAt(new Date().toISOString());
    });

    return () => { ignore = true; };
  }, [episodeId, taskDate]);

  const todayKey = localDateKey(new Date());
  const dailyTasks = useMemo(
    () => buildCareTaskRows(episode?.currentCarePlan ?? null, { date: taskDate, completionLog: taskCompletionLog, medicationRecords: medications }),
    [episode, medications, taskCompletionLog, taskDate],
  );
  const savedWarningSigns = useMemo(() => getSavedWarningSignsFromPlan(episode?.currentCarePlan ?? null), [episode]);
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
    ? clamp(taskCompletion.completionRate * 100)
    : displayedTaskCount > 0 ? clamp((displayedCompletedCount / displayedTaskCount) * 100) : 0;
  const lastTaskSyncLabel = formatTaskSyncAge(lastTaskSyncAt);
  const recoveryForecast = episodeForecast?.recoveryForecast;
  const deteriorationForecast = episodeForecast?.deterioration;
  const relapseForecast = episodeForecast?.relapse;
  const recoveryProbability = recoveryForecast?.dataSufficiency === "insufficient"
    ? null
    : (episodeForecast?.recoveryProbability ?? recoveryForecast?.currentRecoveryPercentage ?? null);
  const deteriorationRisk = episodeForecast?.deteriorationRisk ?? deteriorationForecast?.probabilityPercent ?? null;
  const relapseRisk = episodeForecast?.relapseRisk ?? relapseForecast?.probabilityPercent ?? null;
  const recoveryOutcomeDetail = !episodeForecast
    ? forecastError || "Forecast unavailable"
    : recoveryForecast?.dataSufficiency === "insufficient"
      ? "Insufficient data"
      : recoveryForecast?.confidence == null || !recoveryForecast.dataSufficiency
        ? "Forecast details unavailable"
        : `${recoveryForecast.confidence}% confidence - ${recoveryForecast.dataSufficiency} data`;
  const deteriorationOutcomeDetail = !episodeForecast || deteriorationForecast?.probabilityPercent == null
    ? forecastError || "Insufficient data"
    : `${(deteriorationForecast.riskLevel || "undetermined").toUpperCase()} risk - ${deteriorationForecast.horizonDays == null ? "Forecast horizon unavailable" : `${deteriorationForecast.horizonDays}-day forecast`} - ${deteriorationForecast.confidence == null ? "Confidence unavailable" : `${deteriorationForecast.confidence}% confidence`}`;
  const relapseOutcomeDetail = !episodeForecast || relapseRisk == null || relapseForecast?.dataSufficiency === "insufficient"
    ? forecastError || "Insufficient data"
    : `${(relapseForecast?.riskLevel || "undetermined").toUpperCase()} risk - ${relapseForecast?.horizonDays == null ? "Forecast horizon unavailable" : `${relapseForecast.horizonDays}-day forecast`} - ${relapseForecast?.confidence == null ? "Confidence unavailable" : `${relapseForecast.confidence}% confidence`}`;
  const forecastDaysRemaining = recoveryForecast?.predictedTimelineDays ?? null;
  const assessmentCount = assessmentDates.length;
  const lastAssessment = assessmentDates.at(0) ?? assessmentDates.at(-1) ?? "";
  const biometricEntryCount = dailyVitals.filter((item) => item.hasEntry).length;
  const biometricCoverage = coveragePercent(biometricEntryCount, dailyVitals.length);
  const elapsedDays = episode?.dayStart != null ? Math.max(episode.dayStart, 1) : null;
  const clinicalInputCoverage = coveragePercent(assessmentCount, elapsedDays);
  const interventionCoverage = coveragePercent(timeline.length, elapsedDays);

  if (isLoading && !episode) return <SubHeaderSkeleton episodeId={episodeId} />;
  if (error && !episode) {
    return <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center"><AlertCircle className="h-8 w-8 text-destructive" /><p className="text-sm font-semibold text-destructive">{error}</p><Button type="button" variant="outline" onClick={() => { setIsLoading(true); setError(""); setRefreshKey((key) => key + 1); }}>Try Again</Button></div>;
  }
  if (!episode) return null;

  const patient = episode.patient;
  const careEpisodeReference = getHumanReadableCareEpisodeReference(episode);
  const riskBadge = getHeaderRiskBadge(episode.riskCategory);
  const overallProgress = clamp(Math.round(episode.dayProgress ?? getProgressPercent(episode.dayStart, episode.expectedDurationDays)));
  const expectedRecoveryDate = (() => {
    if (episodeForecast?.recoveryForecast.expectedRecoveryDate) return formatLongDate(episodeForecast.recoveryForecast.expectedRecoveryDate);
    if (!episode.createdAt || !episode.expectedDurationDays) return "--";
    const date = new Date(episode.createdAt);
    if (Number.isNaN(date.getTime())) return "--";
    date.setDate(date.getDate() + episode.expectedDurationDays);
    return formatLongDate(date.toISOString());
  })();
  const baselineDaysRemaining = episode.expectedDurationDays == null || episode.dayStart == null
    ? null
    : Math.max(episode.expectedDurationDays - episode.dayStart, 0);
  const daysRemaining = forecastDaysRemaining ?? baselineDaysRemaining;
  const actualRecovery = episodeForecast?.recoveryForecast.currentRecoveryPercentage ?? null;
  const progression = buildRecoveryProgression(episode.expectedDurationDays ?? 1, episode.dayStart, actualRecovery);
  const hasActualRecovery = progression.some((point) => point.actual != null);
  const latestVitals = latestVitalsSummary(dailyVitals);
  const recoveryPhaseLabel = episode.carePhase ? formatPhaseLabel(episode.carePhase) : "--";
  const trajectorySummary = (() => {
    const trajectory = recoveryProbability == null
      ? "being monitored"
      : recoveryProbability >= 70
        ? "favorable"
        : recoveryProbability >= 40
          ? "steady and requiring continued monitoring"
          : "at risk and requiring closer review";
    const forecastText = recoveryProbability == null ? "" : ` Predicted recovery is ${recoveryProbability}%.`;
    const adherenceText = adherence == null ? "" : ` Care-plan adherence is ${adherence}%.`;
    const riskText = episode.riskCategory ? ` Current risk is ${formatPhaseLabel(episode.riskCategory).toLowerCase()}.` : "";
    const timelineText = daysRemaining == null ? "" : ` The expected recovery window has ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining.`;
    return `The patient's recovery trajectory is ${trajectory}.${forecastText}${adherenceText}${riskText}${timelineText}`;
  })();
  const openAction = (action: string, href: string) => {
    capturePostHogEvent("recovery_action_opened", { episode_id: episodeId, action });
    router.push(href);
  };
  const openScheduleFollowUp = () => {
    capturePostHogEvent("recovery_action_opened", { episode_id: episodeId, action: "schedule_follow_up" });
    setIsScheduleFollowUpOpen(true);
  };
  const handleFollowUpCreated = (appointment: ScheduledAppointmentResult) => {
    setScheduledFollowUp(appointment);
    setRefreshKey((key) => key + 1);
  };

  const acknowledgeSelectedAlert = async () => {
    if (!reviewAlertId) return;
    try {
      await acknowledgeAlert(reviewAlertId);
      capturePostHogEvent("recovery_alert_acknowledged", { episode_id: episodeId, alert_id: reviewAlertId });
      setReviewAlertId(null);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setAlertsError(requestError instanceof Error ? requestError.message : "Unable to acknowledge alert.");
    }
  };
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden pb-8">
      <button type="button" aria-label="Back to care episode" onClick={() => router.push(`/dashboard/care-episodes/${episodeId}`)} className="inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to Care Episode</button>

      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-foreground">Recovery &amp; Outcomes</h1><span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>{riskBadge.label === "High" ? "AT RISK" : riskBadge.label.toUpperCase()}</span></div>
        <p className="mt-1 text-sm font-medium text-muted-foreground">A comprehensive intelligence overview for patient <strong className="font-bold text-foreground">{patient?.name || "Unknown Patient"}</strong> (<strong className="font-bold text-foreground">{patient?.hospitalId || "--"}</strong>)</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<CalendarCheck className="h-4 w-4" />} label="Expected Recovery" value={expectedRecoveryDate} detail={daysRemaining == null ? "Duration unavailable" : `${daysRemaining} days remaining`} />
        <MetricCard icon={<HeartPulse className="h-4 w-4" />} label="Recovery Phase" value={recoveryPhaseLabel} detail="Current care phase" valueClassName="text-destructive" />
        <MetricCard icon={<ClipboardCheck className="h-4 w-4" />} label="Care Plan Adherence" value={adherence == null ? "--" : `${adherence}%`} detail={adherence == null ? "No adherence records" : `${missedDoseCount} missed dose${missedDoseCount === 1 ? "" : "s"}`} progress={adherence} />
        <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Overall Progress" value={`${overallProgress}%`} detail={episode.expectedDurationDays ? `Day ${episode.dayStart ?? "--"} of ${episode.expectedDurationDays}` : "Duration unavailable"} progress={overallProgress} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold text-foreground">Recovery Intelligence</h2></div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">System-generated insights</p>
            <div className="mt-4 rounded-lg border-l-4 border-primary bg-blue-50 p-4"><p className="mb-1 text-sm font-bold text-primary">Trajectory Summary</p><p className="text-sm font-medium leading-6 text-foreground/80">{trajectorySummary}</p></div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Recovery Progression Over Time</p><div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 border-t-2 border-dashed border-muted-foreground" />Expected</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-primary" />Actual</span></div></div>
            <div className="mt-4 h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={progression} margin={{ top: 8, right: 12, left: -8, bottom: 2 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={30} /><Tooltip /><Line type="monotone" dataKey="expected" name="Expected" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} /><Line type="monotone" dataKey="actual" name="Actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} /></LineChart></ResponsiveContainer></div>
            <p className="mt-2 text-xs text-muted-foreground">{hasActualRecovery ? "Actual recovery is plotted from the latest forecast on day " + (episode.dayStart ?? "--") + "." : "Actual recovery data is not available for this episode yet."}</p>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Contributing Factors</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FactorCard title="Care Plan Adherence" percent={adherence} detail={adherence == null ? "No medication logs available" : missedDoseCount + " missed dose" + (missedDoseCount === 1 ? "" : "s") + " recorded"} />
              <FactorCard title="Biometric Trends" percent={biometricCoverage} detail={biometricCoverage == null ? "No daily vitals available" : biometricEntryCount + " of " + dailyVitals.length + " days with recorded vitals" + (latestVitals ? "; " + latestVitals : "")} />
              <FactorCard title="Clinical Inputs" percent={clinicalInputCoverage} detail={clinicalInputCoverage == null ? "No assessments recorded" : assessmentCount + " assessment" + (assessmentCount === 1 ? "" : "s") + " across " + elapsedDays + " elapsed day" + (elapsedDays === 1 ? "" : "s")} />
              <FactorCard title="Recent Interventions" percent={interventionCoverage} detail={interventionCoverage == null ? "No timeline interventions recorded" : timeline.length + " timeline event" + (timeline.length === 1 ? "" : "s") + " across " + elapsedDays + " elapsed day" + (elapsedDays === 1 ? "" : "s")} />
            </div>
          </CardContent></Card>

          <Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><h2 className="text-base font-bold text-foreground">Clinical Assessment</h2></div>
            <div className="mt-4 flex flex-wrap items-center gap-8"><div><p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Last Assessment</p><p className="mt-1 text-sm font-bold text-foreground">{lastAssessment ? formatLongDate(lastAssessment) : "--"}</p></div><div><p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">Assessments Completed</p><p className="mt-1 text-sm font-bold text-foreground">{assessmentCount}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={() => openAction("new_assessment", `/dashboard/care-episodes/${episodeId}/assessment`)}><Plus className="h-4 w-4" />New Assessment</Button><Button type="button" variant="outline" onClick={() => openAction("assessment_history", `/dashboard/care-episodes/${episodeId}/assessment-history`)}><History className="h-4 w-4" />View History</Button></div>
          </CardContent></Card>

          <section><h2 className="mb-4 text-base font-bold text-foreground">Recovery Outcomes</h2><div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
             <OutcomeCard label="Recovery Probability" percent={recoveryProbability} detail={recoveryOutcomeDetail} trackColor="var(--color-blue-50)" progressColor="var(--color-primary)" />
             <OutcomeCard label="Risk of Deterioration" percent={deteriorationRisk} detail={deteriorationOutcomeDetail} trackColor="var(--color-red-50)" progressColor="var(--color-red-500)" />
             <OutcomeCard label="Relapse Risk Forecast" percent={relapseRisk ?? null} detail={relapseOutcomeDetail} trackColor="var(--color-red-50)" progressColor="var(--color-red-500)" />
          </div></section>
        </div>

        <div className="min-w-0 space-y-6">

          <Card className="w-full min-w-0 rounded-xl border-primary/10 bg-blue-50 shadow-sm"><CardContent className="p-4 sm:p-5"><h2 className="text-base font-bold text-foreground">Clinical Action Workspace</h2><p className="mt-1 text-xs font-medium text-muted-foreground">Initiate interventions based on recovery insights.</p><div className="mt-4 space-y-3">
            <ActionButton icon={<Pencil className="h-4 w-4" />} title="Adjust Care Plan" detail="Open care plan editor" onClick={() => openAction("adjust_care_plan", `/dashboard/care-episodes/${episodeId}/recovery/adjust-plan`)} />
            <ActionButton icon={<CalendarPlus className="h-4 w-4" />} title="Schedule Follow-up" detail="Open appointment modal" onClick={openScheduleFollowUp} />
            <ActionButton icon={<Send className="h-4 w-4" />} title="Send Patient Instruction" detail="Open messaging module" onClick={() => openAction("send_instruction", `/dashboard/messages?${new URLSearchParams({ episodeId, patientId: episode.patientId, patientName: patient?.name || "Patient" })}`)} />
          </div></CardContent></Card>
          {scheduledFollowUp ? (
            <Card className="w-full min-w-0 rounded-xl border-emerald-200 bg-emerald-50/70 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold text-foreground">Follow-up scheduled</h2>
                    <p className="mt-0.5 truncate whitespace-nowrap text-xs font-medium text-muted-foreground">
                      {appointmentTypeLabel(scheduledFollowUp.type)} on {formatLongDate(scheduledFollowUp.date)} at {scheduledFollowUp.time}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push(scheduledFollowUp.id ? `/dashboard/appointments/${encodeURIComponent(scheduledFollowUp.id)}` : "/dashboard/appointments")}
                      className="mt-2 h-8 border-emerald-200 bg-white px-3 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      Open in Appointments
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <Card className="flex w-full min-w-0 h-[480px] min-h-[360px] max-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border-border bg-card shadow-sm"><CardContent className="flex min-h-0 flex-1 flex-col p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-bold text-foreground">Daily Care Tasks</h2><p className="text-xs font-medium text-muted-foreground">{patient?.name || "Patient"} - Day {episode.dayStart ?? "--"} of {episode.expectedDurationDays ?? "--"}</p></div><div className="flex shrink-0 items-center gap-1 pt-0.5 text-muted-foreground"><button type="button" aria-label="Previous care-task day" onClick={() => setTaskDate((date) => shiftDate(date, -1))} className="rounded p-1 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-20 text-center text-xs font-bold text-foreground/80">{taskDate === todayKey ? "Today" : formatLongDate(taskDate)}</span><button type="button" aria-label="Next care-task day" disabled={taskDate >= todayKey} onClick={() => setTaskDate((date) => shiftDate(date, 1))} className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-muted-foreground"><p>Daily Check-ins</p><p>{displayedCompletedCount} / {displayedTaskCount} completed</p></div><div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${taskCompletionPercent}%` }} /></div>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">{dailyTasks.length === 0 ? <p className="py-4 text-center text-sm font-medium text-muted-foreground">No care-plan tasks configured yet.</p> : null}{dailyTasks.map((task) => <div key={task.id} className="flex items-start gap-3"><Checkbox checked={task.done} disabled aria-label={`${task.label}: ${task.done ? "completed" : "not completed"} (read only)`} className="mt-0.5 disabled:cursor-default disabled:opacity-100" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-foreground">{task.label}</span><span className={cn("block text-xs font-medium", task.missed ? "text-amber-700" : "text-muted-foreground")}>{taskDetailText(task)}</span></span></div>)}</div>
            <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-[#BFE8F5] bg-[#E9F8FC] px-3 py-3 text-xs"><p className="flex items-center gap-1.5 font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Updating live</p><p className="font-medium text-muted-foreground">Last sync {lastTaskSyncLabel}</p></div>
          </CardContent></Card>

          <Card className="flex w-full min-w-0 h-[480px] min-h-[360px] max-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border-border bg-card shadow-sm">
            <CardContent className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-base font-bold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Open Alerts
                </h2>
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">{alerts.length} OPEN</span>
              </div>

              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                {alertsError ? <p className="py-4 text-center text-sm font-medium text-destructive">{alertsError}</p> : null}
                {!alertsError && alerts.length === 0 ? <p className="py-4 text-center text-sm font-medium text-muted-foreground">No open alerts for this care episode.</p> : null}
                {alerts.map((alert) => {
                  const tone = alertTone(alert);
                  return (
                    <div key={alert.id} className={cn("rounded-xl border p-3.5", tone.card)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{alert.severity} severity</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tone.badge)}>{tone.label}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tone.statusBadge)}>{tone.statusLabel}</span>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{alert.meta}</span>
                      </div>
                      <p className="mt-2 text-sm font-bold text-foreground">{alert.title}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{alert.description}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-muted-foreground">
                        <span>Source: {alert.triggerSource}</span>
                        {alert.status !== "active" && alert.acknowledgedBy && alert.acknowledgedBy !== "Not recorded" ? <span>Acknowledged by {alert.acknowledgedBy}</span> : null}
                        {alert.status !== "active" && alert.acknowledgedAt ? <span>Acknowledged {formatTaskClock(alert.acknowledgedAt)}</span> : null}
                      </div>
                      <Button type="button" variant="outline" onClick={() => { setReviewAlertId(alert.id); capturePostHogEvent("recovery_alert_impact_opened", { episode_id: episodeId, alert_id: alert.id }); }} className="mt-3 h-8 w-full border-current/20 bg-white/70 text-xs font-bold text-foreground hover:bg-white">Review Impact</Button>
                    </div>
                  );
                })}
              </div>

              {savedWarningSigns.length > 0 ? (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Patient guidance</p>
                  <div className="mt-3 max-h-40 space-y-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                    {savedWarningSigns.map((warning) => (
                      <div key={warning.id} className="rounded-lg bg-destructive/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-foreground">{warning.title}</p>
                          <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-destructive">{warning.severity}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">{warning.detail} - {warning.threshold}</p>
                        {warning.response ? <p className="mt-2 text-xs font-semibold text-foreground/80">{warning.response}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ScheduleAppointmentModal
        open={isScheduleFollowUpOpen}
        onOpenChange={setIsScheduleFollowUpOpen}
        onAppointmentCreated={handleFollowUpCreated}
        initialPatient={{ id: episode.patientId, name: patient?.name || "Patient" }}
        initialAppointmentType="teleconsultation"
        initialCareEpisodeId={episodeId}
        initialCareEpisodeLabel={careEpisodeReference ? `Care episode ${careEpisodeReference}` : "Current care episode"}
        initialReason="Recovery follow-up review"
        autoConfirm
      />

      <ReviewImpactModal
        open={Boolean(reviewAlertId)}
        alert={reviewImpact}
        onOpenChange={(open) => { if (!open) setReviewAlertId(null); }}
        onAcknowledge={() => void acknowledgeSelectedAlert()}
        acknowledgementAvailable={Boolean(selectedAlert)}
        careEpisodeHref={`/dashboard/care-episodes/${episodeId}#risk-intelligence`}
      />
    </div>
  );
}

function MetricCard({ icon, label, value, detail, progress, valueClassName }: { icon: React.ReactNode; label: string; value: string; detail: string; progress?: number | null; valueClassName?: string }) {
  return (
    <Card className="rounded-xl border-border bg-card shadow-sm">
      <CardContent className="min-h-[142px] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
        </div>
        <p className={cn("mt-3 text-sm font-bold text-foreground", valueClassName)}>{value}</p>
        {progress != null ? <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${clamp(progress)}%` }} /></div> : null}
        <p className="mt-2 text-xs font-medium text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
function FactorCard({ title, percent, detail }: { title: string; percent: number | null; detail: string }) {
  const displayPercent = percent == null ? "--" : String(percent) + "%";
  return (
    <div className="min-h-[132px] rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="shrink-0 text-sm font-bold text-primary">{displayPercent}</p>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: (percent == null ? 0 : clamp(percent)) + "%" }} />
      </div>
      <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function OutcomeCard({
  label,
  detail,
  percent,
  trackColor,
  progressColor,
}: {
  label: string;
  detail: string;
  percent: number | null;
  trackColor: string;
  progressColor: string;
}) {
  const unavailable = percent == null;
  return (
    <Card className="h-full rounded-xl border-border bg-slate-50/60 shadow-none">
      <CardContent className="flex h-full min-h-[224px] flex-col items-center p-6 text-center">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
        <div role="img" aria-label={`${label}: ${unavailable ? "insufficient data" : `${percent}%`}`}>
          <CircularProgress percent={percent} size={116} trackColor={trackColor} progressColor={progressColor} />
        </div>
        <p className="mt-4 text-[10px] font-medium text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
function ActionButton({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-foreground">{title}</span><span className="block text-xs font-medium text-muted-foreground">{detail}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>;
}







