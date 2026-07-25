"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CareEpisodeDetail } from "@/lib/api/care-episodes";
import { getHeaderRiskBadge, getInitials, getProgressPercent } from "./utils";

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
}: {
  episodeId: string;
  episode: CareEpisodeDetail;
}) {
  const patient = episode.patient;
  const patientName = patient?.name || "Unknown Patient";
  const riskBadge = getHeaderRiskBadge(episode.riskCategory);
  const progressPercent = getProgressPercent(episode.dayStart, episode.expectedDurationDays);

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/care-episodes/${episodeId}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Care Episode
      </Link>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
              {getInitials(patientName)}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 md:text-xl">{patientName}</h1>
                <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                  {riskBadge.label}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500">
                Patient ID: {patient?.hospitalId || "--"} • Age: {patient?.age ?? "--"} • {patient?.gender || "--"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-lg bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-700">
              <span className="font-bold text-primary">CARE EPISODE:</span> {episode.carePhase || episode.diagnosis || "--"}
              <span className="mx-3 text-slate-500">|</span>
              Recovery Day {episode.dayStart ?? 0} of {episode.expectedDurationDays ?? 0}
            </p>
            <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="whitespace-nowrap text-xs font-bold text-slate-700">{progressPercent}% Complete</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
