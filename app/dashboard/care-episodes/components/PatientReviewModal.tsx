"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ClipboardList, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  dismissPendingCareEpisode,
  getCareEpisodeById,
  openPendingCareEpisode,
  type CareEpisodeDetail,
} from "@/lib/api/care-episodes";
import { cn } from "@/lib/utils";
import type { ClinicalConcern, PatientReviewModalProps } from "./types";

type SeverityTrend = "Improving" | "Stable" | "Worsening";

const CONCERN_PERCENT: Record<ClinicalConcern, number> = {
  None: 8,
  Mild: 35,
  Moderate: 65,
  High: 92,
};

const TREND_CLASSNAME: Record<SeverityTrend, string> = {
  Improving: "text-primary",
  Stable: "text-slate-500",
  Worsening: "text-red-500",
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
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return datePart + " | " + timePart;
}

function getSeverityTrend(value: string | null): SeverityTrend {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "decreasing" || normalized === "improving") return "Improving";
  if (normalized === "increasing" || normalized === "worsening") return "Worsening";
  return "Stable";
}

function getClinicalConcern(episode: CareEpisodeDetail): ClinicalConcern {
  const concern = episode.clinicalConcern?.trim().toLowerCase();
  if (concern === "high" || concern === "severe" || concern === "critical") return "High";
  if (concern === "moderate" || concern === "medium") return "Moderate";
  if (concern === "mild" || concern === "low") return "Mild";
  if (concern === "none") return "None";

  const risk = episode.riskCategory?.trim().toLowerCase();
  if (risk === "high" || risk === "critical") return "High";
  if (risk === "medium" || risk === "moderate") return "Moderate";
  if (risk === "low") return "Mild";
  return "None";
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-xs font-medium text-slate-500">{children}</span>;
}

export function PatientReviewModal({
  open,
  onOpenChange,
  episodeId,
  onActionComplete,
}: PatientReviewModalProps) {
  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [error, setError] = useState("");
  const [isDismissing, setIsDismissing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const isBusy = isDismissing || isOpening;
  const isLoading = Boolean(open && episodeId && episode?.id !== episodeId && !error);

  useEffect(() => {
    if (!open || !episodeId) return;

    let ignore = false;

    getCareEpisodeById(episodeId)
      .then((result) => {
        if (ignore) return;
        setEpisode(result);
        setError("");
        capturePostHogEvent("pending_review_viewed", { episode_id: result.id });
      })
      .catch((requestError: unknown) => {
        if (ignore) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load this review.");
      });

    return () => {
      ignore = true;
    };
  }, [episodeId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isBusy) onOpenChange(nextOpen);
  };

  const handleDismiss = async () => {
    if (!episode) return;
    setIsDismissing(true);
    try {
      const result = await dismissPendingCareEpisode(episode.id);
      capturePostHogEvent("pending_episode_dismissed", { episode_id: episode.id });
      toast.success("Episode marked as no further action.");
      onActionComplete?.({ id: result.id, status: result.status });
      onOpenChange(false);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to update the episode.");
    } finally {
      setIsDismissing(false);
    }
  };

  const handleOpenEpisode = async () => {
    if (!episode) return;
    setIsOpening(true);
    try {
      const result = await openPendingCareEpisode(episode.id, episode.clinicianId);
      capturePostHogEvent("pending_episode_opened", { episode_id: episode.id });
      toast.success("Care episode opened.");
      onActionComplete?.({ id: result.id, status: result.status });
      onOpenChange(false);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to open the episode.");
    } finally {
      setIsOpening(false);
    }
  };

  const patientName = episode?.patient?.name || "Unknown Patient";
  const patientCode = episode?.tracmedyPatientId || episode?.patient?.hospitalId || "--";
  const concern = episode ? getClinicalConcern(episode) : "None";
  const trend = getSeverityTrend(episode?.riskTrend ?? null);
  const expectedFollowUp = episode?.expectedDurationDays
    ? episode.expectedDurationDays + " days"
    : "Not specified";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[820px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex h-19 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-primary">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <DialogPrimitive.Title className="text-lg font-bold text-slate-900 sm:text-xl">
                Patient Review
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Description className="sr-only">
              Review the pending care episode and decide on the next step.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              type="button"
              aria-label="Close patient review"
              disabled={isBusy}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-[calc(90vh-152px)] overflow-y-auto px-5 py-7 sm:px-8 sm:py-8">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center gap-2 text-sm font-medium text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading review...
              </div>
            ) : error ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm font-semibold text-red-600">{error}</p>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            ) : episode ? (
              <div className="space-y-6">
                <div className="rounded-xl bg-blue-50 p-5">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                      {getInitials(patientName)}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{patientName}</h3>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <FieldLabel>Patient ID</FieldLabel>
                      <p className="mt-1 text-sm font-bold text-slate-900">{patientCode}</p>
                    </div>
                    <div>
                      <FieldLabel>Diagnosis</FieldLabel>
                      <p className="mt-1 text-sm font-bold text-primary">{episode.diagnosis || "Not specified"}</p>
                    </div>
                    <div>
                      <FieldLabel>Primary Provider</FieldLabel>
                      <p className="mt-1 text-sm font-bold text-slate-900">{episode.clinicianName || "Not assigned"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
                  <section className="rounded-xl border border-slate-200 p-5" aria-labelledby="encounter-details-heading">
                    <h4 id="encounter-details-heading" className="text-xs font-extrabold uppercase tracking-[0.06em] text-primary">
                      Encounter Details
                    </h4>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                      <div>
                        <FieldLabel>Encounter Type</FieldLabel>
                        <p className="mt-1 text-sm font-bold text-slate-900">{episode.encounterType || "Not specified"}</p>
                      </div>
                      <div>
                        <FieldLabel>Created Date</FieldLabel>
                        <p className="mt-1 text-sm font-bold text-slate-900">{formatDateTime(episode.createdAt)}</p>
                      </div>
                      <div>
                        <FieldLabel>Episode Status</FieldLabel>
                        <span className="mt-1 inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold capitalize text-amber-600">
                          {episode.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <div>
                        <FieldLabel>Expected Follow-up</FieldLabel>
                        <span className="mt-1 inline-flex rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary">
                          {expectedFollowUp}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-5" aria-labelledby="clinical-assessment-heading">
                    <h4 id="clinical-assessment-heading" className="text-xs font-extrabold uppercase tracking-[0.06em] text-red-500">
                      Clinical Assessment
                    </h4>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">Condition Severity</span>
                      <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold", TREND_CLASSNAME[trend])}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {episode.conditionSeverity || trend}
                      </span>
                    </div>
                    <div className="mt-4 rounded-lg bg-red-50 p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-red-500">
                        Clinical Concern Level
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-lg font-extrabold uppercase text-red-500">{concern}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-red-200">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: CONCERN_PERCENT[concern] + "%" }}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border border-slate-200 p-5" aria-labelledby="clinician-notes-heading">
                  <h4 id="clinician-notes-heading" className="text-xs font-extrabold uppercase tracking-[0.06em] text-slate-500">
                    Clinician Notes
                  </h4>
                  <div className="mt-3 rounded-lg border-l-4 border-primary bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {episode.clinicianNotes || "No clinician notes were provided."}
                  </div>
                </section>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <span className="text-slate-500">
                      CREATED <span className="ml-1 font-bold text-slate-700">{formatDateTime(episode.createdAt)}</span>
                    </span>
                    <span className="text-slate-500">
                      BY <span className="ml-1 font-bold text-slate-700">{episode.clinicianName || "System"}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">STATUS</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {episode.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-stretch justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDismiss}
              disabled={!episode || isBusy}
              className="h-11 px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              {isDismissing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Marking...
                </>
              ) : (
                "Mark No Further Action"
              )}
            </Button>
            <Button
              type="button"
              onClick={handleOpenEpisode}
              disabled={!episode || isBusy}
              className="h-12 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-sm hover:bg-primary/90"
            >
              {isOpening ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
