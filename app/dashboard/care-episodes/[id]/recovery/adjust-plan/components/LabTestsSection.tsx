"use client";

import { useState } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import type { LabTest } from "../types";
import { AddRowButton, DeleteDialog, fieldClass, SectionFrame } from "./SectionFrame";

export function LabTestsSection({ items, onChange }: { items: LabTest[]; onChange: (items: LabTest[]) => void }) {
  const [deleting, setDeleting] = useState<LabTest | null>(null);
  const update = (index: number, patch: Partial<LabTest>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<FlaskConical className="h-4 w-4" />} title="Laboratory & Diagnostic Tests" subtitle="Recommended tests, imaging and scans for this care plan">
      <div className="space-y-4">{items.map((item, index) => <div key={item.id} className="min-w-0 rounded-xl bg-muted/60 p-3">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)_minmax(125px,0.9fr)_auto]">
          <label className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Type</span>
            <select aria-label="Test type" className={`${fieldClass} min-w-0 truncate pr-8`}><option>Laboratory Test</option><option>Diagnostic Test</option><option>Imaging</option></select>
          </label>
          <label className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Test name</span>
            <input aria-label="Test name" placeholder="Test name" className={fieldClass} value={item.name} onChange={(event) => update(index, { name: event.target.value })} />
          </label>
          <label className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Priority</span>
            <select aria-label="Priority" className={fieldClass} value={item.priority} onChange={(event) => update(index, { priority: event.target.value as LabTest["priority"] })}><option>Routine</option><option>Urgent</option></select>
          </label>
          <button type="button" aria-label={`Delete ${item.name || "test"}`} onClick={() => setDeleting(item)} className="flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-red-400 hover:bg-red-50 sm:mt-5"><Trash2 className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.7fr)]">
          <label className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Clinical reason (optional)</span>
            <input aria-label="Clinical reason optional" placeholder="Clinical reason (optional)" className={fieldClass} value={item.purpose} onChange={(event) => update(index, { purpose: event.target.value })} />
          </label>
          <label className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Expected date</span>
            <input type="date" aria-label="Expected date" className={fieldClass} value={item.date} onChange={(event) => update(index, { date: event.target.value })} />
          </label>
        </div>
      </div>)}</div>
      <AddRowButton onClick={() => onChange([...items, {
        id: crypto.randomUUID(),
        name: "",
        priority: "Routine",
        purpose: "",
        date: "",
      }])}>Add test recommendation</AddRowButton>
      <DeleteDialog label={deleting?.name ?? "test"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
