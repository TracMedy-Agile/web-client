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
