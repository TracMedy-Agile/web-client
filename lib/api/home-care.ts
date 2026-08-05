import type { components } from "@/docs/types/api";
import { apiClient } from "@/lib/services/auth/api-client";

export type CreateHomeCareRequestInput = components["schemas"]["CreateHomeCareRequestDto"];

export type HomeCareService = {
  id: string;
  name: string;
  category: string;
  description: string;
  estimatedDuration: string;
  startingPrice: number | null;
};

export type HomeCareRequest = {
  id: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function unwrapData(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 2; depth += 1) {
    const record = asRecord(current);
    if (!record || !("data" in record)) break;
    current = record.data;
  }
  return current;
}

function stringValue(record: JsonRecord, key: string, fallback = "") {
  return typeof record[key] === "string" ? record[key] : fallback;
}

async function readResponse(response: Response, fallbackMessage: string): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = asRecord(payload);
    const message = typeof record?.message === "string" ? record.message : fallbackMessage;
    throw new Error(message);
  }
  return unwrapData(payload);
}

export async function getHomeCareServices(): Promise<HomeCareService[]> {
  const response = await apiClient("/home-care/services", { cache: "no-store" });
  const payload = await readResponse(response, "Unable to load home-care services.");
  const record = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.services)
        ? record.services
        : [];

  return list
    .map(asRecord)
    .filter((item): item is JsonRecord => item !== null)
    .map((item) => ({
      id: stringValue(item, "id"),
      name: stringValue(item, "name", "Home-care service"),
      category: stringValue(item, "category"),
      description: stringValue(item, "description"),
      estimatedDuration: stringValue(item, "estimatedDuration"),
      startingPrice: typeof item.startingPrice === "number" && Number.isFinite(item.startingPrice)
        ? item.startingPrice
        : null,
    }))
    .filter((service) => service.id);
}

export async function createHomeCareRequest(input: CreateHomeCareRequestInput): Promise<HomeCareRequest> {
  const response = await apiClient.post("/home-care/requests", input, { cache: "no-store" });
  const payload = await readResponse(response, "Unable to create the home-care request.");
  const record = asRecord(payload);
  return { id: record ? stringValue(record, "id") : "" };
}
