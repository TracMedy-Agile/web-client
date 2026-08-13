import type { components } from "@/docs/types/api";
import { apiClient } from "@/lib/services/auth/api-client";

type NotificationPrefsDto = NonNullable<components["schemas"]["UpdateProfileDto"]["notificationPrefs"]>;
type ChangePasswordDto = components["schemas"]["ChangePasswordDto"];

export type HospitalProfileSettings = {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  logoUrl: string;
};

export type NotificationPreferences = {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  smsAlerts: boolean;
  dailySummaryReportEmail: boolean;
};

export type SubscriptionSummary = {
  planName: string;
  status: string;
  billingPeriod: string;
  estimatedTotal: number;
  currency: string;
  renewalDate: string;
  usage: {
    activeCareEpisodes: number;
    appointments: number;
    activeClinicians: number;
  };
};

const defaultHospitalProfile: HospitalProfileSettings = {
  name: "Lagos General Hospital",
  address: "12 Marina Road, Lagos Island, Lagos",
  contactEmail: "admin@lagosgeneral.ng",
  contactPhone: "+234 801 000 0001",
  timezone: "Africa/Lagos",
  logoUrl: "",
};

export const defaultNotificationPreferences: NotificationPreferences = {
  emailNotifications: true,
  inAppNotifications: true,
  smsAlerts: false,
  dailySummaryReportEmail: true,
};

const defaultSubscriptionSummary: SubscriptionSummary = {
  planName: "Free Plan",
  status: "Active",
  billingPeriod: "Current billing period",
  estimatedTotal: 0,
  currency: "NGN",
  renewalDate: "--",
  usage: {
    activeCareEpisodes: 0,
    appointments: 0,
    activeClinicians: 0,
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

function firstString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function booleanFrom(record: Record<string, unknown>, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return fallback;
}

function numberFrom(record: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await apiClient(path, init);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(typeof record?.message === "string" ? record.message : "Unable to complete settings request.");
  }
  return unwrapData(payload);
}

export async function getHospitalProfileSettings(): Promise<HospitalProfileSettings> {
  const payload = asRecord(await request("/auth/hospital"));
  if (!payload) return defaultHospitalProfile;

  const contact = asRecord(payload.contact) ?? payload;

  return {
    name: firstString(payload, ["name", "facilityName", "hospitalName"], defaultHospitalProfile.name),
    address: firstString(payload, ["address", "location", "streetAddress"], defaultHospitalProfile.address),
    contactEmail: firstString(contact, ["contactEmail", "email", "adminEmail"], defaultHospitalProfile.contactEmail),
    contactPhone: firstString(contact, ["contactPhone", "phone", "phoneNumber"], defaultHospitalProfile.contactPhone),
    timezone: firstString(payload, ["timezone", "timeZone"], defaultHospitalProfile.timezone),
    logoUrl: firstString(payload, ["logoUrl", "logo", "avatarUrl"], defaultHospitalProfile.logoUrl),
  };
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const payload = asRecord(await request("/profile/me/notification-preferences")) ?? {};
  const prefs = asRecord(payload.notificationPrefs) ?? asRecord(payload.preferences) ?? payload;

  return {
    emailNotifications: booleanFrom(prefs, ["emailNotifications", "alertEmail", "emailAlerts"], defaultNotificationPreferences.emailNotifications),
    inAppNotifications: booleanFrom(prefs, ["inAppNotifications", "pushNotifications", "appNotifications"], defaultNotificationPreferences.inAppNotifications),
    smsAlerts: booleanFrom(prefs, ["smsAlerts", "smsNotifications"], defaultNotificationPreferences.smsAlerts),
    dailySummaryReportEmail: booleanFrom(prefs, ["dailySummaryReportEmail", "dailySummaryEmail"], defaultNotificationPreferences.dailySummaryReportEmail),
  };
}

export async function saveNotificationPreferences(preferences: NotificationPreferences) {
  const notificationPrefs: NotificationPrefsDto = {
    emailNotifications: preferences.emailNotifications,
    inAppNotifications: preferences.inAppNotifications,
    pushNotifications: preferences.inAppNotifications,
    smsAlerts: preferences.smsAlerts,
    smsNotifications: preferences.smsAlerts,
    dailySummaryReportEmail: preferences.dailySummaryReportEmail,
  };

  await request("/profile/me", {
    method: "PATCH",
    body: JSON.stringify({ notificationPrefs }),
  });
}

export async function changeCurrentPassword(input: ChangePasswordDto) {
  await request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const payload = asRecord(await request("/subscriptions/me")) ?? {};
  const plan = asRecord(payload.plan) ?? payload;
  const usage = asRecord(payload.usage) ?? payload;

  return {
    planName: firstString(plan, ["name", "planName", "subscriptionPlan", "tier"], defaultSubscriptionSummary.planName),
    status: firstString(payload, ["status", "subscriptionStatus"], defaultSubscriptionSummary.status),
    billingPeriod: firstString(payload, ["billingPeriod", "currentPeriod", "period"], defaultSubscriptionSummary.billingPeriod),
    estimatedTotal: numberFrom(payload, ["estimatedTotal", "amount", "total"], defaultSubscriptionSummary.estimatedTotal),
    currency: firstString(payload, ["currency"], defaultSubscriptionSummary.currency),
    renewalDate: firstString(payload, ["renewalDate", "currentPeriodEnd", "nextBillingDate"], defaultSubscriptionSummary.renewalDate),
    usage: {
      activeCareEpisodes: numberFrom(usage, ["activeCareEpisodes", "careEpisodes"], defaultSubscriptionSummary.usage.activeCareEpisodes),
      appointments: numberFrom(usage, ["appointments", "appointmentCount"], defaultSubscriptionSummary.usage.appointments),
      activeClinicians: numberFrom(usage, ["activeClinicians", "clinicians"], defaultSubscriptionSummary.usage.activeClinicians),
    },
  };
}
