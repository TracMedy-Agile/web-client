import {
  createCareEpisodeTimelineEvent,
  getCareEpisodeById,
  getCareEpisodeDailyVitals,
  getCareEpisodeMedicationAdherence,
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
  const page = await getCareEpisodeTimelinePage(episodeId, {
    eventType: ASSESSMENT_EVENT_TYPE,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    limit: 100,
  });

  return page.data.map((event) => {
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
    clinicianName: payload.clinicianName,
  };
}

export async function getAssessmentWorkspace(episodeId: string): Promise<AssessmentWorkspaceEntry> {
  const [episode, medicationRecords, dailyVitals, history] = await Promise.all([
    getCareEpisodeById(episodeId),
    getCareEpisodeMedicationAdherence(episodeId).catch(() => []),
    getCareEpisodeDailyVitals(episodeId, 7).catch(() => []),
    getAssessmentHistory(episodeId).catch(() => []),
  ]);

  const symptoms = symptomNames(episode.latestCheckin);
  const latestVitals = dailyVitals.filter((entry) => entry.hasEntry).at(-1)?.vitals;
  const checkinNotes = stringValue(episode.latestCheckin ?? {}, ["notes"]);
  const clinicalSources = [
    latestVitals ? { label: "Vitals", verified: true } : null,
    symptoms.length > 0 ? { label: "Symptoms", verified: true } : null,
    checkinNotes ? { label: "Patient Notes", verified: true } : null,
    Array.isArray(episode.latestCheckin?.images) && episode.latestCheckin.images.length > 0
      ? { label: "Clinical Media", verified: true }
      : null,
  ].filter((source): source is { label: string; verified: boolean } => Boolean(source));

  const vitalSummary = latestVitals
    ? [
        latestVitals.spo2 != null ? `SpO2 ${latestVitals.spo2}%` : "",
        latestVitals.heartRate != null ? `heart rate ${latestVitals.heartRate} bpm` : "",
        latestVitals.bloodPressureSystolic != null
          ? `blood pressure ${latestVitals.bloodPressureSystolic}/${latestVitals.bloodPressureDiastolic ?? "--"} mmHg`
          : "",
      ].filter(Boolean).join(", ")
    : "";

  const clinicalSummary = [
    episode.diagnosis ? `The active episode is monitoring ${episode.diagnosis}.` : "",
    vitalSummary ? `The latest recorded vitals show ${vitalSummary}.` : "No recent daily vitals are available.",
    symptoms.length > 0 ? `The latest check-in reports ${symptoms.join(", ")}.` : "No symptoms were reported in the latest check-in.",
    checkinNotes ? `Patient note: ${checkinNotes}` : "",
    episode.riskScore != null ? `The current risk score is ${episode.riskScore}.` : "",
  ].filter(Boolean).join(" ");

  const adherencePercent = medicationRecords.length > 0
    ? Math.round(medicationRecords.reduce((total, item) => total + item.adherencePercentage, 0) / medicationRecords.length)
    : 0;
  const missedDoses = medicationRecords.reduce((total, item) => total + item.missedCount, 0);
  const adherenceBreakdown = medicationRecords.map((item) => ({
    label: item.missedCount > 0
      ? `${item.name}: ${item.missedCount} missed dose${item.missedCount === 1 ? "" : "s"}`
      : `${item.name}: no missed doses`,
    positive: item.missedCount === 0,
  }));
  if (episode.latestCheckin) adherenceBreakdown.push({ label: "Latest check-in received", positive: true });

  return {
    episodeId,
    assessmentNumber: history.length + 1,
    clinicalStatus: {
      title: "Clinical Status Summary",
      confidencePercent: null,
      summary: clinicalSummary,
      sources: clinicalSources,
    },
    carePlanAdherence: {
      title: "Care Plan Adherence",
      confidencePercent: null,
      summary: medicationRecords.length > 0
        ? "Calculated from medication logs available for this episode."
        : "No medication adherence records are available for this episode.",
      adherencePercent: medicationRecords.length > 0 ? adherencePercent : null,
      trendLabel: missedDoses > 0 ? `${missedDoses} missed dose${missedDoses === 1 ? "" : "s"}` : "No missed doses",
      trendDeltaPercent: null,
      breakdown: adherenceBreakdown,
      sources: medicationRecords.length > 0 ? [{ label: "Medication", verified: true }] : [],
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
