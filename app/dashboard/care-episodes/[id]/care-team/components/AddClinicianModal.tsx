"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, Phone, Search, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { addClinicianToTeam, searchAvailableClinicians } from "@/lib/api/careTeamAndPlan.api";
import { getAvatarColor, getInitials } from "../../_shared/utils";
import type { Clinician, ClinicianRole } from "../../_shared/careTeamTypes";

const ROLE_FILTERS: { label: string; value: ClinicianRole | "all" }[] = [
  { label: "All Roles", value: "all" },
  { label: "Doctor", value: "Doctor" },
  { label: "Nurse", value: "Nurse" },
  { label: "Physiotherapist", value: "Physiotherapist" },
  { label: "Pharmacist", value: "Pharmacist" },
  { label: "Nutritionist", value: "Nutritionist" },
];

const ROLE_BADGE_CLASSNAME: Record<ClinicianRole, string> = {
  Doctor: "bg-[#E7F2FF] text-[#1769C2]",
  Nurse: "bg-[#F1EAFE] text-[#7C3AED]",
  Physiotherapist: "bg-[#E6FBF3] text-[#0F9D6C]",
  Pharmacist: "bg-[#FFF4E5] text-[#B45309]",
  Nutritionist: "bg-[#FFECEC] text-[#B91C1C]",
};

type AddClinicianModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string;
  onAdded: () => void;
};

export function AddClinicianModal({ open, onOpenChange, episodeId, onAdded }: AddClinicianModalProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<ClinicianRole | "all">("all");
  const [results, setResults] = useState<Clinician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    setIsLoading(true);
    searchAvailableClinicians(query, roleFilter).then((clinicians) => {
      if (!ignore) {
        setResults(clinicians);
        setIsLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [open, query, roleFilter]);

  const handleAdd = async (clinician: Clinician) => {
    setAddingId(clinician.id);
    try {
      await addClinicianToTeam(episodeId, clinician.id);
      toast.success(`${clinician.name} added to the care team.`);
      setResults((current) => current.filter((item) => item.id !== clinician.id));
      onAdded();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to add clinician.");
    } finally {
      setAddingId(null);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setRoleFilter("all");
    }
    onOpenChange(nextOpen);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between border-b border-[#E5EAF0] bg-[#FBFCFE] px-6 py-5">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-[#151D2C]">Add Clinician</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm font-medium text-[#71809B]">
                Search the hospital directory and add clinicians to this care team.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              type="button"
              aria-label="Close add clinician"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#344054] transition-colors hover:bg-[#EEF2F6]"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-b border-[#E5EAF0] px-6 py-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7689A5]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, speciality or department"
                className="h-11 w-full rounded-lg border border-[#DDE3EC] bg-white pl-10 pr-3.5 text-sm font-medium text-[#172033] outline-none placeholder:text-[#7689A5] focus-visible:border-[#74A9E5] focus-visible:ring-2 focus-visible:ring-[#0B5CAB]/10"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as ClinicianRole | "all")}>
              <SelectTrigger className="h-11 w-full rounded-lg border-[#DDE3EC] text-sm font-medium text-[#172033] sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70] border-[#DDE3EC]">
                {ROLE_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm font-medium text-[#71809B]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching directory...
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm font-medium text-[#71809B]">
                <UsersRound className="h-8 w-8 text-[#B7C2D4]" />
                No available clinicians match your search.
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((clinician) => (
                  <div
                    key={clinician.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: getAvatarColor(clinician.name) }}
                      >
                        {getInitials(clinician.name)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#111827]">{clinician.name}</span>
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-bold", ROLE_BADGE_CLASSNAME[clinician.role])}>
                            {clinician.role}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-[#71809B]">{clinician.specialty}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-[#023E8A]">
                          <Phone className="h-3.5 w-3.5" />
                          {clinician.phone}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleAdd(clinician)}
                      disabled={addingId === clinician.id}
                      className="h-10 shrink-0 gap-1.5 rounded-lg bg-[#064B91] px-4 text-sm font-bold text-white hover:bg-[#023E8A] sm:w-auto"
                    >
                      {addingId === clinician.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "+ Add"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
