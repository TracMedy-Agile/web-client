"use client";

import { useState } from "react";
import { Home, Trash2 } from "lucide-react";
import type { Clinician, HomeCareOrder } from "../types";
import { AddTaskModal } from "./AddTaskModal";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, FieldLabel, SectionFrame } from "./SectionFrame";

export function HomeCareSection({ items, clinicians, onChange }: { items: HomeCareOrder[]; clinicians: Clinician[]; onChange: (items: HomeCareOrder[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<HomeCareOrder | null>(null);
  const update = (index: number, patch: Partial<HomeCareOrder>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <SectionFrame icon={<Home className="h-4 w-4" />} title="Home Care" subtitle="In-home nursing, wound care and community health interventions">
      <div className="space-y-4">{items.map((item, index) => <div key={item.id} className="rounded-xl bg-[#F1F3F5] p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_.8fr_.8fr_auto]"><input aria-label="Home care service" className={fieldClass} value={item.service} onChange={(event) => update(index, { service: event.target.value })} /><select aria-label="Priority" className={fieldClass} value={item.priority} onChange={(event) => update(index, { priority: event.target.value })}><option>Routine</option><option>Urgent</option></select><select aria-label="Frequency" className={fieldClass} value={item.frequency} onChange={(event) => update(index, { frequency: event.target.value })}><option>Daily</option><option>Weekly</option><option>As needed</option></select><button type="button" aria-label={`Delete ${item.service}`} onClick={() => setDeleting(item)} className="flex h-9 w-9 items-center justify-center justify-self-end text-red-400"><Trash2 className="h-4 w-4" /></button></div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><label><FieldLabel>Start date</FieldLabel><input type="date" className={fieldClass} value={item.startDate} onChange={(event) => update(index, { startDate: event.target.value })} /></label><label><FieldLabel>Duration</FieldLabel><div className="relative"><input type="number" min={1} className={`${fieldClass} pr-12`} value={item.duration} onChange={(event) => update(index, { duration: Number(event.target.value) })} /><span className="absolute right-3 top-2.5 text-[10px] text-[#7D8BA0]">days</span></div></label><label><FieldLabel>Number of weeks</FieldLabel><input type="number" min={1} className={fieldClass} value={item.numberOfWeeks} onChange={(event) => update(index, { numberOfWeeks: Number(event.target.value) })} /></label></div>
        <label className="mt-3 block"><FieldLabel>Clinical instructions</FieldLabel><textarea className={areaClass} placeholder="Enter clinical instructions, monitoring notes, or special requirements..." value={item.instructions} onChange={(event) => update(index, { instructions: event.target.value })} /></label>
        <FieldLabel>Fulfillment method</FieldLabel><div className="grid gap-2 sm:grid-cols-2"><label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${item.fulfillmentMethod === "hospital" ? "border-[#3B82F6] bg-[#EFF6FF]" : "border-[#DDE3EC] bg-white"}`}><input type="radio" checked={item.fulfillmentMethod === "hospital"} onChange={() => update(index, { fulfillmentMethod: "hospital" })} /><span><strong className="block text-[11px] text-[#172033]">Assign hospital provider</strong><span className="text-[9px] text-[#71819A]">Assign a nurse, CHN, or physiotherapist from your hospital team</span></span></label><label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${item.fulfillmentMethod === "network" ? "border-[#3B82F6] bg-[#EFF6FF]" : "border-[#DDE3EC] bg-white"}`}><input type="radio" checked={item.fulfillmentMethod === "network"} onChange={() => update(index, { fulfillmentMethod: "network" })} /><span><strong className="block text-[11px] text-[#172033]">Tracmedy care network</strong><span className="text-[9px] text-[#71819A]">Route to Tracmedy for provider assignment and coordination</span></span></label></div>
        <label className="mt-3 block"><FieldLabel>Assigned nurse / CHN</FieldLabel><select className={fieldClass} value={item.clinicianId} onChange={(event) => update(index, { clinicianId: event.target.value })}><option value="">Select available clinician</option>{clinicians.map((clinician) => <option key={clinician.id} value={clinician.id}>{clinician.name}{clinician.role ? ` — ${clinician.role}` : ""}</option>)}</select></label>
      </div>)}</div>
      <AddRowButton onClick={() => setAdding(true)}>Add home care order</AddRowButton>
      <AddTaskModal kind="homeCare" open={adding} onClose={() => setAdding(false)} onAdd={(task) => onChange([...items, { id: crypto.randomUUID(), service: task.title, priority: "Routine", frequency: task.summary, startDate: task.date, duration: 14, numberOfWeeks: 2, instructions: task.description, fulfillmentMethod: "hospital", clinicianId: "" }])} />
      <DeleteDialog label={deleting?.service ?? "home care order"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
