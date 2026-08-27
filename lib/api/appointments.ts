import type { components } from "@/docs/types/api";

type AppointmentQueryParams = {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  facilityId?: string;
  search?: string;
  type?: string;
  department?: string;
  page?: number;
  limit?: number;
};

type CalendarQueryParams = {
  date: string;
  facilityId: string;
};

type ClinicianQueryParams = {
  q?: string;
  department?: string;
  status?: string;
  page?: number;
  limit?: number;
};

type PendingUnassignedQueryParams = {
  department?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

type AppointmentMutationData = Record<string, unknown>;
export type AppointmentCapacity = components["schemas"]["CapacityResponseDto"];
export type CompleteAppointmentInput = components["schemas"]["CompleteAppointmentDto"];
export type CallTokenResponse = components["schemas"]["CallTokenResponseDto"];
export type CallStartResponse = components["schemas"]["CallStartResponseDto"];
export type CallJoinResponse = components["schemas"]["CallJoinResponseDto"];
export type CallEndResponse = components["schemas"]["CallEndResponseDto"];
export type CallNudgeResponse = components["schemas"]["CallNudgeResponseDto"];

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-token");
    const { accessToken } = await res.json();
    return accessToken;
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
  if (!res.ok) throw new Error(payload?.message ?? "Request failed");
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

export async function getAppointments(params?: AppointmentQueryParams) {
  const query = new URLSearchParams();
  setQueryValue(query, "status", params?.status);
  setQueryValue(query, "dateFrom", params?.dateFrom);
  setQueryValue(query, "dateTo", params?.dateTo);
  setQueryValue(query, "facilityId", params?.facilityId);
  setQueryValue(query, "search", params?.search);
  setQueryValue(query, "type", params?.type);
  setQueryValue(query, "department", params?.department);
  setQueryValue(query, "page", params?.page ?? 1);
  setQueryValue(query, "limit", clampLimit(params?.limit));

  return request("/appointments", undefined, query);
}

export async function getCalendarAppointments(params: CalendarQueryParams) {
  const query = new URLSearchParams();
  query.set("date", params.date);
  query.set("facilityId", params.facilityId);

  return request("/appointments/calendar", undefined, query);
}

function normalizeAppointmentCapacity(payload: unknown): AppointmentCapacity {
  const root = payload as { data?: AppointmentCapacity };
  if (root.data) return root.data;
  return payload as AppointmentCapacity;
}

export async function getAppointmentCapacity(params: CalendarQueryParams & { time?: string }): Promise<AppointmentCapacity> {
  const query = new URLSearchParams();
  query.set("date", params.date);
  query.set("facilityId", params.facilityId);
  setQueryValue(query, "time", params.time);
  const payload = await request("/appointments/capacity", undefined, query);
  return normalizeAppointmentCapacity(payload);
}

export async function getClinicians(params?: ClinicianQueryParams) {
  const query = new URLSearchParams();
  setQueryValue(query, "q", params?.q);
  setQueryValue(query, "department", params?.department);
  setQueryValue(query, "status", params?.status);
  setQueryValue(query, "page", params?.page ?? 1);
  setQueryValue(query, "limit", clampLimit(params?.limit));

  return request("/clinicians", undefined, query);
}

export async function getPendingUnassigned(params?: PendingUnassignedQueryParams) {
  const query = new URLSearchParams();
  setQueryValue(query, "department", params?.department);
  setQueryValue(query, "priority", params?.priority);
  setQueryValue(query, "dateFrom", params?.dateFrom);
  setQueryValue(query, "dateTo", params?.dateTo);
  setQueryValue(query, "page", params?.page ?? 1);
  setQueryValue(query, "limit", clampLimit(params?.limit));

  return request("/appointments/pending-unassigned", undefined, query);
}

export async function getAppointmentById(id: string) {
  return request(`/appointments/${encodeURIComponent(id)}`);
}

export async function createAppointment(data: AppointmentMutationData) {
  return request("/appointments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function confirmAppointment(id: string) {
  return request(`/appointments/${encodeURIComponent(id)}/confirm`, {
    method: "PATCH",
  });
}

export async function rescheduleAppointment(id: string, data: AppointmentMutationData) {
  return request(`/appointments/${encodeURIComponent(id)}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function cancelAppointment(id: string, data: AppointmentMutationData) {
  return request(`/appointments/${encodeURIComponent(id)}/cancel`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function markNoShow(id: string) {
  return request(`/appointments/${encodeURIComponent(id)}/no-show`, {
    method: "PATCH",
  });
}

export async function checkInAppointment(id: string) {
  return request(`/appointments/${encodeURIComponent(id)}/checkin`, {
    method: "PATCH",
  });
}

export async function completeAppointment(id: string, data: CompleteAppointmentInput = {}) {
  return request(`/appointments/${encodeURIComponent(id)}/complete`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function getAppointmentCallToken(id: string): Promise<CallTokenResponse> {
  return unwrapData<CallTokenResponse>(await request(`/appointments/${encodeURIComponent(id)}/call/token`, {
    method: "POST",
  }));
}

export async function startAppointmentCall(id: string): Promise<CallStartResponse> {
  return unwrapData<CallStartResponse>(await request(`/appointments/${encodeURIComponent(id)}/call/start`, {
    method: "POST",
  }));
}

export async function joinAppointmentCall(id: string): Promise<CallJoinResponse> {
  return unwrapData<CallJoinResponse>(await request(`/appointments/${encodeURIComponent(id)}/call/join`, {
    method: "POST",
  }));
}

export async function endAppointmentCall(id: string): Promise<CallEndResponse> {
  return unwrapData<CallEndResponse>(await request(`/appointments/${encodeURIComponent(id)}/call/end`, {
    method: "POST",
  }));
}

export async function nudgeAppointmentCall(id: string): Promise<CallNudgeResponse> {
  return unwrapData<CallNudgeResponse>(await request(`/appointments/${encodeURIComponent(id)}/call/nudge`, {
    method: "POST",
  }));
}
