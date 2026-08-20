"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronLeft, Plus, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getCareEpisodeById,
  removeCareTeamMember,
  type CareEpisodeDetail,
  type CareTeamMember,
} from "@/lib/api/care-episodes";
import { createPlaceholderEpisode, formatLongDate, getAvatarColor, getInitials, humanizeSlug } from "../_shared/utils";
import { AddClinicianModal } from "./components/AddClinicianModal";

function roleBadgeClass(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes("nurse")) return "bg-violet-50 text-violet-600";
  if (normalized.includes("pharm")) return "bg-amber-50 text-amber-700";
  if (normalized.includes("physio")) return "bg-emerald-50 text-emerald-600";
  return "bg-blue-50 text-primary";
}

function roleLabel(role: string) {
  return humanizeSlug(role) || "Doctor";
}

function CareTeamSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="h-8 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-11 w-36 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="h-[520px] animate-pulse rounded-xl bg-white shadow-sm" />
    </div>
  );
}

export default function CareTeamPage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";
  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [team, setTeam] = useState<CareTeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removingClinicianId, setRemovingClinicianId] = useState("");
  const displayEpisode = episode ?? createPlaceholderEpisode(episodeId);

  async function refreshTeam() {
    const detail = await getCareEpisodeById(episodeId);
    setEpisode(detail);
    setTeam(detail.careTeam);
  }

  async function removeMember(member: CareTeamMember) {
    setRemovingClinicianId(member.clinicianId);
    try {
      await removeCareTeamMember(episodeId, member.clinicianId);
      capturePostHogEvent("care_team_member_removed", {
        episode_id: episodeId,
        clinician_id: member.clinicianId,
      });
      await refreshTeam();
      toast.success(`${member.name} was removed from the care team.`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Unable to remove this clinician.");
    } finally {
      setRemovingClinicianId("");
    }
  }

  useEffect(() => {
    if (!episodeId) return;
    capturePostHogEvent("care_team_viewed", { episode_id: episodeId });
    let ignore = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const detail = await getCareEpisodeById(episodeId);
        if (!ignore) {
          setEpisode(detail);
          setTeam(detail.careTeam);
        }
      } catch (requestError) {
        if (!ignore) setError(requestError instanceof Error ? requestError.message : "Unable to load the care team.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [episodeId]);

  if (isLoading) return <CareTeamSkeleton />;

  const patientName = displayEpisode.patient?.name || "this patient";
  const patientCode = displayEpisode.patient?.hospitalId || displayEpisode.patientId || "--";

  return (
    <div className="space-y-6 pb-8">
      <Link href={`/dashboard/care-episodes/${episodeId}`} aria-label="Back to care episode" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200/70 text-slate-800 transition hover:bg-slate-300">
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-slate-900 md:text-[28px]">Care Team</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            Shared ownership and coordinated care for {patientName}{patientCode !== "--" ? ` • ${patientCode}` : ""}.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            capturePostHogEvent("add_clinician_opened", { episode_id: episodeId });
            setIsModalOpen(true);
          }}
          className="h-11 gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-none hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Clinician
        </Button>
      </div>

      <Card className="rounded-xl border border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-5">
            <UsersRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-900">Clinicians</h2>
            <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{team.length}</span>
          </div>

          {error ? <p className="py-12 text-center text-sm font-medium text-red-600">{error}</p> : null}
          {!error && team.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 px-6 py-12 text-center">
              <UsersRound className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-900">No clinicians assigned yet</p>
              <p className="mt-1 max-w-md text-sm font-medium leading-6 text-slate-500">
                Add clinicians from the hospital directory to coordinate care for this episode.
              </p>
            </div>
          ) : null}
          {!error && team.length > 0 ? (
            <div className="space-y-3">
              {team.map((member) => (
                <article key={member.id} className="grid gap-4 rounded-xl border border-border bg-white px-4 py-4 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center md:px-6 md:py-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm"
                      style={{ backgroundColor: getAvatarColor(member.name) }}
                    >
                      {getInitials(member.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-bold text-slate-900">{member.name}</h3>
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", roleBadgeClass(member.role))}>
                          {roleLabel(member.role)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-500">Care team member</p>
                      <p className="mt-2 text-sm font-semibold text-primary">Added {formatLongDate(member.assignedAt)}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Role</p>
                    <div className="flex h-10 items-center justify-between rounded-lg border border-border bg-white px-3 text-sm font-semibold text-slate-700">
                      <span>{roleLabel(member.role)}</span>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    disabled={removingClinicianId === member.clinicianId}
                    onClick={() => void removeMember(member)}
                    className="h-10 justify-start gap-2 px-0 text-xs font-extrabold uppercase tracking-[0.04em] text-red-500 hover:bg-red-50 hover:text-red-600 md:justify-center md:px-3"
                  >
                    <Trash2 className="h-4 w-4" />
                    {removingClinicianId === member.clinicianId ? "Removing" : "Remove"}
                  </Button>
                </article>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AddClinicianModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        episodeId={episodeId}
        existingClinicianIds={team.map((member) => member.clinicianId)}
        onAdded={refreshTeam}
      />
    </div>
  );
}