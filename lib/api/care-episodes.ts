import type { components, operations } from "@/docs/types/api";

type ApiCareEpisodeSummary = components["schemas"]["CareEpisodeSummaryDto"];
export type AddPatientToQueuePayload = components["schemas"]["CreateCareEpisodeDto"];
type OpenPendingEpisodePayload = components["schemas"]["OpenPendingEpisodeDto"];
type DismissPendingEpisodePayload = components["schemas"]["DismissPendingEpisodeDto"];
type CloseEpisodePayload = components["schemas"]["CloseEpisodeDto"];
type DailyVitalsApiResponse =
  operations["CareEpisodesController_getDailyVitals"]["responses"][200]["content"]["application/json"];
type MedicationAdherenceApiRecord = components["schemas"]["MedicationAdherenceDto"];
type CreateTimelineEventPayload = Omit<components["schemas"]["CreateTimelineEventDto"], "payload"> & {
  payload?: Record<string, unknown>;
};

export type CareEpisodeRecord = {
  id: ApiCareEpisodeSummary["id"];
  patientId: ApiCareEpisodeSummary["patientId"];
  facilityId: ApiCareEpisodeSummary["facilityId"];
  clinicianId: string;
  diagnosis: string;
  status: ApiCareEpisodeSummary["status"];
  carePhase: string | null;
  dayStart: number | null;
  expectedDurationDays: number | null;
  riskScore: number | null;
  riskCategory: string | null;
  riskTrend: string | null;
  closureReason: string | null;
  outcomeStatus: string | null;
  finalNotes?: string | null;
  encounterType: string | null;
  conditionSeverity: string | null;
  tracmedyPatientId?: string | null;
  clinicalConcern?: string | null;
  clinicianNotes?: string | null;
  clinicianName?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareEpisodesResponse = {
  data: CareEpisodeRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  activeCount: number;
  pendingCount: number;
  closedCount: number;
  highRiskCount: number;
  todayCheckinsPending: number;
};

export type CareEpisodesQueryParams = {
  status?: string;
  riskLevel?: string;
  dateFrom?: string;
  dateTo?: string;
  patientId?: string;
  page?: number;
  limit?: number;
};

export type PatientSearchResult = {
  id: string;
  name: string;
  tracmedyPatientId: string;
  phone: string;
};

export type ApiRecord = Record<string, unknown>;

export type CareEpisodePatient = {
  name: string;
  phone: string;
  email: string;
  age: number | null;
  gender: string;
  hospitalId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export type CareTeamMember = {
  id: string;
  clinicianId: string;
  name: string;
  role: string;
  assignedAt: string;
};

export type CareEpisodeDetail = CareEpisodeRecord & {
  currentCarePlan: ApiRecord | null;
  patient: CareEpisodePatient | null;
  careTeam: CareTeamMember[];
  latestCheckin: ApiRecord | null;
  recentTimeline: ApiRecord[];
  riskData: ApiRecord | null;
  dayProgress: number | null;
  facility: { id: string; name: string; tracId: string } | null;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-token");
    const { accessToken } = await res.json();
    return typeof accessToken === "string" ? accessToken : null;
  } catch {
    return null;
  }
}

async function request(path: string, init?: RequestInit, query?: URLSearchParams) {
  const accessToken = await getAccessToken();
  const url = `${BASE}${path}${query?.toString() ? `?${query}` : ""}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).message
        : undefined;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }

  return payload;
}

function setQueryValue(query: URLSearchParams, key: string, value?: string | number) {
  if (value === undefined || value === null || value === "" || value === "all") return;
  query.set(key, String(value));
}

function clampLimit(limit?: number) {
  if (!limit || !Number.isFinite(limit)) return 5;
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

export function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ApiRecord) : null;
}

export function getString(record: ApiRecord | null, keys: string[], fallback = "") {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

export function getNumber(record: ApiRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeCareEpisodeSummary(record: ApiRecord): CareEpisodeRecord {
  return {
    id: getString(record, ["id"]),
    patientId: getString(record, ["patientId"]),
    facilityId: getString(record, ["facilityId"]),
    clinicianId: getString(record, ["clinicianId"]),
    diagnosis: getString(record, ["diagnosis"]),
    status: getString(record, ["status"]),
    carePhase: getString(record, ["carePhase"]) || null,
    dayStart: getNumber(record, ["dayStart"]),
    expectedDurationDays: getNumber(record, ["expectedDurationDays"]),
    riskScore: getNumber(record, ["riskScore"]),
    riskCategory: getString(record, ["riskCategory"]) || null,
    riskTrend: getString(record, ["riskTrend"]) || null,
    closureReason: getString(record, ["closureReason"]) || null,
    outcomeStatus: getString(record, ["outcomeStatus"]) || null,
    finalNotes: getString(record, ["finalNotes"]) || null,
    encounterType: getString(record, ["encounterType"]) || null,
    conditionSeverity: getString(record, ["conditionSeverity"]) || null,
    tracmedyPatientId: getString(record, ["tracmedyPatientId"]) || null,
    clinicalConcern: getString(record, ["clinicalConcern"]) || null,
    clinicianNotes: getString(record, ["clinicianNotes"]) || null,
    clinicianName: getString(record, ["clinicianName"]) || null,
    closedAt: getString(record, ["closedAt"]) || null,
    createdAt: getString(record, ["createdAt"]),
    updatedAt: getString(record, ["updatedAt"]),
  };
}

function unwrapData(payload: unknown) {
  const record = asRecord(payload);
  return record && "data" in record ? record.data : payload;
}

export async function getHospitalFacilityId(): Promise<string> {
  const payload = await request("/auth/hospital");
  const data = asRecord(unwrapData(payload));
  const facility = asRecord(data?.facility);
  const id = facility?.id;
  return typeof id === "string" ? id : "";
}

export async function getCareEpisodes(params?: CareEpisodesQueryParams): Promise<CareEpisodesResponse> {
  const query = new URLSearchParams();
  setQueryValue(query, "status", params?.status);
  setQueryValue(query, "riskLevel", params?.riskLevel);
  setQueryValue(query, "dateFrom", params?.dateFrom);
  setQueryValue(query, "dateTo", params?.dateTo);
  setQueryValue(query, "patientId", params?.patientId);
  setQueryValue(query, "page", params?.page ?? 1);
  setQueryValue(query, "limit", clampLimit(params?.limit));

  const payload = await request("/care-episodes", undefined, query);
  const body = asRecord(payload) ?? {};
  const nested = asRecord(body.data);
  const rawList = Array.isArray(body.data)
    ? body.data
    : Array.isArray(nested?.data)
      ? nested.data
      : [];
  const source = Array.isArray(body.data) ? body : (nested ?? body);
  const list = rawList
    .map(asRecord)
    .filter((item): item is ApiRecord => Boolean(item))
    .map(normalizeCareEpisodeSummary);

  return {
    data: list,
    total: getNumber(source, ["total"]) ?? list.length,
    page: getNumber(source, ["page"]) ?? params?.page ?? 1,
    limit: getNumber(source, ["limit"]) ?? clampLimit(params?.limit),
    totalPages: getNumber(source, ["totalPages"]) ?? 1,
    activeCount: getNumber(source, ["activeCount"]) ?? 0,
    pendingCount: getNumber(source, ["pendingCount"]) ?? 0,
    closedCount: getNumber(source, ["closedCount"]) ?? 0,
    highRiskCount: getNumber(source, ["highRiskCount"]) ?? 0,
    todayCheckinsPending: getNumber(source, ["todayCheckinsPending"]) ?? 0,
  };
}

export async function addPatientToQueue(payload: AddPatientToQueuePayload): Promise<{ id: string }> {
  const response = await request("/care-episodes/pending", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const record = asRecord(unwrapData(response)) ?? asRecord(response);
  return { id: getString(record, ["id"]) };
}

export async function getCurrentUserId(): Promise<string> {
  const payload = await request("/auth/me");
  const root = asRecord(unwrapData(payload));
  const user = asRecord(root?.user) ?? root;
  const id = getString(user, ["id"]);
  if (!id) throw new Error("Unable to determine the current clinician.");
  return id;
}

export type CurrentUserIdentity = { id: string; name: string };

export async function getCurrentUserIdentity(): Promise<CurrentUserIdentity> {
  const payload = await request("/auth/me");
  const root = asRecord(unwrapData(payload));
  const user = asRecord(root?.user) ?? root;
  const id = getString(user, ["id"]);
  if (!id) throw new Error("Unable to determine the current clinician.");
  return { id, name: getString(user, ["name"], "Current clinician") };
}

export async function openPendingCareEpisode(
  id: string,
  clinicianId?: string | null,
): Promise<CareEpisodeRecord> {
  const resolvedClinicianId = clinicianId || await getCurrentUserId();
  const payload: OpenPendingEpisodePayload = { clinicianId: resolvedClinicianId };
  const response = await request("/care-episodes/pending/" + encodeURIComponent(id) + "/open", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const record = asRecord(unwrapData(response)) ?? asRecord(response);
  if (!record) throw new Error("The opened care episode response was invalid.");
  return normalizeCareEpisodeSummary(record);
}

export async function dismissPendingCareEpisode(
  id: string,
  reason = "No further action required after clinical review",
): Promise<CareEpisodeRecord> {
  const payload: DismissPendingEpisodePayload = { reason };
  const response = await request("/care-episodes/pending/" + encodeURIComponent(id) + "/dismiss", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const record = asRecord(unwrapData(response)) ?? asRecord(response);
  if (!record) throw new Error("The dismissed care episode response was invalid.");
  return normalizeCareEpisodeSummary(record);
}

function getPatientItems(payload: unknown): ApiRecord[] {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data.filter((item): item is ApiRecord => Boolean(asRecord(item)));

  const record = asRecord(data);
  if (!record) return [];

  const candidates = [record.items, record.patients, record.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }

  return [];
}

function normalizePatient(record: ApiRecord): PatientSearchResult {
  return {
    id: getString(record, ["id", "patientId", "_id"]),
    name: getString(record, ["name", "fullName", "patientName"], "Unknown Patient"),
    tracmedyPatientId: getString(record, ["tracmedyPatientId"]),
    phone: getString(record, ["phone"]),
  };
}

export async function searchPatients(query: string): Promise<PatientSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const payload = await request(`/patients/search?q=${encodeURIComponent(q)}`);
  return getPatientItems(payload).map(normalizePatient).filter((patient) => patient.id);
}

export function getRecordArray(record: ApiRecord | null, keys: string[]): ApiRecord[] {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is ApiRecord => Boolean(asRecord(item)));
  }
  return [];
}

function normalizeCareTeamMember(record: ApiRecord): CareTeamMember {
  return {
    id: getString(record, ["id", "_id"]),
    clinicianId: getString(record, ["clinicianId"]),
    name: getString(record, ["name", "fullName", "clinicianName"]),
    role: getString(record, ["role", "title", "specialty", "specialization"]),
    assignedAt: getString(record, ["assignedAt", "createdAt"]),
  };
}

// Normalizes the patient summary embedded by GET /care-episodes/{id}.
function normalizePatientIdentity(record: ApiRecord | null): CareEpisodePatient | null {
  if (!record) return null;

  return {
    name: getString(record, ["name"], "Unknown Patient"),
    phone: getString(record, ["phone"]),
    email: getString(record, ["email"]),
    age: getNumber(record, ["age"]),
    gender: getString(record, ["gender"]),
    hospitalId: getString(record, ["tracmedyPatientId", "hospitalId"]),
    emergencyContactName: "",
    emergencyContactPhone: "",
  };
}

async function getFacilityPatient(facilityId: string, patientId: string): Promise<CareEpisodePatient | null> {
  if (!facilityId || !patientId) return null;
  const payload = await request(
    "/facilities/" + encodeURIComponent(facilityId) + "/patients/" + encodeURIComponent(patientId),
  );
  const root = asRecord(unwrapData(payload)) ?? {};
  return normalizePatientIdentity(asRecord(root.patient));
}

export type ClinicianSummary = { id: string; name: string; department: string };

export async function getClinicianSummary(clinicianId: string): Promise<ClinicianSummary | null> {
  if (!clinicianId) return null;
  const payload = await request(`/clinicians/${encodeURIComponent(clinicianId)}`);
  const body = asRecord(unwrapData(payload)) ?? {};
  const name = getString(body, ["name"]);
  if (!name) return null;
  return {
    id: getString(body, ["id"], clinicianId),
    name,
    department: getString(body, ["department"]),
  };
}

async function enrichCareTeamNames(careTeam: CareTeamMember[]): Promise<CareTeamMember[]> {
  const uniqueClinicianIds = Array.from(new Set(careTeam.map((member) => member.clinicianId).filter(Boolean)));
  if (uniqueClinicianIds.length === 0) return careTeam;

  const clinicians = await Promise.all(
    uniqueClinicianIds.map((clinicianId) => getClinicianSummary(clinicianId).catch(() => null)),
  );
  const nameById = new Map(clinicians.filter((c): c is ClinicianSummary => Boolean(c)).map((c) => [c.id, c]));

  return careTeam.map((member) => {
    const clinician = nameById.get(member.clinicianId);
    return clinician
      ? { ...member, name: clinician.name, role: member.role || clinician.department }
      : { ...member, name: member.name || "Unknown" };
  });
}

function normalizeCareEpisodeDetail(payload: unknown): CareEpisodeDetail {
  const body = asRecord(unwrapData(payload)) ?? {};
  const summary = normalizeCareEpisodeSummary(body);

  return {
    ...summary,
    currentCarePlan: asRecord(body.currentCarePlan),
    patient: normalizePatientIdentity(asRecord(body.patient)),
    careTeam: getRecordArray(body, ["careTeam"]).map(normalizeCareTeamMember),
    latestCheckin: asRecord(body.latestCheckIn ?? body.latestCheckin),
    recentTimeline: getRecordArray(body, ["recentTimelineEvents", "recentTimeline"]),
    riskData: asRecord(body.riskData),
    dayProgress: getNumber(body, ["dayProgress"]),
    facility: (() => {
      const facility = asRecord(body.facility);
      return facility ? { id: getString(facility, ["id"]), name: getString(facility, ["name"]), tracId: getString(facility, ["tracId"]) } : null;
    })(),
  };
}

export async function getCareEpisodeById(id: string): Promise<CareEpisodeDetail> {
  const payload = await request(`/care-episodes/${encodeURIComponent(id)}`);
  const detail = normalizeCareEpisodeDetail(payload);
  const [patient, careTeam, clinician] = await Promise.all([
    getFacilityPatient(detail.facilityId, detail.patientId).catch(() => detail.patient),
    enrichCareTeamNames(detail.careTeam).catch(() => detail.careTeam),
    detail.clinicianName || !detail.clinicianId
      ? Promise.resolve(null)
      : getClinicianSummary(detail.clinicianId).catch(() => null),
  ]);
  return {
    ...detail,
    patient: patient ?? detail.patient,
    careTeam,
    clinicianName: detail.clinicianName || clinician?.name || null,
  };
}

export async function closeCareEpisode(id: string, payload: CloseEpisodePayload) {
  return request(`/care-episodes/${encodeURIComponent(id)}/close`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function completeCareEpisodeTask(episodeId: string, taskId: string) {
  return request(`/care-episodes/${encodeURIComponent(episodeId)}/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: "POST",
  });
}

export type DailyVitalValues = {
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  temperature: number | null;
  spo2: number | null;
  weight: number | null;
  bloodSugar: number | null;
};

export type DailyVitalsRecord = {
  date: string;
  vitals: DailyVitalValues;
  hasEntry: boolean;
};

function normalizeDailyVitals(record: ApiRecord): DailyVitalsRecord {
  const vitals = asRecord(record.vitals);
  return {
    date: getString(record, ["date"]),
    hasEntry: record.hasEntry === true,
    vitals: {
      bloodPressureSystolic: getNumber(vitals, ["bp_systolic"]),
      bloodPressureDiastolic: getNumber(vitals, ["bp_diastolic"]),
      heartRate: getNumber(vitals, ["heart_rate"]),
      temperature: getNumber(vitals, ["temperature"]),
      spo2: getNumber(vitals, ["spo2"]),
      weight: getNumber(vitals, ["weight"]),
      bloodSugar: getNumber(vitals, ["blood_sugar"]),
    },
  };
}

export async function getCareEpisodeDailyVitals(id: string, days = 7): Promise<DailyVitalsRecord[]> {
  const query = new URLSearchParams({ days: String(Math.min(Math.max(Math.trunc(days), 1), 30)) });
  const payload = await request(`/care-episodes/${encodeURIComponent(id)}/vitals/daily`, undefined, query);
  const body = asRecord(unwrapData(payload)) as (ApiRecord & DailyVitalsApiResponse) | null;
  return getRecordArray(body, ["days"]).map(normalizeDailyVitals);
}

export type MedicationAdherenceRecord = Omit<MedicationAdherenceApiRecord, "lastTakenAt"> & {
  lastTakenAt: string | null;
};

function normalizeMedicationAdherence(record: ApiRecord): MedicationAdherenceRecord {
  return {
    medicationId: getString(record, ["medicationId", "id", "_id"]),
    name: getString(record, ["name", "medicationName"], "Medication"),
    dosageStrength: getString(record, ["dosageStrength", "dosage", "strength"]),
    totalDoses: getNumber(record, ["totalDoses"]) ?? 0,
    takenCount: getNumber(record, ["takenCount"]) ?? 0,
    missedCount: getNumber(record, ["missedCount"]) ?? 0,
    adherencePercentage: getNumber(record, ["adherencePercentage"]) ?? 0,
    lastTakenAt: getString(record, ["lastTakenAt"]) || null,
  };
}

export async function getCareEpisodeMedicationAdherence(id: string): Promise<MedicationAdherenceRecord[]> {
  const payload = await request(`/care-episodes/${encodeURIComponent(id)}/medications/adherence`);
  const data = unwrapData(payload);
  const list = Array.isArray(data) ? data : getRecordArray(asRecord(data), ["items", "medications"]);
  return list.filter((item): item is ApiRecord => Boolean(asRecord(item))).map((item) => normalizeMedicationAdherence(item));
}

export type TimelineEventRecord = {
  id: string;
  episodeId: string;
  eventType: string;
  source: string;
  status: string;
  payload: ApiRecord;
  timestamp: string;
};

export type TimelinePageResponse = {
  data: TimelineEventRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function normalizeTimelineEvent(record: ApiRecord, index: number): TimelineEventRecord {
  return {
    id: getString(record, ["id", "_id"]) || `event-${index}`,
    episodeId: getString(record, ["episodeId"]),
    eventType: getString(record, ["eventType", "type"], "update"),
    source: getString(record, ["source"], "system"),
    status: getString(record, ["status"], "completed"),
    payload: asRecord(record.payload) ?? {},
    timestamp: getString(record, ["timestamp", "createdAt"]),
  };
}

export async function createCareEpisodeTimelineEvent(
  id: string,
  payload: CreateTimelineEventPayload,
): Promise<TimelineEventRecord> {
  const response = await request(`/care-episodes/${encodeURIComponent(id)}/timeline`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const record = asRecord(unwrapData(response)) ?? asRecord(response);
  if (!record) throw new Error("The timeline event response was invalid.");
  return normalizeTimelineEvent(record, 0);
}

export type TimelineQueryParams = {
  page?: number;
  limit?: number;
  eventType?: string;
  source?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getCareEpisodeTimelinePage(
  id: string,
  params?: TimelineQueryParams,
): Promise<TimelinePageResponse> {
  const query = new URLSearchParams();
  setQueryValue(query, "page", params?.page ?? 1);
  setQueryValue(query, "limit", clampLimit(params?.limit ?? 100));
  setQueryValue(query, "eventType", params?.eventType);
  setQueryValue(query, "source", params?.source);
  setQueryValue(query, "status", params?.status);
  setQueryValue(query, "dateFrom", params?.dateFrom);
  setQueryValue(query, "dateTo", params?.dateTo);

  const payload = await request(`/care-episodes/${encodeURIComponent(id)}/timeline`, undefined, query);
  const body = asRecord(payload) ?? {};
  const nested = asRecord(body.data);
  const list = Array.isArray(body.data)
    ? (body.data as ApiRecord[])
    : Array.isArray(nested?.data)
      ? (nested?.data as ApiRecord[])
      : getRecordArray(nested ?? body, ["items", "timeline", "events"]);
  const source = Array.isArray(body.data) ? body : nested ?? body;

  return {
    data: list.filter((item): item is ApiRecord => Boolean(asRecord(item))).map((item, index) => normalizeTimelineEvent(item, index)),
    total: getNumber(source, ["total"]) ?? list.length,
    page: getNumber(source, ["page"]) ?? params?.page ?? 1,
    limit: getNumber(source, ["limit"]) ?? clampLimit(params?.limit ?? 100),
    totalPages: getNumber(source, ["totalPages"]) ?? 1,
  };
}

export type CareEpisodeSyncResponse = {
  hasMore: boolean;
  syncToken: string;
  events: TimelineEventRecord[];
  carePlan: ApiRecord | null;
  lastCheckIn: ApiRecord | null;
  riskScore: number | null;
};

export async function getCareEpisodeSync(id: string, since: string): Promise<CareEpisodeSyncResponse> {
  const query = new URLSearchParams({ since });
  const payload = await request(`/care-episodes/${encodeURIComponent(id)}/sync`, undefined, query);
  const body = asRecord(unwrapData(payload)) ?? {};
  const events = getRecordArray(body, ["events"]);

  return {
    hasMore: body.hasMore === true,
    syncToken: getString(body, ["syncToken"]),
    events: events.map((event, index) => normalizeTimelineEvent(event, index)),
    carePlan: asRecord(body.carePlan),
    lastCheckIn: asRecord(body.lastCheckIn),
    riskScore: getNumber(body, ["riskScore"]),
  };
}
