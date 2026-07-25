"use client";

import { useState } from "react";
import { Pill, Trash2 } from "lucide-react";
import type { Medication } from "../types";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, SectionFrame } from "./SectionFrame";

export function MedicationSection({ items, onChange }: { items: Medication[]; onChange: (items: Medication[]) => void }) {
  const [deleting, setDeleting] = useState<Medication | null>(null);
  const update = (index: number, patch: Partial<Medication>) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<Pill className="h-4 w-4" />} title="Assigned Medications" subtitle="Active prescriptions linked to this care plan">
      <div className="space-y-4">
        {items.map((item, index) => <div key={item.id} className="rounded-xl bg-muted/60 p-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.1fr_.8fr_.9fr_.9fr_auto]">
            <input aria-label="Medication" className={fieldClass} value={item.name} onChange={(event) => update(index, { name: event.target.value })} />
            <input aria-label="Dosage" className={fieldClass} value={item.dosage} onChange={(event) => update(index, { dosage: event.target.value })} />
            <input aria-label="Frequency" className={fieldClass} value={item.frequency} onChange={(event) => update(index, { frequency: event.target.value })} />
            <input aria-label="Duration" className={fieldClass} value={item.duration} onChange={(event) => update(index, { duration: event.target.value })} />
            <button type="button" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)} className="col-span-2 flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-red-400 hover:bg-red-50 md:col-span-1"><Trash2 className="h-4 w-4" /></button>
          </div>
          <textarea aria-label={`${item.name} instructions`} className={`${areaClass} mt-2`} value={item.instructions} onChange={(event) => update(index, { instructions: event.target.value })} />
        </div>)}
      </div>
      <AddRowButton onClick={() => onChange([...items, {
        id: crypto.randomUUID(),
        name: "",
        dosage: "",
        frequency: "",
        duration: "",
        instructions: "",
      }])}>Add medication</AddRowButton>
      <DeleteDialog label={deleting?.name ?? "medication"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
