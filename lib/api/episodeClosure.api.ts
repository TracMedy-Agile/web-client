import { getAssessmentHistory } from "@/lib/api/careTeamAndPlan.api";
import { getCarePlan } from "@/lib/api/care-plan";
import {
  getCareEpisodeById,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeTimelinePage,
  getNumber,
  getString,
  type TimelineEventRecord,
} from "@/lib/api/care-episodes";
import type {
  CareTimelineEvent,
  ClosedEpisodeRecord,
  ClosureCarePlanVersion,
  ClosureReason,
  TimelineEventStatus,
  TimelineEventType,
  TimelineSource,
} from "@/app/dashboard/care-episodes/[id]/_shared/episodeClosureTypes";

function humanize(value: string, fallback = "Not available") {
  if (!value) return fallback;
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function closureReasonLabel(value: string | null): ClosureReason {
  if (value === "recovery_completed") return "Recovery completed";
  if (value === "lost_to_follow_up") return "Lost to follow-up";
  return "No further action";
}

function eventTitle(event: TimelineEventRecord) {
  return getString(event.payload, ["message", "title"]) || humanize(event.eventType, "Timeline event");
}

function eventDescription(event: TimelineEventRecord) {
  return getString(event.payload, ["description", "details", "summary", "note", "changeReason"]);
}

function eventType(event: TimelineEventRecord): TimelineEventType {
  const type = event.eventType.toLowerCase();
  if (type.includes("alert") || type.includes("escalation")) return "Alert";
  if (type.includes("check")) return "Check-in";
  if (type.includes("medication")) return "Medication";
  if (event.source.toLowerCase().includes("clinician") || type.includes("assessment") || type.includes("care_plan")) return "Clinician";
  return "System";
}

function eventStatus(event: TimelineEventRecord): TimelineEventStatus {
  const status = event.status.toLowerCase();
  if (status.includes("critical")) return "Critical";
  if (status.includes("miss")) return "Missed";
  if (status.includes("pending")) return "Pending";
  return "Completed";
}

function eventSource(event: TimelineEventRecord): TimelineSource {
  const source = event.source.toLowerCase();
  if (source.includes("patient")) return "Patient App";
  if (source.includes("clinician")) return "Clinician";
  return "System";
}

function toTimelineEvent(event: TimelineEventRecord): CareTimelineEvent {
  const parsed = Date.parse(event.timestamp);
  const date = Number.isFinite(parsed) ? new Date(parsed) : null;
  return {
    id: event.id,
    title: eventTitle(event),
    description: eventDescription(event),
    status: eventStatus(event),
    type: eventType(event),
    source: eventSource(event),
    date: date ? date.toISOString().slice(0, 10) : "",
    time: date ? new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "--",
  };
}

function isAlert(event: TimelineEventRecord) {
  const type = event.eventType.toLowerCase();
  return type.includes("alert") || type.includes("escalation") || event.status.toLowerCase().includes("critical");
}

function isCarePlanEvent(event: TimelineEventRecord) {
  return event.eventType.toLowerCase().includes("care_plan");
}

async function getAllTimeline(episodeId: string) {
  const first = await getCareEpisodeTimelinePage(episodeId, { page: 1, limit: 100 });
  if (first.totalPages <= 1) return first.data;
  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) => getCareEpisodeTimelinePage(episodeId, { page: index + 2, limit: 100 })),
  );
  return [first, ...remaining].flatMap((page) => page.data);
}

export async function getClosedEpisodeSummary(episodeId: string): Promise<ClosedEpisodeRecord> {
  const [episode, timeline, medicationRecords, assessmentHistory, carePlan] = await Promise.all([
    getCareEpisodeById(episodeId),
    getAllTimeline(episodeId).catch(() => []),
    getCareEpisodeMedicationAdherence(episodeId).catch(() => []),
    getAssessmentHistory(episodeId).catch(() => []),
    getCarePlan(episodeId).catch(() => null),
  ]);

  const chronological = [...timeline].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const closureEvent = [...chronological].reverse().find((event) => event.eventType === "episode_closed") ?? null;
  const closedAt = episode.closedAt || closureEvent?.timestamp || episode.updatedAt;
  const closurePayload = closureEvent?.payload ?? {};
  const finalNotes = episode.finalNotes || getString(closurePayload, ["finalNotes"]) || "No final clinical notes were supplied.";
  const closureReason = closureReasonLabel(episode.closureReason || getString(closurePayload, ["closureReason"]) || null);
  const outcome = humanize(episode.outcomeStatus || getString(closurePayload, ["outcomeStatus"]));

  const durationMs = Date.parse(closedAt) - Date.parse(episode.createdAt);
  const totalDurationDays = Number.isFinite(durationMs) ? Math.max(Math.ceil(durationMs / 86_400_000), 1) : episode.expectedDurationDays;
  const checkInEvents = chronological.filter((event) => event.eventType.toLowerCase().includes("check"));
  const checkInDates = new Set(checkInEvents.map((event) => event.timestamp.slice(0, 10)).filter(Boolean));
  const totalMonitoringDays = episode.expectedDurationDays ?? episode.dayStart ?? checkInDates.size;
  const completedMonitoringDays = Math.min(checkInDates.size, Math.max(totalMonitoringDays, checkInDates.size));
  const checkInCompletionPercent = totalMonitoringDays > 0 ? Math.min(Math.round((completedMonitoringDays / totalMonitoringDays) * 100), 100) : null;
  const medicationAdherencePercent = medicationRecords.length > 0
    ? Math.round(medicationRecords.reduce((total, record) => total + record.adherencePercentage, 0) / medicationRecords.length)
    : null;

  const alerts = chronological.filter(isAlert);
  const severity = (event: TimelineEventRecord) => getString(event.payload, ["severity"], event.status).toLowerCase();
  const resolvedAlerts = alerts.filter((event) => ["completed", "resolved", "acknowledged"].includes(event.status.toLowerCase())).length;
  const emergencyEscalations = chronological.filter((event) => event.eventType.toLowerCase().includes("emergency")).length;
  const specialistEscalations = chronological.filter((event) => event.eventType.toLowerCase().includes("specialist")).length;

  const riskValues = chronological
    .map((event) => getNumber(event.payload, ["riskScore", "risk_score", "score", "newScore"]))
    .filter((value): value is number => value != null);
  const openingRisk = riskValues.at(0) ?? null;
  const closingRisk = episode.riskScore;
  const riskImprovement = openingRisk != null && closingRisk != null && openingRisk > 0
    ? Math.round(((openingRisk - closingRisk) / openingRisk) * 100)
    : null;

  const carePlanEvents = chronological.filter(isCarePlanEvent);
  const carePlanHistory: ClosureCarePlanVersion[] = carePlanEvents.map((event) => {
    const version = getNumber(event.payload, ["version", "carePlanVersion"]);
    const isCurrent = carePlan && version === carePlan.version;
    return {
      version: version == null ? "Version unavailable" : `CP-v${version}`,
      title: event.eventType === "care_plan_reconciled" ? "Care Plan Reconciled" : "Care Plan Updated",
      status: isCurrent ? "Completed" : carePlan && version != null && version < carePlan.version ? "Superseded" : "Updated",
      date: event.timestamp,
      author: getString(event.payload, ["clinicianName"], eventSource(event)),
      description: eventDescription(event) || "No change description was supplied.",
    };
  });
  if (carePlan && !carePlanHistory.some((entry) => entry.version === `CP-v${carePlan.version}`)) {
    carePlanHistory.push({
      version: `CP-v${carePlan.version}`,
      title: "Final Care Plan",
      status: "Completed",
      date: carePlan.createdAt,
      author: "Clinician",
      description: carePlan.changeReason || "No change description was supplied.",
    });
  }

  const interventionEvents = chronological.filter((event) => {
    const type = event.eventType.toLowerCase();
    return isCarePlanEvent(event) || type.includes("instruction") || type.includes("intervention") || type.includes("escalation");
  });
  const latestAssessment = assessmentHistory.at(0) ?? assessmentHistory.at(-1) ?? null;
  const latestCarePlan = carePlanHistory.at(-1) ?? null;
  const closureSource = closureEvent ? eventSource(closureEvent) : "Clinician";
  const patientName = episode.patient?.name || "Patient";
  const alertSentence = alerts.length > 0
    ? `${alerts.length} alert${alerts.length === 1 ? " was" : "s were"} recorded; ${resolvedAlerts} ${resolvedAlerts === 1 ? "is" : "are"} marked resolved or completed.`
    : "No alert events were found in the episode timeline.";
  const adherenceSentence = medicationAdherencePercent == null
    ? "Medication adherence data is unavailable."
    : `Average medication adherence was ${medicationAdherencePercent}%.`;
  const checkInSentence = checkInCompletionPercent == null
    ? "Check-in completion could not be calculated."
    : `Check-in completion was ${checkInCompletionPercent}% across ${completedMonitoringDays} of ${totalMonitoringDays} monitoring days.`;

  return {
    episodeId,
    patient: {
      name: patientName,
      patientCode: episode.patient?.hospitalId || episode.tracmedyPatientId || episode.patientId,
      age: episode.patient?.age ?? null,
      gender: episode.patient?.gender || "Not available",
      episodeCode: episode.id,
      diagnosisTag: episode.diagnosis || "Diagnosis unavailable",
      closedDate: closedAt,
    },
    overview: {
      facility: episode.facility?.name || "Facility unavailable",
      assignedClinician: episode.clinicianName || "Clinician unavailable",
      diagnosis: episode.diagnosis || "Diagnosis unavailable",
      openedDate: episode.createdAt,
      closedDate: closedAt,
      totalDurationDays,
      closureReason,
      outcome,
      carePhaseAtClosure: episode.carePhase || "Not available",
    },
    closureRecord: {
      closedBy: getString(closurePayload, ["clinicianName"], closureSource),
      closedByRole: getString(closurePayload, ["clinicianRole"], "Source recorded in timeline"),
      closureDateTime: closedAt,
      closureReason,
      finalNotes,
      auditRef: closureEvent?.id || "Not available",
    },
    aiClosureSummary: {
      statusBadge: outcome,
      frozenAtLabel: `Frozen at closure - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(closedAt))}`,
      narrative: `${patientName}'s care episode was closed with the outcome "${outcome}". ${adherenceSentence} ${checkInSentence}\n\n${alertSentence} ${emergencyEscalations} emergency escalation${emergencyEscalations === 1 ? " was" : "s were"} recorded.`,
      medicationAdherencePercent,
      checkInCompletionPercent,
      emergencyEscalations,
      monitoringDays: { completed: completedMonitoringDays, total: totalMonitoringDays },
    },
    intelligenceSummary: {
      riskTrend: { opening: openingRisk, closing: closingRisk, improvementPercent: riskImprovement },
      alertSummary: {
        totalAlerts: alerts.length,
        critical: alerts.filter((event) => severity(event).includes("critical") || severity(event).includes("high")).length,
        moderate: alerts.filter((event) => severity(event).includes("moderate") || severity(event).includes("medium")).length,
        low: alerts.filter((event) => severity(event).includes("low")).length,
        resolved: { count: resolvedAlerts, total: alerts.length },
      },
      clinicalActivity: {
        assessments: assessmentHistory.length,
        carePlanAdjustments: carePlanEvents.length,
        specialistEscalations,
        emergencyEscalations,
        interventionsLogged: interventionEvents.length,
      },
    },
    assessmentHistory,
    carePlanHistory,
    interventionsLog: interventionEvents.map((event) => ({
      id: event.id,
      intervention: humanize(event.eventType),
      description: eventDescription(event) || "No intervention details were supplied.",
      date: event.timestamp,
      clinicianName: getString(event.payload, ["clinicianName"], eventSource(event)),
      linkedTrigger: getString(event.payload, ["linkedTrigger", "trigger"], "No linked trigger supplied"),
    })),
    careTimeline: [...chronological].reverse().slice(0, 20).map(toTimelineEvent),
    closureArtifacts: {
      finalClinicalAssessment: {
        label: "Final Clinical Assessment",
        value: latestAssessment?.outcome || "Not available",
        detail: latestAssessment ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(latestAssessment.date)) : "No assessment timeline event found",
      },
      finalCarePlanVersion: {
        label: "Final Care Plan Version",
        value: latestCarePlan?.version || "Not available",
        detail: latestCarePlan?.title || "No active care plan found",
      },
      finalRecoveryStatus: {
        label: "Final Recovery Status",
        value: outcome,
        detail: closureReason,
      },
      finalRiskScore: {
        label: "Final Risk Score",
        value: closingRisk == null ? "Not available" : String(closingRisk),
        detail: episode.riskCategory ? `${humanize(episode.riskCategory)} risk` : "Risk category unavailable",
      },
      finalPatientInstructions: {
        label: "Final Patient Instructions",
        value: finalNotes,
        detail: "Final notes preserved at episode closure",
      },
    },
  };
}
