"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Clock3, RotateCcw, Save, Video } from "lucide-react";
import { toast } from "sonner";

import { Field, SaveNotice, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

type AppointmentSettings = {
  defaultDuration: number;
  checkInWindowBefore: string;
  checkInWindowAfter: string;
  allowVirtualConsultations: boolean;
  requireClinicianAssignment: boolean;
  autoConfirmFollowUps: boolean;
  dailyCapacity: number;
};

const defaults: AppointmentSettings = {
  defaultDuration: 30,
  checkInWindowBefore: "30",
  checkInWindowAfter: "15",
  allowVirtualConsultations: true,
  requireClinicianAssignment: true,
  autoConfirmFollowUps: false,
  dailyCapacity: 24,
};

export default function AppointmentSettingsPage() {
  const [settings, setSettings] = useState(defaults);
  const [savedSettings, setSavedSettings] = useState(defaults);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    capturePostHogEvent("settings_appointment_viewed");
  }, []);

  function updateSettings(partial: Partial<AppointmentSettings>) {
    setSettings((current) => ({ ...current, ...partial }));
    setNotice("");
  }

  function resetSettings() {
    setSettings(savedSettings);
    setNotice("Appointment settings have been reset to the last saved values.");
    capturePostHogEvent("settings_appointment_reset");
  }

  function saveSettings() {
    setSavedSettings(settings);
    setNotice("Appointment settings are ready, but the backend has no appointment settings update endpoint yet.");
    capturePostHogEvent("settings_appointment_saved", { mode: "local_ready" });
    toast.info("Appointment settings endpoint is not available yet.");
  }

  return (
    <div>
      <SettingsHeader title="Appointment" description="Control appointment defaults, check-in windows, virtual care access, and daily booking capacity." />
      <SettingsPanel title="Appointment Settings" description="These defaults guide scheduling behavior across hospital appointment workflows." footer={<><Button type="button" variant="outline" onClick={resetSettings} className="h-11 rounded-lg px-5 font-semibold"><RotateCcw className="h-4 w-4" />Reset to Default</Button><Button type="button" onClick={saveSettings} className="h-11 rounded-lg px-5 font-semibold"><Save className="h-4 w-4" />Save Appointment Settings</Button></>}>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Default Appointment Duration">
            <Select value={String(settings.defaultDuration)} onValueChange={(value) => updateSettings({ defaultDuration: Number(value) })}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 minutes</SelectItem><SelectItem value="30">30 minutes</SelectItem><SelectItem value="45">45 minutes</SelectItem><SelectItem value="60">60 minutes</SelectItem></SelectContent></Select>
          </Field>
          <Field label="Check-in Opens">
            <Select value={settings.checkInWindowBefore} onValueChange={(value) => updateSettings({ checkInWindowBefore: value })}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 minutes before</SelectItem><SelectItem value="30">30 minutes before</SelectItem><SelectItem value="45">45 minutes before</SelectItem></SelectContent></Select>
          </Field>
          <Field label="Late Check-in Grace">
            <Select value={settings.checkInWindowAfter} onValueChange={(value) => updateSettings({ checkInWindowAfter: value })}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10 minutes after</SelectItem><SelectItem value="15">15 minutes after</SelectItem><SelectItem value="20">20 minutes after</SelectItem></SelectContent></Select>
          </Field>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="h-5 w-5" aria-hidden /></span><div><p className="text-sm font-bold text-foreground">Daily Appointment Capacity</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Set the safe number of appointments the facility can accept per day.</p></div></div>
            <span className="inline-flex h-8 w-fit items-center rounded-full bg-primary/10 px-3 text-sm font-bold text-primary">{settings.dailyCapacity} slots</span>
          </div>
          <Slider value={[settings.dailyCapacity]} min={4} max={60} step={1} onValueChange={([dailyCapacity]) => updateSettings({ dailyCapacity: dailyCapacity ?? settings.dailyCapacity })} className="mt-5" />
        </div>

        <div className="divide-y divide-border rounded-lg border border-border bg-background">
          <ToggleRow icon={<Video className="h-5 w-5" />} title="Allow Virtual Consultations" description="Enable virtual appointment types for clinicians and patients." checked={settings.allowVirtualConsultations} onChange={(allowVirtualConsultations) => updateSettings({ allowVirtualConsultations })} />
          <ToggleRow icon={<Clock3 className="h-5 w-5" />} title="Require Clinician Assignment" description="Appointments must have a clinician assigned before confirmation." checked={settings.requireClinicianAssignment} onChange={(requireClinicianAssignment) => updateSettings({ requireClinicianAssignment })} />
          <ToggleRow icon={<CalendarClock className="h-5 w-5" />} title="Auto-confirm Follow-ups" description="Automatically confirm follow-up appointments created during care episode closure." checked={settings.autoConfirmFollowUps} onChange={(autoConfirmFollowUps) => updateSettings({ autoConfirmFollowUps })} />
        </div>

        {notice ? <SaveNotice>{notice}</SaveNotice> : null}
      </SettingsPanel>
    </div>
  );
}

function ToggleRow({ icon, title, description, checked, onChange }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3"><span className="mt-0.5 text-primary">{icon}</span><div><p className="text-sm font-bold text-foreground">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div></div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
