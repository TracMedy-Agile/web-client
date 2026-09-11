import type { components } from "@/docs/types/api";
import { apiClient } from "@/lib/services/auth/api-client";

type InvitationLookup = components["schemas"]["InvitationLookupResponseDto"];

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

async function readPayload(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = asRecord(payload);
    if (response.status === 401) {
      throw new Error("Sign in as the invited caregiver to view or respond to this invitation.");
    }
    throw new Error(stringValue(record?.message, fallback));
  }
  return payload;
}

function normalizeInvitation(payload: unknown): InvitationLookup {
  const record = asRecord(unwrapData(payload));
  if (!record) throw new Error("The invitation response was invalid.");

  return {
    id: stringValue(record.id),
    patientName: stringValue(record.patientName, "Unknown patient"),
    relationship: stringValue(record.relationship, "caregiver"),
    role: stringValue(record.role, "support member"),
    status: stringValue(record.status, "pending"),
    expired: record.expired === true,
  };
}

export async function getCaregiverInvitation(token: string): Promise<InvitationLookup> {
  if (!token) throw new Error("This invitation link is missing its token.");

  const response = await apiClient(`/caregivers/invitations/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return normalizeInvitation(await readPayload(response, "Unable to load this caregiver invitation."));
}

export async function acceptCaregiverInvitation(token: string): Promise<void> {
  if (!token) throw new Error("This invitation link is missing its token.");

  const response = await apiClient(`/caregivers/invitations/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });
  await readPayload(response, "Unable to accept this caregiver invitation.");
}

export async function declineCaregiverInvitation(token: string): Promise<void> {
  if (!token) throw new Error("This invitation link is missing its token.");

  const response = await apiClient(`/caregivers/invitations/${encodeURIComponent(token)}/decline`, {
    method: "POST",
  });
  await readPayload(response, "Unable to decline this caregiver invitation.");
}