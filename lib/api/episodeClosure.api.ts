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
  const [episode, timelineResult, medicationResult, assessmentHistory, carePlan] = await Promise.all([
    getCareEpisodeById(episodeId),
    getAllTimeline(episodeId).catch(() => null),
    getCareEpisodeMedicationAdherence(episodeId).catch(() => null),
    getAssessmentHistory(episodeId).catch(() => []),
    getCarePlan(episodeId).catch(() => null),
  ]);
  const timelineAvailable = timelineResult !== null;
  const timeline = timelineResult ?? [];
  const medicationRecords = medicationResult ?? [];

  const chronological = [...timeline].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const closureEvent = [...chronological].reverse().find((event) => event.eventType === "episode_closed") ?? null;
  const closurePayload = closureEvent?.payload ?? {};
  const closureSnapshot = episode.closure;
  const closedAt = closureSnapshot?.closedAt || episode.closedAt || closureEvent?.timestamp || episode.updatedAt;
  const finalNotes = closureSnapshot?.finalNotes || episode.finalNotes || getString(closurePayload, ["finalNotes"]) || "No final clinical notes were supplied.";
  const closureReason = closureReasonLabel(
    closureSnapshot?.closureReason || episode.closureReason || getString(closurePayload, ["closureReason"]) || null,
  );
  const outcome = humanize(closureSnapshot?.outcomeStatus || episode.outcomeStatus || getString(closurePayload, ["outcomeStatus"]));

  const durationMs = Date.parse(closedAt) - Date.parse(episode.createdAt);
  const totalDurationDays = Number.isFinite(durationMs) ? Math.max(Math.ceil(durationMs / 86_400_000), 1) : episode.expectedDurationDays;
  const checkInEvents = chronological.filter((event) => {
    const status = event.status.toLowerCase();
    return event.eventType.toLowerCase().includes("check") && !["missed", "pending", "cancelled", "failed"].includes(status);
  });
  const checkInDates = new Set(checkInEvents.map((event) => event.timestamp.slice(0, 10)).filter(Boolean));
  const completedCheckIns = checkInEvents.length;
  const totalMonitoringDays = timelineAvailable ? episode.expectedDurationDays ?? null : null;
  const completedMonitoringDays = timelineAvailable ? checkInDates.size : null;
  const checkInCompletionPercent = timelineAvailable && totalMonitoringDays != null && totalMonitoringDays > 0
    ? Math.min(Math.round((completedCheckIns / totalMonitoringDays) * 100), 100)
    : null;
  const totalScheduledDoses = medicationRecords.reduce((total, record) => total + record.totalDoses, 0);
  const totalTakenDoses = medicationRecords.reduce((total, record) => total + record.takenCount, 0);
  const medicationAdherencePercent = medicationRecords.length > 0
    ? totalScheduledDoses > 0
      ? Math.round((totalTakenDoses / totalScheduledDoses) * 100)
      : Math.round(medicationRecords.reduce((total, record) => total + record.adherencePercentage, 0) / medicationRecords.length)
    : null;
  const alerts = chronological.filter(isAlert);
  const severity = (event: TimelineEventRecord) => getString(event.payload, ["severity"], event.status).toLowerCase();
  const resolvedAlerts = alerts.filter((event) => ["completed", "resolved", "acknowledged"].includes(event.status.toLowerCase())).length;
  const emergencyEscalations = timelineAvailable ? chronological.filter((event) => event.eventType.toLowerCase().includes("emergency")).length : null;
  const specialistEscalations = chronological.filter((event) => event.eventType.toLowerCase().includes("specialist")).length;

  const riskValues = chronological
    .map((event) => getNumber(event.payload, ["riskScore", "risk_score", "score", "newScore"]))
    .filter((value): value is number => value != null);
  const openingRisk = riskValues.at(0) ?? null;
  const closingRisk = episode.riskScore;
  const riskImprovement = openingRisk != null && closingRisk != null && openingRisk > 0
    ? Math.round(((openingRisk - closingRisk) / openingRisk) * 100)
    : null;

  // GET /care-episodes/{id}/care-plan now returns every historical version directly, so the
  // history no longer needs to be guessed from care_plan_* timeline events.
  const carePlanVersions = carePlan ? [...carePlan.versions].sort((left, right) => left.version - right.version) : [];
  const carePlanEventsByVersion = new Map(
    chronological
      .filter(isCarePlanEvent)
      .map((event) => [getNumber(event.payload, ["version"]), event] as const)
      .filter((entry): entry is readonly [number, TimelineEventRecord] => entry[0] != null),
  );
  const carePlanHistory: ClosureCarePlanVersion[] = carePlanVersions.map((version, index) => {
    const isFinalVersion = index === carePlanVersions.length - 1;
    const versionEvent = carePlanEventsByVersion.get(version.version);
    const versionStatus: ClosureCarePlanVersion["status"] = isFinalVersion
      ? "Completed"
      : version.isActive
        ? "Updated"
        : "Superseded";
    return {
      version: `CP-v${version.version}`,
      title: isFinalVersion ? "Final Care Plan" : index === 0 ? "Initial Care Plan" : "Updated Care Plan",
      status: versionStatus,
      date: version.createdAt,
      clinicianId: version.clinicianId ?? null,
      clinicianName: version.clinicianName || getString(versionEvent?.payload ?? {}, ["clinicianName", "clinician"]) || episode.clinicianName || null,
      author: version.clinicianName || getString(versionEvent?.payload ?? {}, ["clinicianName", "clinician"], episode.clinicianName || "Clinician unavailable"),
      description: version.changeReason || getString(versionEvent?.payload ?? {}, ["changeReason", "message"], "No change description was supplied."),
    };
  });

  const interventionEvents = chronological.filter((event) => {
    const type = event.eventType.toLowerCase();
    return isCarePlanEvent(event) || type.includes("instruction") || type.includes("intervention") || type.includes("escalation");
  });
  const latestAssessment = assessmentHistory.at(0) ?? assessmentHistory.at(-1) ?? null;
  const latestCarePlan = carePlanHistory.at(-1) ?? null;
  const closureSource = closureEvent ? eventSource(closureEvent) : "Clinician";
  const patientName = episode.patient?.name || "Patient";
  const alertSentence = !timelineAvailable ? "Alert data is unavailable." : alerts.length > 0
    ? `${alerts.length} alert${alerts.length === 1 ? " was" : "s were"} recorded; ${resolvedAlerts} ${resolvedAlerts === 1 ? "is" : "are"} marked resolved or completed.`
    : "No alert events were found in the episode timeline.";
  const adherenceSentence = medicationAdherencePercent == null
    ? "Medication adherence data is unavailable."
    : `Average medication adherence was ${medicationAdherencePercent}%.`;
  const checkInSentence = checkInCompletionPercent == null
    ? "Check-in completion data is unavailable."
    : `Check-in completion was ${checkInCompletionPercent}% with ${completedCheckIns} of ${totalMonitoringDays} expected check-ins recorded.`;
  const emergencySentence = emergencyEscalations == null
    ? "Emergency escalation data is unavailable."
    : `${emergencyEscalations} emergency escalation${emergencyEscalations === 1 ? " was" : "s were"} recorded.`;

  return {
    episodeId,
    patient: {
      name: patientName,
      patientCode: episode.patient?.hospitalId || episode.tracmedyPatientId || episode.patientId,
      age: episode.patient?.age ?? null,
      gender: episode.patient?.gender || "Not available",
      episodeCode: episode.reference || "Not available",
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
      closedBy: closureSnapshot?.closedBy?.name || getString(closurePayload, ["clinicianName"]) || episode.clinicianName || closureSource,
      closureDateTime: closedAt,
      closureReason,
      finalNotes,
    },
    aiClosureSummary: {
      statusBadge: outcome,
      frozenAtLabel: `Frozen at closure - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(closedAt))}`,
      narrative: `${patientName}'s care episode was closed with the outcome "${outcome}". ${adherenceSentence} ${checkInSentence}\n\n${alertSentence} ${emergencySentence}`,
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
        carePlanAdjustments: carePlanVersions.length,
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
