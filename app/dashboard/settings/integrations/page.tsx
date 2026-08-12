"use client";

import { useEffect, useState } from "react";
import { Cable, Copy, Eye, EyeOff, KeyRound, Link2, LockKeyhole, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

const maskedKey = "tm_live_••••••••••••••••••••9f2a";
const revealedKey = "tm_live_staging_contract_pending_9f2a";

export default function IntegrationsPage() {
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    capturePostHogEvent("settings_integrations_viewed");
  }, []);

  function unavailable(action: string) {
    setNotice(`${action} is waiting for backend integration contracts.`);
    capturePostHogEvent("settings_integration_action_unavailable", { action });
    toast.info("Integration endpoint is not available yet.");
  }

  async function copyKey() {
    await navigator.clipboard.writeText(revealed ? revealedKey : maskedKey);
    toast.success("API key copied.");
  }

  return (
    <div>
      <SettingsHeader title="Integrations" description="Connect external hospital systems and manage workspace API access." />
      <SettingsPanel title="Integrations" description="EHR and API access controls are shown here. Backend contracts are still required before connection actions can persist.">
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Cable className="h-6 w-6" /></span>
              <div><h2 className="text-lg font-bold text-foreground">EHR Integration</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Connect Tracmedy to your hospital electronic health record system for synchronized patient and appointment context.</p></div>
            </div>
            <div className="mt-5 rounded-lg border border-dashed border-border bg-card p-4"><p className="text-sm font-bold text-foreground">Connection Status</p><p className="mt-1 text-sm text-muted-foreground">Not connected</p></div>
            <Button type="button" onClick={() => unavailable("Connect EHR")} className="mt-5 h-11 rounded-lg px-5 font-semibold"><Link2 className="h-4 w-4" />Connect EHR</Button>
          </section>

          <section className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound className="h-6 w-6" /></span>
              <div><h2 className="text-lg font-bold text-foreground">API Access</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use a workspace API key for approved server-side integrations once backend key management is available.</p></div>
            </div>
            <div className="mt-5 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-bold text-foreground">Workspace API Key</p>
              <div className="mt-3 flex min-h-11 flex-col gap-3 rounded-lg border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <code className="break-all text-sm font-bold text-foreground">{revealed ? revealedKey : maskedKey}</code>
                <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setRevealed((value) => !value)} className="h-9 rounded-lg">{revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{revealed ? "Hide" : "Reveal"}</Button><Button type="button" variant="outline" size="sm" onClick={() => void copyKey()} className="h-9 rounded-lg"><Copy className="h-4 w-4" />Copy</Button></div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => unavailable("Regenerate API key")} className="h-10 rounded-lg font-semibold"><RotateCw className="h-4 w-4" />Regenerate</Button><Button type="button" variant="outline" onClick={() => unavailable("Revoke API key")} className="h-10 rounded-lg font-semibold text-destructive hover:text-destructive"><LockKeyhole className="h-4 w-4" />Revoke</Button></div>
          </section>
        </div>
        {notice ? <SaveNotice>{notice}</SaveNotice> : null}
      </SettingsPanel>
    </div>
  );
}
