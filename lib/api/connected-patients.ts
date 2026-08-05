import type { components } from "@/docs/types/api";

// Facility-scoped patient list, profile, and invite endpoints are defined in Back-end/openapi.yaml.
type ApiConnectedPatient = components["schemas"]["ConnectedPatientResponseDto"];
export type CreatePatientInviteInput = components["schemas"]["CreatePatientInviteDto"];
export type PatientInvite = components["schemas"]["PatientInviteResponseDto"];
export type UpdateConnectedPatientInput = components["schemas"]["UpdateFacilityPatientDto"];

export type ConnectedPatientRecord = {
  patientId: ApiConnectedPatient["patientId"];
  name: string;
  email: ApiConnectedPatient["email"];
  phone: string;
  tracmedyPatientId: string;
  externalPatientId: string;
  status: ApiConnectedPatient["status"];
  connectedAt: ApiConnectedPatient["connectedAt"];
  preferred: ApiConnectedPatient["preferred"];
};

export type ConnectedPatientsMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ConnectedPatientsResponse = {
  data: ConnectedPatientRecord[];
  meta: ConnectedPatientsMeta;
};

type ConnectedPatientsQueryParams = {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export type PatientProfileDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  tracmedyPatientId: string;
  dateOfBirth: string;
  age: number | null;
  gender: string;
  bloodGroup: string;
  avatarUrl: string;
};

export type PatientConnection = {
  linkId: string;
  status: string;
  externalPatientId: string;
  connectedAt: string;
  disconnectedAt: string | null;
};

export type PatientConnectionHistoryEntry = {
  id: string;
  type: string;
  note: string;
  performedById: string;
  occurredAt: string;
};

export type ApiRecord = Record<string, unknown>;

export type PatientProfileResponse = {
  patient: PatientProfileDetail;
  connection: PatientConnection;
  connectionHistory: PatientConnectionHistoryEntry[];
  careEpisodes: ApiRecord[];
  appointments: ApiRecord[];
};

export type HospitalFacility = {
  id: string;
  name: string;
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
    const message = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>).message : undefined;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }

  return payload;
}

function setQueryValue(query: URLSearchParams, key: string, value?: string | number) {
  if (value === undefined || value === null || value === "" || value === "all") return;
  query.set(key, String(value));
}

function clampLimit(limit?: number) {
  if (!limit || !Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ApiRecord) : null;
}

function getStringField(record: ApiRecord | null, key: string, fallback = "") {
  const value = record?.[key];
  return typeof value === "string" ? value : fallback;
}

function getNullableStringField(record: ApiRecord | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function getNumberField(record: ApiRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBooleanField(record: ApiRecord | null, key: string, fallback = false) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function getRecordArray(value: unknown): ApiRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter((item): item is ApiRecord => Boolean(item));
}

export async function getHospitalFacility(): Promise<HospitalFacility> {
  const payload = await request("/auth/hospital");
  const outer = asRecord(payload);
  const record = asRecord(outer?.data) ?? outer;
  const facility = record?.facility && typeof record.facility === "object" ? (record.facility as Record<string, unknown>) : null;
  return {
    id: getStringField(facility, "id"),
    name: getStringField(facility, "name", "Healthcare Facility"),
  };
}

export async function getHospitalFacilityId(): Promise<string> {
  const facility = await getHospitalFacility();
  return facility.id;
}

function normalizeConnectedPatient(record: ApiRecord): ConnectedPatientRecord {
  return {
    patientId: getStringField(record, "patientId"),
    name: getStringField(record, "name", "Unknown Patient"),
    email: getStringField(record, "email"),
    phone: getStringField(record, "phone"),
    tracmedyPatientId: getStringField(record, "tracmedyPatientId"),
    externalPatientId: getStringField(record, "externalPatientId"),
    status: getStringField(record, "status", "active"),
    connectedAt: getStringField(record, "connectedAt"),
    preferred: getBooleanField(record, "preferred"),
  };
}

// GET /facilities/{facilityId}/patients?q=&status=&page=&limit=
export async function getConnectedPatients(
  facilityId: string,
  params?: ConnectedPatientsQueryParams,
): Promise<ConnectedPatientsResponse> {
  const query = new URLSearchParams();
  setQueryValue(query, "q", params?.q);
  setQueryValue(query, "status", params?.status);
  setQueryValue(query, "page", params?.page ?? 1);
  setQueryValue(query, "limit", clampLimit(params?.limit));

  const payload = await request(`/facilities/${encodeURIComponent(facilityId)}/patients`, undefined, query);
  // Responses are wrapped as { statusCode, message, data }, and for this endpoint `data` is
  // itself the paginated { data: [...], meta: {...} } shape — patients/meta live two levels deep.
  const outer = asRecord(payload);
  const body = asRecord(outer?.data) ?? outer;
  const data = getRecordArray(body?.data).map(normalizeConnectedPatient);
  const metaRecord = asRecord(body?.meta);

  const meta: ConnectedPatientsMeta = {
    page: getNumberField(metaRecord, "page") ?? params?.page ?? 1,
    limit: getNumberField(metaRecord, "limit") ?? clampLimit(params?.limit),
    total: getNumberField(metaRecord, "total") ?? data.length,
    totalPages: Math.max(getNumberField(metaRecord, "totalPages") ?? 1, 1),
  };

  return { data, meta };
}

// POST /facilities/{facilityId}/patient-invites
export async function createPatientInvite(
  facilityId: string,
  input: CreatePatientInviteInput,
): Promise<PatientInvite> {
  const payload = await request("/facilities/" + encodeURIComponent(facilityId) + "/patient-invites", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const outer = asRecord(payload);
  const root = asRecord(outer?.data) ?? outer;

  const id = getStringField(root, "id");
  const email = getStringField(root, "email");
  const status = getStringField(root, "status");
  const expiresAt = getStringField(root, "expiresAt");
  const code = getStringField(root, "code");

  if (!id || !email || !status || !expiresAt || !code) {
    throw new Error("The connection code response was incomplete. Please try again.");
  }

  return {
    id,
    email,
    existingUser: getBooleanField(root, "existingUser"),
    status,
    expiresAt,
    code,
  };
}

function normalizePatientDetail(record: ApiRecord | null): PatientProfileDetail {
  return {
    id: getStringField(record, "id"),
    name: getStringField(record, "name", "Unknown Patient"),
    email: getStringField(record, "email"),
    phone: getStringField(record, "phone"),
    tracmedyPatientId: getStringField(record, "tracmedyPatientId"),
    dateOfBirth: getStringField(record, "dateOfBirth"),
    age: getNumberField(record, "age"),
    gender: getStringField(record, "gender"),
    bloodGroup: getStringField(record, "bloodGroup"),
    avatarUrl: getStringField(record, "avatarUrl"),
  };
}

function normalizeConnection(record: ApiRecord | null): PatientConnection {
  return {
    linkId: getStringField(record, "linkId"),
    status: getStringField(record, "status", "active"),
    externalPatientId: getStringField(record, "externalPatientId"),
    connectedAt: getStringField(record, "connectedAt"),
    disconnectedAt: getNullableStringField(record, "disconnectedAt"),
  };
}

function normalizeHistoryEntry(record: ApiRecord): PatientConnectionHistoryEntry {
  return {
    id: getStringField(record, "id"),
    type: getStringField(record, "type"),
    note: getStringField(record, "note"),
    performedById: getStringField(record, "performedById"),
    occurredAt: getStringField(record, "occurredAt"),
  };
}

// GET /facilities/{facilityId}/patients/{patientId}
export async function getPatientProfile(facilityId: string, patientId: string): Promise<PatientProfileResponse> {
  const payload = await request(
    `/facilities/${encodeURIComponent(facilityId)}/patients/${encodeURIComponent(patientId)}`,
  );
  // Same { statusCode, message, data } wrapper as the list endpoint — unwrap it, falling back to
  // the raw payload if this particular route turns out not to be wrapped.
  const outer = asRecord(payload);
  const root = asRecord(outer?.data) ?? outer ?? {};

  return {
    patient: normalizePatientDetail(asRecord(root.patient)),
    connection: normalizeConnection(asRecord(root.connection)),
    connectionHistory: getRecordArray(root.connectionHistory).map(normalizeHistoryEntry),
    careEpisodes: getRecordArray(root.careEpisodes),
    appointments: getRecordArray(root.appointments),
  };
}

export async function updateConnectedPatient(
  facilityId: string,
  patientId: string,
  input: UpdateConnectedPatientInput,
): Promise<PatientProfileResponse> {
  await request(`/facilities/${encodeURIComponent(facilityId)}/patients/${encodeURIComponent(patientId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return getPatientProfile(facilityId, patientId);
}

export async function disconnectConnectedPatient(facilityId: string, patientId: string): Promise<void> {
  await request(`/facilities/${encodeURIComponent(facilityId)}/patients/${encodeURIComponent(patientId)}/disconnect`, {
    method: "PATCH",
  });
}

export async function reconnectConnectedPatient(facilityId: string, patientId: string): Promise<void> {
  await request(`/facilities/${encodeURIComponent(facilityId)}/patients/${encodeURIComponent(patientId)}/reconnect`, {
    method: "PATCH",
  });
}
