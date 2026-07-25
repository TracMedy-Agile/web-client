"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SaveCarePlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: number;
  nextVersion: number;
  patientName: string;
  isSaving: boolean;
  onConfirm: (changeReason: string) => void;
};

export function SaveCarePlanModal({ open, onOpenChange, currentVersion, nextVersion, patientName, isSaving, onConfirm }: SaveCarePlanModalProps) {
  const [changeReason, setChangeReason] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) return;
    if (!nextOpen) setChangeReason("");
    onOpenChange(nextOpen);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[576px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Save className="h-4.5 w-4.5" />
              </span>
              <DialogPrimitive.Title className="text-lg font-bold text-foreground">Save Updated Care Plan</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              type="button"
              aria-label="Close save care plan"
              disabled={isSaving}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm leading-6 text-muted-foreground">
                The current plan (v{currentVersion}) will be archived and a new version (v{nextVersion}) will become active for{" "}
                <strong className="text-foreground">{patientName}</strong>.
              </p>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-foreground">Change Reason</span>
              <Textarea
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                placeholder="Describe the resolution and outcome..."
                className="min-h-28 resize-none rounded-lg border-border bg-card py-3 text-sm leading-6"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
              className="h-11 px-4 text-sm font-bold text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm(changeReason.trim())}
              disabled={isSaving || !changeReason.trim()}
              className="h-11 gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Confirm and Save
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
