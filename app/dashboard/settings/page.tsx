"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ImagePlus, Loader2, MapPin, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Field, inputClassName, SaveNotice, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { FACILITY_LOCATION_SELECTED_EVENT, FacilityLocationPicker } from "@/components/dashboard/FacilityLocationPicker";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getHospitalProfileSettings, type HospitalProfileSettings, updateHospitalLocation, updateHospitalProfileSettings, uploadHospitalCover, uploadHospitalLogo } from "@/lib/api/settings";

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

// Matches POST /facilities/{id}/uploads: PNG/JPEG/WebP, max 2 MB.
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const timezones = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Europe/London", "America/New_York"];

type HospitalProfileTextField = "name" | "contactEmail" | "contactPhone" | "timezone";
type FacilityLocationSelection = { address?: string; latitude?: number; longitude?: number };


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
  const [coverPreview, setCoverPreview] = useState("");
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const coverPreviewRef = useRef("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  function validateImageFile(file: File, label: "Logo" | "Cover photo") {
    if (!IMAGE_ACCEPT.split(",").includes(file.type)) {
      toast.error(`${label} must be a PNG, JPG or WebP image.`);
      return false;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`${label} must be 2MB or smaller.`);
      return false;
    }

    return true;
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !validateImageFile(file, "Logo")) return;

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

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !validateImageFile(file, "Cover photo")) return;

    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    const preview = URL.createObjectURL(file);
    coverPreviewRef.current = preview;
    setPendingCoverFile(file);
    setCoverPreview(preview);
    setNotice("Cover photo selected. Save configuration to upload it.");
    setNoticeTone("info");
    capturePostHogEvent("settings_cover_selected", { file_type: file.type, file_size: file.size });
  }

  function removeCover() {
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
    logoPreviewRef.current = "";
    setPendingLogoFile(null);
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    coverPreviewRef.current = "";
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
        const coverPhotoUrl = await uploadHospitalCover(profile.facilityId, pendingCoverFile);
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
      logoPreviewRef.current = "";
      setPendingLogoFile(null);
      if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
      coverPreviewRef.current = "";
      setPendingCoverFile(null);
      setProfile(savedProfile);
      setInitialProfile(savedProfile);
      setLogoPreview(savedProfile.logoUrl);
      setCoverPreview(savedProfile.coverPhotoUrl);
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
            <div>
              <div className="h-44 rounded-xl bg-muted sm:h-52" />
              <div className="-mt-14 flex items-end gap-4 px-4 sm:-mt-16 sm:px-6">
                <div className="h-28 w-28 shrink-0 rounded-full border-4 border-card bg-muted sm:h-32 sm:w-32" />
                <div className="space-y-2 pb-1">
                  <div className="h-6 w-56 rounded bg-muted" />
                  <div className="h-4 w-40 rounded bg-muted" />
                </div>
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
            <input ref={logoInputRef} type="file" accept={IMAGE_ACCEPT} onChange={handleLogoChange} disabled={isSaving} className="sr-only" tabIndex={-1} aria-hidden />
            <input ref={coverInputRef} type="file" accept={IMAGE_ACCEPT} onChange={handleCoverChange} disabled={isSaving} className="sr-only" tabIndex={-1} aria-hidden />

            <section aria-label="Hospital cover and logo">
              {/* Cover banner: image (or brand gradient) fading into the panel at the bottom. */}
              <div className="relative h-44 overflow-hidden rounded-xl bg-linear-to-br from-primary via-primary/80 to-primary/40 sm:h-52">
                {coverPreview ? (
                  <div role="img" aria-label="Hospital cover photo" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverPreview})` }} />
                ) : null}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-card to-transparent" />

                <div className="absolute right-3 top-3 flex overflow-hidden rounded-lg bg-card/90 shadow-sm backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={isSaving}
                    className="flex h-10 items-center gap-2 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                    Change cover
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={isSaving}
                        aria-label="More cover photo options"
                        className="flex h-10 items-center border-l border-border px-2.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => coverInputRef.current?.click()}>
                        <ImagePlus className="h-4 w-4" />
                        Upload new cover
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={removeCover} disabled={!coverPreview} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Remove cover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Logo overlaps the banner's bottom-left edge; name and address sit beside it. */}
              <div className="relative -mt-14 flex flex-col gap-4 px-4 sm:-mt-16 sm:flex-row sm:items-end sm:px-6">
                <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
                  <div
                    aria-label="Hospital logo"
                    role="img"
                    className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-card bg-primary bg-cover bg-center text-4xl font-semibold text-primary-foreground shadow-md"
                    style={logoPreview ? { backgroundImage: `url(${logoPreview})` } : undefined}
                  >
                    {logoPreview ? null : initials(profile.name)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={isSaving}
                        aria-label="Change hospital logo"
                        className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem onSelect={() => logoInputRef.current?.click()}>
                        <ImagePlus className="h-4 w-4" />
                        Upload new logo
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={removeLogo} disabled={!logoPreview} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Remove logo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="min-w-0 pb-1">
                  <h2 className="truncate text-2xl font-bold text-foreground">{profile.name || "Hospital name"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Hospital workspace</p>
                  {profile.address ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{profile.address}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 px-4 text-xs text-muted-foreground sm:px-6">Logo and cover: PNG, JPG or WebP, max 2MB. Changes upload when you save.</p>
            </section>

            <div className="grid gap-7 md:grid-cols-2">
              <Field label="Hospital Name" className="md:col-span-2">
                <Input value={profile.name} onChange={(event) => updateField("name", event.target.value)} disabled={isSaving} className={inputClassName} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <Input value={profile.address} onChange={(event) => updateAddress(event.target.value)} disabled={isSaving} className={inputClassName} />
              </Field>
              <div className="space-y-2 md:col-span-2" role="group" aria-labelledby="hospital-map-location-label">
                <span id="hospital-map-location-label" className="text-sm font-bold text-foreground">Map Location</span>
                <FacilityLocationPicker latitude={profile.latitude} longitude={profile.longitude} address={profile.address} disabled={isSaving || isLoading} />
              </div>
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
