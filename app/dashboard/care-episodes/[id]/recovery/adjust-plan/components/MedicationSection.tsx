"use client";

import { useState } from "react";
import { Pill, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Medication } from "../types";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, SectionFrame } from "./SectionFrame";

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Five times daily",
  "Six times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "Every 12 hours",
  "Every other day",
  "Once weekly",
  "Twice weekly",
  "Three times weekly",
  "Other/Custom",
];

const MEDICATION_FIELDS = [
  { key: "name", label: "Medication", placeholder: "Medication name" },
  { key: "dosage", label: "Dosage", placeholder: "Dosage e.g. 500mg" },
  { key: "frequency", label: "Frequency", placeholder: "Frequency e.g. twice daily" },
  { key: "duration", label: "Duration", placeholder: "Duration e.g. 7 days" },
] as const;

export function MedicationSection({ items, onChange }: { items: Medication[]; onChange: (items: Medication[]) => void }) {
  const [deleting, setDeleting] = useState<Medication | null>(null);
  const update = (index: number, patch: Partial<Medication>) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<Pill className="h-4 w-4" />} title="Assigned Medications" subtitle="Active prescriptions linked to this care plan">
      <div className="space-y-4">
        {items.map((item, index) => <div key={item.id} className="rounded-xl bg-muted/60 p-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.1fr_.8fr_.9fr_.9fr_auto]">
            {MEDICATION_FIELDS.map((field) => (
              <label key={field.key} className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{field.label}</span>
                {field.key === "frequency" ? (
                  <Select
                    value={FREQUENCY_OPTIONS.includes(item.frequency) ? item.frequency : item.frequency ? "Other/Custom" : undefined}
                    onValueChange={(value) => update(index, { frequency: value })}
                  >
                    <SelectTrigger aria-label={field.label} className={fieldClass}>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <input
                    aria-label={field.label}
                    placeholder={field.placeholder}
                    className={fieldClass}
                    value={item[field.key]}
                    onChange={(event) => update(index, { [field.key]: event.target.value })}
                  />
                )}
              </label>
            ))}
            <button type="button" aria-label={`Delete ${item.name || "medication"}`} onClick={() => setDeleting(item)} className="col-span-2 flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-red-400 hover:bg-red-50 md:col-span-1 md:mt-5"><Trash2 className="h-4 w-4" /></button>
          </div>
          <label className="mt-2 block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Additional instruction</span>
            <textarea
              aria-label={`${item.name || "Medication"} additional instruction`}
              placeholder="Additional instruction for this medication"
              className={areaClass}
              value={item.instructions}
              onChange={(event) => update(index, { instructions: event.target.value })}
            />
          </label>
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
