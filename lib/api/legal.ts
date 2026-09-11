const BASE = process.env.NEXT_PUBLIC_API_URL;

export type PrivacySummary = {
  title: string;
  description: string;
  storedData: string[];
  dataUsage: string[];
  accessPolicy: string;
  ownershipStatement: string;
};

export type TermsOfService = {
  title: string;
  lastUpdated: string;
  body: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function firstString(record: Record<string, unknown> | null, keys: string[], fallback = "") {
  if (!record) return fallback;

  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }

  return fallback;
}

function stringifyListItem(value: unknown): string {
  if (typeof value === "string") return value.trim();

  const record = asRecord(value);
  if (!record) return "";

  return firstString(record, ["label", "title", "name", "value", "description", "body", "content", "text"]);
}

function firstStringList(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return [];

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.map(stringifyListItem).filter(Boolean);
    }

    const singleValue = stringValue(value);
    if (singleValue) return [singleValue];
  }

  return [];
}

function errorMessage(payload: unknown, fallback: string) {
  const record = asRecord(payload);
  return stringValue(record?.message, fallback);
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export async function getPrivacySummary(): Promise<PrivacySummary> {
  if (!BASE) throw new Error("API base URL is not configured.");

  const response = await fetch(`${BASE}/legal/privacy-summary`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessage(payload, "Unable to load privacy policy."));
  }

  const data = asRecord(unwrapData(payload));

  return {
    title: firstString(data, ["title", "policyTitle", "name"], "Privacy Policy"),
    description: firstString(data, ["description", "summary", "intro", "introduction"]),
    storedData: firstStringList(data, ["storedData", "storedDataList", "dataStored", "collectedData", "dataCollected"]),
    dataUsage: firstStringList(data, ["dataUsage", "dataUsageList", "usage", "dataUse", "uses"]),
    accessPolicy: firstString(data, ["accessPolicy", "access", "dataAccessPolicy"]),
    ownershipStatement: firstString(data, ["ownershipStatement", "dataOwnership", "ownership"]),
  };
}

export async function getTermsOfService(): Promise<TermsOfService> {
  if (!BASE) throw new Error("API base URL is not configured.");

  const response = await fetch(`${BASE}/legal/terms`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessage(payload, "Unable to load terms of service."));
  }

  const data = asRecord(unwrapData(payload));
  const lastUpdated = firstString(data, ["lastUpdated", "updatedAt", "effectiveDate", "publishedAt"]);

  return {
    title: firstString(data, ["title", "name"], "Terms of Service"),
    lastUpdated: lastUpdated ? formatDateLabel(lastUpdated) : "Not available",
    body: firstStringList(data, ["body", "paragraphs", "content", "terms", "sections"]),
  };
}