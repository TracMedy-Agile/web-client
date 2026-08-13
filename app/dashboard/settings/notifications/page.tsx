"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, Loader2, Mail, MessageSquareText, RotateCcw, Save, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { defaultNotificationPreferences, getNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from "@/lib/api/settings";

type PreferenceRowConfig = {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
};

const rows: PreferenceRowConfig[] = [
  {
    key: "emailNotifications",
    title: "Email Notifications for Alerts",
    description: "Send alert updates and escalation summaries to the configured hospital email.",
    icon: Mail,
  },
  {
    key: "inAppNotifications",
    title: "In-App Notifications",
    description: "Show real-time updates inside the hospital dashboard notification center.",
    icon: Bell,
  },
  {
    key: "smsAlerts",
    title: "SMS Alerts",
    description: "Send critical alert notifications by SMS when the SMS channel is available.",
    icon: Smartphone,
    disabled: true,
    badge: "Coming soon",
  },
  {
    key: "dailySummaryReportEmail",
    title: "Daily Summary Report Email",
    description: "Email a daily overview of care episodes, alerts, appointments, and workload activity.",
    icon: MessageSquareText,
  },
];

function PreferenceRow({ row, checked, onChange }: { row: PreferenceRowConfig; checked: boolean; onChange: (checked: boolean) => void }) {
  const Icon = row.icon;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground">{row.title}</p>
            {row.badge ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{row.badge}</span> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.description}</p>
        </div>
      </div>
      <Switch checked={checked} disabled={row.disabled} onCheckedChange={onChange} aria-label={`Toggle ${row.title}`} />
    </div>
  );
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [initialPreferences, setInitialPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");

  useEffect(() => {
    capturePostHogEvent("settings_notifications_viewed");
    let isMounted = true;

    getNotificationPreferences()
      .then((loadedPreferences) => {
        if (!isMounted) return;
        setPreferences(loadedPreferences);
        setInitialPreferences(loadedPreferences);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Unable to load notification preferences.";
        setNotice(message);
        setNoticeTone("error");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updatePreference(key: keyof NotificationPreferences, checked: boolean) {
    setPreferences((current) => ({ ...current, [key]: checked }));
    setNotice("");
  }

  function resetPreferences() {
    setPreferences(initialPreferences);
    setNotice("Notification preferences have been reset to the last loaded values.");
    setNoticeTone("info");
    capturePostHogEvent("settings_notifications_reset");
  }

  async function savePreferences() {
    setIsSaving(true);
    setNotice("");
    try {
      await saveNotificationPreferences(preferences);
      setInitialPreferences(preferences);
      setNotice("Notification preferences saved successfully.");
      setNoticeTone("success");
      capturePostHogEvent("settings_notifications_saved");
      toast.success("Notification preferences saved.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save notification preferences.";
      setNotice(message);
      setNoticeTone("error");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <SettingsHeader title="Notification Preferences" description="Choose which alert and operational updates should reach hospital staff from this dashboard." />

      <SettingsPanel
        title="Notification Preferences"
        description="Manage email, in-app, SMS, and daily summary notification behavior."
        footer={
          <>
            <Button type="button" variant="outline" onClick={resetPreferences} disabled={isSaving} className="h-11 rounded-lg px-5 font-semibold">
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
            <Button type="button" onClick={() => void savePreferences()} disabled={isSaving} className="h-11 rounded-lg px-5 font-semibold">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Preferences
            </Button>
          </>
        }
      >
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center text-sm font-semibold text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
            Loading notification preferences...
          </div>
        ) : (
          <>
            <div className="divide-y divide-border rounded-lg border border-border bg-background">
              {rows.map((row) => (
                <PreferenceRow key={row.key} row={row} checked={preferences[row.key]} onChange={(checked) => updatePreference(row.key, checked)} />
              ))}
            </div>

            {notice ? <SaveNotice tone={noticeTone}>{notice}</SaveNotice> : null}
          </>
        )}
      </SettingsPanel>
    </div>
  );
}
