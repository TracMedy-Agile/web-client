import type { components } from "@/docs/types/api";

type ApiAuditLog = components["schemas"]["AuditLogResponseDto"];

export class AuditLogAccessDeniedError extends Error {
  status = 403;

  constructor(message = "You do not have permission to view audit logs.") {
    super(message);
    this.name = "AuditLogAccessDeniedError";
  }
}

export type AuditLogEntry = {
  id: string;
  staffName: string;
  staffRole: string;
  moduleKey: string;
  module: string;
  action: string;
  reference?: string;
  timestamp: string;
  ipAddress: string;
  deviceAgent: string;
};

export type AuditLogsResponse = {
  data: AuditLogEntry[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type AuditLogsQuery = {
  search?: string;
  module?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function request(path: string, query?: URLSearchParams): Promise<unknown> {
  const tokenResponse = await fetch("/api/auth/get-token");
  const tokenPayload = await tokenResponse.json().catch(() => null);
  const accessToken = stringValue(asRecord(tokenPayload)?.accessToken);
  const response = await fetch(`${BASE}${path}${query?.toString() ? `?${query}` : ""}`, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = stringValue(asRecord(payload)?.message, "Failed to load audit logs.");
    if (response.status === 403) {
      throw new AuditLogAccessDeniedError(message);
    }
    throw new Error(message);
  }
  return payload;
}

function unwrap(payload: unknown) {
  const outer = asRecord(payload);
  return asRecord(outer?.data) ?? outer;
}

function normalizeAuditLog(value: ApiAuditLog | Record<string, unknown>): AuditLogEntry {
  const record = value as unknown as Record<string, unknown>;
  const target = asRecord(record.targetEntity);
  const actorName = stringValue(record.actorName, "System");
  const actorRole = stringValue(record.actorRole, "System");
  const referenceId = stringValue(target?.id);
  const referenceSummary = stringValue(target?.summary);
  return {
    id: stringValue(record.id, "Unknown"),
    staffName: actorName,
    staffRole: humanize(actorRole),
    moduleKey: stringValue(record.module, "system"),
    module: humanize(stringValue(record.module, "System")),
    action: humanize(stringValue(record.action, "Activity recorded")),
    reference: referenceSummary || (referenceId ? `#${referenceId}` : undefined),
    timestamp: stringValue(record.createdAt, new Date(0).toISOString()),
    ipAddress: stringValue(record.ipAddress, "Not recorded"),
    deviceAgent: stringValue(record.userAgent, "Not recorded"),
  };
}

export async function getAuditLogs(params: AuditLogsQuery = {}): Promise<AuditLogsResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") query.set(key, String(value));
  });
  const root = unwrap(await request("/facilities/audit-logs", query));
  const entries = Array.isArray(root?.data) ? root.data.map((item) => normalizeAuditLog(item as ApiAuditLog)) : [];
  const meta = asRecord(root?.meta);
  return {
    data: entries,
    meta: {
      page: Number(meta?.page) || params.page || 1,
      limit: Number(meta?.limit) || params.limit || 20,
      total: Number(meta?.total) || entries.length,
      totalPages: Math.max(Number(meta?.totalPages) || 1, 1),
    },
  };
}

export async function getAllAuditLogs(
  params: Omit<AuditLogsQuery, "page" | "limit"> = {},
): Promise<AuditLogEntry[]> {
  const firstPage = await getAuditLogs({ ...params, page: 1, limit: 100 });
  if (firstPage.meta.totalPages <= 1) return firstPage.data;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
      getAuditLogs({ ...params, page: index + 2, limit: 100 }),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((response) => response.data);
}

export async function getAuditLog(id: string): Promise<AuditLogEntry> {
  const root = unwrap(await request(`/facilities/audit-logs/${encodeURIComponent(id)}`));
  if (!root) throw new Error("Audit log entry was not found.");
  return normalizeAuditLog(root as unknown as ApiAuditLog);
}
