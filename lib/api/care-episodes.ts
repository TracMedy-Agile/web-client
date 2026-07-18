export type CareEpisodeRecord = {
  id: string;
  patientId: string;
  facilityId: string;
  clinicianId: string;
  diagnosis: string;
  status: string;
  carePhase: string | null;
  dayStart: number | null;
  expectedDurationDays: number | null;
  riskScore: number | null;
  riskCategory: string | null;
  riskTrend: string | null;
  closureReason: string | null;
  outcomeStatus: string | null;
  encounterType: string | null;
  conditionSeverity: string | null;
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

// Matches CreateCareEpisodeDto in Back-end/openapi.yaml (POST /care-episodes/pending).
// Only patientId and facilityId are required server-side.
export type AddPatientToQueuePayload = {
  patientId: string;
  facilityId: string;
  diagnosis?: string;
  clinicianId?: string;
  tracmedyPatientId?: string;
  encounterType?: string;
  conditionSeverity?: string;
  clinicalConcern?: string;
  followUpReasons?: string[];
  expectedDurationDays?: number;
  clinicianNotes?: string;
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
};

export type CareEpisodeDetail = CareEpisodeRecord & {
  currentCarePlan: ApiRecord | null;
  patient: CareEpisodePatient | null;
  careTeam: CareTeamMember[];
  latestCheckin: ApiRecord | null;
  recentTimeline: ApiRecord[];
  riskData: ApiRecord | null;
  dayProgress: number | null;
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
  const list = Array.isArray(body.data)
    ? (body.data as CareEpisodeRecord[])
    : Array.isArray(nested?.data)
      ? (nested?.data as CareEpisodeRecord[])
      : [];
  const source = Array.isArray(body.data) ? body : (nested ?? body);

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
  const record = asRecord(response) ?? asRecord(unwrapData(response));
  return { id: getString(record, ["id"]) };
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
  };
}

// The care episode detail endpoint does not embed patient demographics (only patientId).
// Real name/phone/email/age/gender/etc. come from the facility-scoped patient profile endpoint.
function normalizePatientIdentity(record: ApiRecord | null): CareEpisodePatient | null {
  if (!record) return null;

  return {
    name: getString(record, ["name"], "Unknown Patient"),
    phone: getString(record, ["phone"]),
    email: getString(record, ["email"]),
    age: getNumber(record, ["age"]),
    gender: getString(record, ["gender"]),
    hospitalId: getString(record, ["tracmedyPatientId"]),
    emergencyContactName: "",
    emergencyContactPhone: "",
  };
}

export async function getFacilityPatient(facilityId: string, patientId: string): Promise<CareEpisodePatient | null> {
  if (!facilityId || !patientId) return null;
  const payload = await request(`/facilities/${encodeURIComponent(facilityId)}/patients/${encodeURIComponent(patientId)}`);
  const body = asRecord(unwrapData(payload)) ?? {};
  return normalizePatientIdentity(asRecord(body.patient));
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

  return {
    id: getString(body, ["id", "_id"]),
    patientId: getString(body, ["patientId"]),
    facilityId: getString(body, ["facilityId"]),
    clinicianId: getString(body, ["clinicianId"]),
    diagnosis: getString(body, ["diagnosis"]),
    status: getString(body, ["status"]),
    carePhase: getString(body, ["carePhase"]) || null,
    dayStart: getNumber(body, ["dayStart"]),
    expectedDurationDays: getNumber(body, ["expectedDurationDays"]),
    riskScore: getNumber(body, ["riskScore"]),
    riskCategory: getString(body, ["riskCategory"]) || null,
    riskTrend: getString(body, ["riskTrend"]) || null,
    closureReason: getString(body, ["closureReason"]) || null,
    outcomeStatus: getString(body, ["outcomeStatus"]) || null,
    encounterType: getString(body, ["encounterType"]) || null,
    conditionSeverity: getString(body, ["conditionSeverity"]) || null,
    createdAt: getString(body, ["createdAt"]),
    updatedAt: getString(body, ["updatedAt"]),
    currentCarePlan: asRecord(body.currentCarePlan),
    patient: null,
    careTeam: getRecordArray(body, ["careTeam"]).map(normalizeCareTeamMember),
    latestCheckin: asRecord(body.latestCheckIn ?? body.latestCheckin),
    recentTimeline: getRecordArray(body, ["recentTimelineEvents", "recentTimeline"]),
    riskData: asRecord(body.riskData),
    dayProgress: getNumber(body, ["dayProgress"]),
  };
}

export async function getCareEpisodeById(id: string): Promise<CareEpisodeDetail> {
  const payload = await request(`/care-episodes/${encodeURIComponent(id)}`);
  const detail = normalizeCareEpisodeDetail(payload);

  const [patient, careTeam] = await Promise.all([
    getFacilityPatient(detail.facilityId, detail.patientId).catch(() => null),
    enrichCareTeamNames(detail.careTeam).catch(() => detail.careTeam),
  ]);

  return { ...detail, patient, careTeam };
}

export async function closeCareEpisode(id: string, payload?: { closureReason?: string; outcomeStatus?: string }) {
  return request(`/care-episodes/${encodeURIComponent(id)}/close`, {
    method: "PATCH",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function completeCareEpisodeTask(episodeId: string, taskId: string) {
  return request(`/care-episodes/${encodeURIComponent(episodeId)}/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: "POST",
  });
}

export type MedicationAdherenceRecord = {
  medicationId: string;
  name: string;
  dosageStrength: string;
  totalDoses: number;
  takenCount: number;
  missedCount: number;
  adherencePercentage: number;
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
