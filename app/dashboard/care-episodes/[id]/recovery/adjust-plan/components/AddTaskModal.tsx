"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AddTaskKind } from "../types";
import { areaClass, fieldClass, FieldLabel } from "./SectionFrame";

export type NewTaskValues = { title: string; summary: string; description: string; date: string; priority: "Routine" | "Urgent" };
const empty: NewTaskValues = { title: "", summary: "", description: "", date: "", priority: "Routine" };
const labels: Record<AddTaskKind, { title: string; summary: string; description: string }> = {
  lab: { title: "Test name", summary: "Purpose", description: "Add test recommendation" },
  monitoring: { title: "Monitoring item", summary: "Frequency", description: "Add monitoring recommendation" },
  homeCare: { title: "Home care service", summary: "Frequency", description: "Add home care order" },
  lifestyle: { title: "Category", summary: "Short recommendation", description: "Add lifestyle recommendation" },
  warning: { title: "Warning sign", summary: "What to watch for", description: "Add warning sign" },
};

export function AddTaskModal({ kind, open, onClose, onAdd }: { kind: AddTaskKind; open: boolean; onClose: () => void; onAdd: (values: NewTaskValues) => void }) {
  const [draft, setDraft] = useState(empty);
  const copy = labels[kind];
  const valid = draft.title.trim() && draft.summary.trim();
  const close = () => { setDraft(empty); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="rounded-xl border-[#DDE3EC] bg-white sm:max-w-xl">
        <DialogHeader><DialogTitle>{copy.description}</DialogTitle><DialogDescription>Complete the required details below.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><FieldLabel>{copy.title}</FieldLabel><input className={fieldClass} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <label><FieldLabel>{copy.summary}</FieldLabel><input className={fieldClass} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} /></label>
          {kind === "lab" || kind === "homeCare" ? <label><FieldLabel>{kind === "lab" ? "Expected date" : "Start date"}</FieldLabel><input type="date" className={fieldClass} value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label> : null}
          {kind === "lab" ? <label><FieldLabel>Priority</FieldLabel><select className={fieldClass} value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as NewTaskValues["priority"] }))}><option>Routine</option><option>Urgent</option></select></label> : null}
          <label className="sm:col-span-2"><FieldLabel>{kind === "warning" ? "Patient response" : "Instructions / details"}</FieldLabel><textarea className={areaClass} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="button" disabled={!valid} className="bg-[#0753A5] text-white" onClick={() => { if (!valid) return; onAdd(draft); close(); }}>Add to plan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
