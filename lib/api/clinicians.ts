import type { Clinician } from "@/app/dashboard/care-episodes/[id]/recovery/adjust-plan/types";
import type { components } from "@/docs/types/api";
import { apiClient } from "@/lib/services/auth/api-client";
import { apiErrorFromResponse, networkApiError } from "@/lib/api/errors";

const BASE = process.env.NEXT_PUBLIC_API_URL;
type UnknownRecord = Record<string, unknown>;
type ApiClinicianListItem = components["schemas"]["ClinicianListItemDto"];
export type ClinicianProfile = components["schemas"]["ClinicianProfileResponseDto"];

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function value(record: UnknownRecord, keys: string[], fallback = "") {
  for (const key of keys) if (typeof record[key] === "string" && record[key]) return record[key] as string;
  return fallback;
}

function numberValue(record: UnknownRecord, key: string, fallback = 0) {
  return typeof record[key] === "number" ? record[key] : fallback;
}

// Shared GET /clinicians fetch Ã¢â‚¬â€ CliniciansController_findAll (Back-end/openapi.yaml), scoped to
// the authenticated staff member's facility. Returns ClinicianListResponseDto ({ data, meta }).
async function fetchClinicianList(params: URLSearchParams): Promise<UnknownRecord[]> {
  const tokenResponse = await fetch("/api/auth/get-token").catch(() => null);
  const tokenPayload = tokenResponse ? await tokenResponse.json().catch(() => ({})) : {};
  const token = typeof tokenPayload.accessToken === "string" ? tokenPayload.accessToken : null;

  const response = await fetch(`${BASE}/clinicians?${params}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => {
    throw networkApiError("Unable to reach clinician services.");
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromResponse(response, payload, "Unable to load clinicians.");

  const root = asRecord(payload);
  const data = root?.data ?? payload;
  const nested = asRecord(data);
  const list = Array.isArray(data) ? data : Array.isArray(nested?.data) ? nested.data : Array.isArray(nested?.items) ? nested.items : [];
  return list.map(asRecord).filter((item): item is UnknownRecord => Boolean(item));
}

export async function getAvailableClinicians(): Promise<Clinician[]> {
  const list = await fetchClinicianList(new URLSearchParams({ status: "available" }));
  return list.map((item) => ({
    id: value(item, ["id", "clinicianId", "_id"]),
    name: value(item, ["name", "fullName", "clinicianName"], "Unnamed clinician"),
    role: value(item, ["role", "specialty", "title"]),
  })).filter((item) => item.id);
}

export type ClinicianSearchResult = {
  id: string;
  name: string;
  department: string;
  avatarUrl: string;
};

export type ClinicianDirectoryEntry = ApiClinicianListItem & {
  /** Some backend responses expose specialty separately; department remains the generated contract field. */
  specialty?: string | null;
};

export type TeamMemberActivityEntry = {
  id: string;
  module: string;
  action: string;
  actorName: string;
  targetSummary: string;
  createdAt: string;
};

export type TeamMemberActivityResponse = {
  data: TeamMemberActivityEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getFacilityClinicians(params?: {
  q?: string;
  department?: string;
  limit?: number;
}): Promise<ClinicianDirectoryEntry[]> {
  const query = new URLSearchParams({ limit: String(params?.limit ?? 100) });
  if (params?.q?.trim()) query.set("q", params.q.trim());
  if (params?.department && params.department !== "all") query.set("department", params.department);
  const list = await fetchClinicianList(query);
  return list.map((item) => ({
    id: value(item, ["id"]),
    name: value(item, ["name"], "Unnamed clinician"),
    email: value(item, ["email"]),
    department: value(item, ["department"]) || null,
    specialty: value(item, ["specialty"]) || null,
    schedule: value(item, ["schedule"], "Schedule not configured"),
    dailyCapacity: numberValue(item, "dailyCapacity"),
    assignedAppointments: numberValue(item, "assignedAppointments"),
    capacityUtilization: numberValue(item, "capacityUtilization"),
    status: (value(item, ["status"], "available") as ApiClinicianListItem["status"]),
    avatarUrl: value(item, ["avatarUrl", "photoUrl", "imageUrl"]),
  })).filter((item) => item.id);
}

export async function getFacilityClinician(id: string): Promise<ClinicianProfile> {
  const tokenResponse = await fetch("/api/auth/get-token").catch(() => null);
  const tokenPayload = tokenResponse ? await tokenResponse.json().catch(() => ({})) : {};
  const token = typeof tokenPayload.accessToken === "string" ? tokenPayload.accessToken : null;

  const response = await fetch(`${BASE}/clinicians/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => {
    throw networkApiError("Unable to reach clinician services.");
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromResponse(response, payload, response.status === 404 ? "Team member not found." : "Unable to load this team member.");

  const root = asRecord(payload);
  const nested = asRecord(root?.data);
  const profile = nested ?? root;
  if (!profile) throw new Error("The team member response was empty.");

  return profile as ClinicianProfile;
}

export async function getTeamMemberActivity(
  id: string,
  params: { page?: number; limit?: number; action?: string } = {},
): Promise<TeamMemberActivityResponse> {
  const tokenResponse = await fetch("/api/auth/get-token").catch(() => null);
  const tokenPayload = tokenResponse ? await tokenResponse.json().catch(() => ({})) : {};
  const token = typeof tokenPayload.accessToken === "string" ? tokenPayload.accessToken : null;
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.action?.trim()) query.set("action", params.action.trim());

  const response = await fetch(`${BASE}/team/members/${encodeURIComponent(id)}/activity${query.toString() ? `?${query}` : ""}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => {
    throw networkApiError("Unable to reach team activity services.");
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromResponse(response, payload, response.status === 404 ? "Team member activity was not found." : "Unable to load team member activity.");

  const root = asRecord(payload);
  const nested = asRecord(root?.data);
  const listRoot = nested ?? root;
  const rows = Array.isArray(listRoot?.data) ? listRoot.data : [];
  const meta = asRecord(listRoot?.meta);

  return {
    data: rows
      .map(asRecord)
      .filter((item): item is UnknownRecord => Boolean(item))
      .map((item) => ({
        id: value(item, ["id"], "Unknown"),
        module: value(item, ["module"], "system"),
        action: value(item, ["action"], "activity_recorded"),
        actorName: value(item, ["actorName"], "System"),
        targetSummary: value(item, ["targetSummary"], "No target recorded"),
        createdAt: value(item, ["createdAt"], new Date(0).toISOString()),
      })),
    meta: {
      page: typeof meta?.page === "number" ? meta.page : params.page ?? 1,
      limit: typeof meta?.limit === "number" ? meta.limit : params.limit ?? 20,
      total: typeof meta?.total === "number" ? meta.total : rows.length,
      totalPages: Math.max(typeof meta?.totalPages === "number" ? meta.totalPages : 1, 1),
    },
  };
}

export async function searchClinicians(query: string): Promise<ClinicianSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const list = await fetchClinicianList(new URLSearchParams({ q }));
  return list.map((item) => ({
    id: value(item, ["id"]),
    name: value(item, ["name"], "Unnamed clinician"),
    department: value(item, ["department"]),
    avatarUrl: value(item, ["avatarUrl", "photoUrl", "imageUrl"]),
  })).filter((item) => item.id);
}

// Facility-wide clinician directory (no filters) Ã¢â‚¬â€ used to resolve clinicianId -> display name
// wherever a record only carries the raw ID (e.g. CareEpisodeSummaryDto, AppointmentResponseDto).
export async function getClinicianDirectory(limit = 100): Promise<Record<string, ClinicianSearchResult>> {
  const list = await fetchClinicianList(new URLSearchParams({ limit: String(limit) }));
  const directory: Record<string, ClinicianSearchResult> = {};

  for (const item of list) {
    const id = value(item, ["id"]);
    if (!id) continue;
    directory[id] = {
      id,
      name: value(item, ["name"], "Unnamed clinician"),
      department: value(item, ["department"]),
      avatarUrl: value(item, ["avatarUrl", "photoUrl", "imageUrl"]),
    };
  }

  return directory;
}
export type TeamMember = components["schemas"]["TeamMemberRowDto"] & { avatarUrl?: string | null };
export type InviteTeamMemberInput = components["schemas"]["InviteTeamMemberDto"];
export type InviteTeamMemberResult = components["schemas"]["InviteResultDto"];
export type UpdateTeamMemberInput = components["schemas"]["UpdateTeamMemberDto"];
export type SuspendTeamMemberInput = components["schemas"]["SuspendTeamMemberDto"];
export type EscalationPreference = components["schemas"]["EscalationPreferenceDto"];
export type UpdateEscalationPreferenceInput = components["schemas"]["UpdateEscalationPreferenceDto"];

export function getTeamMemberRequestId(member: TeamMember): string {
  const record = member as unknown as UnknownRecord;
  const explicitId = value(record, ["memberId", "staffId", "staffMemberId", "clinicianId"]);
  if (explicitId) return explicitId;
  if (member.id.startsWith("legacy-")) return member.id.slice("legacy-".length);
  return member.id;
}


async function teamRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await apiClient(path, {
    ...init,
    cache: "no-store",
  }).catch(() => {
    throw networkApiError("Unable to reach team services.");
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw apiErrorFromResponse(response, payload, response.status === 401 ? "Your session expired. Please sign in again and retry." : "Unable to complete team request.");
  }
  return payload;
}

function unwrapPayload(payload: unknown): unknown {
  const root = asRecord(payload);
  return root && "data" in root ? root.data : payload;
}

function teamRowsFromPayload(payload: unknown): TeamMember[] {
  const unwrapped = unwrapPayload(payload);
  const container = asRecord(unwrapped);
  const rows = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray(container?.data)
      ? container.data
      : [];
  return rows.map(asRecord).filter((item): item is UnknownRecord => Boolean(item)).map((item) => item as TeamMember);
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const members = teamRowsFromPayload(await teamRequest("/team/members"));
  const directory: Record<string, ClinicianSearchResult> = await getClinicianDirectory().catch(() => ({}));

  return members.map((member) => {
    const record = member as unknown as UnknownRecord;
    const clinician = directory[member.userId] ?? directory[member.id] ?? directory[getTeamMemberRequestId(member)];
    const avatarUrl = value(record, ["avatarUrl", "photoUrl", "imageUrl"]) || clinician?.avatarUrl || null;
    return avatarUrl ? { ...member, avatarUrl } : member;
  });
}

export async function getTeamMember(id: string): Promise<TeamMember> {
  const members = await getTeamMembers();
  const member = members.find((item) => item.id === id || item.userId === id || getTeamMemberRequestId(item) === id);
  if (!member) throw new Error("Team member not found.");
  return member;
}

export async function inviteTeamMember(input: InviteTeamMemberInput): Promise<InviteTeamMemberResult> {
  const payload = await teamRequest("/team/members", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const result = unwrapPayload(payload);
  if (!asRecord(result)) throw new Error("The invite response was invalid.");
  return result as InviteTeamMemberResult;
}

export async function resendTeamMemberInvite(id: string): Promise<InviteTeamMemberResult> {
  const payload = await teamRequest(`/team/members/${encodeURIComponent(id)}/resend-invite`, { method: "POST" });
  const result = unwrapPayload(payload);
  if (!asRecord(result)) throw new Error("The resend response was invalid.");
  return result as InviteTeamMemberResult;
}

export async function updateTeamMember(id: string, input: UpdateTeamMemberInput): Promise<TeamMember> {
  const payload = await teamRequest(`/team/members/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const result = unwrapPayload(payload);
  if (!asRecord(result)) throw new Error("The update response was invalid.");
  return result as TeamMember;
}

export async function suspendTeamMember(id: string, input: SuspendTeamMemberInput): Promise<void> {
  await teamRequest(`/team/members/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function reactivateTeamMember(id: string): Promise<void> {
  await teamRequest(`/team/members/${encodeURIComponent(id)}/reactivate`, { method: "POST" });
}

export async function removeTeamMember(id: string): Promise<void> {
  await teamRequest(`/team/members/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getTeamMemberEscalationPreference(id: string): Promise<EscalationPreference> {
  const payload = await teamRequest(`/team/members/${encodeURIComponent(id)}/escalation-preference`);
  const result = unwrapPayload(payload);
  if (!asRecord(result)) throw new Error("The escalation preference response was invalid.");
  return result as EscalationPreference;
}

export async function updateTeamMemberEscalationPreference(
  id: string,
  input: UpdateEscalationPreferenceInput,
): Promise<EscalationPreference> {
  const payload = await teamRequest(`/team/members/${encodeURIComponent(id)}/escalation-preference`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const result = unwrapPayload(payload);
  if (!asRecord(result)) throw new Error("The escalation preference response was invalid.");
  return result as EscalationPreference;
}

