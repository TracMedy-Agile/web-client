"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { Info, LoaderCircle, X } from "lucide-react";
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
  expectedLabel?: string;
  actualLabel?: string;
  evidence: ReviewImpactEvidenceRow[];
};

type ReviewImpactModalProps = {
  open: boolean;
  alert: ReviewImpactData | null;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
  onEscalate?: () => void;
  acknowledgementAvailable?: boolean;
  careEpisodeHref?: string;
  isLoading?: boolean;
};

const EVIDENCE_STATUS_BADGE: Record<string, string> = {
  ELEVATED: "bg-amber-50 text-amber-700",
  HIGH: "bg-red-50 text-red-700",
  CRITICAL: "bg-red-50 text-red-700",
  MODERATE: "bg-amber-50 text-amber-700",
  LOW: "bg-emerald-50 text-emerald-700",
  "NORMAL RANGE": "bg-emerald-50 text-emerald-700",
  LINKED: "bg-red-50 text-red-700",
  RECORDED: "bg-blue-50 text-blue-700",
};

function evidenceBadgeClass(status: string) {
  return EVIDENCE_STATUS_BADGE[status] ?? "bg-muted text-muted-foreground";
}

export function ReviewImpactModal({
  open,
  alert,
  onOpenChange,
  careEpisodeHref,
  isLoading = false,
}: ReviewImpactModalProps) {
  if (!alert) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-[672px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <header className="flex shrink-0 items-start justify-between border-b border-border px-6 py-6 sm:px-8 sm:py-7">
            <div className="min-w-0 pr-4">
              <DialogPrimitive.Title className="text-xl font-bold text-foreground">
                {alert.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm font-medium text-muted-foreground">
                {alert.subtitle}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close review impact"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 overflow-y-auto px-6 py-7 sm:px-8 sm:py-8">
            {isLoading ? (
              <p role="status" className="mb-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Refreshing clinical evidence...
              </p>
            ) : null}

            <section className="rounded-r-xl border-l-4 border-red-500 bg-primary/5 px-4 py-5">
              <p className="text-base font-medium text-foreground sm:text-lg">
                {alert.expectedLabel ?? "Expected resting HR at Day 4"}: <span className="font-bold">{alert.expected}</span>
              </p>
              <p className="mt-1.5 text-base font-medium text-red-500 sm:text-lg">
                {alert.actualLabel ?? "Actual 72-hr average"}: <span className="font-bold">{alert.actual}</span>
              </p>
              <p className="mt-2 text-sm font-medium italic text-muted-foreground">
                Trend direction: {alert.trend}
              </p>
            </section>

            <p className="mb-4 mt-8 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Supporting Evidence
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              {alert.evidence.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No supporting evidence is available for this alert.
                </p>
              ) : null}
              {alert.evidence.map((row, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className={cn(
                    "grid min-h-16 grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-5",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <span className="text-sm font-medium text-foreground/80">{row.label}</span>
                  <span className="text-sm font-medium text-foreground sm:text-right">{row.value}</span>
                  <span className={cn(
                    "w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                    evidenceBadgeClass(row.status),
                  )}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <footer className="shrink-0 border-t border-border bg-muted/30 px-6 py-4 sm:px-8">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              Note: Acknowledgement must be completed from the patient&apos;s care episode.
            </p>
            <div className="mt-6 flex justify-end gap-4">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost" className="h-12 px-4 text-sm font-bold text-foreground hover:bg-muted">
                  Cancel
                </Button>
              </DialogPrimitive.Close>
              {careEpisodeHref ? (
                <Button asChild className="h-12 rounded-xl px-5 text-sm font-bold">
                  <Link href={careEpisodeHref}>Open Care Episode</Link>
                </Button>
              ) : null}
            </div>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
