import type { Clinician } from "@/app/dashboard/care-episodes/[id]/recovery/adjust-plan/types";
import type { components } from "@/docs/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL;
type UnknownRecord = Record<string, unknown>;
type ApiClinicianListItem = components["schemas"]["ClinicianListItemDto"];

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function value(record: UnknownRecord, keys: string[], fallback = "") {
  for (const key of keys) if (typeof record[key] === "string" && record[key]) return record[key] as string;
  return fallback;
}

// Shared GET /clinicians fetch — CliniciansController_findAll (Back-end/openapi.yaml), scoped to
// the authenticated staff member's facility. Returns ClinicianListResponseDto ({ data, meta }).
async function fetchClinicianList(params: URLSearchParams): Promise<UnknownRecord[]> {
  const tokenResponse = await fetch("/api/auth/get-token").catch(() => null);
  const tokenPayload = tokenResponse ? await tokenResponse.json().catch(() => ({})) : {};
  const token = typeof tokenPayload.accessToken === "string" ? tokenPayload.accessToken : null;

  const response = await fetch(`${BASE}/clinicians?${params}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Unable to load clinicians.");

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
};

export type ClinicianDirectoryEntry = Pick<
  ApiClinicianListItem,
  "id" | "name" | "email" | "department" | "status"
>;

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
    status: (value(item, ["status"], "available") as ApiClinicianListItem["status"]),
  })).filter((item) => item.id);
}

export async function searchClinicians(query: string): Promise<ClinicianSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const list = await fetchClinicianList(new URLSearchParams({ q }));
  return list.map((item) => ({
    id: value(item, ["id"]),
    name: value(item, ["name"], "Unnamed clinician"),
    department: value(item, ["department"]),
  })).filter((item) => item.id);
}

// Facility-wide clinician directory (no filters) — used to resolve clinicianId -> display name
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
    };
  }

  return directory;
}
