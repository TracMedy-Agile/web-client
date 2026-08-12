"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Laptop, Loader2, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Field, inputClassName, SaveNotice, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { changeCurrentPassword } from "@/lib/api/settings";

const activeSessions = [
  { id: "current", device: "Chrome on Windows", location: "Lagos, Nigeria", lastActive: "Current session" },
  { id: "mobile", device: "Safari on iPhone", location: "Lagos, Nigeria", lastActive: "2 hours ago" },
];

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [maxLoginAttempts, setMaxLoginAttempts] = useState("5");
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
      <SettingsHeader title="Security" description="Manage password access, session controls, and account protection settings for this hospital workspace." />

      <div className="space-y-5">
        <SettingsPanel title="Change Password" description="Update the password for your current hospital account.">
          <form onSubmit={(event) => void handlePasswordSubmit(event)} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Current Password">
                <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClassName} required />
              </Field>
              <Field label="New Password">
                <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClassName} required />
              </Field>
              <Field label="Confirm Password">
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClassName} required />
              </Field>
            </div>
            <Button type="submit" disabled={isChangingPassword} className="h-11 rounded-lg px-5 font-semibold">
              {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Update Password
            </Button>
          </form>
        </SettingsPanel>

        <SettingsPanel title="Account Protection" description="Configure login security and session behavior." footer={<Button type="button" onClick={saveSecurityPreferences} className="h-11 rounded-lg px-5 font-semibold"><Save className="h-4 w-4" />Save Security Settings</Button>}>
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" aria-hidden /></span><div><p className="text-sm font-bold text-foreground">Two Factor Authentication</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Require an additional verification step for hospital staff sign-in.</p></div></div>
            <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} aria-label="Toggle two factor authentication" />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Session Timeout">
              <Select value={sessionTimeout} onValueChange={setSessionTimeout}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 minutes</SelectItem><SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">1 hour</SelectItem><SelectItem value="120">2 hours</SelectItem></SelectContent></Select>
            </Field>
            <Field label="Max Login Attempt" hint="For safety, this cannot exceed 5 attempts.">
              <Select value={maxLoginAttempts} onValueChange={setMaxLoginAttempts}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">3 attempts</SelectItem><SelectItem value="4">4 attempts</SelectItem><SelectItem value="5">5 attempts</SelectItem></SelectContent></Select>
            </Field>
          </div>

          <div>
            <h3 className="text-base font-bold text-foreground">Active Sessions</h3>
            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
              {activeSessions.map((session) => (
                <div key={session.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm"><Laptop className="h-5 w-5" aria-hidden /></span><div><p className="text-sm font-bold text-foreground">{session.device}</p><p className="mt-1 text-sm text-muted-foreground">{session.location} - {session.lastActive}</p></div></div>
                  {session.id === "current" ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Current</span> : null}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={saveSecurityPreferences} className="mt-4 h-10 rounded-lg font-semibold text-destructive hover:text-destructive"><LockKeyhole className="h-4 w-4" />Log out all devices</Button>
          </div>

          {notice ? <SaveNotice tone={noticeTone}>{notice}</SaveNotice> : null}
        </SettingsPanel>
      </div>
    </div>
  );
}
