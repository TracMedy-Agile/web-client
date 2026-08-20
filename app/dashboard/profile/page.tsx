"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { InfoBanner, inputClassName, SaveNotice, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getMyProfile, updateMyProfile, uploadMyAvatar, type MyProfile } from "@/lib/api/profile";

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
  return <span className="mb-2 block text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">{children}</span>;
}

function splitName(name: string) {
  const [first = "", ...rest] = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(" ") };
}

export default function ProfilePage() {
  const { user, updateUser } = useDashboardUser();
  const roleLabel = user?.specialty || formatRoleLabel(user?.role);
  const [profile, setProfile] = useState<MyProfile>(defaultProfile);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initialName, setInitialName] = useState({ firstName: "", lastName: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
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
        setInitialName(split);
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

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validType = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/gif";
    if (!validType) {
      toast.error("Upload a JPG, PNG, or GIF photo.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    const preview = URL.createObjectURL(file);
    avatarPreviewRef.current = preview;
    setPendingAvatarFile(file);
    setAvatarPreview(preview);
    setNotice("Photo selected. Save changes to upload it.");
    setNoticeTone("info");
  }

  function removeAvatar() {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    avatarPreviewRef.current = "";
    setPendingAvatarFile(null);
    setAvatarPreview("");
    setNotice("Photo will be removed when you save changes.");
    setNoticeTone("info");
  }

  function resetProfile() {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    avatarPreviewRef.current = "";
    setPendingAvatarFile(null);
    setFirstName(initialName.firstName);
    setLastName(initialName.lastName);
    setAvatarPreview(profile.avatarUrl);
    setNotice("Profile has been reset to the last loaded values.");
    setNoticeTone("info");
  }

  async function saveProfile() {
    setIsSaving(true);
    setNotice("");

    try {
      let nextProfile = profile;
      if (pendingAvatarFile) {
        nextProfile = await uploadMyAvatar(pendingAvatarFile);
      }
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      nextProfile = await updateMyProfile(fullName || nextProfile.name);

      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = "";
      setPendingAvatarFile(null);
      setProfile(nextProfile);
      const split = splitName(nextProfile.name);
      setFirstName(split.firstName);
      setLastName(split.lastName);
      setInitialName(split);
      setAvatarPreview(nextProfile.avatarUrl);
      setNotice("Profile saved successfully.");
      setNoticeTone("success");
      capturePostHogEvent("profile_saved");
      updateUser({ name: nextProfile.name, avatarUrl: nextProfile.avatarUrl });
      toast.success("Profile saved.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save profile.";
      setNotice(message);
      setNoticeTone("error");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Staff member";

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold uppercase tracking-wide text-foreground">Profile.</h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-6 text-muted-foreground">
          Your hospital has already provided your professional information. Review your details below.
        </p>
      </div>

      <SettingsPanel
        title="Profile"
        hideHeader
        variant="card"
        className="mx-auto max-w-3xl"
        footer={
          <>
            <Button type="button" onClick={() => void saveProfile()} disabled={isSaving} className="h-11 rounded-lg px-5 font-semibold">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
            <Button type="button" variant="outline" onClick={resetProfile} disabled={isSaving} className="h-11 rounded-lg px-5 font-semibold">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </>
        }
      >
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center text-sm font-semibold text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
            Loading profile...
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-foreground">Profile Photo</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Upload a professional photo for your profile. JPG, PNG or GIF. Max size 2MB.
              </p>
              <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
                <div
                  aria-label="Profile photo preview"
                  className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary bg-cover bg-center text-4xl font-semibold text-primary-foreground"
                  role="img"
                  style={avatarPreview ? { backgroundImage: `url(${avatarPreview})` } : undefined}
                >
                  {avatarPreview ? null : initials(displayName)}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" asChild disabled={isSaving} className="h-10 rounded-lg px-4 text-sm font-semibold">
                    <label>
                      <ImagePlus className="h-4 w-4" />
                      Update Photo
                      <input type="file" accept="image/png,image/jpeg,image/gif" onChange={handleAvatarChange} disabled={isSaving} className="sr-only" />
                    </label>
                  </Button>
                  <Button type="button" variant="outline" onClick={removeAvatar} disabled={isSaving} className="h-10 rounded-lg px-4 text-sm font-semibold text-muted-foreground">
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-bold text-foreground">Professional Information</h2>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <label className="block">
                  <FieldLabel>First Name</FieldLabel>
                  <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={isSaving} className={inputClassName} />
                </label>
                <label className="block">
                  <FieldLabel>Last Name</FieldLabel>
                  <Input value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={isSaving} className={inputClassName} />
                </label>
                <label className="block">
                  <FieldLabel>Email</FieldLabel>
                  <Input value={profile.email} readOnly className={`${inputClassName} bg-muted/60 text-muted-foreground`} />
                </label>
                <label className="block">
                  <FieldLabel>Role</FieldLabel>
                  <Input value={roleLabel} readOnly className={`${inputClassName} bg-muted/60 text-muted-foreground`} />
                </label>
              </div>
              <div className="mt-6">
                <InfoBanner>Professional information is managed by your hospital administrator.</InfoBanner>
              </div>
            </div>

            {notice ? <SaveNotice tone={noticeTone}>{notice}</SaveNotice> : null}
          </>
        )}
      </SettingsPanel>
    </div>
  );
}
