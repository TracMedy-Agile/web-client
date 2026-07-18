"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ClipboardList, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getEpisodeById, markNoFurtherAction, openCareEpisode } from "@/lib/api/careEpisodeIntake.api";
import type { ClinicalConcern, PatientReviewModalProps, PendingReviewEpisode, PendingReviewStatus, SeverityTrend } from "./types";

const CONCERN_PERCENT: Record<ClinicalConcern, number> = {
  None: 8,
  Mild: 35,
  Moderate: 65,
  High: 92,
};

const TREND_DOT_CLASSNAME: Record<SeverityTrend, string> = {
  Improving: "bg-[#023E8A]",
  Stable: "bg-[#71809B]",
  Worsening: "bg-[#EF4444]",
};

const TREND_TEXT_CLASSNAME: Record<SeverityTrend, string> = {
  Improving: "text-[#023E8A]",
  Stable: "text-[#71809B]",
  Worsening: "text-[#EF4444]",
};

const STATUS_BADGE_CLASSNAME: Record<PendingReviewStatus, string> = {
  "Pending Review": "bg-[#FFF4E5] text-[#F59E0B]",
  "No Further Action": "bg-[#F3F4F6] text-[#71809B]",
  Open: "bg-[#E7F2FF] text-[#023E8A]",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "--";
  const date = new Date(parsed);
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { datePart, timePart };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs font-medium text-[#71809B]">{children}</span>;
}

export function PatientReviewModal({ open, onOpenChange, episodeId, onActionComplete }: PatientReviewModalProps) {
  const [episode, setEpisode] = useState<PendingReviewEpisode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingNoAction, setIsMarkingNoAction] = useState(false);
  const [isOpeningEpisode, setIsOpeningEpisode] = useState(false);

  const isBusy = isMarkingNoAction || isOpeningEpisode;

  useEffect(() => {
    if (!open || !episodeId) {
      setEpisode(null);
      return;
    }

    let ignore = false;
    setIsLoading(true);
    getEpisodeById(episodeId).then((result) => {
      if (!ignore) {
        setEpisode(result);
        setIsLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [open, episodeId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isBusy) return;
    onOpenChange(nextOpen);
  };

  const handleMarkNoFurtherAction = async () => {
    if (!episode) return;
    setIsMarkingNoAction(true);
    try {
      const result = await markNoFurtherAction(episode.id);
      toast.success("Episode marked as no further action.");
      onActionComplete?.(result);
      onOpenChange(false);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to update the episode.");
    } finally {
      setIsMarkingNoAction(false);
    }
  };

  const handleOpenCareEpisode = async () => {
    if (!episode) return;
    setIsOpeningEpisode(true);
    try {
      const result = await openCareEpisode(episode.id);
      toast.success("Care episode opened.");
      onActionComplete?.(result);
      onOpenChange(false);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to open the episode.");
    } finally {
      setIsOpeningEpisode(false);
    }
  };

  const consultation = episode ? formatDateTime(episode.consultationDate) : null;
  const created = episode ? formatDateTime(episode.createdAt) : null;
  const concernPercent = episode ? CONCERN_PERCENT[episode.clinicalConcern] : 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[820px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex h-19 shrink-0 items-center justify-between border-b border-[#E5EAF0] bg-[#FBFCFE] px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E7F2FF] text-[#1769C2]">
                <ClipboardList className="h-5 w-5" />
              </span>
              <DialogPrimitive.Title className="text-lg font-bold text-[#151D2C] sm:text-xl">
                Patient Review
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Description className="sr-only">
              Review the pending care episode and decide on next steps.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              type="button"
              aria-label="Close patient review"
              disabled={isBusy}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#344054] transition-colors hover:bg-[#EEF2F6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="overflow-y-auto px-5 py-7 sm:px-8 sm:py-8" style={{ maxHeight: "calc(90vh - 152px)" }}>
            {isLoading || !episode ? (
              <div className="flex h-64 items-center justify-center gap-2 text-sm font-medium text-[#71809B]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading review...
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl bg-[#EFF5FF] p-5">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#023E8A] text-lg font-bold text-white">
                      {getInitials(episode.patientName)}
                    </span>
                    <h3 className="text-lg font-bold text-[#111827]">{episode.patientName}</h3>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <FieldLabel>Patient ID</FieldLabel>
                      <p className="mt-1 text-sm font-bold text-[#111827]">{episode.patientCode}</p>
                    </div>
                    <div>
                      <FieldLabel>Diagnosis</FieldLabel>
                      <p className="mt-1 text-sm font-bold text-[#023E8A]">{episode.diagnosis}</p>
                    </div>
                    <div>
                      <FieldLabel>Primary Provider</FieldLabel>
                      <p className="mt-1 text-sm font-bold text-[#111827]">{episode.primaryProvider}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-xl border border-[#E5E7EB] p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#023E8A]">Encounter Details</p>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                      <div>
                        <FieldLabel>Encounter Type</FieldLabel>
                        <p className="mt-1 text-sm font-bold text-[#111827]">{episode.encounterType}</p>
                      </div>
                      <div>
                        <FieldLabel>Consultation Date</FieldLabel>
                        <p className="mt-1 text-sm font-bold text-[#111827]">
                          {consultation && typeof consultation === "object" ? `${consultation.datePart} | ${consultation.timePart}` : "--"}
                        </p>
                      </div>
                      <div>
                        <FieldLabel>Discharge Status</FieldLabel>
                        <span className="mt-1 inline-flex rounded-md bg-[#E7F2FF] px-2.5 py-1 text-xs font-bold text-[#023E8A]">
                          {episode.dischargeStatus}
                        </span>
                      </div>
                      <div>
                        <FieldLabel>Follow up Trigger</FieldLabel>
                        <span className="mt-1 inline-flex rounded-md bg-[#E7F2FF] px-2.5 py-1 text-xs font-bold text-[#023E8A]">
                          {episode.followUpTrigger}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#EF4444]">Clinical Assessment</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-[#71809B]">Clinician Severity</span>
                      <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold", TREND_TEXT_CLASSNAME[episode.severityTrend])}>
                        <span className={cn("h-2 w-2 rounded-full", TREND_DOT_CLASSNAME[episode.severityTrend])} />
                        {episode.severityTrend}
                      </span>
                    </div>
                    <div className="mt-4 rounded-lg bg-[#FFF5F5] p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#EF4444]">Clinical Concern Level</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-lg font-extrabold uppercase text-[#EF4444]">{episode.clinicalConcern}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#FFD7D7]">
                          <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${concernPercent}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] p-5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#71809B]">Clinician Notes</p>
                  <div className="mt-3 rounded-lg border-l-4 border-[#023E8A] bg-[#F8FAFC] p-4 text-sm leading-6 text-[#344054]">
                    {episode.clinicianNotes}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <span className="text-[#71809B]">
                      CREATED{" "}
                      <span className="ml-1 font-bold text-[#344054]">
                        {created && typeof created === "object" ? `${created.datePart} · ${created.timePart}` : "--"}
                      </span>
                    </span>
                    <span className="text-[#71809B]">
                      BY <span className="ml-1 font-bold text-[#344054]">{episode.createdBy}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#71809B]">STATUS</span>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", STATUS_BADGE_CLASSNAME[episode.status])}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {episode.status}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-stretch justify-end gap-3 border-t border-[#E5EAF0] bg-[#FBFCFE] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <Button
              type="button"
              variant="ghost"
              onClick={handleMarkNoFurtherAction}
              disabled={!episode || isBusy}
              className="h-11 px-4 text-sm font-bold text-[#344054] hover:bg-[#EEF2F6]"
            >
              {isMarkingNoAction ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Marking...
                </>
              ) : (
                "Mark No Further Action"
              )}
            </Button>
            <Button
              type="button"
              onClick={handleOpenCareEpisode}
              disabled={!episode || isBusy}
              className="h-12 rounded-xl bg-[#064B91] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#023E8A]"
            >
              {isOpeningEpisode ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                "Open Care Episode"
              )}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
