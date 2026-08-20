"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Field, inputClassName, SaveNotice, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getHospitalProfileSettings, type HospitalProfileSettings, updateHospitalProfileSettings, uploadHospitalLogo } from "@/lib/api/settings";

const defaultProfile: HospitalProfileSettings = {
  facilityId: "",
  name: "Lagos General Hospital",
  address: "12 Marina Road, Lagos Island, Lagos",
  contactEmail: "admin@lagosgeneral.ng",
  contactPhone: "+234 801 000 0001",
  timezone: "Africa/Lagos",
  logoUrl: "",
};

const timezones = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Europe/London", "America/New_York"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TH";
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<HospitalProfileSettings>(defaultProfile);
  const [initialProfile, setInitialProfile] = useState<HospitalProfileSettings>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");
  const [logoPreview, setLogoPreview] = useState("");
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const logoPreviewRef = useRef("");

  useEffect(() => {
    capturePostHogEvent("settings_hospital_profile_viewed");
    let isMounted = true;

    getHospitalProfileSettings()
      .then((settings) => {
        if (!isMounted) return;
        setProfile(settings);
        setInitialProfile(settings);
        setLogoPreview(settings.logoUrl);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Unable to load hospital profile.";
        setNotice(message);
        setNoticeTone("error");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    };
  }, []);

  function updateField(field: keyof HospitalProfileSettings, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validType = file.type === "image/png" || file.type === "image/jpeg";
    if (!validType) {
      toast.error("Upload a PNG or JPG logo.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    const preview = URL.createObjectURL(file);
    logoPreviewRef.current = preview;
    setPendingLogoFile(file);
    setLogoPreview(preview);
    setNotice("Logo selected. Save configuration to upload it.");
    setNoticeTone("info");
    capturePostHogEvent("settings_logo_selected", { file_type: file.type, file_size: file.size });
  }

  function removeLogo() {
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    logoPreviewRef.current = "";
    setPendingLogoFile(null);
    setLogoPreview("");
    setProfile((current) => ({ ...current, logoUrl: "" }));
    setNotice("Logo will be removed when you save configuration.");
    setNoticeTone("info");
  }

  function resetProfile() {
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    logoPreviewRef.current = "";
    setPendingLogoFile(null);
    setProfile(initialProfile);
    setLogoPreview(initialProfile.logoUrl);
    setNotice("Hospital profile has been reset to the last loaded values.");
    setNoticeTone("info");
    capturePostHogEvent("settings_hospital_profile_reset");
  }

  async function saveProfile() {
    setIsSaving(true);
    setNotice("");

    try {
      let nextProfile = profile;
      if (pendingLogoFile) {
        const logoUrl = await uploadHospitalLogo(profile.facilityId, pendingLogoFile);
        nextProfile = { ...profile, logoUrl };
      }

      const savedProfile = await updateHospitalProfileSettings(nextProfile);
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = "";
      setPendingLogoFile(null);
      setProfile(savedProfile);
      setInitialProfile(savedProfile);
      setLogoPreview(savedProfile.logoUrl);
      setNotice("Hospital profile saved successfully.");
      setNoticeTone("success");
      capturePostHogEvent("settings_hospital_profile_saved", { mode: "api" });
      toast.success("Hospital profile saved.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save hospital profile.";
      setNotice(message);
      setNoticeTone("error");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <SettingsHeader title="Hospital Profile" description="Manage your hospital's information" />

      <SettingsPanel
        title="Hospital Profile"
        hideHeader
        footer={
          <>
            <Button type="button" onClick={() => void saveProfile()} disabled={isSaving} className="h-11 rounded-lg px-5 font-semibold">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </Button>
            <Button type="button" variant="outline" onClick={resetProfile} disabled={isSaving} className="h-11 rounded-lg px-5 font-semibold">
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
          </>
        }
      >
        {isLoading ? (
          <div className="animate-pulse space-y-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="h-28 w-28 shrink-0 rounded-full bg-muted" />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <div className="h-10 w-36 rounded-lg bg-muted" />
                  <div className="h-10 w-32 rounded-lg bg-muted" />
                </div>
                <div className="h-4 w-56 rounded bg-muted" />
              </div>
            </div>
            <div className="grid gap-7 md:grid-cols-2">
              <div className="h-11 rounded-lg bg-muted md:col-span-2" />
              <div className="h-11 rounded-lg bg-muted md:col-span-2" />
              <div className="h-11 rounded-lg bg-muted" />
              <div className="h-11 rounded-lg bg-muted" />
              <div className="h-11 rounded-lg bg-muted" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div
                aria-label="Hospital logo preview"
                className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary bg-cover bg-center text-4xl font-semibold text-primary-foreground"
                role="img"
                style={logoPreview ? { backgroundImage: `url(${logoPreview})` } : undefined}
              >
                {logoPreview ? null : initials(profile.name)}
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Button type="button" asChild disabled={isSaving} className="h-10 rounded-lg px-4 text-sm font-semibold">
                    <label>
                      <ImagePlus className="h-4 w-4" />
                      Change Image
                      <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} disabled={isSaving} className="sr-only" />
                    </label>
                  </Button>
                  <Button type="button" variant="outline" onClick={removeLogo} disabled={isSaving} className="h-10 rounded-lg px-4 text-sm font-semibold text-muted-foreground">
                    <X className="h-4 w-4" />
                    Remove image
                  </Button>
                </div>
                <p className="text-base text-muted-foreground">We support PNGs, JPGs max size 2MB</p>
              </div>
            </div>

            <div className="grid gap-7 md:grid-cols-2">
              <Field label="Hospital Name" className="md:col-span-2">
                <Input value={profile.name} onChange={(event) => updateField("name", event.target.value)} disabled={isSaving} className={inputClassName} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <Input value={profile.address} onChange={(event) => updateField("address", event.target.value)} disabled={isSaving} className={inputClassName} />
              </Field>
              <Field label="Contact Email">
                <Input type="email" value={profile.contactEmail} onChange={(event) => updateField("contactEmail", event.target.value)} disabled={isSaving} className={inputClassName} />
              </Field>
              <Field label="Contact Phone">
                <Input value={profile.contactPhone} onChange={(event) => updateField("contactPhone", event.target.value)} disabled={isSaving} className={inputClassName} />
              </Field>
              <Field label="Timezone">
                <Select value={profile.timezone} onValueChange={(value) => updateField("timezone", value)} disabled={isSaving}>
                  <SelectTrigger className={selectClassName}>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((timezone) => (
                      <SelectItem key={timezone} value={timezone}>{timezone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {notice ? <SaveNotice tone={noticeTone}>{notice}</SaveNotice> : null}
          </>
        )}
      </SettingsPanel>
    </div>
  );
}
