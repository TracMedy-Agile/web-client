"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { InfoBanner, SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

type ConfigurationState = {
  episodeDuration: number;
  autoCloseAfter: number;
  requireClinicianApproval: boolean;
  escalationRoles: {
    doctor: boolean;
    nurse: boolean;
    hospitalAdmin: boolean;
  };
};

const defaults: ConfigurationState = {
  episodeDuration: 14,
  autoCloseAfter: 14,
  requireClinicianApproval: true,
  escalationRoles: {
    doctor: true,
    nurse: true,
    hospitalAdmin: true,
  },
};

const roleRows = [
  { key: "doctor", label: "Doctor", description: "Escalate clinical-critical alerts to doctors on duty." },
  { key: "nurse", label: "Nurse", description: "Notify nursing staff when patient monitoring needs immediate review." },
  { key: "hospitalAdmin", label: "Hospital Admin", description: "Include administrators for operational escalation coverage." },
] as const;

function SliderRow({ label, description, value, onChange }: { label: string; description: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <span className="inline-flex h-8 w-fit items-center rounded-full bg-primary/10 px-3 text-sm font-bold text-primary">{value} days</span>
      </div>
      <Slider value={[value]} min={1} max={90} step={1} onValueChange={([nextValue]) => onChange(nextValue ?? value)} className="mt-5" />
      <div className="mt-3 flex justify-between text-xs font-semibold text-muted-foreground">
        <span>1 day</span>
        <span>90 days</span>
      </div>
    </div>
  );
}

export default function ConfigurationPage() {
  const [configuration, setConfiguration] = useState<ConfigurationState>(defaults);
  const [savedConfiguration, setSavedConfiguration] = useState<ConfigurationState>(defaults);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    capturePostHogEvent("settings_configuration_viewed");
  }, []);

  function updateConfiguration(partial: Partial<ConfigurationState>) {
    setConfiguration((current) => ({ ...current, ...partial }));
    setNotice("");
  }

  function updateRole(role: keyof ConfigurationState["escalationRoles"], checked: boolean) {
    setConfiguration((current) => ({
      ...current,
      escalationRoles: { ...current.escalationRoles, [role]: checked },
    }));
    setNotice("");
  }

  function resetConfiguration() {
    setConfiguration(savedConfiguration);
    setNotice("Configuration has been reset to the last saved values.");
    capturePostHogEvent("settings_configuration_reset");
  }

  function saveConfiguration() {
    setSavedConfiguration(configuration);
    setNotice("Configuration changes are ready, but the backend has no settings update endpoint yet.");
    capturePostHogEvent("settings_configuration_saved", { mode: "local_ready" });
    toast.info("Backend settings update endpoint is not available yet.");
  }

  return (
    <div>
      <SettingsHeader title="Configuration" description="Control default care episode rules and escalation behavior for hospital workflows." />

      <SettingsPanel
        title="Care Configuration"
        description="Set default episode timing and decide how closure approvals should behave."
        footer={
          <>
            <Button type="button" variant="outline" onClick={resetConfiguration} className="h-11 rounded-lg px-5 font-semibold">
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
            <Button type="button" onClick={saveConfiguration} className="h-11 rounded-lg px-5 font-semibold">
              <Save className="h-4 w-4" />
              Save Configuration
            </Button>
          </>
        }
      >
        <SliderRow
          label="Default Episode Duration"
          description="New episodes run for this number of days unless extended by a clinician."
          value={configuration.episodeDuration}
          onChange={(episodeDuration) => updateConfiguration({ episodeDuration })}
        />

        <SliderRow
          label="Auto-Close Inactive Episodes"
          description="Episodes with no patient activity for this number of days are closed for review."
          value={configuration.autoCloseAfter}
          onChange={(autoCloseAfter) => updateConfiguration({ autoCloseAfter })}
        />

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Require Clinician Approval to Close</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Episodes can only be closed after explicit clinician sign-off, even when auto-close triggers.</p>
            </div>
          </div>
          <Switch checked={configuration.requireClinicianApproval} onCheckedChange={(requireClinicianApproval) => updateConfiguration({ requireClinicianApproval })} aria-label="Require clinician approval to close" />
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground">Critical Alert Escalation Roles</h3>
          <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
            {roleRows.map((role) => (
              <div key={role.key} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{role.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{role.description}</p>
                </div>
                <Switch checked={configuration.escalationRoles[role.key]} onCheckedChange={(checked) => updateRole(role.key, checked)} aria-label={`Toggle ${role.label} escalation`} />
              </div>
            ))}
          </div>
        </div>

        <InfoBanner>
          Role-based defaults help keep escalation paths consistent. Custom permissions from Team Management still control what each staff member can access.
        </InfoBanner>

        {notice ? <SaveNotice>{notice}</SaveNotice> : null}
      </SettingsPanel>
    </div>
  );
}
