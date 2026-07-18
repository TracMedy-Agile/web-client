"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileCheck2,
  Gauge,
  History,
  ListTree,
  Lock,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  TrendingDown,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getClosedEpisodeSummary } from "@/lib/api/episodeClosure.api";
import { getAvatarColor, getInitials } from "../_shared/utils";
import type { ClosedEpisodeRecord, TimelineEventStatus, TimelineEventType } from "../_shared/episodeClosureTypes";

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

const CARE_PLAN_STATUS_CLASSNAME: Record<string, string> = {
  Superseded: "bg-[#F3F4F6] text-[#71809B]",
  Updated: "bg-[#E7F2FF] text-[#1769C2]",
  Completed: "bg-[#DFFBF0] text-[#10B981]",
};

const TIMELINE_STATUS_CLASSNAME: Record<TimelineEventStatus, string> = {
  Critical: "bg-[#FFECEC] text-[#EF4444]",
  Completed: "bg-[#DFFBF0] text-[#10B981]",
  Missed: "bg-[#FFF4E5] text-[#F59E0B]",
  Pending: "bg-[#F3F4F6] text-[#71809B]",
};

const TIMELINE_ICON_CLASSNAME: Record<TimelineEventType, string> = {
  Alert: "bg-[#FFECEC] text-[#EF4444]",
  "Check-in": "bg-[#DFFBF0] text-[#10B981]",
  Clinician: "bg-[#E7F2FF] text-[#1769C2]",
  Medication: "bg-[#FFF4E5] text-[#F59E0B]",
  System: "bg-[#F3F4F6] text-[#71809B]",
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
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#DDE3EC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[#71809B]">
      <Lock className="h-3 w-3" />
      Read-Only
    </span>
  );
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#E7F2FF] text-[#1769C2]">{icon}</span>
      <div>
        <h2 className="text-sm font-bold text-[#111827] sm:text-base">{title}</h2>
        {subtitle ? <p className="text-xs font-medium text-[#71809B]">{subtitle}</p> : null}
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
    <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading icon={icon} title={title} subtitle={subtitle} />
          <div className="flex shrink-0 items-center gap-2">
            <ReadOnlyBadge />
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#71809B] hover:bg-[#F3F4F6]"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {expanded ? <div className="mt-5">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

function ClosureArtifactCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#E7F2FF] text-[#1769C2]">{icon}</span>
      <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.04em] text-[#71809B]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#111827]">{value}</p>
      <p className="mt-0.5 text-xs font-medium leading-5 text-[#71809B]">{detail}</p>
    </div>
  );
}

export default function ClosedEpisodeSummaryPage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";

  const [record, setRecord] = useState<ClosedEpisodeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    getClosedEpisodeSummary(episodeId).then((result) => {
      if (!ignore) {
        setRecord(result);
        setIsLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [episodeId]);

  if (isLoading || !record) {
    return (
      <div className="mx-auto max-w-[1080px] space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const { patient, overview, closureRecord, aiClosureSummary, intelligenceSummary, assessmentHistory, carePlanHistory, interventionsLog, careTimeline, closureArtifacts } =
    record;
  const closureDateTime = formatDateTime(closureRecord.closureDateTime);
  const timelineGroupLabel = careTimeline.length > 0 ? formatDate(`${careTimeline[0].date}T00:00:00`) : "";

  return (
    <div className="mx-auto max-w-[1080px] space-y-5 pb-10">
      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: getAvatarColor(patient.name) }}
            >
              {getInitials(patient.name)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[#111827] md:text-xl">{patient.name}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-bold text-[#71809B]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#71809B]" />
                  Closed · {formatDate(patient.closedDate)}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-[#71809B]">
                Patient ID: {patient.patientCode} · Age: {patient.age} · {patient.gender}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium text-[#71809B]">
                Episode ID: {patient.episodeCode}
                <span className="inline-flex rounded-full bg-[#E7F2FF] px-2.5 py-0.5 text-xs font-bold text-[#023E8A]">{patient.diagnosisTag}</span>
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-11 gap-2 rounded-xl border-[#DDE3EC] bg-white px-5 text-sm font-bold text-[#111827] hover:bg-[#F8FAFC]">
            <Link href="/dashboard/care-episodes">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading icon={<ClipboardList className="h-4.5 w-4.5" />} title="Episode overview" />
              <ReadOnlyBadge />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Facility / Provider</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{overview.facility}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Assigned Clinician</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{overview.assignedClinician}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Diagnosis</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{overview.diagnosis}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Opened</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{formatDate(overview.openedDate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Closed</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{formatDate(overview.closedDate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Total Duration</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{overview.totalDurationDays} days</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Closure Reason</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{overview.closureReason}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Outcome</p>
                <p className="mt-1 text-sm font-bold text-[#10B981]">{overview.outcome}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Care Phase at Closure</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{overview.carePhaseAtClosure}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading icon={<ShieldCheck className="h-4.5 w-4.5" />} title="Closure record" />
              <ReadOnlyBadge />
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Closed By</p>
                <p className="mt-1 font-bold text-[#111827]">
                  {closureRecord.closedBy} · {closureRecord.closedByRole}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Closure Date &amp; Time</p>
                <p className="mt-1 font-bold text-[#111827]">
                  {closureDateTime.datePart} · {closureDateTime.timePart}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Closure Reason</p>
                <span className="mt-1 inline-flex rounded-full bg-[#E7F2FF] px-2.5 py-1 text-xs font-bold text-[#023E8A]">{closureRecord.closureReason}</span>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#71809B]">Final Notes</p>
                <p className="mt-1 italic leading-6 text-[#344054]">{closureRecord.finalNotes}</p>
              </div>
              <p className="border-t border-[#E5E7EB] pt-3 text-xs font-medium text-[#71809B]">Audit ref: {closureRecord.auditRef}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-[#B9D8FF] bg-[#F0F6FF] shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading icon={<Sparkles className="h-4.5 w-4.5" />} title="AI Episode Closure Summary" />
            <ReadOnlyBadge />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DFFBF0] px-3 py-1 text-xs font-bold text-[#10B981]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {aiClosureSummary.statusBadge}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#71809B]">
              <Lock className="h-3.5 w-3.5" />
              {aiClosureSummary.frozenAtLabel}
            </span>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#344054]">
            {aiClosureSummary.narrative.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#D6E7FF] pt-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-[#71809B]">Medication adherence</p>
              <p className="mt-1 text-2xl font-extrabold text-[#111827]">{aiClosureSummary.medicationAdherencePercent}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#71809B]">Check-in completion</p>
              <p className="mt-1 text-2xl font-extrabold text-[#111827]">{aiClosureSummary.checkInCompletionPercent}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#71809B]">Emergency escalations</p>
              <p className="mt-1 text-2xl font-extrabold text-[#111827]">{aiClosureSummary.emergencyEscalations}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#71809B]">Monitoring days</p>
              <p className="mt-1 text-2xl font-extrabold text-[#111827]">
                {aiClosureSummary.monitoringDays.completed}/{aiClosureSummary.monitoringDays.total}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading icon={<Gauge className="h-4.5 w-4.5" />} title="Episode Intelligence Summary" subtitle="Risk, alerts and clinical activity across the full episode" />
            <ReadOnlyBadge />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#71809B]">
                <TrendingDown className="h-4 w-4 text-[#10B981]" />
                Risk Trend
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-[#71809B]">Opening</p>
                  <p className="text-2xl font-extrabold text-[#EF4444]">{intelligenceSummary.riskTrend.opening}</p>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-[#71809B]" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-[#71809B]">Closing</p>
                  <p className="text-2xl font-extrabold text-[#10B981]">{intelligenceSummary.riskTrend.closing}</p>
                </div>
              </div>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#10B981]">
                <TrendingDown className="h-3.5 w-3.5" />
                {intelligenceSummary.riskTrend.improvementPercent}% improvement
              </p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#71809B]">
                <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                Alert Summary
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Total alerts</dt>
                  <dd className="font-bold text-[#111827]">{intelligenceSummary.alertSummary.totalAlerts}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Critical</dt>
                  <dd className="font-bold text-[#EF4444]">{intelligenceSummary.alertSummary.critical}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Moderate</dt>
                  <dd className="font-bold text-[#F59E0B]">{intelligenceSummary.alertSummary.moderate}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Low</dt>
                  <dd className="font-bold text-[#111827]">{intelligenceSummary.alertSummary.low}</dd>
                </div>
                <div className="flex justify-between border-t border-[#E5E7EB] pt-2">
                  <dt className="text-[#71809B]">Resolved</dt>
                  <dd className="font-bold text-[#10B981]">
                    {intelligenceSummary.alertSummary.resolved.count} / {intelligenceSummary.alertSummary.resolved.total}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#71809B]">
                <Activity className="h-4 w-4 text-[#023E8A]" />
                Clinical Activity
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Assessments</dt>
                  <dd className="font-bold text-[#111827]">{intelligenceSummary.clinicalActivity.assessments}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Care plan adjustments</dt>
                  <dd className="font-bold text-[#111827]">{intelligenceSummary.clinicalActivity.carePlanAdjustments}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Specialist escalations</dt>
                  <dd className="font-bold text-[#111827]">{intelligenceSummary.clinicalActivity.specialistEscalations}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#71809B]">Emergency escalations</dt>
                  <dd className="font-bold text-[#111827]">{intelligenceSummary.clinicalActivity.emergencyEscalations}</dd>
                </div>
                <div className="flex justify-between border-t border-[#E5E7EB] pt-2">
                  <dt className="text-[#71809B]">Interventions logged</dt>
                  <dd className="font-bold text-[#111827]">{intelligenceSummary.clinicalActivity.interventionsLogged}</dd>
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
            <thead className="bg-[#EFF5FF]">
              <tr>
                {["DATE & TIME", "OUTCOME", "ESCALATION", "KEY OBSERVATION", "CLINICIAN"].map((heading) => (
                  <th key={heading} className="h-12 px-4 text-left text-xs font-bold text-[#71809B]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assessmentHistory.map((assessment) => {
                const { datePart, timePart } = formatDateTime(assessment.date);
                return (
                  <tr key={assessment.id} className="border-b border-[#E5E7EB] last:border-0">
                    <td className="px-4 py-4 align-top">
                      <span className="block font-bold text-[#111827]">{datePart}</span>
                      <span className="mt-0.5 block text-xs font-medium text-[#71809B]">{timePart}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", ESCALATION_BADGE_CLASSNAME[assessment.escalationStatus] ?? "bg-[#F3F4F6] text-[#71809B]")}>
                        {assessment.escalationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold", OUTCOME_TEXT_CLASSNAME[assessment.outcome] ?? "text-[#71809B]")}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {assessment.outcome}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-4 align-top text-sm text-[#344054]">{assessment.clinicianNotes}</td>
                    <td className="px-4 py-4 align-top text-sm font-medium text-[#344054]">{assessment.clinicianName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ExpandableCard>

      <ExpandableCard icon={<History className="h-4.5 w-4.5" />} title="Care Plan History" subtitle={`${carePlanHistory.length} versions · interventions attempted during episode`}>
        <div className="space-y-5">
          {carePlanHistory.map((version, index) => {
            const { datePart, timePart } = formatDateTime(version.date);
            return (
              <div key={version.version} className="relative pl-6">
                {index < carePlanHistory.length - 1 ? <span className="absolute left-[5px] top-3 h-full w-px bg-[#DDE3EC]" /> : null}
                <span className={cn("absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full", version.status === "Completed" ? "bg-[#10B981]" : version.status === "Updated" ? "bg-[#023E8A]" : "bg-[#AAB4C2]")} />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[#111827]">{version.title}</p>
                  <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold text-[#71809B]">{version.version}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", CARE_PLAN_STATUS_CLASSNAME[version.status])}>{version.status}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#71809B]">
                  {datePart} · {timePart} · {version.author}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-[#344054]">{version.description}</p>
              </div>
            );
          })}
        </div>
      </ExpandableCard>

      <ExpandableCard icon={<Syringe className="h-4.5 w-4.5" />} title="Interventions log">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead className="bg-[#EFF5FF]">
              <tr>
                {["INTERVENTION", "DATE", "CLINICIAN", "LINKED TRIGGER"].map((heading) => (
                  <th key={heading} className="h-12 px-4 text-left text-xs font-bold text-[#71809B]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {interventionsLog.map((entry) => (
                <tr key={entry.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-4 py-4 align-top">
                    <span className="block font-bold text-[#111827]">{entry.intervention}</span>
                    <span className="mt-0.5 block text-xs font-medium text-[#71809B]">{entry.description}</span>
                  </td>
                  <td className="px-4 py-4 align-top text-sm font-medium text-[#344054]">{formatDate(entry.date)}</td>
                  <td className="px-4 py-4 align-top text-sm font-medium text-[#344054]">{entry.clinicianName}</td>
                  <td className="px-4 py-4 align-top text-sm text-[#344054]">{entry.linkedTrigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ExpandableCard>

      <ExpandableCard icon={<ListTree className="h-4.5 w-4.5" />} title="Unified Care Timeline">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.06em] text-[#71809B]">{timelineGroupLabel}</p>
        <div className="space-y-3">
          {careTimeline.map((event) => (
            <div key={event.id} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-4">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TIMELINE_ICON_CLASSNAME[event.type])}>
                {event.type === "Alert" ? <AlertCircle className="h-4.5 w-4.5" /> : event.type === "Check-in" ? <CheckCircle2 className="h-4.5 w-4.5" /> : event.type === "Clinician" ? <Stethoscope className="h-4.5 w-4.5" /> : event.type === "Medication" ? <Pill className="h-4.5 w-4.5" /> : <ClipboardList className="h-4.5 w-4.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[#111827]">{event.title}</p>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold", TIMELINE_STATUS_CLASSNAME[event.status])}>{event.status}</span>
                </div>
                <p className="mt-0.5 text-sm text-[#71809B]">{event.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-[#71809B]">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {event.time}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {event.source}
                  </span>
                  <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold text-[#71809B]">{event.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ExpandableCard>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading icon={<FileCheck2 className="h-4.5 w-4.5" />} title="Closure Artifacts" subtitle="Final preserved records at episode close" />
            <ReadOnlyBadge />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
