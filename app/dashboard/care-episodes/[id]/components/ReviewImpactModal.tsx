"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReviewImpactEvidenceRow = {
  label: string;
  value: string;
  status: string;
};

export type ReviewImpactData = {
  title: string;
  subtitle: string;
  expected: string;
  actual: string;
  trend: string;
  evidence: ReviewImpactEvidenceRow[];
};

type ReviewImpactModalProps = {
  open: boolean;
  alert: ReviewImpactData | null;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
};

const EVIDENCE_STATUS_BADGE: Record<string, string> = {
  ELEVATED: "bg-[#FFF4E5] text-[#F59E0B]",
  HIGH: "bg-[#FFECEC] text-[#EF4444]",
  "NORMAL RANGE": "bg-[#DFFBF0] text-[#10B981]",
  LINKED: "bg-[#FFECEC] text-[#EF4444]",
};

function evidenceBadgeClass(status: string) {
  return EVIDENCE_STATUS_BADGE[status] ?? "bg-[#F3F4F6] text-[#71809B]";
}

export function ReviewImpactModal({ open, alert, onOpenChange, onAcknowledge }: ReviewImpactModalProps) {
  if (!alert) return null;

  const handleAcknowledge = () => {
    onAcknowledge();
    onOpenChange(false);
    toast.success("Alert acknowledged.");
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between border-b border-[#E5E7EB] p-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-[#111827]">{alert.title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm font-medium text-[#71809B]">
                {alert.subtitle}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#71809B] hover:bg-[#F3F4F6]">
              <X className="h-4.5 w-4.5" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-[65vh] overflow-y-auto p-6">
            <div className="rounded-lg border-l-4 border-[#EF4444] bg-[#EFF5FF] p-4">
              <p className="text-sm font-bold text-[#111827]">
                Expected resting HR at Day 4: <span className="font-bold">{alert.expected}</span>
              </p>
              <p className="mt-1 text-sm font-bold text-[#EF4444]">Actual 72-hr average: {alert.actual}</p>
              <p className="mt-1 text-xs font-medium italic text-[#71809B]">Trend direction: {alert.trend}</p>
            </div>

            <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-[0.08em] text-[#71809B]">Supporting Evidence</p>
            <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
              {alert.evidence.map((row, index) => (
                <div
                  key={row.label}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3",
                    index > 0 && "border-t border-[#E5E7EB]",
                  )}
                >
                  <span className="text-sm font-medium text-[#344054]">{row.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#111827]">{row.value}</span>
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", evidenceBadgeClass(row.status))}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-[#E5E7EB] p-6">
            <p className="text-xs font-medium text-[#71809B]">
              Note: Acknowledgement must be completed from the patient&apos;s care episode.
            </p>
            <div className="flex justify-end gap-3">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost" className="h-10 px-4 text-sm font-bold text-[#344054] hover:bg-[#F3F4F6]">
                  Cancel
                </Button>
              </DialogPrimitive.Close>
              <Button
                type="button"
                onClick={handleAcknowledge}
                className="h-10 rounded-lg bg-[#023E8A] px-4 text-sm font-bold text-white hover:bg-[#023575]"
              >
                Acknowledge
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
