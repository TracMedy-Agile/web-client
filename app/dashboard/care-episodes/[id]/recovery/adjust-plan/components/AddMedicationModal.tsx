"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Medication } from "../types";
import { areaClass, fieldClass, FieldLabel } from "./SectionFrame";

type Draft = Omit<Medication, "id">;
const empty: Draft = { name: "", dosage: "", frequency: "", duration: "", instructions: "" };

export function AddMedicationModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (medication: Draft) => void }) {
  const [draft, setDraft] = useState(empty);
  const valid = draft.name.trim() && draft.dosage.trim() && draft.frequency.trim() && draft.duration.trim();
  const close = () => { setDraft(empty); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="rounded-xl border-[#DDE3EC] bg-white sm:max-w-xl">
        <DialogHeader><DialogTitle>Add medication</DialogTitle><DialogDescription>Add the prescription details and patient instructions.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["name", "dosage", "frequency", "duration"] as const).map((key) => <label key={key}><FieldLabel>{key}</FieldLabel><input className={fieldClass} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
          <label className="sm:col-span-2"><FieldLabel>Instructions</FieldLabel><textarea className={areaClass} value={draft.instructions} onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))} /></label>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="button" disabled={!valid} className="bg-[#0753A5] text-white" onClick={() => { if (!valid) return; onAdd(draft); close(); }}>Add medication</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
