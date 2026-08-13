"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, UsersRound } from "lucide-react";
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
  return "bg-blue-50 text-blue-600";
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

  if (isLoading) return <div className="space-y-4"><div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" /><div className="h-7 w-40 animate-pulse rounded bg-slate-200" /><div className="h-64 animate-pulse rounded-xl bg-slate-100" /></div>;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/care-episodes/${episodeId}`} aria-label="Back to care episode" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 md:text-2xl">Care Team</h1>
          <p className="mt-2 max-w-140 text-sm font-medium leading-6 text-slate-500">
            Shared ownership and coordinated care for {displayEpisode.patient?.name || "this patient"}.
          </p>
        </div>

          <Button
            type="button"
            onClick={() => {
              capturePostHogEvent("add_clinician_opened", { episode_id: episodeId });
              setIsModalOpen(true);
            }}
            className="h-11 gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Clinician
          </Button>

      </div>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <UsersRound className="h-4 w-4 text-primary" />
              Clinicians
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{team.length}</span>
            </h2>
            <span className="text-xs font-medium text-slate-500">Assigned clinicians from the episode record</span>
          </div>

          {error ? <p className="py-10 text-center text-sm font-medium text-red-600">{error}</p> : null}
          {!error && team.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-slate-500">No clinicians are assigned to this care team yet.</p>
          ) : null}
          {!error && team.length > 0 ? (
            <div className="divide-y divide-border">
              {team.map((member) => (
                <div key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: getAvatarColor(member.name) }}
                    >
                      {getInitials(member.name)}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">{member.name}</span>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-bold", roleBadgeClass(member.role))}>
                          {humanizeSlug(member.role) || "Clinician"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">Added {formatLongDate(member.assignedAt)}</p>
                    </div>
                  </div>

                    <Button
                      type="button"
                      variant="ghost"
                      disabled={removingClinicianId === member.clinicianId}
                      onClick={() => void removeMember(member)}
                      className="h-9 self-start px-3 text-sm font-bold text-red-600 sm:self-center"
                    >
                      {removingClinicianId === member.clinicianId ? "Removing..." : "Remove"}
                    </Button>

                </div>
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
