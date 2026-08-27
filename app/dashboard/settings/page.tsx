"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Field, inputClassName, SaveNotice, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getHospitalProfileSettings, type HospitalProfileSettings, updateHospitalLocation, updateHospitalProfileSettings, uploadHospitalCoverPhoto, uploadHospitalLogo } from "@/lib/api/settings";

const defaultProfile: HospitalProfileSettings = {
  facilityId: "",
  name: "Lagos General Hospital",
  address: "12 Marina Road, Lagos Island, Lagos",
  latitude: null,
  longitude: null,
  contactEmail: "admin@lagosgeneral.ng",
  contactPhone: "+234 801 000 0001",
  timezone: "Africa/Lagos",
  logoUrl: "",
  coverPhotoUrl: "",
};

const timezones = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Europe/London", "America/New_York"];

type HospitalProfileTextField = "name" | "contactEmail" | "contactPhone" | "timezone";
type FacilityLocationSelection = { address?: string; latitude?: number; longitude?: number };

const FACILITY_LOCATION_SELECTED_EVENT = "tracmedy:facility-location-selected";

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
  const [coverPreview, setCoverPreview] = useState("");
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const logoPreviewRef = useRef("");
  const coverPreviewRef = useRef("");

  useEffect(() => {
    capturePostHogEvent("settings_hospital_profile_viewed");
    let isMounted = true;

    getHospitalProfileSettings()
      .then((settings) => {
        if (!isMounted) return;
        setProfile(settings);
        setInitialProfile(settings);
        setLogoPreview(settings.logoUrl);
        setCoverPreview(settings.coverPhotoUrl);
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
      if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    };
  }, []);

  useEffect(() => {
    function handleFacilityLocationSelected(event: Event) {
      const detail = (event as CustomEvent<FacilityLocationSelection>).detail;
      const latitude = detail && typeof detail.latitude === "number" && Number.isFinite(detail.latitude) ? detail.latitude : null;
      const longitude = detail && typeof detail.longitude === "number" && Number.isFinite(detail.longitude) ? detail.longitude : null;
      if (latitude === null || longitude === null) return;

      setProfile((current) => ({
        ...current,
        address: detail.address || current.address,
        latitude,
        longitude,
      }));
      setNotice("");
    }

    window.addEventListener(FACILITY_LOCATION_SELECTED_EVENT, handleFacilityLocationSelected);
    return () => window.removeEventListener(FACILITY_LOCATION_SELECTED_EVENT, handleFacilityLocationSelected);
  }, []);

  function updateField(field: HospitalProfileTextField, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function updateAddress(value: string) {
    setProfile((current) => ({ ...current, address: value, latitude: null, longitude: null }));
    setNotice("");
  }

  function validateImageFile(file: File, label: "logo" | "cover photo") {
    const validType = file.type === "image/png" || file.type === "image/jpeg";
    if (!validType) {
      toast.error(`Upload a PNG or JPG ${label}.`);
      return false;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(`${label === "logo" ? "Logo" : "Cover photo"} must be 2MB or smaller.`);
      return false;
    }

    return true;
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file, "logo")) {
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

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file, "cover photo")) {
      event.target.value = "";
      return;
    }

    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    const preview = URL.createObjectURL(file);
    coverPreviewRef.current = preview;
    setPendingCoverFile(file);
    setCoverPreview(preview);
    setNotice("Cover photo selected. Save configuration to upload it.");
    setNoticeTone("info");
    capturePostHogEvent("settings_cover_photo_selected", { file_type: file.type, file_size: file.size });
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

  function removeCoverPhoto() {
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    coverPreviewRef.current = "";
    setPendingCoverFile(null);
    setCoverPreview("");
    setProfile((current) => ({ ...current, coverPhotoUrl: "" }));
    setNotice("Cover photo will be removed when you save configuration.");
    setNoticeTone("info");
  }

  function resetProfile() {
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    logoPreviewRef.current = "";
    coverPreviewRef.current = "";
    setPendingLogoFile(null);
    setPendingCoverFile(null);
    setProfile(initialProfile);
    setLogoPreview(initialProfile.logoUrl);
    setCoverPreview(initialProfile.coverPhotoUrl);
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
        nextProfile = { ...nextProfile, logoUrl };
      }
      if (pendingCoverFile) {
        const coverPhotoUrl = await uploadHospitalCoverPhoto(nextProfile.facilityId, pendingCoverFile);
        nextProfile = { ...nextProfile, coverPhotoUrl };
      }

      let savedProfile = await updateHospitalProfileSettings(nextProfile);
      const hasSelectedCoordinates = nextProfile.latitude !== null && nextProfile.longitude !== null;
      const shouldSyncLocation = hasSelectedCoordinates && (nextProfile.latitude !== initialProfile.latitude || nextProfile.longitude !== initialProfile.longitude);
      if (shouldSyncLocation) {
        const location = await updateHospitalLocation(savedProfile.facilityId, {
          latitude: nextProfile.latitude,
          longitude: nextProfile.longitude,
        });
        savedProfile = { ...savedProfile, ...location };
      }

      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
      if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
      logoPreviewRef.current = "";
      coverPreviewRef.current = "";
      setPendingLogoFile(null);
      setPendingCoverFile(null);
      setProfile(savedProfile);
      setInitialProfile(savedProfile);
      setLogoPreview(savedProfile.logoUrl);
      setCoverPreview(savedProfile.coverPhotoUrl);
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
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
                        Change Logo
                        <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} disabled={isSaving} className="sr-only" />
                      </label>
                    </Button>
                    <Button type="button" variant="outline" onClick={removeLogo} disabled={isSaving} className="h-10 rounded-lg px-4 text-sm font-semibold text-muted-foreground">
                      <X className="h-4 w-4" />
                      Remove logo
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">We support PNGs, JPGs max size 2MB</p>
                </div>
              </div>

              <div className="space-y-3">
                <div
                  aria-label="Hospital cover photo preview"
                  className="flex h-28 min-h-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted bg-cover bg-center text-sm font-semibold text-muted-foreground"
                  role="img"
                  style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}
                >
                  {coverPreview ? null : "Cover photo"}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" asChild disabled={isSaving} className="h-10 rounded-lg px-4 text-sm font-semibold">
                    <label>
                      <ImagePlus className="h-4 w-4" />
                      Change Cover
                      <input type="file" accept="image/png,image/jpeg" onChange={handleCoverChange} disabled={isSaving} className="sr-only" />
                    </label>
                  </Button>
                  <Button type="button" variant="outline" onClick={removeCoverPhoto} disabled={isSaving} className="h-10 rounded-lg px-4 text-sm font-semibold text-muted-foreground">
                    <X className="h-4 w-4" />
                    Remove cover
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">We support PNGs, JPGs max size 2MB</p>
              </div>
            </div>

            <div className="grid gap-7 md:grid-cols-2">
              <Field label="Hospital Name" className="md:col-span-2">
                <Input value={profile.name} onChange={(event) => updateField("name", event.target.value)} disabled={isSaving} className={inputClassName} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <Input value={profile.address} onChange={(event) => updateAddress(event.target.value)} disabled={isSaving} className={inputClassName} />
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
