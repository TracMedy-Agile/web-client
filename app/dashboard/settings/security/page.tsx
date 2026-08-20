"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Field, inputClassName, SaveNotice, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { changeCurrentPassword } from "@/lib/api/settings";

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [maxLoginAttempts, setMaxLoginAttempts] = useState("3");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");

  useEffect(() => {
    capturePostHogEvent("settings_security_viewed");
  }, []);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    if (newPassword.length < 8) {
      setNotice("New password must be at least 8 characters.");
      setNoticeTone("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice("New password and confirmation do not match.");
      setNoticeTone("error");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeCurrentPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated successfully.");
      setNoticeTone("success");
      capturePostHogEvent("settings_password_changed");
      toast.success("Password updated.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to update password.";
      setNotice(message);
      setNoticeTone("error");
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  }

  function saveSecurityPreferences() {
    setNotice("Security preferences are ready, but 2FA, session timeout, login attempt, and session management endpoints are not available yet.");
    setNoticeTone("info");
    capturePostHogEvent("settings_security_saved", { mode: "local_ready" });
    toast.info("Security settings endpoint is not available yet.");
  }

  return (
    <div>
      <SettingsHeader title="Security" description="Manage authentication and session settings." />

      <div className="space-y-6">
        <SettingsPanel title="Change Password">
          <form onSubmit={(event) => void handlePasswordSubmit(event)} className="space-y-7">
            <Field label="Current Password">
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Enter current password" className={inputClassName} required />
            </Field>
            <Field label="New Password">
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Enter new password" className={inputClassName} required />
            </Field>
            <Field label="Confirm New Password">
              <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat new password" className={inputClassName} required />
            </Field>
            <Button type="submit" disabled={isChangingPassword} className="h-11 rounded-lg px-5 font-semibold">
              {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Update Password
            </Button>
          </form>
        </SettingsPanel>

        <SettingsPanel title="Account Protection" hideHeader>
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-medium text-foreground">Two Factor Authentication</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} aria-label="Toggle two factor authentication" />
          </div>

          <div className="grid gap-5 rounded-xl border border-border bg-card p-5 md:grid-cols-2">
            <Field label="Session Timeout">
              <Select value={sessionTimeout} onValueChange={setSessionTimeout}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 minutes</SelectItem><SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">1 hour</SelectItem><SelectItem value="120">2 hours</SelectItem></SelectContent></Select>
              <span className="block text-sm leading-5 text-muted-foreground">Auto-logout after 30 minutes of inactivity</span>
            </Field>
            <Field label="Max Login Attempt">
              <Select value={maxLoginAttempts} onValueChange={setMaxLoginAttempts}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">3</SelectItem><SelectItem value="4">4</SelectItem><SelectItem value="5">5</SelectItem></SelectContent></Select>
              <span className="block text-sm leading-5 text-muted-foreground">max login attempt cannot exceed 5</span>
            </Field>
          </div>

          <div className="space-y-3 pl-5">
            <h3 className="text-xl font-bold text-foreground">Active sessions</h3>
            <Button type="button" variant="outline" onClick={saveSecurityPreferences} className="h-11 rounded-lg border-destructive px-5 font-semibold text-destructive hover:text-destructive">Log out all devices</Button>
          </div>

          {notice ? <SaveNotice tone={noticeTone}>{notice}</SaveNotice> : null}
        </SettingsPanel>
      </div>
    </div>
  );
}
