"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";
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
import { getCareEpisodeById, type CareEpisodeDetail } from "@/lib/api/care-episodes";
import { getAssessmentHistory } from "@/lib/api/careTeamAndPlan.api";
import { CareEpisodeSubHeader, SubHeaderSkeleton } from "../_shared/SubHeader";
import { createPlaceholderEpisode, formatLongDate, formatTime } from "../_shared/utils";
import type { Assessment } from "../_shared/careTeamTypes";

const ESCALATION_BADGE_CLASSNAME: Record<string, string> = {
  Stable: "bg-[#DFFBF0] text-[#10B981]",
  Improving: "bg-[#FFF4E5] text-[#F59E0B]",
  "Delayed Recovery": "bg-[#FFECEC] text-[#EF4444]",
  Escalated: "bg-[#FFECEC] text-[#EF4444]",
};

const OUTCOME_TEXT_CLASSNAME: Record<string, string> = {
  "No Escalation": "text-[#10B981]",
  Escalated: "text-[#EF4444]",
  "Care Plan Adjustment": "text-[#F59E0B]",
};

export default function AssessmentHistoryPage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const displayEpisode = episode ?? createPlaceholderEpisode(episodeId);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clinicianFilter, setClinicianFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    Promise.allSettled([getCareEpisodeById(episodeId), getAssessmentHistory(episodeId)]).then(([episodeResult, assessmentResult]) => {
      if (ignore) return;
      if (episodeResult.status === "fulfilled") setEpisode(episodeResult.value);
      if (assessmentResult.status === "fulfilled") setAssessments(assessmentResult.value);
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
      if (dateTo && Date.parse(assessment.date) > Date.parse(dateTo)) return false;
      return true;
    });
  }, [assessments, clinicianFilter, outcomeFilter, dateFrom, dateTo]);

  const hasFilters = Boolean(dateFrom || dateTo || clinicianFilter !== "all" || outcomeFilter !== "all");

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setClinicianFilter("all");
    setOutcomeFilter("all");
  };

  const exportCsv = () => {
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
      <div className="space-y-6">
        <SubHeaderSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CareEpisodeSubHeader episodeId={episodeId} episode={displayEpisode} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#111827] md:text-2xl">Assessment History</h1>
          <p className="mt-2 text-sm font-medium text-[#71809B]">
            {displayEpisode.patient?.name || "Patient"} · {displayEpisode.patient?.hospitalId || "--"} · <strong>{assessments.length} Assessments</strong>
          </p>
        </div>
        <Button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="h-11 gap-2 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575]"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 border-b border-[#E5E7EB] pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Date Range</span>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 text-sm font-medium text-[#344054] outline-none sm:w-36"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 text-sm font-medium text-[#344054] outline-none sm:w-36"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Clinician</span>
                <Select value={clinicianFilter} onValueChange={setClinicianFilter}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-[#DDE3EC] text-sm font-medium text-[#344054] sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#DDE3EC]">
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
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Outcome</span>
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-[#DDE3EC] text-sm font-medium text-[#344054] sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#DDE3EC]">
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
              <button type="button" onClick={clearFilters} className="text-sm font-bold text-[#023E8A] hover:underline">
                Clear all filters
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm font-medium text-[#71809B]">No assessments match the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead className="bg-[#EFF5FF]">
                  <tr>
                    {["DATE / TIME", "ESCALATION STATUS", "ASSESSMENT OUTCOME", "CLINICIAN NOTES", "CLINICIAN NAME"].map((heading) => (
                      <th key={heading} className="h-14 px-4 text-left text-xs font-bold text-[#71809B]">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((assessment) => (
                    <tr key={assessment.id} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-4 py-5 align-top">
                        <span className="block font-bold text-[#111827]">{formatLongDate(assessment.date)}</span>
                        <span className="mt-1 block text-xs font-medium text-[#71809B]">{formatTime(assessment.date)}</span>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                            ESCALATION_BADGE_CLASSNAME[assessment.escalationStatus] ?? "bg-[#F3F4F6] text-[#71809B]",
                          )}
                        >
                          {assessment.escalationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-sm font-bold",
                            OUTCOME_TEXT_CLASSNAME[assessment.outcome] ?? "text-[#71809B]",
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {assessment.outcome}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-5 align-top text-sm text-[#344054]">{assessment.clinicianNotes}</td>
                      <td className="px-4 py-5 align-top text-sm font-medium text-[#344054]">{assessment.clinicianName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 ? (
            <p className="mt-4 text-sm font-medium text-[#71809B]">
              Showing 1-{filtered.length} of {filtered.length} Assessments
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
