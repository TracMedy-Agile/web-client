"use client";

import { useState, type FormEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Loader2, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EscalateCaseContext = {
  patientName: string;
  patientCode: string;
  alertReason: string;
  severity: string;
};

type EscalateCaseModalProps = {
  open: boolean;
  context: EscalateCaseContext;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, notes: string) => void | Promise<void>;
  submissionAvailable?: boolean;
};

const REASONS = [
  "Clinical deterioration",
  "Specialist review required",
  "Emergency intervention",
  "Care plan review",
  "Other",
];

export function EscalateCaseModal({
  open,
  context,
  onOpenChange,
  onConfirm,
  submissionAvailable = true,
}: EscalateCaseModalProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason) {
      setShowValidation(true);
      return;
    }
    if (!submissionAvailable) return;
    setIsSubmitting(true);
    setError("");
    try {
      await onConfirm(reason, notes.trim());
      onOpenChange(false);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to escalate this alert.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between border-b border-border p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-foreground">Escalate Case</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  Send this clinical risk signal for urgent review.
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close aria-label="Close escalate case" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="max-h-[65vh] space-y-5 overflow-y-auto p-6">
              <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-foreground">{context.patientName}</p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">{context.patientCode}</p>
                  </div>
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold uppercase text-red-700">{context.severity}</span>
                </div>
                <p className="mt-3 flex items-start gap-2 text-sm font-medium leading-5 text-foreground/80">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  {context.alertReason}
                </p>
              </div>

              <div>
                <label htmlFor="escalation-reason" className="text-sm font-semibold text-foreground">
                  Escalation reason <span className="text-red-600">*</span>
                </label>
                <select
                  id="escalation-reason"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setShowValidation(false);
                  }}
                  aria-invalid={showValidation && !reason}
                  aria-describedby={showValidation && !reason ? "escalation-reason-error" : undefined}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a reason</option>
                  {REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                {showValidation && !reason ? <p id="escalation-reason-error" className="mt-1.5 text-xs font-medium text-red-600">Select an escalation reason.</p> : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="escalation-notes" className="text-sm font-semibold text-foreground">Notes</label>
                  <span className="text-xs text-muted-foreground">{notes.length}/1000</span>
                </div>
                <textarea
                  id="escalation-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={1000}
                  rows={5}
                  placeholder="Add clinical context, observations, or requested next steps..."
                  className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              </div>

              {!submissionAvailable ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-800">
                  Case escalation will be enabled when the backend escalation endpoint is available.
                </div>
              ) : null}
              {error ? (
                <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs font-medium text-destructive">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border p-6 sm:flex-row sm:justify-end">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost" className="h-10 px-4 font-bold text-foreground hover:bg-muted">Cancel</Button>
              </DialogPrimitive.Close>
              <Button type="submit" disabled={!submissionAvailable || isSubmitting} className="h-10 rounded-lg bg-red-600 px-5 font-bold text-white hover:bg-red-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                {isSubmitting ? "Escalating..." : "Confirm Escalation"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
