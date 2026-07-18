"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ClipboardList, History, Phone, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCareEpisodeById, type CareEpisodeDetail } from "@/lib/api/care-episodes";
import { getCareTeam, removeClinicianFromTeam } from "@/lib/api/careTeamAndPlan.api";
import { CareEpisodeSubHeader, SubHeaderSkeleton } from "../_shared/SubHeader";
import { createPlaceholderEpisode, formatLongDate, getAvatarColor, getInitials } from "../_shared/utils";
import type { CareTeamMember, ClinicianRole } from "../_shared/careTeamTypes";
import { AddClinicianModal } from "./components/AddClinicianModal";

const ROLE_BADGE_CLASSNAME: Record<ClinicianRole, string> = {
  Doctor: "bg-[#E7F2FF] text-[#1769C2]",
  Nurse: "bg-[#F1EAFE] text-[#7C3AED]",
  Physiotherapist: "bg-[#E6FBF3] text-[#0F9D6C]",
  Pharmacist: "bg-[#FFF4E5] text-[#B45309]",
  Nutritionist: "bg-[#FFECEC] text-[#B91C1C]",
};

export default function CareTeamPage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const displayEpisode = episode ?? createPlaceholderEpisode(episodeId);
  const [team, setTeam] = useState<CareTeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadTeam = () => {
    getCareTeam(episodeId).then(setTeam);
  };

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    setIsLoading(true);
    Promise.allSettled([getCareEpisodeById(episodeId), getCareTeam(episodeId)]).then(([episodeResult, teamResult]) => {
      if (ignore) return;
      if (episodeResult.status === "fulfilled") setEpisode(episodeResult.value);
      if (teamResult.status === "fulfilled") setTeam(teamResult.value);
      setIsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [episodeId]);

  const handleRemove = async (member: CareTeamMember) => {
    setRemovingId(member.id);
    try {
      await removeClinicianFromTeam(episodeId, member.id);
      setTeam((current) => current.filter((item) => item.id !== member.id));
      toast.success(`${member.name} removed from the care team.`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to remove clinician.");
    } finally {
      setRemovingId(null);
    }
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
          <h1 className="text-lg font-bold text-[#111827] md:text-2xl">Care Team</h1>
          <p className="mt-2 max-w-140 text-sm font-medium leading-6 text-[#71809B]">
            Shared ownership and coordinated care for {displayEpisode.patient?.name || "this patient"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="h-11 gap-2 rounded-xl border-[#DDE3EC] bg-white px-5 text-sm font-bold text-[#111827] hover:bg-[#F8FAFC]">
            <Link href={`/dashboard/care-episodes/${episodeId}/assessment-history`}>
              <History className="h-4 w-4" />
              Assessment History
            </Link>
          </Button>
          <Button asChild className="h-11 gap-2 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575]">
            <Link href={`/dashboard/care-episodes/${episodeId}/assessment`}>
              <ClipboardList className="h-4 w-4" />
              New Assessment
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-[#E5E7EB] pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#111827]">
              <UsersRound className="h-4 w-4 text-[#023E8A]" />
              Clinicians
              <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-xs font-bold text-[#71809B]">{team.length}</span>
            </h2>
            <Button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="h-10 gap-1.5 rounded-lg bg-[#023E8A] px-4 text-sm font-bold text-white hover:bg-[#023575]"
            >
              <Plus className="h-4 w-4" />
              Add Clinician
            </Button>
          </div>

          {team.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-[#71809B]">No clinicians assigned to this care team yet.</p>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
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
                        <span className="font-bold text-[#111827]">{member.name}</span>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-bold", ROLE_BADGE_CLASSNAME[member.role])}>
                          {member.role}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-[#71809B]">
                        {member.roleOnTeam} · {member.specialty}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#71809B]">
                        <span className="inline-flex items-center gap-1.5 text-[#023E8A]">
                          <Phone className="h-3.5 w-3.5" />
                          {member.phone}
                        </span>
                        <span>Added {formatLongDate(member.dateAdded)}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleRemove(member)}
                    disabled={removingId === member.id}
                    className="h-9 self-start px-3 text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-600 sm:self-center"
                  >
                    {removingId === member.id ? "Removing..." : "Remove"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddClinicianModal open={isModalOpen} onOpenChange={setIsModalOpen} episodeId={episodeId} onAdded={loadTeam} />
    </div>
  );
}
