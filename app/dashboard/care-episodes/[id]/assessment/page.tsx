"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronUp,
  CircleCheck,
  ClipboardList,
  Loader2,
  Sparkles,
  Stethoscope,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getCareEpisodeById, getCurrentUserIdentity, type CareEpisodeDetail } from "@/lib/api/care-episodes";
import { getAssessmentWorkspace, saveAssessment } from "@/lib/api/careTeamAndPlan.api";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { createPlaceholderEpisode } from "../_shared/utils";
import type { AssessmentOutcome, AssessmentWorkspaceEntry } from "../_shared/careTeamTypes";

const OUTCOME_DOT_CLASSNAME: Record<AssessmentOutcome, string> = {
  Improving: "bg-emerald-500",
  Stable: "bg-primary",
  "Delayed Recovery": "bg-amber-500",
  Deteriorating: "bg-red-500",
  Resolved: "bg-emerald-500",
  "No Escalation": "bg-emerald-500",
  Escalated: "bg-red-500",
  "Care Plan Adjustment": "bg-amber-500",
};

const OUTCOME_TO_ESCALATION: Partial<Record<AssessmentOutcome, "Stable" | "Improving" | "Delayed Recovery" | "Escalated">> = {
  Improving: "Improving",
  Stable: "Stable",
  "Delayed Recovery": "Delayed Recovery",
  Deteriorating: "Escalated",
  Resolved: "Stable",
};

function fieldClass(extra = "") {
  return cn(
    "h-11 w-full rounded-lg border border-transparent bg-slate-100 px-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/10",
    extra,
  );
}

function IntelligenceCard({
  icon,
  title,
  confidencePercent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  confidencePercent: number | null;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className="rounded-xl border-border bg-white shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</span>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-500"
          >
            {confidencePercent == null ? "LIVE DATA" : `${confidencePercent}% CONFIDENCE`}
            <ChevronUp className={cn("h-3.5 w-3.5 transition-transform", !expanded && "rotate-180")} />
          </button>
        </div>
        {expanded ? <div className="mt-4">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

function SourceTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-500">
      <CircleCheck className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export default function ClinicalAssessmentWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const displayEpisode = episode ?? createPlaceholderEpisode(episodeId);
  const [workspace, setWorkspace] = useState<AssessmentWorkspaceEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [clinicianName, setClinicianName] = useState("Current clinician");

  const [outcome, setOutcome] = useState<AssessmentOutcome | "">("");
  const [recommendedActions, setRecommendedActions] = useState<string[]>([]);
  const [symptomStatus, setSymptomStatus] = useState("");
  const [treatmentResponse, setTreatmentResponse] = useState("");
  const [keyObservation, setKeyObservation] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  useEffect(() => {
    if (!episodeId) return;
    capturePostHogEvent("clinical_assessment_viewed", { episode_id: episodeId });
    let ignore = false;
    Promise.allSettled([getCareEpisodeById(episodeId), getAssessmentWorkspace(episodeId), getCurrentUserIdentity()]).then(([episodeResult, workspaceResult, userResult]) => {
      if (ignore) return;
      if (episodeResult.status === "fulfilled") setEpisode(episodeResult.value);
      if (workspaceResult.status === "fulfilled") {
        const entry = workspaceResult.value;
        setWorkspace(entry);
        setOutcome("");
        setRecommendedActions([]);
        setSymptomStatus(entry.findings.symptomStatus);
        setTreatmentResponse(entry.findings.treatmentResponse);
        setKeyObservation(entry.findings.keyObservation);
        setClinicalNotes(entry.findings.clinicalNotes);
      }
      if (workspaceResult.status === "rejected") {
        setWorkspaceError(workspaceResult.reason instanceof Error ? workspaceResult.reason.message : "Unable to load assessment data.");
      }
      if (userResult.status === "fulfilled") setClinicianName(userResult.value.name);
      setIsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [episodeId]);

  const toggleAction = (action: string, checked: boolean) => {
    setRecommendedActions((current) => (checked ? Array.from(new Set([...current, action])) : current.filter((item) => item !== action)));
  };

  const handleSave = async () => {
    if (!outcome) {
      toast.error("Select an assessment outcome before saving.");
      return;
    }
    setIsSaving(true);
    try {
      await saveAssessment(episodeId, {
        outcome,
        escalationStatus: OUTCOME_TO_ESCALATION[outcome] ?? "Stable",
        recommendedActions,
        symptomStatus,
        treatmentResponse,
        keyObservation,
        clinicianNotes: clinicalNotes,
        clinicianName,
      });
      capturePostHogEvent("clinical_assessment_saved", { episode_id: episodeId, outcome });
      toast.success("Assessment saved successfully.");
      if (recommendedActions.includes("Adjust Care Plan")) {
        router.push(`/dashboard/care-episodes/${episodeId}/care-plan`);
      } else {
        router.push(`/dashboard/care-episodes/${episodeId}/assessment-history`);
      }
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to save assessment.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <Card className="mx-auto max-w-2xl rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-8 text-center">
          <p className="text-sm font-medium text-red-600">{workspaceError || "Unable to load assessment data."}</p>
          <Button asChild variant="outline" className="mt-4"><Link href={`/dashboard/care-episodes/${episodeId}`}>Back to episode</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
      <Link
        href={`/dashboard/care-episodes/${episodeId}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Clinical Assessment Workspace</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
            <Sparkles className="h-3.5 w-3.5" />
            Episode data loaded
          </span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-slate-500">
          {displayEpisode.patient?.name || "Patient"} · {displayEpisode.patient?.hospitalId || "--"} · Assessment #{workspace.assessmentNumber}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <IntelligenceCard icon={<Stethoscope className="h-5 w-5" />} title="A · Clinical Status Intelligence" confidencePercent={workspace.clinicalStatus.confidencePercent}>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-blue-600">
                <Sparkles className="h-3.5 w-3.5" />
                Clinical Summary
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{workspace.clinicalStatus.summary}</p>
            </div>
            <p className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-[0.06em] text-slate-500">Sources</p>
            <div className="flex flex-wrap gap-2">
              {workspace.clinicalStatus.sources.map((source) => (
                <SourceTag key={source.label} label={source.label} />
              ))}
              {workspace.clinicalStatus.sources.length === 0 ? <span className="text-xs font-medium text-slate-500">No current source data</span> : null}
            </div>
          </IntelligenceCard>

          <IntelligenceCard icon={<ClipboardList className="h-5 w-5" />} title="B · Care Plan Adherence Intelligence" confidencePercent={workspace.carePlanAdherence.confidencePercent}>
            <p className="text-sm font-medium text-slate-500">{workspace.carePlanAdherence.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="text-4xl font-extrabold text-slate-900">{workspace.carePlanAdherence.adherencePercent == null ? "--" : `${workspace.carePlanAdherence.adherencePercent}%`}</span>
              <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${workspace.carePlanAdherence.adherencePercent ?? 0}%` }} />
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-500">
                {workspace.carePlanAdherence.trendLabel}
                {workspace.carePlanAdherence.trendDeltaPercent == null ? "" : ` (${workspace.carePlanAdherence.trendDeltaPercent}%)`}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {workspace.carePlanAdherence.breakdown.map((item) => (
                <span key={item.label} className={cn("inline-flex items-center gap-2 text-sm font-medium", item.positive ? "text-emerald-500" : "text-red-500")}>
                  {item.positive ? <CircleCheck className="h-4 w-4 shrink-0" /> : <XIcon className="h-4 w-4 shrink-0 rounded-full bg-red-50 p-0.5" />}
                  {item.label}
                </span>
              ))}
            </div>
            <p className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-[0.06em] text-slate-500">Sources</p>
            <div className="flex flex-wrap gap-2">
              {workspace.carePlanAdherence.sources.map((source) => (
                <SourceTag key={source.label} label={source.label} />
              ))}
              {workspace.carePlanAdherence.sources.length === 0 ? <span className="text-xs font-medium text-slate-500">No medication data available</span> : null}
            </div>
          </IntelligenceCard>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-500">
              Clinician Responds to Evidence
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Card className="rounded-xl border-border bg-white shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 sm:text-base">Clinician Findings</h2>
                  <p className="text-xs font-medium text-slate-500">Your assessment based on the evidence above</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.04em] text-slate-900">Symptom Status</span>
                  <input value={symptomStatus} onChange={(event) => setSymptomStatus(event.target.value)} className={fieldClass()} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.04em] text-slate-900">Treatment Response</span>
                  <input value={treatmentResponse} onChange={(event) => setTreatmentResponse(event.target.value)} className={fieldClass()} />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.04em] text-slate-900">Key Observation</span>
                <input value={keyObservation} onChange={(event) => setKeyObservation(event.target.value)} className={fieldClass()} />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.04em] text-slate-900">Clinical Assessment Notes</span>
                <Textarea
                  value={clinicalNotes}
                  onChange={(event) => setClinicalNotes(event.target.value)}
                  className={cn(fieldClass(), "min-h-28 resize-none py-3 leading-6")}
                />
              </label>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4">
          <Card className="rounded-xl border-border bg-white shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.06em] text-slate-500">Assessment Outcome</h2>
              <RadioGroup value={outcome} onValueChange={(value) => setOutcome(value as AssessmentOutcome)} className="mt-3 space-y-2">
                {workspace.outcomeOptions.map((option) => {
                  const selected = outcome === option;
                  return (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-sm font-bold transition-colors",
                        selected ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-700",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <RadioGroupItem value={option} className={selected ? "border-amber-500 text-amber-500" : ""} />
                        {option}
                      </span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", OUTCOME_DOT_CLASSNAME[option])} />
                    </label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-white shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.06em] text-slate-500">Recommended Actions</h2>
              <div className="mt-3 space-y-2">
                {workspace.recommendedActions.map((action) => {
                  const checked = recommendedActions.includes(action);
                  return (
                    <label
                      key={action}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm font-bold transition-colors",
                        checked ? "border-primary text-primary" : "border-slate-200 text-slate-700",
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={(next) => toggleAction(action, next === true)} />
                      {action}
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Assessment"
            )}
          </Button>
          <Button
            asChild
            type="button"
            variant="outline"
            disabled={isSaving}
            className="h-11 w-full rounded-xl border-border bg-white text-sm font-bold text-slate-900 hover:bg-slate-50"
          >
            <Link href={`/dashboard/care-episodes/${episodeId}`}>Cancel</Link>
          </Button>
          <p className="text-center text-xs font-medium text-slate-500">{clinicianName} · auto-timestamped</p>
        </aside>
      </div>
    </div>
  );
}
