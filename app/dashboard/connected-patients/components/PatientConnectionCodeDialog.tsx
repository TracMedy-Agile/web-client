"use client";

import { useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  createPatientInvite,
  type CreatePatientInviteInput,
  type PatientInvite,
} from "@/lib/api/connected-patients";

type PatientConnectionCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string;
  facilityName: string;
};

type InviteForm = {
  externalPatientId: string;
  patientName: string;
  phone: string;
  email: string;
};

const EMPTY_FORM: InviteForm = {
  externalPatientId: "",
  patientName: "",
  phone: "",
  email: "",
};

function hoursUntil(expiresAt: string) {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return 72;
  return Math.max(1, Math.ceil((expiry - Date.now()) / (60 * 60 * 1000)));
}

function formatGeneratedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function PatientConnectionCodeDialog({
  open,
  onOpenChange,
  facilityId,
  facilityName,
}: PatientConnectionCodeDialogProps) {
  const [form, setForm] = useState<InviteForm>(EMPTY_FORM);
  const [invite, setInvite] = useState<PatientInvite | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateField = (field: keyof InviteForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const generateInvite = async () => {
    if (!facilityId) {
      toast.error("Your facility is still loading. Please try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreatePatientInviteInput = {
        email: form.email.trim(),
        ...(form.externalPatientId.trim()
          ? { externalPatientId: form.externalPatientId.trim() }
          : {}),
      };
      const response = await createPatientInvite(facilityId, input);
      setInvite(response);
      setGeneratedAt(new Date());
      setCopied(false);
      toast.success("Connection code generated successfully.");
      capturePostHogEvent("connection_code_generated", {
        existing_user: response.existingUser,
      });
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate a connection code.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await generateInvite();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      window.setTimeout(() => {
        setForm(EMPTY_FORM);
        setInvite(null);
        setGeneratedAt(null);
        setCopied(false);
        setIsSubmitting(false);
      }, 200);
    }
  };

  const copyCode = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      capturePostHogEvent("connection_code_copied");
      toast.success("Connection code copied.");
    } catch {
      toast.error("Unable to copy the connection code.");
    }
  };

  const shareBySms = () => {
    if (!invite || !form.phone.trim()) {
      toast.error("Add a phone number to send this code by SMS.");
      return;
    }
    const message = encodeURIComponent(
      facilityName + " invited you to connect on Tracmedy. Your one-time connection code is " +
        invite.code + ". It expires in " + hoursUntil(invite.expiresAt) + " hours.",
    );
    capturePostHogEvent("connection_code_sent_sms");
    window.location.href = "sms:" + form.phone.trim() + "?body=" + message;
  };

  const shareByEmail = () => {
    if (!invite) return;
    const subject = encodeURIComponent("Your " + facilityName + " Tracmedy connection code");
    const body = encodeURIComponent(
      "Use the one-time code " + invite.code + " to connect your Tracmedy mobile app to " +
        facilityName + ". This code expires in " + hoursUntil(invite.expiresAt) + " hours.",
    );
    capturePostHogEvent("connection_code_sent_email");
    window.location.href = "mailto:" + invite.email + "?subject=" + subject + "&body=" + body;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl gap-0 overflow-y-auto border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
        {invite ? (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-6 sm:px-8">
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Connection Code Generated
              </DialogTitle>
              <DialogDescription className="sr-only">
                Review and share the one-time patient connection code.
              </DialogDescription>
            </div>

            <div className="space-y-6 px-6 py-6 sm:px-8">
              <section className="rounded-xl border border-slate-300 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-bold text-primary">
                    {form.patientName.trim() || invite.email}
                  </p>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                    {facilityName}
                  </span>
                </div>

                <div className="mt-6 rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 px-4 py-7 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                    Your unique access token
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                    <span className="break-all font-mono text-3xl font-bold tracking-[0.12em] text-primary sm:text-4xl">
                      {invite.code}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copy connection code"
                      onClick={copyCode}
                      className="border-primary text-primary hover:bg-blue-50"
                    >
                      {copied ? <Check /> : <Copy />}
                    </Button>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</dt>
                      <dd className="text-sm font-semibold text-slate-900">Active</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <Clock3 className="h-4 w-4" />
                    </span>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Valid for</dt>
                      <dd className="text-sm font-semibold text-slate-900">{hoursUntil(invite.expiresAt)} Hours</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-primary">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Generated</dt>
                      <dd className="text-sm font-semibold text-slate-900">
                        Today, {generatedAt ? formatGeneratedAt(generatedAt) : "--"}
                      </dd>
                    </div>
                  </div>
                </dl>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" onClick={shareBySms} className="h-12 font-bold">
                  <MessageSquare />
                  Send via SMS
                </Button>
                <Button type="button" onClick={shareByEmail} className="h-12 font-bold">
                  <Mail />
                  Send via Email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={generateInvite}
                  className="h-12 border-primary font-bold text-primary hover:bg-blue-50 sm:col-span-2"
                >
                  <RefreshCw className={isSubmitting ? "animate-spin" : ""} />
                  {isSubmitting ? "Generating..." : "Generate New Code"}
                </Button>
              </div>

              <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  This connection code can only be used once, expires automatically after{" "}
                  {hoursUntil(invite.expiresAt)} hours, and becomes invalid immediately after
                  successful use or when a new code is generated.
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4 sm:px-8">
              <Button type="button" onClick={() => handleOpenChange(false)} className="px-6 font-bold">
                Done
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-6 sm:px-8">
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Generate Patient Connection Code
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Generate a secure one-time connection code that allows a patient to connect
                their Tracmedy mobile app to this healthcare facility.
              </DialogDescription>
            </div>

            <div className="space-y-6 px-6 py-6 sm:px-8">
              <fieldset>
                <legend className="mb-4 text-sm font-bold text-slate-900">Patient Information</legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="connection-hospital-id" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      Hospital Patient ID
                    </Label>
                    <Input
                      id="connection-hospital-id"
                      value={form.externalPatientId}
                      onChange={(event) => updateField("externalPatientId", event.target.value)}
                      placeholder="e.g. TR-900234"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="connection-patient-name" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      Patient Name
                    </Label>
                    <Input
                      id="connection-patient-name"
                      value={form.patientName}
                      onChange={(event) => updateField("patientName", event.target.value)}
                      placeholder="Full legal name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="connection-phone" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      Phone Number
                    </Label>
                    <Input
                      id="connection-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      placeholder="+234 810 039 5949"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="connection-email" className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="connection-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="patient@example.com"
                    />
                  </div>
                </div>
              </fieldset>

              <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm font-medium text-primary sm:grid-cols-2">
                <p className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" />One-time use only</p>
                <p className="flex items-center gap-3"><span aria-hidden="true">•</span>Valid for 72 hours</p>
                <p className="flex items-center gap-3"><span aria-hidden="true">•</span>Linked to this hospital only</p>
                <p className="flex items-center gap-3"><span aria-hidden="true">•</span>New codes invalidate previous</p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.email.trim()} className="font-bold">
                <KeyRound />
                {isSubmitting ? "Generating..." : "Generate Connection Code"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
