"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileCheck2,
  Gauge,
  History,
  Lock,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getClosedEpisodeSummary } from "@/lib/api/episodeClosure.api";
import { getAvatarColor, getInitials } from "../_shared/utils";
import type { ClosedEpisodeRecord } from "../_shared/episodeClosureTypes";

const ESCALATION_BADGE_CLASSNAME: Record<string, string> = {
  Stable: "bg-emerald-50 text-emerald-600",
  Improving: "bg-amber-50 text-amber-600",
  "Delayed Recovery": "bg-destructive/10 text-destructive",
  Escalated: "bg-destructive/10 text-destructive",
};

const OUTCOME_TEXT_CLASSNAME: Record<string, string> = {
  "No Escalation": "text-emerald-600",
  Escalated: "text-destructive",
  "Care Plan Adjustment": "text-amber-600",
};

const CARE_PLAN_STATUS_CLASSNAME: Record<string, string> = {
  Superseded: "bg-muted text-muted-foreground",
  Updated: "bg-primary/10 text-primary",
  Completed: "bg-emerald-50 text-emerald-600",
};


function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return { datePart: "--", timePart: "--" };
  const date = new Date(parsed);
  return {
    datePart: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date),
    timePart: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

function ReadOnlyBadge() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-border px-2 text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
      <Lock className="h-3 w-3 shrink-0" />
      Read-Only
    </span>
  );
}

function IconContainer({ children }: { children: React.ReactNode }) {
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{children}</span>;
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <IconContainer>{icon}</IconContainer>
      <div>
        <h2 className="text-sm font-bold text-foreground sm:text-base">{title}</h2>
        {subtitle ? <p className="text-xs font-medium text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function ExpandableCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className="w-full rounded-xl border-border bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading icon={icon} title={title} subtitle={subtitle} />
          <div className="flex shrink-0 items-center gap-2">
            <ReadOnlyBadge />
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {expanded ? <div className="mt-4">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

function ClosureArtifactCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      <IconContainer>{icon}</IconContainer>
      <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function ClosedEpisodeSummaryPage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";

  const [record, setRecord] = useState<ClosedEpisodeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (episodeId) capturePostHogEvent("closed_episode_summary_viewed", { episode_id: episodeId });
  }, [episodeId]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    getClosedEpisodeSummary(episodeId)
      .then((result) => { if (!ignore) setRecord(result); })
      .catch((requestError) => { if (!ignore) setError(requestError instanceof Error ? requestError.message : "Unable to load the closed episode summary."); })
      .finally(() => { if (!ignore) setIsLoading(false); });
    return () => {
      ignore = true;
    };
  }, [episodeId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1080px] space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !record) {
    return <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center"><AlertCircle className="h-8 w-8 text-destructive" /><p className="text-sm font-semibold text-destructive">{error || "Closed episode summary is unavailable."}</p><Button asChild variant="outline"><Link href="/dashboard/care-episodes">Back to Care Episodes</Link></Button></div>;
  }

  const { patient, overview, closureRecord, aiClosureSummary, intelligenceSummary, assessmentHistory, carePlanHistory, interventionsLog, closureArtifacts } =
    record;
  const closureDateTime = formatDateTime(closureRecord.closureDateTime);

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-3 pb-8">
      <Card className="w-full rounded-xl border-border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: getAvatarColor(patient.name) }}
            >
              {getInitials(patient.name)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-foreground md:text-xl">{patient.name}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Closed · {formatDate(patient.closedDate)}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Patient ID: {patient.patientCode} · Age: {patient.age ?? "--"} · {patient.gender}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                Episode ID: {patient.episodeCode}
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{patient.diagnosisTag}</span>
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-11 gap-2 rounded-xl border-border bg-card px-5 text-sm font-bold text-foreground hover:bg-muted/60">
            <Link href="/dashboard/care-episodes">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid w-full min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="w-full h-full rounded-xl border-border bg-card shadow-sm">
          <CardContent className="h-full p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading icon={<ClipboardList className="h-4.5 w-4.5" />} title="Episode overview" />
              <ReadOnlyBadge />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Facility / Provider</p>
                <p className="mt-1 text-sm font-bold text-foreground">{overview.facility}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Assigned Clinician</p>
                <p className="mt-1 text-sm font-bold text-foreground">{overview.assignedClinician}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Diagnosis</p>
                <p className="mt-1 text-sm font-bold text-foreground">{overview.diagnosis}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Opened</p>
                <p className="mt-1 text-sm font-bold text-foreground">{formatDate(overview.openedDate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Closed</p>
                <p className="mt-1 text-sm font-bold text-foreground">{formatDate(overview.closedDate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Total Duration</p>
                <p className="mt-1 text-sm font-bold text-foreground">{overview.totalDurationDays == null ? "--" : `${overview.totalDurationDays} days`}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Closure Reason</p>
                <p className="mt-1 text-sm font-bold text-foreground">{overview.closureReason}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Outcome</p>
                <p className="mt-1 text-sm font-bold text-emerald-600">{overview.outcome}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Care Phase at Closure</p>
                <p className="mt-1 text-sm font-bold text-foreground">{overview.carePhaseAtClosure}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full h-full rounded-xl border-border bg-card shadow-sm">
          <CardContent className="h-full p-4">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading icon={<ShieldCheck className="h-4.5 w-4.5" />} title="Closure record" />
              <ReadOnlyBadge />
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Closed By</p>
                <p className="mt-1 font-bold text-foreground">
                  {closureRecord.closedBy}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Closure Date &amp; Time</p>
                <p className="mt-1 font-bold text-foreground">
                  {closureDateTime.datePart} · {closureDateTime.timePart}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Closure Reason</p>
                <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{closureRecord.closureReason}</span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Final Notes</p>
                <p className="mt-1 italic leading-6 text-foreground/80">{closureRecord.finalNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full rounded-xl border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading icon={<Sparkles className="h-4.5 w-4.5" />} title="AI Episode Closure Summary" />
            <ReadOnlyBadge />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              {aiClosureSummary.statusBadge}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              <Lock className="h-3 w-3" />
              {aiClosureSummary.frozenAtLabel}
            </span>
          </div>
          <div className="mt-2 space-y-1.5 text-xs leading-5 text-foreground/80">
            {aiClosureSummary.narrative.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-primary/20 pt-2 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Medication adherence</p>
              <p className="mt-1 text-xl font-extrabold text-foreground">{aiClosureSummary.medicationAdherencePercent == null ? "--" : `${aiClosureSummary.medicationAdherencePercent}%`}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Check-in completion</p>
              <p className="mt-1 text-xl font-extrabold text-foreground">{aiClosureSummary.checkInCompletionPercent == null ? "--" : `${aiClosureSummary.checkInCompletionPercent}%`}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Emergency escalations</p>
              <p className="mt-1 text-xl font-extrabold text-foreground">{aiClosureSummary.emergencyEscalations == null ? "--" : aiClosureSummary.emergencyEscalations}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">Monitoring days</p>
              <p className="mt-1 text-xl font-extrabold text-foreground">
                {aiClosureSummary.monitoringDays.completed == null || aiClosureSummary.monitoringDays.total == null
                  ? "--"
                  : `${aiClosureSummary.monitoringDays.completed}/${aiClosureSummary.monitoringDays.total}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full h-full rounded-xl border-border bg-card shadow-sm">
        <CardContent className="h-full p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading icon={<Gauge className="h-4.5 w-4.5" />} title="Episode Intelligence Summary" subtitle="Risk, alerts and clinical activity across the full episode" />
            <ReadOnlyBadge />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-emerald-600" />
                Risk Trend
              </p>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Opening</p>
                  <p className="text-xl font-extrabold text-destructive">{intelligenceSummary.riskTrend.opening ?? "--"}</p>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Closing</p>
                  <p className="text-xl font-extrabold text-emerald-600">{intelligenceSummary.riskTrend.closing ?? "--"}</p>
                </div>
              </div>
              {intelligenceSummary.riskTrend.improvementPercent == null ? <p className="mt-2 text-xs text-muted-foreground">Opening risk score unavailable</p> : <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><TrendingDown className="h-3.5 w-3.5" />{intelligenceSummary.riskTrend.improvementPercent}% improvement</p>}
            </div>

            <div className="rounded-xl border border-border p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Alert Summary
              </p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total alerts</dt>
                  <dd className="font-bold text-foreground">{intelligenceSummary.alertSummary.totalAlerts}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Critical</dt>
                  <dd className="font-bold text-destructive">{intelligenceSummary.alertSummary.critical}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Moderate</dt>
                  <dd className="font-bold text-amber-600">{intelligenceSummary.alertSummary.moderate}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Low</dt>
                  <dd className="font-bold text-foreground">{intelligenceSummary.alertSummary.low}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <dt className="text-muted-foreground">Resolved</dt>
                  <dd className="font-bold text-emerald-600">
                    {intelligenceSummary.alertSummary.resolved.count} / {intelligenceSummary.alertSummary.resolved.total}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-border p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Activity className="h-4 w-4 text-primary" />
                Clinical Activity
              </p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Assessments</dt>
                  <dd className="font-bold text-foreground">{intelligenceSummary.clinicalActivity.assessments}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Care plan adjustments</dt>
                  <dd className="font-bold text-foreground">{intelligenceSummary.clinicalActivity.carePlanAdjustments}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Specialist escalations</dt>
                  <dd className="font-bold text-foreground">{intelligenceSummary.clinicalActivity.specialistEscalations}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Emergency escalations</dt>
                  <dd className="font-bold text-foreground">{intelligenceSummary.clinicalActivity.emergencyEscalations == null ? "--" : intelligenceSummary.clinicalActivity.emergencyEscalations}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <dt className="text-muted-foreground">Interventions logged</dt>
                  <dd className="font-bold text-foreground">{intelligenceSummary.clinicalActivity.interventionsLogged}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExpandableCard
        icon={<Stethoscope className="h-4.5 w-4.5" />}
        title="Clinical Assessment History"
        subtitle={`${assessmentHistory.length} assessments · clinician reasoning across the episode`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="bg-primary/5">
              <tr>
                {["DATE & TIME", "OUTCOME", "ESCALATION", "KEY OBSERVATION", "CLINICIAN"].map((heading) => (
                  <th key={heading} className="h-12 px-4 text-left text-xs font-bold text-muted-foreground">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assessmentHistory.length === 0 ? <tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-muted-foreground">No clinical assessments were recorded for this episode.</td></tr> : null}
              {assessmentHistory.map((assessment) => {
                const { datePart, timePart } = formatDateTime(assessment.date);
                return (
                  <tr key={assessment.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 align-top">
                      <span className="block font-bold text-foreground">{datePart}</span>
                      <span className="mt-0.5 block text-xs font-medium text-muted-foreground">{timePart}</span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", ESCALATION_BADGE_CLASSNAME[assessment.escalationStatus] ?? "bg-muted text-muted-foreground")}>
                        {assessment.escalationStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold", OUTCOME_TEXT_CLASSNAME[assessment.outcome] ?? "text-muted-foreground")}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {assessment.outcome}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-4 align-top text-sm text-foreground/80">{assessment.clinicianNotes}</td>
                    <td className="px-3 py-3 align-top text-sm font-medium text-foreground/80">{assessment.clinicianName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ExpandableCard>

      <ExpandableCard icon={<History className="h-4.5 w-4.5" />} title="Care Plan History" subtitle={`${carePlanHistory.length} versions · interventions attempted during episode`}>
        <div className="space-y-2">
          {carePlanHistory.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No care-plan version events were found.</p> : null}
          {carePlanHistory.map((version, index) => {
            const { datePart, timePart } = formatDateTime(version.date);
            return (
              <div key={`${version.version}-${version.date}`} className="relative pl-6">
                {index < carePlanHistory.length - 1 ? <span className="absolute left-[5px] top-3 h-full w-px bg-border" /> : null}
                <span className={cn("absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full", version.status === "Completed" ? "bg-emerald-600" : version.status === "Updated" ? "bg-primary" : "bg-muted-foreground")} />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-foreground">{version.title}</p>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{version.version}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", CARE_PLAN_STATUS_CLASSNAME[version.status])}>{version.status}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {datePart} · {timePart} · {version.author}
                </p>
                <p className="mt-1 text-xs leading-5 text-foreground/80">{version.description}</p>
              </div>
            );
          })}
        </div>
      </ExpandableCard>

      <ExpandableCard icon={<Syringe className="h-4.5 w-4.5" />} title="Interventions log">
        <div className="overflow-x-auto">
          {interventionsLog.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No intervention events were found.</p>
          ) : (
          <table className="w-full min-w-[680px] border-collapse">
            <thead className="bg-primary/5">
              <tr>
                {["INTERVENTION", "DATE", "CLINICIAN", "LINKED TRIGGER"].map((heading) => (
                  <th key={heading} className="h-12 px-4 text-left text-xs font-bold text-muted-foreground">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {interventionsLog.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3 align-top">
                    <span className="block font-bold text-foreground">{entry.intervention}</span>
                    <span className="mt-0.5 block text-xs font-medium text-muted-foreground">{entry.description}</span>
                  </td>
                  <td className="px-3 py-3 align-top text-sm font-medium text-foreground/80">{formatDate(entry.date)}</td>
                  <td className="px-3 py-3 align-top text-sm font-medium text-foreground/80">{entry.clinicianName}</td>
                  <td className="px-3 py-3 align-top text-sm text-foreground/80">{entry.linkedTrigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </ExpandableCard>


      <Card className="w-full h-full rounded-xl border-border bg-card shadow-sm">
        <CardContent className="h-full p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading icon={<FileCheck2 className="h-4.5 w-4.5" />} title="Closure Artifacts" subtitle="Final preserved records at episode close" />
            <ReadOnlyBadge />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ClosureArtifactCard icon={<Stethoscope className="h-4 w-4" />} {...closureArtifacts.finalClinicalAssessment} />
            <ClosureArtifactCard icon={<History className="h-4 w-4" />} {...closureArtifacts.finalCarePlanVersion} />
            <ClosureArtifactCard icon={<Activity className="h-4 w-4" />} {...closureArtifacts.finalRecoveryStatus} />
            <ClosureArtifactCard icon={<Gauge className="h-4 w-4" />} {...closureArtifacts.finalRiskScore} />
            <ClosureArtifactCard icon={<ClipboardList className="h-4 w-4" />} {...closureArtifacts.finalPatientInstructions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}