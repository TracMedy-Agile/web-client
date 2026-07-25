import {
  getCareEpisodeById,
  getCareEpisodeDailyVitals,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeSync,
  getCareEpisodeTimelinePage,
  getCareEpisodes,
  getHospitalFacilityId,
  getString,
  type DailyVitalsRecord,
  type MedicationAdherenceRecord,
  type TimelineEventRecord,
  type CareEpisodeRecord,
} from "@/lib/api/care-episodes";
import {
  getClinicianDirectory,
  type ClinicianSearchResult,
} from "@/lib/api/clinicians";
import {
  getConnectedPatients,
  type ConnectedPatientRecord,
} from "@/lib/api/connected-patients";

export type AlertSeverity = "critical" | "moderate" | "low";
export type AlertStatus = "active" | "resolved";

export type ClinicalAlert = {
  id: string;
  episodeId: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  reason: string;
  triggerSource: string;
  severity: AlertSeverity;
  assignedClinician: string;
  timestamp: string;
  status: AlertStatus;
  acknowledgedBy: string;
  riskScore: number | null;
  riskCategory: string | null;
  riskTrend: string | null;
};

export type AlertsSnapshot = {
  active: ClinicalAlert[];
  history: ClinicalAlert[];
};

export type AlertReviewEvidence = {
  label: string;
  value: string;
  status: string;
};

export type AlertReviewImpact = {
  patientName: string;
  patientCode: string;
  riskScore: number | null;
  riskCategory: string | null;
  riskTrend: string | null;
  evidence: AlertReviewEvidence[];
};

function getSeverity(episode: CareEpisodeRecord): AlertSeverity {
  const category = (episode.riskCategory ?? "").toLowerCase();
  if (category === "critical" || category === "high" || (episode.riskScore ?? 0) >= 70) return "critical";
  if (category === "moderate" || category === "medium" || (episode.riskScore ?? 0) >= 40) return "moderate";
  return "low";
}

function isResolved(episode: CareEpisodeRecord) {
  return ["closed", "resolved", "completed"].includes(episode.status.toLowerCase());
}

function hasRiskSignal(episode: CareEpisodeRecord) {
  return episode.riskScore !== null || Boolean(episode.riskCategory);
}

function getPatientLabel(patientId: string, directory: Record<string, ConnectedPatientRecord>) {
  const patient = directory[patientId];
  if (patient) {
    return {
      name: patient.name || "Patient",
      code: patient.tracmedyPatientId ? `#PT-${patient.tracmedyPatientId}` : `ID: ${patient.patientId}`,
    };
  }
  const suffix = patientId.slice(-6).toUpperCase();
  return {
    name: suffix ? `Patient ${suffix}` : "Unknown Patient",
    code: suffix ? `ID: ${suffix}` : "ID unavailable",
  };
}

function toAlert(
  episode: CareEpisodeRecord,
  clinicianDirectory: Record<string, ClinicianSearchResult>,
  patientDirectory: Record<string, ConnectedPatientRecord>,
): ClinicalAlert {
  const patient = getPatientLabel(episode.patientId, patientDirectory);
  const resolved = isResolved(episode);
  const riskLabel = episode.riskCategory || (episode.riskScore !== null ? `${Math.round(episode.riskScore)}% risk` : "Risk");
  const clinician = clinicianDirectory[episode.clinicianId]?.name || "Unassigned";

  return {
    id: `risk-${episode.id}`,
    episodeId: episode.id,
    patientId: episode.patientId,
    patientName: patient.name,
    patientCode: patient.code,
    reason: `${riskLabel} signal${episode.diagnosis ? ` — ${episode.diagnosis}` : ""}`,
    triggerSource: "Risk Engine",
    severity: getSeverity(episode),
    assignedClinician: clinician,
    timestamp: episode.updatedAt || episode.createdAt,
    status: resolved ? "resolved" : "active",
    acknowledgedBy: resolved ? "Not recorded" : "—",
    riskScore: episode.riskScore,
    riskCategory: episode.riskCategory,
    riskTrend: episode.riskTrend,
  };
}

export async function getAlertsSnapshot(): Promise<AlertsSnapshot> {
  const [episodesResponse, clinicianDirectory, patientDirectory] = await Promise.all([
    getCareEpisodes({ page: 1, limit: 100 }),
    getClinicianDirectory().catch(() => ({})),
    getHospitalFacilityId()
      .then((facilityId) => getConnectedPatients(facilityId, { page: 1, limit: 100 }))
      .then((response) => Object.fromEntries(response.data.map((patient) => [patient.patientId, patient])))
      .catch(() => ({} as Record<string, ConnectedPatientRecord>)),
  ]);

  const alerts = episodesResponse.data
    .filter(hasRiskSignal)
    .map((episode) => toAlert(episode, clinicianDirectory, patientDirectory))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  return {
    active: alerts.filter((alert) => alert.status === "active"),
    history: alerts.filter((alert) => alert.status === "resolved"),
  };
}

function latestVitalEntry(records: DailyVitalsRecord[]) {
  return records
    .filter((record) => record.hasEntry)
    .sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

function buildVitalEvidence(records: DailyVitalsRecord[]): AlertReviewEvidence[] {
  const latest = latestVitalEntry(records);
  if (!latest) return [];
  const evidence: AlertReviewEvidence[] = [];
  const { vitals } = latest;
  if (vitals.bloodPressureSystolic !== null && vitals.bloodPressureDiastolic !== null) {
    evidence.push({ label: `Blood pressure (${latest.date})`, value: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`, status: "RECORDED" });
  }
  if (vitals.heartRate !== null) evidence.push({ label: `Heart rate (${latest.date})`, value: `${vitals.heartRate} bpm`, status: "RECORDED" });
  if (vitals.spo2 !== null) evidence.push({ label: `SpO₂ (${latest.date})`, value: `${vitals.spo2}%`, status: "RECORDED" });
  if (vitals.temperature !== null) evidence.push({ label: `Temperature (${latest.date})`, value: `${vitals.temperature} °C`, status: "RECORDED" });
  return evidence;
}

function buildAdherenceEvidence(records: MedicationAdherenceRecord[]): AlertReviewEvidence[] {
  if (records.length === 0) return [];
  const totalDoses = records.reduce((sum, record) => sum + record.totalDoses, 0);
  const takenDoses = records.reduce((sum, record) => sum + record.takenCount, 0);
  const adherence = totalDoses > 0
    ? Math.round((takenDoses / totalDoses) * 100)
    : Math.round(records.reduce((sum, record) => sum + record.adherencePercentage, 0) / records.length);
  return [{
    label: "Medication adherence",
    value: `${adherence}% (${takenDoses} of ${totalDoses} doses)`,
    status: "RECORDED",
  }];
}

function buildTimelineEvidence(events: TimelineEventRecord[]): AlertReviewEvidence[] {
  const latest = [...events].sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
  if (!latest) return [];
  const description = getString(latest.payload, ["message", "title", "description"], latest.eventType.replaceAll("_", " "));
  return [{
    label: "Latest clinical event",
    value: description,
    status: latest.status.toUpperCase() || "RECORDED",
  }];
}

export async function getAlertReviewImpact(alert: ClinicalAlert): Promise<AlertReviewImpact> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [detail, vitals, adherence, timeline, sync] = await Promise.all([
    getCareEpisodeById(alert.episodeId).catch(() => null),
    getCareEpisodeDailyVitals(alert.episodeId, 7).catch(() => []),
    getCareEpisodeMedicationAdherence(alert.episodeId).catch(() => []),
    getCareEpisodeTimelinePage(alert.episodeId, { page: 1, limit: 10 }).catch(() => null),
    getCareEpisodeSync(alert.episodeId, since).catch(() => null),
  ]);
  const patientName = detail?.patient?.name || alert.patientName;
  const patientCode = detail?.patient?.hospitalId ? `ID: ${detail.patient.hospitalId}` : alert.patientCode;
  const events = [...(sync?.events ?? []), ...(timeline?.data ?? [])];
  const severity = alert.severity.toUpperCase();
  const evidence = [
    ...buildVitalEvidence(vitals),
    ...buildAdherenceEvidence(adherence),
    ...buildTimelineEvidence(events),
    { label: "Assigned clinician", value: alert.assignedClinician, status: "LINKED" },
  ].slice(0, 6);

  return {
    patientName,
    patientCode,
    riskScore: sync?.riskScore ?? detail?.riskScore ?? alert.riskScore,
    riskCategory: detail?.riskCategory ?? alert.riskCategory,
    riskTrend: detail?.riskTrend ?? alert.riskTrend,
    evidence: evidence.length > 0
      ? evidence
      : [{ label: "Alert severity", value: alert.severity, status: severity }],
  };
}
