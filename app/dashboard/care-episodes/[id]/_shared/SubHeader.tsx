"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CareEpisodeDetail } from "@/lib/api/care-episodes";
import { getHeaderRiskBadge, getInitials, getProgressPercent, humanizeSlug } from "./utils";

export function SubHeaderSkeleton({ episodeId }: { episodeId?: string }) {
  return (
    <div className="space-y-6">
      {episodeId ? (
        <Link
          href={`/dashboard/care-episodes/${episodeId}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Care Episode
        </Link>
      ) : (
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      )}
      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-slate-100" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-52 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CareEpisodeSubHeader({
  episodeId,
  episode,
  variant = "default",
}: {
  episodeId: string;
  episode: CareEpisodeDetail;
  variant?: "default" | "timeline";
}) {
  const patient = episode.patient;
  const patientName = patient?.name || "Unknown Patient";
  const riskBadge = getHeaderRiskBadge(episode.riskCategory);
  const progressPercent = getProgressPercent(episode.currentDay ?? episode.dayStart, episode.expectedDurationDays);
  const recoveryDay = episode.currentDay ?? episode.dayStart;
  const isTimeline = variant === "timeline";

  return (
    <div className={cn("space-y-6", isTimeline && "space-y-4")}>
      <Link
        href={`/dashboard/care-episodes/${episodeId}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Care Episode
      </Link>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className={cn("p-4 sm:p-6", isTimeline && "p-4")}>
          <div className="flex items-start gap-4">
            <span className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white",
              isTimeline ? "h-16 w-16 text-xl" : "h-20 w-20 text-2xl",
            )}>
              {getInitials(patientName)}
            </span>
            <div className={cn("min-w-0 flex-1 space-y-2", isTimeline && "space-y-1.5")}>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={cn("font-bold text-slate-900", isTimeline ? "text-base md:text-lg" : "text-lg md:text-xl")}>{patientName}</h1>
                <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                  {riskBadge.label}
                </span>
              </div>
              <p className={cn("font-medium text-slate-500", isTimeline ? "text-xs" : "text-sm")}>
                Patient ID: {patient?.hospitalId || "--"} • Age: {patient?.age ?? "--"} • {humanizeSlug(patient?.gender || "") || "--"}
              </p>
            </div>
          </div>

          {isTimeline ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-primary">
                <span className="font-bold">Diagnosis:</span> {episode.diagnosis || "--"}
              </span>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-primary">
                Recovery Day {recoveryDay ?? "--"} of {episode.expectedDurationDays ?? "--"}
              </span>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3 rounded-lg bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-700">
                <span className="font-bold text-primary">CARE EPISODE:</span> {episode.carePhase || episode.diagnosis || "--"}
                <span className="mx-3 text-slate-500">|</span>
                Recovery Day {recoveryDay ?? 0} of {episode.expectedDurationDays ?? 0}
              </p>
              <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="whitespace-nowrap text-xs font-bold text-slate-700">{progressPercent}% Complete</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
