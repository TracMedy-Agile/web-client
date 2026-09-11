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

type JsonRecord = Record<string, unknown>;
export type CarePlanWithVersions = CarePlan & {
  versions: CarePlan[];
  versionCount: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(record: JsonRecord, key: string, fallback = "") {
  return typeof record[key] === "string" ? record[key] : fallback;
}

function optionalNumber(record: JsonRecord, key: string) {
  return typeof record[key] === "number" ? record[key] : undefined;
}

function normalizeCarePlan(value: unknown): CarePlan {
  if (!isRecord(value) || !stringValue(value, "id")) {
    throw new Error("The care plan response was invalid.");
  }

  const tasks = Array.isArray(value.tasks)
    ? value.tasks.filter(isRecord).map((task) => ({
        title: stringValue(task, "title", "Care task"),
        dueDate: stringValue(task, "dueDate"),
        status: stringValue(task, "status", "pending"),
        type: stringValue(task, "type") || undefined,
        priority: stringValue(task, "priority") || undefined,
        instructions: stringValue(task, "instructions") || undefined,
      }))
    : [];
  const medications = Array.isArray(value.medications)
    ? value.medications.filter(isRecord).map((medication) => ({
        name: stringValue(medication, "name", "Medication"),
        dosage: stringValue(medication, "dosage"),
        frequency: stringValue(medication, "frequency"),
        duration: stringValue(medication, "duration"),
        instructions: stringValue(medication, "instructions"),
      }))
    : [];
  const lifestyleRecommendations: CarePlan["lifestyleRecommendations"] = [];
  if (Array.isArray(value.lifestyleRecommendations)) {
    for (const item of value.lifestyleRecommendations) {
      if (typeof item === "string") lifestyleRecommendations.push(item);
      else if (isRecord(item)) lifestyleRecommendations.push({
        title: stringValue(item, "title", "Lifestyle"),
        description: stringValue(item, "description"),
      });
    }
  }

  const monitoringRules: CarePlan["monitoringRules"] = Array.isArray(value.monitoringRules)
    ? value.monitoringRules.filter(isRecord).map((rule) => ({
        type: stringValue(rule, "type") || undefined,
        metric: stringValue(rule, "metric") || undefined,
        min: typeof rule.min === "number" ? rule.min : null,
        max: typeof rule.max === "number" ? rule.max : null,
        severity: stringValue(rule, "severity") || undefined,
        warningMessage: stringValue(rule, "warningMessage") || undefined,
        responseInstruction: stringValue(rule, "responseInstruction") || null,
        frequency: stringValue(rule, "frequency") || undefined,
        cadence: stringValue(rule, "cadence") || undefined,
        id: stringValue(rule, "id") || undefined,
        taskId: stringValue(rule, "taskId") || null,
      }))
    : undefined;
  const warningSigns: CarePlan["warningSigns"] = Array.isArray(value.warningSigns)
    ? value.warningSigns.filter(isRecord).map((warning) => ({
        type: stringValue(warning, "type", "warning"),
        metric: stringValue(warning, "metric", "warning"),
        severity: stringValue(warning, "severity", "warning"),
        warningMessage: stringValue(warning, "warningMessage", "Warning sign"),
        responseInstruction: stringValue(warning, "responseInstruction") || undefined,
        min: optionalNumber(warning, "min"),
        max: optionalNumber(warning, "max"),
        carePlanRuleId: stringValue(warning, "carePlanRuleId") || undefined,
        taskId: stringValue(warning, "taskId") || undefined,
      }))
    : undefined;

  return {
    id: stringValue(value, "id"),
    episodeId: stringValue(value, "episodeId"),
    version: typeof value.version === "number" ? value.version : 1,
    clinicianId: typeof value.clinicianId === "string" ? value.clinicianId : null,
    clinicianName: typeof value.clinicianName === "string" ? value.clinicianName : null,
    tasks,
    medications,
    lifestyleRecommendations,
    monitoringFrequency: stringValue(value, "monitoringFrequency"),
    monitoringRules,
    warningSigns,
    episodeDuration: stringValue(value, "episodeDuration"),
    changeReason: stringValue(value, "changeReason"),
    isActive: value.isActive !== false,
    createdAt: stringValue(value, "createdAt"),
  };
}

export async function getCarePlan(episodeId: string): Promise<CarePlanWithVersions> {
  const value = await request(`/care-episodes/${encodeURIComponent(episodeId)}/care-plan`);
  const plan = normalizeCarePlan(value);
  const record = isRecord(value) ? value : {};
  const versions = Array.isArray(record.versions)
    ? record.versions.map(normalizeCarePlan)
    : [plan];
  return {
    ...plan,
    versions,
    versionCount: typeof record.versionCount === "number" ? record.versionCount : versions.length,
  };
}

export async function updateCarePlan(episodeId: string, payload: CarePlanPayload): Promise<CarePlan> {
  return normalizeCarePlan(await request(`/care-episodes/${encodeURIComponent(episodeId)}/care-plan`, { method: "PATCH", body: JSON.stringify(payload) }));
}

export async function createCarePlanVersion(episodeId: string, payload: CarePlanPayload): Promise<CarePlan> {
  return normalizeCarePlan(await request(`/care-episodes/${encodeURIComponent(episodeId)}/care-plan`, { method: "POST", body: JSON.stringify(payload) }));
}
