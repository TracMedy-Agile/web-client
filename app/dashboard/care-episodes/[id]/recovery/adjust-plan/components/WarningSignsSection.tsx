"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { WarningSign } from "../types";
import { AddTaskModal } from "./AddTaskModal";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, SectionFrame } from "./SectionFrame";

export function WarningSignsSection({ items, onChange }: { items: WarningSign[]; onChange: (items: WarningSign[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<WarningSign | null>(null);
  const update = (index: number, patch: Partial<WarningSign>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<AlertTriangle className="h-4 w-4" />} title="Warning Signs" subtitle="Symptoms the patient should watch for and how to respond">
      <div className="space-y-4">{items.map((item, index) => <div key={item.id} className="rounded-xl bg-[#F1F3F5] p-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label="Warning sign" className={fieldClass} value={item.title} onChange={(event) => update(index, { title: event.target.value })} /><input aria-label="Warning sign detail" className={fieldClass} value={item.detail} onChange={(event) => update(index, { detail: event.target.value })} /><button type="button" aria-label={`Delete ${item.title}`} onClick={() => setDeleting(item)} className="flex h-9 w-9 items-center justify-center justify-self-end text-red-400"><Trash2 className="h-4 w-4" /></button></div><textarea aria-label={`${item.title} response`} className={`${areaClass} mt-2`} value={item.response} onChange={(event) => update(index, { response: event.target.value })} /></div>)}</div>
      <AddRowButton onClick={() => setAdding(true)}>Add recommendation</AddRowButton>
      <AddTaskModal kind="warning" open={adding} onClose={() => setAdding(false)} onAdd={(task) => onChange([...items, { id: crypto.randomUUID(), title: task.title, detail: task.summary, response: task.description }])} />
      <DeleteDialog label={deleting?.title ?? "warning sign"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
