"use client";

import { FormEvent, useId, useState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SaveConfirmationModal({ isOpen, onClose, onConfirm, currentVersion, nextVersion, patientName, createsVersion }: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void>; currentVersion: number; nextVersion: number; patientName: string; createsVersion: boolean }) {
  const inputId = useId();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const close = () => { setReason(""); setError(""); onClose(); };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) { setError("Change reason is required."); return; }
    setSaving(true); setError("");
    try { await onConfirm(reason.trim()); toast.success(createsVersion ? `Care plan version ${nextVersion} created.` : "Care plan changes saved."); close(); }
    catch (caught) { const message = caught instanceof Error ? caught.message : "Unable to save the care plan."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) close(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[576px] gap-0 overflow-hidden rounded-[14px] border-[#D7E0EB] bg-white p-0 shadow-2xl [&>button]:right-6 [&>button]:top-6 [&>button]:text-[#8291A8]">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-[#DFE5EC] px-6 py-[18px] pr-16 text-left"><DialogTitle className="flex items-center gap-3 text-xl font-bold text-[#172033]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3FF] text-[#0873DC]"><Save className="h-[18px] w-[18px]" /></span>Save Updated Care Plan</DialogTitle></DialogHeader>
          <div className="px-6 py-6">
            <DialogDescription className="flex items-start gap-4 text-[15px] leading-[21px] text-[#71819A]"><AlertCircle className="mt-0.5 h-[22px] w-[22px] shrink-0 text-[#F59E0B]" /><span>{createsVersion ? <>The current plan (v{currentVersion}) will be archived and a new version (v{nextVersion}) will become active for <strong className="text-[#172033]">{patientName}</strong>.</> : <>The active plan (v{currentVersion}) will be updated for <strong className="text-[#172033]">{patientName}</strong>. This change will be recorded in the audit log.</>}</span></DialogDescription>
            <label htmlFor={inputId} className="mt-6 block text-sm font-medium text-[#111827]">Change Reason</label>
            <textarea id={inputId} required value={reason} disabled={saving} onChange={(event) => { setReason(event.target.value); if (error) setError(""); }} placeholder="Describe the resolution and outcome..." className="mt-2 h-[92px] w-full resize-none rounded-xl border border-[#D6DEE9] px-3 py-3 text-sm outline-none placeholder:text-[#7D8DA6] focus:border-[#1769C2] focus:ring-2 focus:ring-[#DBEAFE]" />
            {error ? <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
          </div>
          <DialogFooter className="flex-row justify-end gap-3 border-t border-[#DFE5EC] bg-[#F8FAFC] px-6 py-[18px] sm:space-x-0"><Button type="button" variant="ghost" onClick={close} disabled={saving} className="h-12 px-5 text-[#526078]">Cancel</Button><Button type="submit" disabled={!reason.trim() || saving} className="h-12 min-w-[154px] bg-[#0753A5] text-white disabled:bg-[#9FB8D5] disabled:opacity-100">{saving ? <><Loader2 className="animate-spin" />Saving...</> : "Confirm and Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
