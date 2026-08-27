"use client";

import { useEffect, useState } from "react";
import { Building2, RotateCcw, Save, Stethoscope, Syringe } from "lucide-react";
import { toast } from "sonner";

import { InfoBanner, SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

const roleIcons = {
  doctor: Stethoscope,
  nurse: Syringe,
  hospitalAdmin: Building2,
} as const;

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
    hospitalAdmin: false,
  },
};

const roleRows = [
  { key: "doctor", label: "Doctor", description: "New users assigned this role must verify their WhatsApp number and provide consent during onboarding." },
  { key: "nurse", label: "Nurse", description: "New users assigned this role must verify their WhatsApp number and provide consent during onboarding." },
  { key: "hospitalAdmin", label: "Hospital Admin", description: "Users with this role are not eligible for clinical alert escalation by default." },
] as const;

function SliderRow({ label, description, value, onChange }: { label: string; description: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="border-b border-border pb-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span className="inline-flex h-8 items-center rounded-lg bg-muted px-3 text-sm font-bold text-foreground">{value} days</span>
      </div>
      <Slider value={[value]} min={1} max={90} step={1} onValueChange={([nextValue]) => onChange(nextValue ?? value)} />
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
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
      <SettingsHeader title="Care Configuration" description="Configure how the system manages patient care." />

      <SettingsPanel
        title="Care Configuration"
        hideHeader
        footer={
          <>
            <Button type="button" onClick={saveConfiguration} className="h-11 rounded-lg px-5 font-semibold">
              <Save className="h-4 w-4" />
              Save Configuration
            </Button>
            <Button type="button" variant="outline" onClick={resetConfiguration} className="h-11 rounded-lg px-5 font-semibold">
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
          </>
        }
      >
        <SliderRow
          label="Default Episode Duration"
          description="New episodes run for 14 days unless extended by a clinician."
          value={configuration.episodeDuration}
          onChange={(episodeDuration) => updateConfiguration({ episodeDuration })}
        />

        <SliderRow
          label="Auto-Close Inactive Episodes After"
          description="Episodes with no patient activity for 14 days are auto-closed for review."
          value={configuration.autoCloseAfter}
          onChange={(autoCloseAfter) => updateConfiguration({ autoCloseAfter })}
        />

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Require Clinician Approval to Close</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Episodes can only be closed after explicit clinician sign-off, even when auto-close triggers.</p>
          </div>
          <Switch checked={configuration.requireClinicianApproval} onCheckedChange={(requireClinicianApproval) => updateConfiguration({ requireClinicianApproval })} aria-label="Require clinician approval to close" />
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-bold text-foreground">Critical Alert Escalation Roles</h3>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">Configure which team roles are eligible to receive WhatsApp notifications for critical patient-alert escalations.</p>
          <p className="text-sm leading-6 text-muted-foreground">These settings automatically determine onboarding requirements for newly invited team members.</p>
          <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
            {roleRows.map((role) => {
              const Icon = roleIcons[role.key];
              return (
                <div key={role.key} className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-4">
                    <Icon className="mt-1 h-5 w-5 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{role.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <Switch checked={configuration.escalationRoles[role.key]} onCheckedChange={(checked) => updateRole(role.key, checked)} aria-label={`Toggle ${role.label} escalation`} />
                </div>
              );
            })}
          </div>
        </div>

        <InfoBanner>
          <div className="font-bold">Role-based Defaults</div>
          <p className="mt-1">These settings apply only to newly invited team members. Existing team members keep their current escalation settings unless updated individually from the Team module.</p>
        </InfoBanner>

        {notice ? <SaveNotice>{notice}</SaveNotice> : null}
      </SettingsPanel>
    </div>
  );
}
