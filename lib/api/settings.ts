import type { components } from "@/docs/types/api";
import { apiClient } from "@/lib/services/auth/api-client";

type UpdateFacilityDto = components["schemas"]["UpdateFacilityDto"];
type FacilityUploadResponseDto = components["schemas"]["FacilityUploadResponseDto"];
type NotificationPrefsDto = NonNullable<components["schemas"]["UpdateProfileDto"]["notificationPrefs"]>;
type ChangePasswordDto = components["schemas"]["ChangePasswordDto"];

export type HospitalProfileSettings = {
  facilityId: string;
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
  facilityId: "",
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

function firstString(record: Record<string, unknown> | null, keys: string[], fallback = "") {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function nullableString(record: Record<string, unknown> | null, keys: string[], fallback = "") {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
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

function normalizeHospitalProfile(payload: unknown): HospitalProfileSettings {
  const record = asRecord(payload);
  if (!record) return defaultHospitalProfile;
  const contact = asRecord(record.contact) ?? record;

  return {
    facilityId: firstString(record, ["id", "facilityId", "hospitalId"], defaultHospitalProfile.facilityId),
    name: firstString(record, ["name", "facilityName", "hospitalName"], defaultHospitalProfile.name),
    address: nullableString(record, ["address", "location", "streetAddress"], defaultHospitalProfile.address),
    contactEmail: nullableString(contact, ["contactEmail", "email", "adminEmail"], defaultHospitalProfile.contactEmail),
    contactPhone: nullableString(contact, ["contactPhone", "phone", "phoneNumber"], defaultHospitalProfile.contactPhone),
    timezone: nullableString(record, ["timezone", "timeZone"], defaultHospitalProfile.timezone),
    logoUrl: nullableString(record, ["logoUrl", "logo", "avatarUrl"], defaultHospitalProfile.logoUrl),
  };
}

export async function getHospitalProfileSettings(): Promise<HospitalProfileSettings> {
  return normalizeHospitalProfile(await request("/auth/hospital"));
}

export async function updateHospitalProfileSettings(profile: HospitalProfileSettings): Promise<HospitalProfileSettings> {
  if (!profile.facilityId) throw new Error("Unable to save hospital profile because the facility ID is missing.");

  const body: UpdateFacilityDto = {
    name: profile.name.trim() || null,
    address: profile.address.trim() || null,
    contactEmail: profile.contactEmail.trim() || null,
    contactPhone: profile.contactPhone.trim() || null,
    timezone: profile.timezone.trim() || null,
    logoUrl: profile.logoUrl.trim() || null,
  };

  return normalizeHospitalProfile(await request(`/facilities/${encodeURIComponent(profile.facilityId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }));
}

export type FacilityLocation = { latitude: number | null; longitude: number | null };

// PATCH /facilities/{id}/location — hospital_admin only, own facility. Send both null to clear.
export async function updateHospitalLocation(facilityId: string, location: FacilityLocation): Promise<FacilityLocation> {
  if (!facilityId) throw new Error("Unable to save facility location because the facility ID is missing.");

  const payload = asRecord(await request(`/facilities/${encodeURIComponent(facilityId)}/location`, {
    method: "PATCH",
    body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude }),
  }));

  return {
    latitude: typeof payload?.latitude === "number" ? payload.latitude : null,
    longitude: typeof payload?.longitude === "number" ? payload.longitude : null,
  };
}

export async function uploadHospitalLogo(facilityId: string, file: File): Promise<string> {
  if (!facilityId) throw new Error("Unable to upload hospital logo because the facility ID is missing.");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "logo");

  const payload = asRecord(await request(`/facilities/${encodeURIComponent(facilityId)}/uploads`, {
    method: "POST",
    body: formData,
  })) as FacilityUploadResponseDto | null;

  if (!payload?.url) throw new Error("The logo upload response did not include a URL.");
  return payload.url;
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
