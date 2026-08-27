"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

const maskedKey = "••••••••••••••••••••••••••••";
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
      <SettingsHeader title="Integrations" description="Connect Tracmedy with your existing tools and systems." />
      <SettingsPanel title="Integrations" hideHeader>
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">EHR Integration</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Connect to your hospital&apos;s Electronic Health Records system</p>
              </div>
              <Button type="button" variant="outline" onClick={() => unavailable("Connect EHR")} className="h-9 rounded-lg text-muted-foreground">Connect</Button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">API Access</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Programmatic access to Tracmedy data via REST API</p>
              </div>
              <Button type="button" variant="outline" onClick={() => unavailable("Connect API access")} className="h-9 rounded-lg text-muted-foreground">Connect</Button>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">API Key</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Input value={revealed ? revealedKey : maskedKey} readOnly className="h-11 flex-1 rounded-lg border-border bg-background text-sm font-semibold" />
                <Button type="button" variant="outline" onClick={() => setRevealed((value) => !value)} className="h-11 rounded-lg text-muted-foreground">
                  {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  Reveal
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyKey()} className="h-11 rounded-lg text-muted-foreground">
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
        {notice ? <SaveNotice>{notice}</SaveNotice> : null}
      </SettingsPanel>
    </div>
  );
}
