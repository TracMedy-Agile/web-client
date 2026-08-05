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
      <div className="space-y-4">{items.map((item, index) => <div key={item.id} className="rounded-xl bg-muted/60 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_110px_auto]"><select aria-label="Test type" className={fieldClass}><option>Laboratory Test</option><option>Diagnostic Test</option><option>Imaging</option></select><input aria-label="Test name" className={fieldClass} value={item.name} onChange={(event) => update(index, { name: event.target.value })} /><select aria-label="Priority" className={fieldClass} value={item.priority} onChange={(event) => update(index, { priority: event.target.value as LabTest["priority"] })}><option>Routine</option><option>Urgent</option></select><button type="button" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)} className="flex h-9 w-9 items-center justify-center justify-self-end text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px]"><input aria-label="Purpose" className={fieldClass} value={item.purpose} onChange={(event) => update(index, { purpose: event.target.value })} /><label><span className="mb-1 block text-[8px] font-bold uppercase text-muted-foreground">Expected date</span><input type="date" aria-label="Expected date" className={fieldClass} value={item.date} onChange={(event) => update(index, { date: event.target.value })} /></label></div>
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
