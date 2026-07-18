"use client";

import { useState } from "react";
import { HeartHandshake, Trash2 } from "lucide-react";
import type { Recommendation } from "../types";
import { AddTaskModal } from "./AddTaskModal";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, SectionFrame } from "./SectionFrame";

export function LifestyleSection({ items, onChange }: { items: Recommendation[]; onChange: (items: Recommendation[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Recommendation | null>(null);
  const update = (index: number, patch: Partial<Recommendation>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<HeartHandshake className="h-4 w-4" />} title="Lifestyle Recommendations" subtitle="Personalized lifestyle guidance based on the patient's recovery progress">
      <div className="space-y-4">{items.map((item, index) => <div key={item.id} className="rounded-xl bg-[#F1F3F5] p-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr_auto]"><input aria-label="Recommendation category" className={fieldClass} value={item.title} onChange={(event) => update(index, { title: event.target.value })} /><input aria-label="Recommendation summary" className={fieldClass} value={item.summary} onChange={(event) => update(index, { summary: event.target.value })} /><button type="button" aria-label={`Delete ${item.title}`} onClick={() => setDeleting(item)} className="flex h-9 w-9 items-center justify-center justify-self-end text-red-400"><Trash2 className="h-4 w-4" /></button></div><textarea aria-label={`${item.title} details`} className={`${areaClass} mt-2`} value={item.description} onChange={(event) => update(index, { description: event.target.value })} /></div>)}</div>
      <AddRowButton onClick={() => setAdding(true)}>Add recommendation</AddRowButton>
      <AddTaskModal kind="lifestyle" open={adding} onClose={() => setAdding(false)} onAdd={(task) => onChange([...items, { id: crypto.randomUUID(), title: task.title, summary: task.summary, description: task.description }])} />
      <DeleteDialog label={deleting?.title ?? "recommendation"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
