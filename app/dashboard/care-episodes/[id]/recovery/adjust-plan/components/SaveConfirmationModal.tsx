"use client";

import { FormEvent, useId, useState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type SaveConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<number>;
  currentVersion: number;
  nextVersion: number;
  patientName: string;
  createsVersion: boolean;
  requiresReason?: boolean;
};

export function SaveConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  currentVersion,
  nextVersion,
  patientName,
  createsVersion,
  requiresReason = true,
}: SaveConfirmationModalProps) {
  const inputId = useId();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const close = () => { setReason(""); setError(""); onClose(); };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (requiresReason && !reason.trim()) { setError("Change reason is required."); return; }
    setSaving(true); setError("");
    try {
      const savedVersion = await onConfirm(requiresReason ? reason.trim() : "Initial care plan setup");
      toast.success("Care plan updated", {
        description: `Version ${savedVersion} is active.`,
      });
      close();
    }
    catch (caught) { const message = caught instanceof Error ? caught.message : "Unable to save the care plan."; toast.error(message); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) close(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[576px] gap-0 overflow-hidden rounded-[14px] border-border bg-card p-0 shadow-2xl [&>button]:right-6 [&>button]:top-6 [&>button]:text-muted-foreground">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border px-6 py-[18px] pr-16 text-left"><DialogTitle className="flex items-center gap-3 text-xl font-bold text-foreground"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Save className="h-[18px] w-[18px]" /></span>Save Updated Care Plan</DialogTitle></DialogHeader>
          <div className="px-6 py-6">
            <DialogDescription className="flex items-start gap-3 text-[14px] leading-5 text-muted-foreground"><AlertCircle className="mt-0.5 h-[22px] w-[22px] shrink-0 text-amber-500" /><span>{createsVersion ? <>The current plan (v{currentVersion}) will be archived and a new version (v{nextVersion}) will become active for <strong className="text-foreground">{patientName}</strong>.</> : <>The active plan (v{currentVersion}) will be updated for <strong className="text-foreground">{patientName}</strong>. This change will be recorded in the audit log.</>}</span></DialogDescription>
            {requiresReason ? (
              <>
                <label htmlFor={inputId} className="mt-6 block text-[14px] font-medium text-foreground">Change Reason</label>
                <textarea id={inputId} required value={reason} disabled={saving} onChange={(event) => { setReason(event.target.value); if (error) setError(""); }} placeholder="Briefly describe the reason for updating this care plan..." className="mt-2 h-[92px] w-full resize-none rounded-xl border border-border px-3 py-3 text-[14px] outline-none placeholder:text-[14px] placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />
                {error ? <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
              </>
            ) : null}
          </div>
          <DialogFooter className="flex-row justify-end gap-3 border-t border-border bg-muted/40 px-6 py-[18px] sm:space-x-0"><Button type="button" variant="ghost" onClick={close} disabled={saving} className="h-10 px-4 text-[14px] font-medium text-muted-foreground">Cancel</Button><Button type="submit" disabled={(requiresReason && !reason.trim()) || saving} className="h-10 min-w-[144px] px-4 text-[14px] font-semibold bg-primary text-white disabled:bg-primary/40 disabled:opacity-100">{saving ? <><Loader2 className="animate-spin" />Saving...</> : "Confirm and Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
