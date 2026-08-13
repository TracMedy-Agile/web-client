"use client";

import { useState } from "react";
import { HeartHandshake, Trash2 } from "lucide-react";
import type { Recommendation } from "../types";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, SectionFrame } from "./SectionFrame";

const LIFESTYLE_CATEGORIES = [
  "Diet & Nutrition",
  "Physical Activity",
  "Sleep & Rest",
  "Stress Management",
  "Substance Use",
  "Others",
];

export function LifestyleSection({ items, onChange }: { items: Recommendation[]; onChange: (items: Recommendation[]) => void }) {
  const [deleting, setDeleting] = useState<Recommendation | null>(null);
  const update = (index: number, patch: Partial<Recommendation>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<HeartHandshake className="h-4 w-4" />} title="Lifestyle Recommendations" subtitle="Personalized lifestyle guidance based on the patient's recovery progress">
      <div className="space-y-4">
        {items.map((item, index) => <div key={item.id} className="rounded-xl bg-muted/60 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[190px_1fr_auto]">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Category</span>
              <select
                aria-label="Lifestyle category"
                className={fieldClass}
                value={item.title}
                onChange={(event) => update(index, { title: event.target.value })}
              >
                <option value="">Select category</option>
                {!LIFESTYLE_CATEGORIES.includes(item.title) && item.title ? <option value={item.title}>{item.title}</option> : null}
                {LIFESTYLE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recommendation title</span>
              <input
                aria-label="Recommendation title"
                placeholder="Recommendation title"
                className={fieldClass}
                value={item.summary}
                onChange={(event) => update(index, { summary: event.target.value })}
              />
            </label>
            <button type="button" aria-label={`Delete ${item.summary || item.title || "recommendation"}`} onClick={() => setDeleting(item)} className="flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-red-400 hover:bg-red-50 sm:mt-5"><Trash2 className="h-4 w-4" /></button>
          </div>
          <label className="mt-2 block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Personalized guidance for patient</span>
            <textarea
              aria-label="Personalized guidance for patient"
              placeholder="Personalized guidance for patient"
              className={areaClass}
              value={item.description}
              onChange={(event) => update(index, { description: event.target.value })}
            />
          </label>
        </div>)}
      </div>
      <AddRowButton onClick={() => onChange([...items, {
        id: crypto.randomUUID(),
        title: "",
        summary: "",
        description: "",
      }])}>Add recommendation</AddRowButton>
      <DeleteDialog label={deleting?.summary || deleting?.title || "recommendation"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
