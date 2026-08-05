import {
  asRecord,
  getCareEpisodeById,
  getCareEpisodeDailyVitals,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeSync,
  getCareEpisodeTimelinePage,
  getCareEpisodes,
  getHospitalFacilityId,
  getNumber,
  getString,
  type ApiRecord,
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
import type { components } from "@/docs/types/api";

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
  acknowledgedAt: string | null;
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
  expectedLabel: string;
  expected: string;
  actualLabel: string;
  actual: string;
  riskScore: number | null;
  riskCategory: string | null;
  trend: string;
  evidence: AlertReviewEvidence[];
  analysisSummary: string;
  generatedAt: string;
  analysisSource: "alert-impact endpoint" | "episode evidence fallback";
};

export type ResolveAlertInput = components["schemas"]["ResolveAlertDto"];
export type EscalateAlertInput = components["schemas"]["EscalateAlertDto"];

type AlertApiRecord = {
  id: string;
  episodeId: string;
  patientId: string;
  patientName: string;
  type: string;
  severity: string;
  triggerSource: string;
  triggerData: ApiRecord;
  status: string;
  acknowledgedBy: string;
  acknowledgedById: string;
  acknowledgedAt: string;
  createdAt: string;
};

type AlertApiPage = {
  data: AlertApiRecord[];
  totalPages: number;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/get-token");
    const payload: unknown = await response.json();
    const record = asRecord(payload);
    return typeof record?.accessToken === "string" ? record.accessToken : null;
  } catch {
    return null;
  }
}

async function requestAlerts(path: string, query: URLSearchParams): Promise<unknown> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}${path}?${query.toString()}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = getString(asRecord(payload), ["message"], "Unable to load alerts.");
    throw new Error(message);
  }

  return payload;
}

async function requestAlertAction(path: string, init?: RequestInit): Promise<unknown> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = getString(asRecord(payload), ["message"], "Unable to update the alert.");
    throw new Error(message);
  }
  return unwrapData(payload);
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await requestAlertAction(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: "PATCH" });
}

export async function resolveAlert(alertId: string, input: ResolveAlertInput): Promise<void> {
  await requestAlertAction(`/alerts/${encodeURIComponent(alertId)}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function escalateAlert(alertId: string, input: EscalateAlertInput): Promise<void> {
  await requestAlertAction(`/alerts/${encodeURIComponent(alertId)}/escalate`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

function unwrapData(payload: unknown): unknown {
  const record = asRecord(payload);
  return record && "data" in record ? record.data : payload;
}

function normalizeAlert(record: ApiRecord): AlertApiRecord {
  const acknowledger = asRecord(record.acknowledgedBy);
  return {
    id: getString(record, ["id"]),
    episodeId: getString(record, ["episodeId"]),
    patientId: getString(record, ["patientId"]),
    patientName: getString(record, ["patientName"], "Patient"),
    type: getString(record, ["type"], "clinical_alert"),
    severity: getString(record, ["severity"], "low"),
    triggerSource: getString(record, ["triggerSource"], "Clinical monitoring"),
    triggerData: asRecord(record.triggerData) ?? {},
    status: getString(record, ["status"], "open"),
    acknowledgedBy: getString(acknowledger, ["name"], getString(record, ["acknowledgedByName"], "Not recorded")),
    acknowledgedById: getString(acknowledger, ["id"], getString(record, ["acknowledgedById"])),
    acknowledgedAt: getString(record, ["acknowledgedAt"]),
    createdAt: getString(record, ["createdAt"]),
  };
}

function parseAlertPage(payload: unknown): AlertApiPage {
  const body = asRecord(unwrapData(payload)) ?? {};
  const list = Array.isArray(body.data) ? body.data : [];
  return {
    data: list
      .map(asRecord)
      .filter((record): record is ApiRecord => Boolean(record))
      .map(normalizeAlert)
      .filter((alert) => Boolean(alert.id && alert.episodeId && alert.patientId)),
    totalPages: Math.max(getNumber(body, ["totalPages"]) ?? 1, 1),
  };
}

async function getAllAlertRecords(
  path: "/alerts" | "/alerts/history",
  filters?: { status?: string; patientId?: string; episodeId?: string },
): Promise<AlertApiRecord[]> {
  const createQuery = (page: number) => {
    const query = new URLSearchParams({ page: String(page), limit: "100" });
    if (filters?.status) query.set("status", filters.status);
    if (filters?.patientId) query.set("patientId", filters.patientId);
    if (filters?.episodeId) query.set("episodeId", filters.episodeId);
    return query;
  };

  const firstPage = parseAlertPage(await requestAlerts(path, createQuery(1)));
  if (firstPage.totalPages === 1) return firstPage.data;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      requestAlerts(path, createQuery(index + 2)).then(parseAlertPage),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.data);
}

function normalizeSeverity(value: string): AlertSeverity {
  const severity = value.toLowerCase();
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "moderate" || severity === "medium") return "moderate";
  return "low";
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
  alert: AlertApiRecord,
  episode: CareEpisodeRecord | undefined,
  clinicianDirectory: Record<string, ClinicianSearchResult>,
  patientDirectory: Record<string, ConnectedPatientRecord>,
): ClinicalAlert {
  const patient = getPatientLabel(alert.patientId, patientDirectory);
  const clinician = episode
    ? clinicianDirectory[episode.clinicianId]?.name || episode.clinicianName || "Unassigned"
    : "Unassigned";
  const reason =
    getString(
      alert.triggerData,
      ["message", "title", "reason", "details", "description", "summary"],
    ) ||
    humanize(alert.type) ||
    "Clinical alert";

  return {
    id: alert.id,
    episodeId: alert.episodeId,
    patientId: alert.patientId,
    patientName: patientDirectory[alert.patientId] ? patient.name : alert.patientName,
    patientCode: patient.code,
    reason,
    triggerSource: humanize(alert.triggerSource),
    severity: normalizeSeverity(alert.severity),
    assignedClinician: clinician,
    timestamp: alert.status === "open" ? alert.createdAt : alert.acknowledgedAt || alert.createdAt,
    acknowledgedAt: alert.acknowledgedAt || null,
    status: alert.status === "open" ? "active" : "resolved",
    acknowledgedBy: alert.acknowledgedBy,
    riskScore: episode?.riskScore ?? null,
    riskCategory: episode?.riskCategory ?? null,
    riskTrend: episode?.riskTrend ?? null,
  };
}
export async function getAlertsSnapshot(): Promise<AlertsSnapshot> {
  const [activeAlerts, historyAlerts, episodesResponse, clinicianDirectory, patientDirectory] = await Promise.all([
    getAllAlertRecords("/alerts", { status: "open" }),
    getAllAlertRecords("/alerts/history"),
    getCareEpisodes({ page: 1, limit: 100 }),
    getClinicianDirectory().catch(() => ({})),
    getHospitalFacilityId()
      .then((facilityId) => getConnectedPatients(facilityId, { page: 1, limit: 100 }))
      .then((response) => Object.fromEntries(response.data.map((patient) => [patient.patientId, patient])))
      .catch(() => ({} as Record<string, ConnectedPatientRecord>)),
  ]);
  const episodesById = Object.fromEntries(
    episodesResponse.data.map((episode) => [episode.id, episode]),
  ) as Record<string, CareEpisodeRecord>;
  const mapAlerts = (alerts: AlertApiRecord[]) =>
    alerts
      .map((alert) =>
        toAlert(
          alert,
          episodesById[alert.episodeId],
          clinicianDirectory,
          patientDirectory,
        ),
      )
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );

  return {
    active: mapAlerts(activeAlerts),
    history: mapAlerts(historyAlerts),
  };
}

export async function getOpenAlertsForEpisode(
  episodeId: string,
  patientId: string,
): Promise<ClinicalAlert[]> {
  const alerts = await getAllAlertRecords("/alerts", {
    status: "open",
    patientId,
    episodeId,
  });
  return alerts.map((alert) => toAlert(alert, undefined, {}, {}));
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

function getStringList(record: ApiRecord | null, key: string): string[] {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getDisplayValue(record: ApiRecord | null, keys: string[]): string {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    const nested = asRecord(value);
    if (nested) {
      const nestedValue = getString(nested, ["display", "label", "value"]);
      const unit = getString(nested, ["unit"]);
      if (nestedValue) return [nestedValue, unit].filter(Boolean).join(" ");
    }
  }
  return "";
}

function buildEndpointEvidence(record: ApiRecord | null): AlertReviewEvidence[] {
  const evidence: AlertReviewEvidence[] = [];
  for (const key of ["evidence", "signalBreakdown", "relevantMetrics"]) {
    const values = record?.[key];
    if (!Array.isArray(values)) continue;
    values.forEach((value) => {
      if (typeof value === "string" && value.trim()) {
        evidence.push({ label: "Impact signal", value: value.trim(), status: "RECORDED" });
        return;
      }
      const item = asRecord(value);
      if (!item) return;
      const label = getString(item, ["label", "metric", "name", "type"], "Clinical evidence");
      const recordedAt = getString(item, ["recordedAt", "timestamp", "date"]);
      const displayLabel = recordedAt ? `${label} (${recordedAt.slice(0, 10)})` : label;
      const itemValue = getDisplayValue(item, ["displayValue", "value", "actual", "reading", "summary"]);
      if (!itemValue) return;
      evidence.push({
        label: displayLabel,
        value: itemValue,
        status: getString(item, ["status", "severity"], "RECORDED").toUpperCase(),
      });
    });
  }
  return evidence;
}

function recordedVitalValues(records: DailyVitalsRecord[], key: keyof DailyVitalsRecord["vitals"]): number[] {
  return [...records]
    .filter((record) => record.hasEntry && record.vitals[key] !== null)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((record) => record.vitals[key])
    .filter((value): value is number => value !== null);
}

function describeTrend(values: number[], unit: string): string {
  if (values.length < 2) return values.length === 1 ? "Single recorded check-in" : "No recorded trend";
  const change = values[values.length - 1] - values[0];
  const threshold = unit === "°C" ? 0.2 : unit === "%" ? 1 : 2;
  if (Math.abs(change) < threshold) return `Stable across ${values.length} recorded check-ins`;
  return `${change > 0 ? "Increasing" : "Decreasing"} by ${Math.abs(change).toFixed(unit === "°C" ? 1 : 0)}${unit} across ${values.length} recorded check-ins`;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function buildVitalHeadline(alert: ClinicalAlert, records: DailyVitalsRecord[]) {
  const trigger = `${alert.triggerSource} ${alert.reason}`.toLowerCase();
  if (trigger.includes("heart") || trigger.includes("pulse") || /\bhr\b/.test(trigger)) {
    const values = recordedVitalValues(records, "heartRate");
    const value = average(values);
    return value === null ? null : { expectedLabel: "Expected resting heart rate", expected: "60–100 bpm", actualLabel: `${values.length}-check-in average`, actual: `${Math.round(value)} bpm`, trend: describeTrend(values, " bpm") };
  }
  if (trigger.includes("spo2") || trigger.includes("oxygen")) {
    const values = recordedVitalValues(records, "spo2");
    const value = average(values);
    return value === null ? null : { expectedLabel: "Expected oxygen saturation", expected: "95–100%", actualLabel: `${values.length}-check-in average`, actual: `${Math.round(value)}%`, trend: describeTrend(values, "%") };
  }
  if (trigger.includes("temperature") || trigger.includes("fever")) {
    const values = recordedVitalValues(records, "temperature");
    const value = average(values);
    return value === null ? null : { expectedLabel: "Expected temperature range", expected: "36.1–37.2 °C", actualLabel: `${values.length}-check-in average`, actual: `${value.toFixed(1)} °C`, trend: describeTrend(values, "°C") };
  }
  if (trigger.includes("blood pressure") || /\bbp\b/.test(trigger)) {
    const systolic = recordedVitalValues(records, "bloodPressureSystolic");
    const diastolic = recordedVitalValues(records, "bloodPressureDiastolic");
    const systolicAverage = average(systolic);
    const diastolicAverage = average(diastolic);
    return systolicAverage === null || diastolicAverage === null ? null : { expectedLabel: "Expected resting blood pressure", expected: "90–120 / 60–80 mmHg", actualLabel: `${Math.min(systolic.length, diastolic.length)}-check-in average`, actual: `${Math.round(systolicAverage)}/${Math.round(diastolicAverage)} mmHg`, trend: describeTrend(systolic, " mmHg") };
  }
  return null;
}

export async function getAlertReviewImpact(alert: ClinicalAlert): Promise<AlertReviewImpact> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [detail, vitals, adherence, timeline, sync, backendImpactPayload] = await Promise.all([
    getCareEpisodeById(alert.episodeId).catch(() => null),
    getCareEpisodeDailyVitals(alert.episodeId, 7).catch(() => []),
    getCareEpisodeMedicationAdherence(alert.episodeId).catch(() => []),
    getCareEpisodeTimelinePage(alert.episodeId, { page: 1, limit: 10 }).catch(() => null),
    getCareEpisodeSync(alert.episodeId, since).catch(() => null),
    requestAlertAction(`/alerts/${encodeURIComponent(alert.id)}/impact`).catch(() => null),
  ]);
  const impactRoot = asRecord(backendImpactPayload);
  const backendImpact = asRecord(impactRoot?.impact) ?? impactRoot;
  const patientName = detail?.patient?.name || alert.patientName;
  const patientCode = detail?.patient?.hospitalId ? `ID: ${detail.patient.hospitalId}` : alert.patientCode;
  const events = [...(sync?.events ?? []), ...(timeline?.data ?? [])];
  const severity = alert.severity.toUpperCase();
  const endpointEvidence = buildEndpointEvidence(backendImpact);
  const backendSignals = getStringList(backendImpact, "trends")
    .map((value) => ({ label: "Impact trend", value, status: "RECORDED" }));
  const evidence = [
    ...endpointEvidence,
    ...backendSignals,
    ...buildVitalEvidence(vitals),
    ...buildAdherenceEvidence(adherence),
    ...buildTimelineEvidence(events),
    { label: "Assigned clinician", value: alert.assignedClinician, status: "LINKED" },
  ].slice(0, 5);
  const vitalHeadline = buildVitalHeadline(alert, vitals);
  const riskScore = sync?.riskScore ?? detail?.riskScore ?? alert.riskScore;
  const endpointExpected = getDisplayValue(backendImpact, ["expected", "expectedValue", "expectedRange"]);
  const endpointActual = getDisplayValue(backendImpact, ["actual", "actualValue", "currentValue"]);
  const endpointTrend = getDisplayValue(backendImpact, ["trend", "trendDirection"]);
  const hasStructuredEndpointImpact = Boolean(endpointExpected || endpointActual || endpointTrend || endpointEvidence.length);

  return {
    patientName,
    patientCode,
    expectedLabel: getString(backendImpact, ["expectedLabel"]) || vitalHeadline?.expectedLabel || "Alert trigger",
    expected: endpointExpected || vitalHeadline?.expected || alert.triggerSource,
    actualLabel: getString(backendImpact, ["actualLabel"]) || vitalHeadline?.actualLabel || "Current risk score",
    actual: endpointActual || vitalHeadline?.actual || (riskScore === null ? "Not recorded" : `${Math.round(riskScore)}/100`),
    riskScore,
    riskCategory: detail?.riskCategory ?? alert.riskCategory,
    trend: endpointTrend || vitalHeadline?.trend || detail?.riskTrend || alert.riskTrend || "No trend supplied",
    analysisSummary: getString(backendImpact, ["ai_summary", "aiSummary", "summary"]),
    generatedAt: getString(backendImpact, ["generatedAt", "generated_at", "computedAt"]) || new Date().toISOString(),
    analysisSource: hasStructuredEndpointImpact ? "alert-impact endpoint" : "episode evidence fallback",
    evidence: evidence.length > 0
      ? evidence
      : [{ label: "Alert severity", value: alert.severity, status: severity }],
  };
}
