"use client";

import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, Mail, Plus, Search, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFacilityClinicians, type ClinicianDirectoryEntry } from "@/lib/api/clinicians";
import { addCareTeamMember } from "@/lib/api/care-episodes";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials, humanizeSlug } from "../../_shared/utils";

type AddClinicianModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string;
  existingClinicianIds: string[];
  onAdded: () => void | Promise<void>;
};

function clinicianRoleLabel(clinician: ClinicianDirectoryEntry) {
  const department = clinician.department ?? "";
  const lowered = department.toLowerCase();
  if (lowered.includes("nurse")) return "Nurse";
  return "Doctor";
}

function roleBadgeClass(role: string) {
  return role.toLowerCase().includes("nurse") ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-primary";
}

export function AddClinicianModal({ open, onOpenChange, episodeId, existingClinicianIds, onAdded }: AddClinicianModalProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [results, setResults] = useState<ClinicianDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [addingClinicianId, setAddingClinicianId] = useState("");

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const clinicians = await getFacilityClinicians({ q: query, limit: 100 });
        if (!ignore) setResults(clinicians.filter((item) => !existingClinicianIds.includes(item.id)));
      } catch (requestError) {
        if (!ignore) setError(requestError instanceof Error ? requestError.message : "Unable to load clinicians.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [open, query, existingClinicianIds]);

  const roleOptions = useMemo(
    () => Array.from(new Set(results.map(clinicianRoleLabel))).sort(),
    [results],
  );

  const filteredResults = roleFilter === "all"
    ? results
    : results.filter((item) => clinicianRoleLabel(item) === roleFilter);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setRoleFilter("all");
    }
    onOpenChange(nextOpen);
  };

  async function addClinician(clinician: ClinicianDirectoryEntry) {
    setAddingClinicianId(clinician.id);
    setError("");
    try {
      await addCareTeamMember(episodeId, { clinicianId: clinician.id, role: clinicianRoleLabel(clinician).toLowerCase() });
      capturePostHogEvent("care_team_member_added", {
        episode_id: episodeId,
        clinician_id: clinician.id,
      });
      await onAdded();
      toast.success(`${clinician.name || "Clinician"} was added to the care team.`);
      handleOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add this clinician.");
    } finally {
      setAddingClinicianId("");
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[calc(100vw-2rem)] max-w-[672px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between px-8 pb-7 pt-7">
            <div>
              <DialogPrimitive.Title className="text-2xl font-bold tracking-[-0.02em] text-slate-900">Add Clinician</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-sm font-medium leading-6 text-slate-500">
                Search the hospital directory and add clinicians to this care team.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close type="button" aria-label="Close add clinician" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex shrink-0 flex-col gap-4 px-8 pb-5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search clinicians"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, speciality or department"
                className="h-10 w-full rounded-lg border border-border bg-white pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger aria-label="Filter clinicians by role" className="h-10 w-full rounded-lg border-border text-sm font-medium text-slate-700 sm:w-[122px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70] border-border">
                <SelectItem value="all">All Roles</SelectItem>
                {roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-7">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center gap-2 text-sm font-medium text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Searching directory...</div>
            ) : error ? (
              <div className="flex h-48 items-center justify-center text-center text-sm font-medium text-red-600">{error}</div>
            ) : filteredResults.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center text-sm font-medium text-slate-500"><UsersRound className="h-8 w-8 text-slate-300" />No available clinicians match your search.</div>
            ) : (
              <div className="space-y-2.5">
                {filteredResults.map((clinician) => {
                  const role = clinicianRoleLabel(clinician);
                  const department = clinician.department || "Department not specified";
                  return (
                    <article key={clinician.id} className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cover bg-center text-base font-bold text-white shadow-sm"
                          style={clinician.avatarUrl ? { backgroundImage: `url(${clinician.avatarUrl})` } : { backgroundColor: getAvatarColor(clinician.name || "Clinician") }}
                        >
                          {clinician.avatarUrl ? null : getInitials(clinician.name || "Clinician")}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-bold text-slate-900">{clinician.name || "Unnamed clinician"}</h3>
                            <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", roleBadgeClass(role))}>{role}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-600">{humanizeSlug(department)}</p>
                          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Mail className="h-3.5 w-3.5" />{clinician.email}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        disabled={Boolean(addingClinicianId)}
                        onClick={() => void addClinician(clinician)}
                        className="h-10 shrink-0 gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white shadow-none hover:bg-primary/90 sm:w-[88px]"
                      >
                        {addingClinicianId === clinician.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {addingClinicianId === clinician.id ? "Adding" : "Add"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}