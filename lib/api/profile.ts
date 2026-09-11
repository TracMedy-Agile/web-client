import { apiClient } from "@/lib/services/auth/api-client";

export type MyProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

const defaultProfile: MyProfile = {
  id: "",
  name: "",
  email: "",
  avatarUrl: "",
};

export type MyAccount = {
  fullName: string;
  avatarUrl: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  dateOfBirth: string;
  gender: string;
  tracId: string;
};

const defaultAccount: MyAccount = {
  fullName: "",
  avatarUrl: "",
  email: "",
  emailVerified: false,
  phone: "",
  phoneVerified: false,
  dateOfBirth: "",
  gender: "",
  tracId: "",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

function firstString(record: Record<string, unknown> | null, keys: string[], fallback = "") {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function booleanFrom(record: Record<string, unknown> | null, key: string, fallback = false) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : fallback;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await apiClient(path, init);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(typeof record?.message === "string" ? record.message : "Unable to complete profile request.");
  }
  return unwrapData(payload);
}

function normalizeProfile(payload: unknown): MyProfile {
  const record = asRecord(payload);
  if (!record) return defaultProfile;

  return {
    id: firstString(record, ["id"]),
    name: firstString(record, ["name", "fullName"]),
    email: firstString(record, ["email"]),
    avatarUrl: firstString(record, ["avatarUrl", "photoUrl"]),
  };
}

export async function getMyProfile(): Promise<MyProfile> {
  return normalizeProfile(await request("/profile/me"));
}

export async function updateMyProfile(name: string): Promise<MyProfile> {
  return normalizeProfile(await request("/profile/me", {
    method: "PATCH",
    body: JSON.stringify({ name: name.trim() }),
  }));
}

export async function updateMyAvatarUrl(avatarUrl: string): Promise<MyProfile> {
  return normalizeProfile(await request("/profile/me", {
    method: "PATCH",
    body: JSON.stringify({ avatarUrl }),
  }));
}

export async function uploadMyAvatar(file: File): Promise<MyProfile> {
  const formData = new FormData();
  formData.append("file", file);
  return normalizeProfile(await request("/profile/avatar", {
    method: "POST",
    body: formData,
  }));
}

function normalizeAccount(payload: unknown): MyAccount {
  const record = asRecord(payload);
  if (!record) return defaultAccount;

  return {
    fullName: firstString(record, ["fullName", "name"]),
    avatarUrl: firstString(record, ["avatarUrl"]),
    email: firstString(record, ["email"]),
    emailVerified: booleanFrom(record, "emailVerified"),
    phone: firstString(record, ["phone"]),
    phoneVerified: booleanFrom(record, "phoneVerified"),
    dateOfBirth: firstString(record, ["dateOfBirth"]),
    gender: firstString(record, ["gender"]),
    tracId: firstString(record, ["tracId"]),
  };
}

export async function getMyAccount(): Promise<MyAccount> {
  return normalizeAccount(await request("/profile/me/account"));
}
