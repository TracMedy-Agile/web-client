"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Field, inputClassName, SaveNotice, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getHospitalProfileSettings, type HospitalProfileSettings } from "@/lib/api/settings";

const defaultProfile: HospitalProfileSettings = {
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
  const [notice, setNotice] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
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
    setLogoPreview(preview);
    setNotice("");
    capturePostHogEvent("settings_logo_selected", { file_type: file.type, file_size: file.size });
  }

  function removeLogo() {
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    logoPreviewRef.current = "";
    setLogoPreview("");
    setProfile((current) => ({ ...current, logoUrl: "" }));
  }

  function resetProfile() {
    setProfile(initialProfile);
    setLogoPreview(initialProfile.logoUrl);
    setNotice("Hospital profile has been reset to the last loaded values.");
    capturePostHogEvent("settings_hospital_profile_reset");
  }

  function saveProfile() {
    setInitialProfile(profile);
    setNotice("Hospital profile changes are ready, but the backend has no settings update endpoint yet.");
    capturePostHogEvent("settings_hospital_profile_saved", { mode: "local_ready" });
    toast.info("Backend settings update endpoint is not available yet.");
  }

  return (
    <div>
      <SettingsHeader title="Hospital Profile" description="Manage the hospital identity and contact details patients and staff see across Tracmedy." />

      <SettingsPanel
        title="Hospital Profile"
        description="Upload a hospital logo and keep core facility details accurate. PNG/JPG logo uploads support up to 2MB."
        footer={
          <>
            <Button type="button" variant="outline" onClick={resetProfile} className="h-11 rounded-lg px-5 font-semibold">
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
            <Button type="button" onClick={saveProfile} className="h-11 rounded-lg px-5 font-semibold">
              <Save className="h-4 w-4" />
              Save Configuration
            </Button>
          </>
        }
      >
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center text-sm font-semibold text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
            Loading hospital profile...
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div
                  aria-label="Hospital logo preview"
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary bg-cover bg-center text-xl font-bold text-primary-foreground"
                  role="img"
                  style={logoPreview ? { backgroundImage: `url(${logoPreview})` } : undefined}
                >
                  {logoPreview ? null : initials(profile.name)}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Hospital Logo</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Recommended square PNG or JPG, maximum 2MB.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" asChild className="h-10 rounded-lg px-4 text-sm font-semibold">
                  <label>
                    <ImagePlus className="h-4 w-4" />
                    Change Image
                    <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="sr-only" />
                  </label>
                </Button>
                <Button type="button" variant="outline" onClick={removeLogo} className="h-10 rounded-lg px-4 text-sm font-semibold">
                  <X className="h-4 w-4" />
                  Remove image
                </Button>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Hospital Name">
                <Input value={profile.name} onChange={(event) => updateField("name", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Contact Phone">
                <Input value={profile.contactPhone} onChange={(event) => updateField("contactPhone", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <Input value={profile.address} onChange={(event) => updateField("address", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Contact Email">
                <Input type="email" value={profile.contactEmail} onChange={(event) => updateField("contactEmail", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Timezone">
                <Select value={profile.timezone} onValueChange={(value) => updateField("timezone", value)}>
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

            {notice ? <SaveNotice>{notice}</SaveNotice> : null}
          </>
        )}
      </SettingsPanel>
    </div>
  );
}
