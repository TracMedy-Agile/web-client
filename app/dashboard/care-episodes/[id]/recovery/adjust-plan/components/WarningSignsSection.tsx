"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { WarningSign } from "../types";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, SectionFrame } from "./SectionFrame";

function warningResponseValue(item: WarningSign) {
  return [item.detail, item.response].filter(Boolean).join("\n");
}

export function WarningSignsSection({ items, onChange }: { items: WarningSign[]; onChange: (items: WarningSign[]) => void }) {
  const [deleting, setDeleting] = useState<WarningSign | null>(null);
  const update = (index: number, patch: Partial<WarningSign>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<AlertTriangle className="h-4 w-4" />} title="Warning Signs" subtitle="Symptoms the patient should watch for and how to respond">
      <div className="space-y-4">
        {items.map((item, index) => <div key={item.id} className="relative rounded-xl bg-muted/60 p-3 pr-14">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Warning sign</span>
            <input
              aria-label="Warning sign"
              placeholder="Warning sign"
              className={fieldClass}
              value={item.title}
              onChange={(event) => update(index, { title: event.target.value })}
            />
          </label>
          <label className="mt-2 block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Patient response</span>
            <textarea
              aria-label={`${item.title || "Warning sign"} patient response`}
              placeholder="What should the patient do when this warning sign appears?"
              className={areaClass}
              value={warningResponseValue(item)}
              onChange={(event) => update(index, { detail: "", response: event.target.value })}
            />
          </label>
          <button type="button" aria-label={`Delete ${item.title || "warning sign"}`} onClick={() => setDeleting(item)} className="absolute right-3 top-8 flex h-9 w-9 items-center justify-center rounded-md text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
        </div>)}
      </div>
      <AddRowButton onClick={() => onChange([...items, {
        id: crypto.randomUUID(),
        title: "",
        detail: "",
        response: "",
      }])}>Add warning sign</AddRowButton>
      <DeleteDialog label={deleting?.title ?? "warning sign"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
