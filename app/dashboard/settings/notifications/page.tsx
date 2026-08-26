"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { defaultNotificationPreferences, getNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from "@/lib/api/settings";

type PreferenceRowConfig = {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  disabled?: boolean;
};

const rows: PreferenceRowConfig[] = [
  {
    key: "emailNotifications",
    title: "Email Notifications for Alerts",
    description: "Receive email when an alert is created",
  },
  {
    key: "inAppNotifications",
    title: "In-App Notifications",
    description: "Show real-time alerts in the platform",
  },
  {
    key: "smsAlerts",
    title: "SMS Alerts",
    description: "Coming soon — SMS for critical alerts",
    disabled: true,
  },
  {
    key: "dailySummaryReportEmail",
    title: "Daily Summary Report Email",
    description: "Receive a daily digest at 7:00 AM",
  },
];

function PreferenceRow({ row, checked, onChange }: { row: PreferenceRowConfig; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex min-h-[77px] flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">{row.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.description}</p>
      </div>
      <Switch checked={checked} disabled={row.disabled} onCheckedChange={onChange} aria-label={`Toggle ${row.title}`} />
    </div>
  );
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");

  useEffect(() => {
    capturePostHogEvent("settings_notifications_viewed");
    let isMounted = true;

    getNotificationPreferences()
      .then((loadedPreferences) => {
        if (!isMounted) return;
        setPreferences(loadedPreferences);
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
    const nextPreferences = { ...preferences, [key]: checked };
    setPreferences(nextPreferences);
    setNotice("");
    saveNotificationPreferences(nextPreferences)
      .then(() => {
        setNotice("Notification preferences saved successfully.");
        setNoticeTone("success");
        capturePostHogEvent("settings_notifications_saved");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to save notification preferences.";
        setNotice(message);
        setNoticeTone("error");
        toast.error(message);
      });
  }

  return (
    <div>
      <SettingsHeader title="Notification Preferences" description="Control how and when you receive alerts" />

      <SettingsPanel title="Notification Preferences" hideHeader>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {rows.map((row) => (
              <div key={row.key} className="flex min-h-[77px] items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
                <div className="space-y-2">
                  <div className="h-4 w-52 rounded bg-muted" />
                  <div className="h-3 w-72 rounded bg-muted/70" />
                </div>
                <div className="h-6 w-11 shrink-0 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
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
