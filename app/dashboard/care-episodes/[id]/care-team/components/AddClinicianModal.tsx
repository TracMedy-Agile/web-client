"use client";

import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, Mail, Search, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFacilityClinicians, type ClinicianDirectoryEntry } from "@/lib/api/clinicians";
import { getAvatarColor, getInitials } from "../../_shared/utils";

type AddClinicianModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string;
  existingClinicianIds: string[];
};

export function AddClinicianModal({ open, onOpenChange, episodeId, existingClinicianIds }: AddClinicianModalProps) {
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [results, setResults] = useState<ClinicianDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

  const departments = useMemo(
    () => Array.from(new Set(results.map((item) => item.department).filter((item): item is string => Boolean(item)))).sort(),
    [results],
  );
  const filteredResults = departmentFilter === "all" ? results : results.filter((item) => item.department === departmentFilter);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setDepartmentFilter("all");
    }
    onOpenChange(nextOpen);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between border-b border-border bg-slate-50 px-6 py-5">
            <div>
              <DialogPrimitive.Title className="text-xl font-bold text-slate-900">Add Clinician</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm font-medium text-slate-500">
                Search the hospital directory and add clinicians to this care team.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close type="button" aria-label="Close add clinician" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search clinicians"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, specialty or department"
                className="h-11 w-full rounded-lg border border-border bg-white pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/10"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger aria-label="Filter clinicians by department" className="h-11 w-full rounded-lg border-border text-sm font-medium text-slate-900 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70] border-border">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm font-medium text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Searching directory...</div>
            ) : error ? (
              <div className="flex h-40 items-center justify-center text-center text-sm font-medium text-red-600">{error}</div>
            ) : filteredResults.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm font-medium text-slate-500"><UsersRound className="h-8 w-8 text-slate-300" />No available clinicians match your search.</div>
            ) : (
              <div className="space-y-3">
                {filteredResults.map((clinician) => (
                  <div key={clinician.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: getAvatarColor(clinician.name || "Clinician") }}>
                        {getInitials(clinician.name || "Clinician")}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">{clinician.name || "Unnamed clinician"}</span>
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">Clinician</span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-slate-500">{clinician.department || "Department not specified"}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Mail className="h-3.5 w-3.5" />{clinician.email}</p>
                      </div>
                    </div>
                    <Button type="button" disabled title="Adding care-team members is not available in the current API" className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-white sm:w-auto">+ Add</Button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              The clinician directory is live. Team assignment will be enabled when the care-team membership endpoint is available for episode {episodeId}.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
