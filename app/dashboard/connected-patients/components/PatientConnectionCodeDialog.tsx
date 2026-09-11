"use client";

import { useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  KeyRound,
  LockKeyhole,
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

const INVITE_VALIDITY_HOURS = 72;

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
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

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
      setShowSuccessBanner(true);
      window.setTimeout(() => setShowSuccessBanner(false), 4000);
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
        setShowSuccessBanner(false);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl gap-0 overflow-y-auto border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
        {invite ? (
          <>
            {showSuccessBanner ? (
              <div
                role="status"
                className="flex items-center gap-2 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-700 sm:px-8"
              >
                <Check className="h-4 w-4" />
                Connection Code Generated successfully.
              </div>
            ) : null}
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
                      <dd className="text-sm font-semibold text-slate-900">{INVITE_VALIDITY_HOURS} Hours</dd>
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

              <div className="space-y-3">
                <p className="text-sm font-medium leading-6 text-slate-500">
                  The connection code is sent automatically after generation. Generate a new code to invalidate the previous code.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={generateInvite}
                  className="h-12 w-full border-primary font-bold text-primary hover:bg-blue-50"
                >
                  <RefreshCw className={isSubmitting ? "animate-spin" : ""} />
                  {isSubmitting ? "Generating..." : "Generate New Code"}
                </Button>
              </div>

              <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  This connection code can only be used once, expires automatically after{" "}
                  {INVITE_VALIDITY_HOURS} hours, and becomes invalid immediately after
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

              <div className="flex gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm font-medium text-primary">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  <p className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />One-time use only</p>
                  <p className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Valid for 72 hours</p>
                  <p className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Linked to this hospital only</p>
                  <p className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />New codes invalidate previous</p>
                </div>
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
