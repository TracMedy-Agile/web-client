"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getCareEpisodeById, type CareEpisodeDetail } from "@/lib/api/care-episodes";
import { getAssessmentHistory } from "@/lib/api/careTeamAndPlan.api";
import { createPlaceholderEpisode, formatLongDate, formatTime } from "../_shared/utils";
import type { Assessment } from "../_shared/careTeamTypes";

const ASSESSMENT_HISTORY_PAGE_SIZE = 10;

const ESCALATION_BADGE_CLASSNAME: Record<string, string> = {
  Stable: "bg-emerald-50 text-emerald-600",
  Improving: "bg-amber-50 text-amber-600",
  "Delayed Recovery": "bg-red-50 text-red-500",
  Escalated: "bg-red-50 text-red-500",
};

const CLINICIAN_NOTES_PREVIEW_LIMIT = 120;

function clinicianNotesPreview(notes: string) {
  const normalized = notes.trim();
  if (!normalized) return "No clinical assessment notes recorded.";
  if (normalized.length <= CLINICIAN_NOTES_PREVIEW_LIMIT) return normalized;
  return `${normalized.slice(0, CLINICIAN_NOTES_PREVIEW_LIMIT - 3).trimEnd()}...`;
}
const OUTCOME_TEXT_CLASSNAME: Record<string, string> = {
  "No Escalation": "text-emerald-600",
  Escalated: "text-red-500",
  "Care Plan Adjustment": "text-amber-600",
};

export default function AssessmentHistoryPage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const displayEpisode = episode ?? createPlaceholderEpisode(episodeId);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clinicianFilter, setClinicianFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!episodeId) return;
    capturePostHogEvent("assessment_history_viewed", { episode_id: episodeId });
    let ignore = false;
    Promise.allSettled([getCareEpisodeById(episodeId), getAssessmentHistory(episodeId)]).then(([episodeResult, assessmentResult]) => {
      if (ignore) return;
      if (episodeResult.status === "fulfilled") setEpisode(episodeResult.value);
      if (assessmentResult.status === "fulfilled") setAssessments(assessmentResult.value);
      if (assessmentResult.status === "rejected") setError(assessmentResult.reason instanceof Error ? assessmentResult.reason.message : "Unable to load assessment history.");
      setIsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [episodeId]);

  const clinicianOptions = useMemo(() => Array.from(new Set(assessments.map((item) => item.clinicianName))), [assessments]);
  const outcomeOptions = useMemo(() => Array.from(new Set(assessments.map((item) => item.outcome))), [assessments]);

  const filtered = useMemo(() => {
    return assessments.filter((assessment) => {
      if (clinicianFilter !== "all" && assessment.clinicianName !== clinicianFilter) return false;
      if (outcomeFilter !== "all" && assessment.outcome !== outcomeFilter) return false;
      if (dateFrom && Date.parse(assessment.date) < Date.parse(dateFrom)) return false;
      if (dateTo && Date.parse(assessment.date) > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
      return true;
    });
  }, [assessments, clinicianFilter, outcomeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ASSESSMENT_HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAssessments = filtered.slice(
    (currentPage - 1) * ASSESSMENT_HISTORY_PAGE_SIZE,
    currentPage * ASSESSMENT_HISTORY_PAGE_SIZE,
  );

  const hasFilters = Boolean(dateFrom || dateTo || clinicianFilter !== "all" || outcomeFilter !== "all");

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setClinicianFilter("all");
    setOutcomeFilter("all");
    setPage(1);
  };

  const openAssessmentModal = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    capturePostHogEvent("assessment_history_item_opened", { episode_id: episodeId, assessment_id: assessment.id });
  };

  const exportCsv = () => {
    capturePostHogEvent("assessment_history_exported", { episode_id: episodeId, result_count: filtered.length });
    const header = ["Date", "Time", "Escalation Status", "Assessment Outcome", "Clinician Notes", "Clinician Name"];
    const rows = filtered.map((assessment) => [
      formatLongDate(assessment.date),
      formatTime(assessment.date),
      assessment.escalationStatus,
      assessment.outcome,
      assessment.clinicianNotes,
      assessment.clinicianName,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `assessment-history-${episodeId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4"><div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" /><div className="h-7 w-56 animate-pulse rounded bg-slate-200" /><div className="h-80 animate-pulse rounded-xl bg-slate-100" /></div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/care-episodes/${episodeId}`} aria-label="Back to care episode" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 md:text-2xl">Assessment History</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {displayEpisode.patient?.name || "Patient"} - {displayEpisode.patient?.hospitalId || "--"} - <strong>{assessments.length} Assessments</strong>
          </p>
        </div>
        <Button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="h-11 gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Date Range</span>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => { setDateFrom(event.target.value); setPage(1); }}
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-medium text-slate-700 outline-none sm:w-36"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => { setDateTo(event.target.value); setPage(1); }}
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-medium text-slate-700 outline-none sm:w-36"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Clinician</span>
                <Select value={clinicianFilter} onValueChange={(value) => { setClinicianFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm font-medium text-slate-700 sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border">
                    <SelectItem value="all">All Clinicians</SelectItem>
                    {clinicianOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Outcome</span>
                <Select value={outcomeFilter} onValueChange={(value) => { setOutcomeFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm font-medium text-slate-700 sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border">
                    <SelectItem value="all">All Outcome</SelectItem>
                    {outcomeOptions.map((outcome) => (
                      <SelectItem key={outcome} value={outcome}>
                        {outcome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="text-sm font-bold text-primary hover:underline">
                Clear all filters
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="py-12 text-center text-sm font-medium text-red-600">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm font-medium text-slate-500">
              {hasFilters ? "No assessments match the selected filters." : "No clinical assessments have been recorded for this episode yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead className="bg-blue-50">
                  <tr>
                    {["DATE / TIME", "ESCALATION STATUS", "ASSESSMENT OUTCOME", "CLINICIAN NOTES", "CLINICIAN NAME"].map((heading) => (
                      <th key={heading} className="h-14 px-4 text-left text-xs font-bold text-slate-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedAssessments.map((assessment) => (
                    <tr
                      key={assessment.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View assessment from ${formatLongDate(assessment.date)}`}
                      onClick={() => openAssessmentModal(assessment)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openAssessmentModal(assessment);
                        }
                      }}
                      className="cursor-pointer border-b border-slate-200 transition-colors hover:bg-blue-50/50 focus:bg-blue-50/60 focus:outline-none last:border-0"
                    >
                      <td className="px-4 py-5 align-top">
                        <span className="block font-bold text-slate-900">{formatLongDate(assessment.date)}</span>
                        <span className="mt-1 block text-xs font-medium text-slate-500">{formatTime(assessment.date)}</span>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                            ESCALATION_BADGE_CLASSNAME[assessment.escalationStatus] ?? "bg-slate-100 text-slate-500",
                          )}
                        >
                          {assessment.escalationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-sm font-bold",
                            OUTCOME_TEXT_CLASSNAME[assessment.outcome] ?? "text-slate-500",
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {assessment.outcome}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-5 align-top text-sm text-slate-700"><span className="block max-w-[280px] line-clamp-2 break-words" title={assessment.clinicianNotes || "No clinical assessment notes recorded."}>{clinicianNotesPreview(assessment.clinicianNotes)}</span></td>
                      <td className="px-4 py-5 align-top text-sm font-medium text-slate-700">{assessment.clinicianName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {(currentPage - 1) * ASSESSMENT_HISTORY_PAGE_SIZE + 1}-{Math.min(currentPage * ASSESSMENT_HISTORY_PAGE_SIZE, filtered.length)} of {filtered.length} Assessments
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous assessment page"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span aria-live="polite" className="min-w-20 text-center text-xs font-bold text-slate-600">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next assessment page"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AssessmentDetailModal
        assessment={selectedAssessment}
        onClose={() => setSelectedAssessment(null)}
      />
    </div>
  );
}

function AssessmentDetailModal({ assessment, onClose }: { assessment: Assessment | null; onClose: () => void }) {
  useEffect(() => {
    if (!assessment) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [assessment]);

  if (!assessment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="assessment-detail-title">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_72px_rgba(15,23,42,0.28)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Clinical Assessment</p>
            <h2 id="assessment-detail-title" className="mt-1 text-lg font-bold text-slate-900">Assessment Details</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {formatLongDate(assessment.date)} at {formatTime(assessment.date)} - {assessment.clinicianName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close assessment details"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">Escalation Status</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{assessment.escalationStatus}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">Assessment Outcome</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{assessment.outcome}</p>
            </div>
          </div> 
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">Symptom Status</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{assessment.symptomStatus || "Not recorded"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">Treatment Response</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{assessment.treatmentResponse || "Not recorded"}</p>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-slate-900">Recommended Actions</h3>
            {assessment.recommendedActions.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                {assessment.recommendedActions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">No recommended actions recorded.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-slate-900">Key Observation</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assessment.keyObservation || "No key observation recorded."}</p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-slate-900">Clinical Assessment Notes</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assessment.clinicianNotes || "No clinical assessment notes recorded."}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
