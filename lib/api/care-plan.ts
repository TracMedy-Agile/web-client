import type { CarePlan, CarePlanPayload } from "@/app/dashboard/care-episodes/[id]/recovery/adjust-plan/types";

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/get-token");
    const data = await response.json();
    return typeof data.accessToken === "string" ? data.accessToken : null;
  } catch {
    return null;
  }
}

async function request(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? (payload as { message?: unknown }).message : null;
    throw new Error(typeof message === "string" ? message : "Unable to save the care plan");
  }
  if (payload && typeof payload === "object" && "data" in payload) return (payload as { data: unknown }).data;
  return payload;
}

export async function getCarePlan(episodeId: string): Promise<CarePlan> {
  return request(`/care-episodes/${encodeURIComponent(episodeId)}/care-plan`) as Promise<CarePlan>;
}

export async function updateCarePlan(episodeId: string, payload: CarePlanPayload): Promise<CarePlan> {
  return request(`/care-episodes/${encodeURIComponent(episodeId)}/care-plan`, { method: "PATCH", body: JSON.stringify(payload) }) as Promise<CarePlan>;
}

export async function createCarePlanVersion(episodeId: string, payload: CarePlanPayload): Promise<CarePlan> {
  return request(`/care-episodes/${encodeURIComponent(episodeId)}/care-plan`, { method: "POST", body: JSON.stringify(payload) }) as Promise<CarePlan>;
}
