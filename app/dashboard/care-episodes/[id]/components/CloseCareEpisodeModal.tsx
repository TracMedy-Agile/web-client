"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { components } from "@/docs/types/api";

export type CloseCareEpisodePayload = components["schemas"]["CloseEpisodeDto"];
type ClosureReasonValue = CloseCareEpisodePayload["closureReason"];
type OutcomeStatusValue = CloseCareEpisodePayload["outcomeStatus"];

const CLOSURE_REASONS: Array<{ value: ClosureReasonValue; label: string }> = [
  { value: "recovery_completed", label: "Recovery completed" },
  { value: "lost_to_follow_up", label: "Lost to follow-up" },
  { value: "no_further_action", label: "No further action" },
];

const OUTCOME_STATUSES: Array<{ value: OutcomeStatusValue; label: string }> = [
  { value: "recovered", label: "Recovered" },
  { value: "ongoing_monitoring", label: "Ongoing monitoring" },
  { value: "referred", label: "Referred" },
  { value: "deceased", label: "Deceased" },
  { value: "unknown", label: "Unknown" },
];

export type EpisodeOutcomeSummary = {
  checkInCompletion: { completed: number; total: number } | null;
  goalAchievementPercent: number | null;
  missedTasksCount: number | null;
};

type CloseCareEpisodeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  isClosing: boolean;
  summary: EpisodeOutcomeSummary;
  onConfirm: (payload: CloseCareEpisodePayload) => void;
};

export function CloseCareEpisodeModal({ open, onOpenChange, patientName, isClosing, summary, onConfirm }: CloseCareEpisodeModalProps) {
  const [closureReason, setClosureReason] = useState<ClosureReasonValue | "">("");
  const [outcomeStatus, setOutcomeStatus] = useState<OutcomeStatusValue | "">("");
  const [finalNotes, setFinalNotes] = useState("");
  const [error, setError] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (isClosing) return;
    if (!nextOpen) {
      setClosureReason("");
      setOutcomeStatus("");
      setFinalNotes("");
      setError("");
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = () => {
    if (!closureReason || !outcomeStatus) {
      setError("Select both a closure reason and final outcome before continuing.");
      return;
    }
    setError("");
    onConfirm({ closureReason, outcomeStatus, finalNotes: finalNotes.trim() || undefined });
  };

  const checkInPercent = summary.checkInCompletion && summary.checkInCompletion.total > 0
    ? Math.min(Math.round((summary.checkInCompletion.completed / summary.checkInCompletion.total) * 100), 100)
    : null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between border-b border-border bg-muted/30 px-6 py-5">
            <div><DialogPrimitive.Title className="text-xl font-bold text-foreground">Close Care Episode</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm font-medium text-muted-foreground">Reviewing final status for <strong className="text-foreground">{patientName}</strong></DialogPrimitive.Description></div>
            <DialogPrimitive.Close type="button" aria-label="Close dialog" disabled={isClosing} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><X className="h-5 w-5" /></DialogPrimitive.Close>
          </div>

          <div className="overflow-y-auto px-6 py-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-primary">Episode Outcome Summary</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Check-in Completion" value={summary.checkInCompletion ? `${summary.checkInCompletion.completed} / ${summary.checkInCompletion.total}` : "--"} progress={checkInPercent} detail={summary.checkInCompletion ? "From episode timeline" : "Not available"} />
              <SummaryCard label="Goal Achievements" value={summary.goalAchievementPercent == null ? "--" : `${summary.goalAchievementPercent}%`} progress={summary.goalAchievementPercent} detail={summary.goalAchievementPercent == null ? "Not tracked by API" : "Recorded goal progress"} />
              <SummaryCard label="Missed Tasks" value={summary.missedTasksCount == null ? "--" : String(summary.missedTasksCount)} detail={summary.missedTasksCount === 0 ? "No missed care-plan tasks" : summary.missedTasksCount == null ? "No task data" : "From active care plan"} positive={summary.missedTasksCount === 0} />
            </div>

            {error ? <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{error}</p> : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-2 flex items-center gap-1 text-xs font-extrabold uppercase tracking-[0.04em] text-foreground">Closure Reason <span className="text-destructive">*</span></span><Select value={closureReason} onValueChange={(value) => { setClosureReason(value as ClosureReasonValue); if (error) setError(""); }}><SelectTrigger className="h-11 w-full rounded-lg border-border bg-muted/60 text-sm font-medium"><SelectValue placeholder="Select a reason..." /></SelectTrigger><SelectContent className="z-[70] border-border">{CLOSURE_REASONS.map((reason) => <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>)}</SelectContent></Select></label>
              <label className="block"><span className="mb-2 flex items-center gap-1 text-xs font-extrabold uppercase tracking-[0.04em] text-foreground">Final Outcome <span className="text-destructive">*</span></span><Select value={outcomeStatus} onValueChange={(value) => { setOutcomeStatus(value as OutcomeStatusValue); if (error) setError(""); }}><SelectTrigger className="h-11 w-full rounded-lg border-border bg-muted/60 text-sm font-medium"><SelectValue placeholder="Select an outcome..." /></SelectTrigger><SelectContent className="z-[70] border-border">{OUTCOME_STATUSES.map((outcome) => <SelectItem key={outcome.value} value={outcome.value}>{outcome.label}</SelectItem>)}</SelectContent></Select></label>
            </div>

            <label className="mt-6 block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.04em] text-foreground">Final Clinical Summary <span className="font-medium normal-case text-muted-foreground">(optional)</span></span><Textarea value={finalNotes} onChange={(event) => setFinalNotes(event.target.value)} placeholder="Enter clinical observations, final metrics, and discharge recommendations..." className="min-h-28 resize-none rounded-lg border-transparent bg-muted/60 py-3 text-sm leading-6" /></label>

            <div className="mt-6 flex items-start gap-3 rounded-xl bg-primary/10 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-bold text-primary">Final Validation Required</p><p className="mt-1 text-sm leading-6 text-foreground/80">Closing this episode removes it from active monitoring. The closure reason, outcome, and final notes are recorded for clinical audit.</p></div></div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4"><Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isClosing} className="h-11 px-4 text-sm font-bold">Cancel</Button><Button type="button" onClick={handleConfirm} disabled={isClosing || !closureReason || !outcomeStatus} className="h-11 gap-2 rounded-xl px-5 text-sm font-bold">{isClosing ? <><Loader2 className="h-4 w-4 animate-spin" />Closing...</> : "Close Episode"}</Button></div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SummaryCard({ label, value, detail, progress, positive = false }: { label: string; value: string; detail: string; progress?: number | null; positive?: boolean }) {
  return <div className="rounded-xl bg-muted/60 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold text-primary">{value}</p>{progress != null ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} /></div> : null}<p className={positive ? "mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700" : "mt-2 text-xs text-muted-foreground"}>{positive ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{detail}</p></div>;
}
