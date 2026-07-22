"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ClosureReason } from "../_shared/episodeClosureTypes";

const CLOSURE_REASONS: ClosureReason[] = [
  "Recovery completed",
  "Transferred",
  "Patient discontinued",
  "Lost to follow-up",
  "Deceased",
  "Administrative closure",
];

const OUTCOME_SUMMARY = {
  checkInCompletion: { completed: 5, total: 7 },
  goalAchievementPercent: 85,
  missedTasksCount: 0,
};

export type CloseCareEpisodePayload = {
  closureReason: ClosureReason;
  finalClinicalSummary: string;
};

type CloseCareEpisodeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  isClosing: boolean;
  onConfirm: (payload: CloseCareEpisodePayload) => void;
};

export function CloseCareEpisodeModal({ open, onOpenChange, patientName, isClosing, onConfirm }: CloseCareEpisodeModalProps) {
  const [closureReason, setClosureReason] = useState<ClosureReason | "">("");
  const [finalClinicalSummary, setFinalClinicalSummary] = useState("");
  const [error, setError] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (isClosing) return;
    if (!nextOpen) {
      setClosureReason("");
      setFinalClinicalSummary("");
      setError("");
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = () => {
    if (!closureReason) {
      setError("Select a closure reason before continuing.");
      return;
    }
    setError("");
    onConfirm({ closureReason, finalClinicalSummary: finalClinicalSummary.trim() });
  };

  const checkInPercent = Math.round((OUTCOME_SUMMARY.checkInCompletion.completed / OUTCOME_SUMMARY.checkInCompletion.total) * 100);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between border-b border-[#E5EAF0] bg-[#FBFCFE] px-6 py-5">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-[#151D2C]">Close Care Episode</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm font-medium text-[#71809B]">
                Reviewing Final Status for <strong className="text-[#344054]">{patientName}</strong>
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              type="button"
              aria-label="Close dialog"
              disabled={isClosing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#344054] transition-colors hover:bg-[#EEF2F6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="overflow-y-auto px-6 py-6" style={{ maxHeight: "calc(90vh - 160px)" }}>
            <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#023E8A]">Episode Outcome Summary</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#F1F3F5] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Check-in Completion</p>
                <p className="mt-2 text-2xl font-extrabold text-[#023E8A]">
                  {OUTCOME_SUMMARY.checkInCompletion.completed}
                  <span className="text-sm font-bold text-[#71809B]"> / {OUTCOME_SUMMARY.checkInCompletion.total}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div className="h-full rounded-full bg-[#023E8A]" style={{ width: `${checkInPercent}%` }} />
                </div>
              </div>
              <div className="rounded-xl bg-[#F1F3F5] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Goal Achievements</p>
                <p className="mt-2 text-2xl font-extrabold text-[#023E8A]">
                  {OUTCOME_SUMMARY.goalAchievementPercent}
                  <span className="text-sm font-bold text-[#71809B]">%</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div className="h-full rounded-full bg-[#023E8A]" style={{ width: `${OUTCOME_SUMMARY.goalAchievementPercent}%` }} />
                </div>
              </div>
              <div className="rounded-xl bg-[#F1F3F5] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Missed Tasks</p>
                <p className="mt-2 text-2xl font-extrabold text-[#023E8A]">{OUTCOME_SUMMARY.missedTasksCount}</p>
                {OUTCOME_SUMMARY.missedTasksCount === 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#10B981]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Perfect Compliance
                  </p>
                ) : null}
              </div>
            </div>

            {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}

            <label className="mt-6 block">
              <span className="mb-2 flex items-center gap-1 text-xs font-extrabold uppercase tracking-[0.04em] text-[#182132]">
                Closure Reason <span className="text-red-500">*</span>
              </span>
              <Select value={closureReason} onValueChange={(value) => setClosureReason(value as ClosureReason)}>
                <SelectTrigger className="h-11 w-full rounded-lg border-[#DDE3EC] bg-[#F1F3F5] text-sm font-medium text-[#172033]">
                  <SelectValue placeholder="Select a definitive reason..." />
                </SelectTrigger>
                <SelectContent className="z-[70] border-[#DDE3EC]">
                  {CLOSURE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="mt-6 block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.04em] text-[#182132]">
                Final Clinical Summary <span className="font-medium normal-case text-[#71809B]">(optional)</span>
              </span>
              <Textarea
                value={finalClinicalSummary}
                onChange={(event) => setFinalClinicalSummary(event.target.value)}
                placeholder="Enter clinical observations, final metrics, and discharge recommendations..."
                className="min-h-28 resize-none rounded-lg border-transparent bg-[#F1F3F5] py-3 text-sm leading-6"
              />
            </label>

            <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#EFF5FF] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#023E8A]" />
              <div>
                <p className="text-sm font-bold text-[#023E8A]">Final Validation Required</p>
                <p className="mt-1 text-sm leading-6 text-[#344054]">
                  Closing this episode will archive all associated metrics and discharge the patient from active monitoring. This
                  action is logged for clinical audit.
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#E5EAF0] bg-[#FBFCFE] px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isClosing}
              className="h-11 px-4 text-sm font-bold text-[#344054] hover:bg-[#EEF2F6]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isClosing}
              className={cn("h-11 gap-2 rounded-xl bg-[#064B91] px-5 text-sm font-bold text-white hover:bg-[#023E8A]")}
            >
              {isClosing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                "Close Episode"
              )}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
