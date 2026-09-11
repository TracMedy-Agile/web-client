"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, CircleHelp, Info, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SaveNotice } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getTeamMemberEscalationPreference,
  getTeamMemberRequestId,
  getTeamMembers,
  updateTeamMemberEscalationPreference,
  type EscalationPreference,
  type UpdateEscalationPreferenceInput,
} from "@/lib/api/clinicians";
import { getMyProfile, updateMyAvatarUrl, uploadMyAvatar, type MyProfile } from "@/lib/api/profile";

const defaultProfile: MyProfile = { id: "", name: "", email: "", avatarUrl: "" };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
}

function formatRoleLabel(value?: string | null) {
  if (!value) return "Staff";
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function FieldLabel({ children }: { children: string }) {
  return <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.04em] text-foreground/80">{children}</span>;
}

const profileInputClassName = "h-12 rounded-lg border-border bg-card px-3 text-sm font-medium text-foreground shadow-none focus-visible:ring-primary/20";
const lockedProfileInputClassName = `${profileInputClassName} cursor-not-allowed bg-muted/60 pr-9 text-muted-foreground`;
const criticalAlertInputClassName = "h-12 rounded-lg border-border bg-card px-3 text-sm font-medium text-foreground shadow-none focus-visible:ring-primary/20";
const countryCodeOptions = [
  { value: "+234", label: "Nigeria (+234)" },
  { value: "+1", label: "United States (+1)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+233", label: "Ghana (+233)" },
] as const;

function LockedProfileInput({ label, value, locked = false }: { label: string; value: string; locked?: boolean }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <Input value={value} readOnly aria-readonly="true" className={locked ? lockedProfileInputClassName : profileInputClassName} />
        {locked ? <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" /> : null}
      </div>
    </label>
  );
}
type CriticalAlertContactStatus = "not_configured" | "verified";

function CriticalAlertContactStatusBadge({ status }: { status: CriticalAlertContactStatus }) {
  const label = status === "verified" ? "Verified" : "Not Configured";
  const className = status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-transparent bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex h-6 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function CriticalAlertRecipientBanner() {
  return (
    <div className="mt-6 flex items-center gap-4 rounded-lg border border-primary bg-sky-100 px-5 py-4 text-sm leading-6 text-primary">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <CircleHelp className="h-5 w-5" aria-hidden="true" />
      </span>
      <p>
        You have been designated as a Critical Alert Recipient. Verify your contact information to receive WhatsApp notifications when critical patient alerts require your attention.
      </p>
    </div>
  );
}
function splitName(name: string) {
  const [first = "", ...rest] = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(" ") };
}

type AlertEscalationChannel = UpdateEscalationPreferenceInput["channels"][number];

type NoticeTone = "info" | "success" | "error";

const allowedAlertEscalationChannels = new Set<AlertEscalationChannel>(["sms", "email", "in_app", "whatsapp"]);

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function localPhoneDigitsForCountry(countryCode: string, phoneNumber: string) {
  const countryDigits = normalizePhoneNumber(countryCode);
  let digits = normalizePhoneNumber(phoneNumber);
  if (countryDigits && digits.startsWith(countryDigits)) digits = digits.slice(countryDigits.length);
  if (countryCode === "+234" && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function formatCriticalAlertPhoneE164(countryCode: string, phoneNumber: string) {
  return `${countryCode}${localPhoneDigitsForCountry(countryCode, phoneNumber)}`;
}

function validateCriticalAlertPhone(countryCode: string, phoneNumber: string) {
  const digits = localPhoneDigitsForCountry(countryCode, phoneNumber);
  if (!digits) return "Phone number is required.";

  if (countryCode === "+234") {
    if (!/^[789]\d{9}$/.test(digits)) return "Enter a valid Nigerian phone number.";
    return "";
  }

  const totalDigits = normalizePhoneNumber(`${countryCode}${digits}`);
  if (digits.length < 7 || totalDigits.length > 15) return "Enter a valid phone number.";
  return "";
}

function parseCriticalAlertPhone(phone: string | null | undefined) {
  if (!phone) return { countryCode: "+234", phoneNumber: "" };
  const option = countryCodeOptions.find((item) => phone.startsWith(item.value));
  if (!option) return { countryCode: "+234", phoneNumber: phone.replace(/^\+/, "") };
  return { countryCode: option.value, phoneNumber: phone.slice(option.value.length) };
}

function normalizeAlertChannels(channels: readonly string[] | null | undefined): AlertEscalationChannel[] {
  if (!channels) return [];
  return channels.filter((channel): channel is AlertEscalationChannel => allowedAlertEscalationChannels.has(channel as AlertEscalationChannel));
}

async function resolveCurrentTeamMemberRequestId(userId: string) {
  const members = await getTeamMembers().catch(() => []);
  const member = members.find((item) => item.id === userId || item.userId === userId || getTeamMemberRequestId(item) === userId);
  return member ? getTeamMemberRequestId(member) : userId;
}

export default function ProfilePage() {
  const { user, updateUser } = useDashboardUser();
  const roleLabel = user?.specialty || formatRoleLabel(user?.role);
  const [profile, setProfile] = useState<MyProfile>(defaultProfile);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [alertCountryCode, setAlertCountryCode] = useState("+234");
  const [alertPhoneNumber, setAlertPhoneNumber] = useState("");
  const [alertPhoneTouched, setAlertPhoneTouched] = useState(false);
  const [alertUsesWhatsapp, setAlertUsesWhatsapp] = useState(false);
  const [alertWhatsappConsent, setAlertWhatsappConsent] = useState(false);
  const [alertEscalationChannels, setAlertEscalationChannels] = useState<AlertEscalationChannel[]>([]);
  const [alertMemberId, setAlertMemberId] = useState("");
  const [savedAlertWhatsappPhone, setSavedAlertWhatsappPhone] = useState("");
  const [isAlertContactSaving, setIsAlertContactSaving] = useState(false);
  const [alertNotice, setAlertNotice] = useState("");
  const [alertNoticeTone, setAlertNoticeTone] = useState<NoticeTone>("info");
  const avatarPreviewRef = useRef("");

  useEffect(() => {
    capturePostHogEvent("profile_viewed");
    let isMounted = true;

    getMyProfile()
      .then((next) => {
        if (!isMounted) return;
        setProfile(next);
        const split = splitName(next.name);
        setFirstName(split.firstName);
        setLastName(split.lastName);
        setAvatarPreview(next.avatarUrl);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setNotice(error instanceof Error ? error.message : "Unable to load your profile.");
        setNoticeTone("error");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let isActive = true;

    async function loadAlertContactPreference() {
      try {
        const requestMemberId = await resolveCurrentTeamMemberRequestId(userId);
        if (!isActive) return;
        setAlertMemberId(requestMemberId);

        const preference = await getTeamMemberEscalationPreference(requestMemberId);
        if (!isActive) return;

        const channels = normalizeAlertChannels(preference.channels);
        setAlertEscalationChannels(channels);
        setAlertUsesWhatsapp(channels.includes("whatsapp"));
        setSavedAlertWhatsappPhone(preference.whatsappPhone ?? "");

        const phone = parseCriticalAlertPhone(preference.whatsappPhone);
        if (phone.phoneNumber) {
          setAlertCountryCode(phone.countryCode);
          setAlertPhoneNumber(phone.phoneNumber);
        }
      } catch {
        if (isActive) setAlertMemberId(userId);
      }
    }

    void loadAlertContactPreference();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const validType = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/gif";
    if (!validType) {
      toast.error("Upload a JPG, PNG, or GIF photo.");
      input.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be 2MB or smaller.");
      input.value = "";
      return;
    }

    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    const preview = URL.createObjectURL(file);
    avatarPreviewRef.current = preview;
    setAvatarPreview(preview);
    setIsSaving(true);
    setNotice("Uploading profile photo...");
    setNoticeTone("info");

    try {
      const nextProfile = await uploadMyAvatar(file);
      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = "";
      setProfile(nextProfile);
      const split = splitName(nextProfile.name);
      setFirstName(split.firstName);
      setLastName(split.lastName);
      setAvatarPreview(nextProfile.avatarUrl);
      setNotice("Profile photo updated successfully.");
      setNoticeTone("success");
      capturePostHogEvent("profile_saved");
      updateUser({ name: nextProfile.name, avatarUrl: nextProfile.avatarUrl });
      toast.success("Profile photo updated.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to update profile photo.";
      setAvatarPreview(profile.avatarUrl);
      setNotice(message);
      setNoticeTone("error");
      toast.error(message);
    } finally {
      setIsSaving(false);
      input.value = "";
    }
  }

  async function removeAvatar() {
    if (!avatarPreview && !profile.avatarUrl) return;

    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    avatarPreviewRef.current = "";
    setIsSaving(true);
    setNotice("Removing profile photo...");
    setNoticeTone("info");

    try {
      const nextProfile = await updateMyAvatarUrl("");
      setProfile(nextProfile);
      const split = splitName(nextProfile.name);
      setFirstName(split.firstName);
      setLastName(split.lastName);
      setAvatarPreview(nextProfile.avatarUrl);
      setNotice("Profile photo removed successfully.");
      setNoticeTone("success");
      capturePostHogEvent("profile_saved");
      updateUser({ name: nextProfile.name, avatarUrl: nextProfile.avatarUrl });
      toast.success("Profile photo removed.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to remove profile photo.";
      setAvatarPreview(profile.avatarUrl);
      setNotice(message);
      setNoticeTone("error");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  function showAlertContactError(message: string) {
    setAlertNotice(message);
    setAlertNoticeTone("error");
    toast.error(message);
  }

  async function saveAndVerifyWhatsappNumber() {
    const phoneError = validateCriticalAlertPhone(alertCountryCode, alertPhoneNumber);
    setAlertPhoneTouched(true);

    if (phoneError) {
      showAlertContactError(phoneError);
      return;
    }

    if (!alertUsesWhatsapp) {
      showAlertContactError("Select that this number is also used for WhatsApp before saving.");
      return;
    }

    if (!alertWhatsappConsent) {
      showAlertContactError("Consent is required before WhatsApp alert escalation can be enabled.");
      return;
    }

    if (!user?.id) {
      showAlertContactError("Unable to identify your team member profile. Please refresh and try again.");
      return;
    }

    const whatsappPhone = formatCriticalAlertPhoneE164(alertCountryCode, alertPhoneNumber);
    const currentChannels = alertEscalationChannels.length ? alertEscalationChannels : [];
    const nextChannels = Array.from(new Set([...currentChannels, "whatsapp" as AlertEscalationChannel]));
    setIsAlertContactSaving(true);
    setAlertNotice("Saving WhatsApp contact...");
    setAlertNoticeTone("info");

    try {
      const requestMemberId = alertMemberId || await resolveCurrentTeamMemberRequestId(user.id);
      const preference: EscalationPreference = await updateTeamMemberEscalationPreference(requestMemberId, {
        channels: nextChannels,
        whatsappPhone,
        whatsappSeverityThreshold: "critical",
      });
      const savedChannels = normalizeAlertChannels(preference.channels);
      setAlertMemberId(requestMemberId);
      setAlertEscalationChannels(savedChannels.length ? savedChannels : nextChannels);
      setSavedAlertWhatsappPhone(preference.whatsappPhone ?? whatsappPhone);
      setAlertUsesWhatsapp(true);
      setAlertNotice("WhatsApp number saved. Verification has been initiated if enabled by the backend.");
      setAlertNoticeTone("success");
      capturePostHogEvent("team_escalation_preference_updated", { member_id: requestMemberId, channels: nextChannels });
      toast.success("WhatsApp number saved.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save WhatsApp number.";
      setAlertNotice(message);
      setAlertNoticeTone("error");
      toast.error("WhatsApp number could not be saved", { description: message });
    } finally {
      setIsAlertContactSaving(false);
    }
  }
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Staff member";
  const currentAlertPhone = alertPhoneNumber ? formatCriticalAlertPhoneE164(alertCountryCode, alertPhoneNumber) : "";
  const alertContactStatus: CriticalAlertContactStatus = savedAlertWhatsappPhone !== "" && currentAlertPhone === savedAlertWhatsappPhone ? "verified" : "not_configured";
  const alertPhoneError = alertPhoneTouched ? validateCriticalAlertPhone(alertCountryCode, alertPhoneNumber) : "";

  return (
    <div className="w-full max-w-6xl space-y-8">
      <header className="space-y-3 text-center">
        <h1 className="text-[32px] font-bold leading-[38px] tracking-[-0.02em] text-foreground">PROFILE.</h1>
        <p className="mx-auto max-w-3xl text-base leading-6 text-muted-foreground">
          Your hospital has already provided your professional information. Review your details and configure how Tracmedy should contact you for critical patient-alert escalations.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center text-sm font-semibold text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
            Loading profile...
          </div>
        ) : (
          <>
            <div className="space-y-0 p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div
                  aria-label="Profile photo preview"
                  className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary bg-cover bg-center text-4xl font-semibold text-primary-foreground"
                  role="img"
                  style={avatarPreview ? { backgroundImage: `url(${avatarPreview})` } : undefined}
                >
                  {avatarPreview ? null : initials(displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold leading-6 text-foreground">Profile Photo</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Upload a professional photo for your profile. JPG, PNG or GIF. Max size 2MB.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" asChild disabled={isSaving} className="h-12 rounded-lg px-4 text-sm font-semibold">
                      <label>
                        Update Photo
                        <input type="file" accept="image/png,image/jpeg,image/gif" onChange={(event) => void handleAvatarChange(event)} disabled={isSaving} className="sr-only" />
                      </label>
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void removeAvatar()} disabled={isSaving} className="h-12 rounded-lg px-4 text-sm font-semibold text-primary">
                      Remove
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-border pt-8">
                <h2 className="text-xl font-bold leading-6 text-foreground">Professional Information</h2>
                <div className="mt-8 grid gap-x-8 gap-y-6 md:grid-cols-2">
                  <LockedProfileInput label="First Name" value={firstName} />
                  <LockedProfileInput label="Last Name" value={lastName} />
                  <LockedProfileInput label="Email" value={profile.email} locked />
                  <LockedProfileInput label="Role" value={roleLabel} locked />
                </div>
                {notice ? <div className="mt-6"><SaveNotice tone={noticeTone}>{notice}</SaveNotice></div> : null}
              </div>
            </div>
            <footer className="flex items-center gap-3 border-t border-border bg-muted px-8 py-5 text-sm leading-5 text-foreground/80">
              <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Professional information is managed by your hospital administrator.</span>
            </footer>
          </>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold leading-6 text-foreground">Critical Alert Contact</h2>
            <CriticalAlertContactStatusBadge status={alertContactStatus} />
          </div>
          <CriticalAlertRecipientBanner />

          <div className="mt-8">
            <FieldLabel>Phone Number</FieldLabel>
            <div className="mt-2 grid grid-cols-[100px_minmax(0,1fr)] gap-2">
              <div className="relative">
                <select
                  value={alertCountryCode}
                  onChange={(event) => {
                    setAlertCountryCode(event.target.value);
                    if (alertPhoneNumber) setAlertPhoneTouched(true);
                  }}
                  className={`${criticalAlertInputClassName} w-full appearance-none pr-8`}
                  aria-label="Critical alert phone country code"
                >
                  {countryCodeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
              <Input
                value={alertPhoneNumber}
                onChange={(event) => setAlertPhoneNumber(event.target.value)}
                onBlur={() => setAlertPhoneTouched(true)}
                inputMode="tel"
                placeholder="801 234 5678"
                className={criticalAlertInputClassName}
                aria-invalid={alertPhoneError ? "true" : "false"}
                aria-describedby={alertPhoneError ? "critical-alert-phone-error" : undefined}
              />
            </div>
            {alertPhoneError ? (
              <p id="critical-alert-phone-error" className="mt-1.5 text-xs font-medium text-destructive">
                {alertPhoneError}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="critical-alert-whatsapp-enabled"
                checked={alertUsesWhatsapp}
                onCheckedChange={(checked) => {
                  const nextChecked = checked === true;
                  setAlertUsesWhatsapp(nextChecked);
                  if (!nextChecked) setAlertWhatsappConsent(false);
                }}
                aria-label="This number is also used for WhatsApp"
              />
              <label htmlFor="critical-alert-whatsapp-enabled" className="cursor-pointer text-sm font-medium leading-5 text-foreground">
                This number is also used for WhatsApp
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="critical-alert-whatsapp-consent"
                checked={alertWhatsappConsent}
                onCheckedChange={(checked) => setAlertWhatsappConsent(checked === true)}
                aria-label="I consent to receive critical patient-alert escalations through WhatsApp"
                className="mt-0.5"
              />
              <label htmlFor="critical-alert-whatsapp-consent" className="cursor-pointer text-sm font-medium leading-5 text-foreground">
                I consent to receive critical patient-alert escalations through WhatsApp
              </label>
            </div>
          </div>

          {alertNotice ? (
            <div className="mt-6">
              <SaveNotice tone={alertNoticeTone}>{alertNotice}</SaveNotice>
            </div>
          ) : null}

          <div className="mt-8">
            <Button type="button" onClick={() => void saveAndVerifyWhatsappNumber()} disabled={isAlertContactSaving} className="h-14 w-full rounded-lg px-5 font-semibold">
              {isAlertContactSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Save & Verify WhatsApp Number
            </Button>
          </div>
        </div>
        <footer className="border-t border-border bg-muted px-8 py-5 text-xs leading-5 tracking-[0.01em] text-foreground/80">
          Your number is only used for clinician-to-platform emergency notifications. Patients will never see your personal number.
        </footer>
      </section>
    </div>
  );
}