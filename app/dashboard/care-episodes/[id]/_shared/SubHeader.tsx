"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CareEpisodeDetail } from "@/lib/api/care-episodes";
import { getHeaderRiskBadge, getInitials, getProgressPercent } from "./utils";

export function SubHeaderSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-[#E5E7EB]" />
      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-[#F3F4F6]" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-52 animate-pulse rounded bg-[#F3F4F6]" />
              <div className="h-4 w-72 animate-pulse rounded bg-[#F3F4F6]" />
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
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#71809B] hover:text-[#111827]"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Care Episode
      </Link>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#023E8A] text-2xl font-bold text-white">
              {getInitials(patientName)}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[#111827] md:text-xl">{patientName}</h1>
                <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", riskBadge.className)}>
                  {riskBadge.label}
                </span>
              </div>
              <p className="text-sm font-medium text-[#71809B]">
                Patient ID: {patient?.hospitalId || "--"} • Age: {patient?.age ?? "--"} • {patient?.gender || "--"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-lg bg-[#EFF5FF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-[#344054]">
              <span className="font-bold text-[#023E8A]">CARE EPISODE:</span> {episode.carePhase || episode.diagnosis || "--"}
              <span className="mx-3 text-[#71809B]">|</span>
              Recovery Day {episode.dayStart ?? 0} of {episode.expectedDurationDays ?? 0}
            </p>
            <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#023E8A]" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="whitespace-nowrap text-xs font-bold text-[#344054]">{progressPercent}% Complete</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
