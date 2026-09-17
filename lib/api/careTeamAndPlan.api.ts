import {
  createCareEpisodeTimelineEvent,
  getCareEpisodeById,
  getCareEpisodeDailyVitals,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeLabResults,
  getCareEpisodeTaskCompletion,
  getCareEpisodeTimelinePage,
  type ApiRecord,
} from "@/lib/api/care-episodes";
import type {
  Assessment,
  AssessmentOutcome,
  AssessmentWorkspaceEntry,
  EscalationStatus,
} from "@/app/dashboard/care-episodes/[id]/_shared/careTeamTypes";

const ASSESSMENT_EVENT_TYPE = "clinical_assessment";

function stringValue(record: ApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return fallback;
}

function stringArray(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}
function isAssessmentOutcome(value: string): value is AssessmentOutcome {
  return [
    "Improving",
    "Stable",
    "Delayed Recovery",
    "Deteriorating",
    "Resolved",
    "No Escalation",
    "Escalated",
    "Care Plan Adjustment",
  ].includes(value);
}

function isEscalationStatus(value: string): value is EscalationStatus {
  return ["Stable", "Improving", "Delayed Recovery", "Escalated"].includes(value);
}

function symptomNames(checkin: ApiRecord | null) {
  if (!checkin) return [];
  const raw = checkin.symptoms;
  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return stringValue(entry as ApiRecord, ["name", "type", "symptom"]);
      }
      return "";
    }).filter(Boolean);
  }
  if (raw && typeof raw === "object") return Object.keys(raw as ApiRecord).map((key) => key.replaceAll("_", " "));
  return [];
}

export type AssessmentHistoryFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export async function getAssessmentHistory(
  episodeId: string,
  filters?: AssessmentHistoryFilters,
): Promise<Assessment[]> {
  const firstPage = await getCareEpisodeTimelinePage(episodeId, {
    eventType: ASSESSMENT_EVENT_TYPE,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    limit: 100,
    page: 1,
  });
  const remainingPages = firstPage.totalPages > 1
    ? await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) => getCareEpisodeTimelinePage(episodeId, {
          eventType: ASSESSMENT_EVENT_TYPE,
          dateFrom: filters?.dateFrom,
          dateTo: filters?.dateTo,
          limit: 100,
          page: index + 2,
        })),
      )
    : [];
  const events = [firstPage, ...remainingPages].flatMap((page) => page.data);

  return events.map((event) => {
    const outcomeValue = stringValue(event.payload, ["outcome"], "Stable");
    const escalationValue = stringValue(event.payload, ["escalationStatus"], "Stable");
    return {
      id: event.id,
      episodeId,
      date: event.timestamp,
      escalationStatus: isEscalationStatus(escalationValue) ? escalationValue : "Stable",
      outcome: isAssessmentOutcome(outcomeValue) ? outcomeValue : "Stable",
      keyObservation: stringValue(event.payload, ["keyObservation"], "No key observation recorded."),
      clinicianNotes: stringValue(event.payload, ["clinicianNotes", "notes", "message"], "No clinical notes recorded."),
      clinicianName: stringValue(event.payload, ["clinicianName"], event.source === "clinician" ? "Clinician" : event.source),
      symptomStatus: stringValue(event.payload, ["symptomStatus"]),
      treatmentResponse: stringValue(event.payload, ["treatmentResponse"]),
      recommendedActions: stringArray(event.payload, ["recommendedActions"]),
    };
  });
}
export type SaveAssessmentPayload = {
  outcome: AssessmentOutcome;
  escalationStatus: EscalationStatus;
  recommendedActions: string[];
  symptomStatus: string;
  treatmentResponse: string;
  keyObservation: string;
  clinicianNotes: string;
  clinicianName: string;
};

export async function saveAssessment(episodeId: string, payload: SaveAssessmentPayload): Promise<Assessment> {
  const event = await createCareEpisodeTimelineEvent(episodeId, {
    eventType: ASSESSMENT_EVENT_TYPE,
    source: "clinician",
    status: "completed",
    payload: {
      ...payload,
      message: payload.clinicianNotes || `Clinical assessment recorded: ${payload.outcome}`,
    },
  });

  return {
    id: event.id,
    episodeId,
    date: event.timestamp,
    escalationStatus: payload.escalationStatus,
    outcome: payload.outcome,
    keyObservation: payload.keyObservation || "No key observation recorded.",
    clinicianNotes: payload.clinicianNotes,
    clinicianName: payload.clinicianName,symptomStatus: payload.symptomStatus,
    treatmentResponse: payload.treatmentResponse,
    recommendedActions: payload.recommendedActions,
  };
}

export async function getAssessmentWorkspace(episodeId: string): Promise<AssessmentWorkspaceEntry> {
  const today = new Date().toISOString().slice(0, 10);
  const [episode, medicationRecords, dailyVitals, labResults, history, taskCompletion] = await Promise.all([
    getCareEpisodeById(episodeId),
    getCareEpisodeMedicationAdherence(episodeId).catch(() => []),
    getCareEpisodeDailyVitals(episodeId, 7).catch(() => []),
    getCareEpisodeLabResults(episodeId).catch(() => []),
    getAssessmentHistory(episodeId).catch(() => []),
    getCareEpisodeTaskCompletion(episodeId, today).catch(() => null),
  ]);

  const symptoms = symptomNames(episode.latestCheckin);
  const latestVitals = dailyVitals.filter((entry) => entry.hasEntry).at(-1)?.vitals;
  const checkinNotes = stringValue(episode.latestCheckin ?? {}, ["notes"]);
  const clinicalSources = [
    latestVitals ? { label: "Vitals", verified: true } : null,
    symptoms.length > 0 ? { label: "Symptoms", verified: true } : null,
    checkinNotes ? { label: "Patient Notes", verified: true } : null,
    medicationRecords.length > 0 ? { label: "Medication adherence", verified: true } : null,
    labResults.length > 0 ? { label: "Laboratory results", verified: true } : null,
    Array.isArray(episode.latestCheckin?.images) && episode.latestCheckin.images.length > 0
      ? { label: "Clinical Media", verified: true }
      : null,
  ].filter((source): source is { label: string; verified: boolean } => Boolean(source));

  const medicationTotals = medicationRecords.reduce(
    (totals, item) => ({
      total: totals.total + item.totalDoses,
      completed: totals.completed + item.takenCount,
      missed: totals.missed + item.missedCount,
    }),
    { total: 0, completed: 0, missed: 0 },
  );
  const taskTotals = taskCompletion && taskCompletion.totalDue > 0
    ? { total: taskCompletion.totalDue, completed: taskCompletion.completed, missed: taskCompletion.missed }
    : { total: 0, completed: 0, missed: 0 };
  const adherenceTotal = medicationTotals.total + taskTotals.total;
  const adherenceCompleted = medicationTotals.completed + taskTotals.completed;
  const fallbackMedicationPercent = medicationRecords.length > 0
    ? Math.round(medicationRecords.reduce((total, item) => total + item.adherencePercentage, 0) / medicationRecords.length)
    : null;
  const adherencePercent = adherenceTotal > 0
    ? Math.round((adherenceCompleted / adherenceTotal) * 100)
    : fallbackMedicationPercent;
  const missedItems = medicationTotals.missed + taskTotals.missed;
  const adherenceSources = [
    medicationRecords.length > 0 ? { label: "Medication", verified: true } : null,
    taskTotals.total > 0 ? { label: "Daily Tasks", verified: true } : null,
  ].filter((source): source is { label: string; verified: boolean } => Boolean(source));
  const adherenceBreakdown = medicationRecords.map((item) => ({
    label: item.missedCount > 0
      ? `${item.name}: ${item.missedCount} missed dose${item.missedCount === 1 ? "" : "s"}`
      : `${item.name}: no missed doses`,
    positive: item.missedCount === 0,
  }));
  if (taskTotals.total > 0) {
    adherenceBreakdown.push({
      label: `${taskTotals.completed}/${taskTotals.total} daily tasks completed`,
      positive: taskTotals.missed === 0,
    });
  }

  return {
    episodeId,
    assessmentNumber: history.length + 1,
    clinicalStatus: {
      title: "Clinical Status Summary",
      confidencePercent: null,
      summary: "",
      sources: clinicalSources,
    },
    carePlanAdherence: {
      title: "Care Plan Adherence",
      confidencePercent: null,
      summary: adherenceSources.length > 0
        ? `Whole-care-plan adherence uses ${adherenceSources.map((source) => source.label.toLowerCase()).join(" and ")} records available for this episode.`
        : "No care-plan adherence records are available for this episode.",
      adherencePercent,
      trendLabel: missedItems > 0 ? `${missedItems} missed item${missedItems === 1 ? "" : "s"}` : "No missed items",
      trendPositive: missedItems === 0,
      trendDeltaPercent: null,
      breakdown: adherenceBreakdown,
      sources: adherenceSources,
    },
    outcomeOptions: ["Improving", "Stable", "Delayed Recovery", "Deteriorating", "Resolved"],
    recommendedActions: ["Adjust Care Plan", "Schedule Follow-up", "Send Patient Instructions", "Escalate to Specialist"],
    findings: {
      symptomStatus: symptoms.length > 0 ? symptoms.join(", ") : "",
      treatmentResponse: "",
      keyObservation: checkinNotes,
      clinicalNotes: "",
    },
  };
}

export type { EscalationStatus };
