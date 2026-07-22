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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[576px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between border-b border-[#E5EAF0] bg-[#FBFCFE] px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E7F2FF] text-[#1769C2]">
                <Save className="h-4.5 w-4.5" />
              </span>
              <DialogPrimitive.Title className="text-lg font-bold text-[#151D2C]">Save Updated Care Plan</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              type="button"
              aria-label="Close save care plan"
              disabled={isSaving}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#344054] transition-colors hover:bg-[#EEF2F6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-start gap-3 rounded-lg bg-[#FFF8EC] p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" />
              <p className="text-sm leading-6 text-[#71809B]">
                The current plan (v{currentVersion}) will be archived and a new version (v{nextVersion}) will become active for{" "}
                <strong className="text-[#344054]">{patientName}</strong>.
              </p>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-[#172033]">Change Reason</span>
              <Textarea
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                placeholder="Describe the resolution and outcome..."
                className="min-h-28 resize-none rounded-lg border-[#DDE3EC] bg-white py-3 text-sm leading-6"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E5EAF0] bg-[#FBFCFE] px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
              className="h-11 px-4 text-sm font-bold text-[#344054] hover:bg-[#EEF2F6]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm(changeReason)}
              disabled={isSaving}
              className="h-11 gap-2 rounded-xl bg-[#064B91] px-5 text-sm font-bold text-white hover:bg-[#023E8A]"
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
