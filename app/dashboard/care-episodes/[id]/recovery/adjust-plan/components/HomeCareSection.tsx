"use client";

import { useState } from "react";
import { Info, Home, Trash2 } from "lucide-react";
import type { HomeCareService } from "@/lib/api/home-care";
import type { Clinician, HomeCareOrder } from "../types";
import { AddRowButton, areaClass, DeleteDialog, fieldClass, FieldLabel, SectionFrame } from "./SectionFrame";

const SERVICE_OPTIONS = ["Vitals Monitoring", "In-home Nursing", "Wound Care", "Physiotherapy", "Community Health Visit"];

function newHomeCareOrder(services: HomeCareService[]): HomeCareOrder {
  const firstService = services[0];
  return {
    id: crypto.randomUUID(),
    serviceId: firstService?.id ?? "",
    service: firstService?.name ?? "Vitals Monitoring",
    priority: "Routine",
    frequency: "Daily",
    startDate: "",
    duration: 14,
    numberOfVisits: 10,
    instructions: "",
    fulfillmentMethod: "network",
    clinicianId: "",
    isNew: true,
  };
}

export function HomeCareSection({
  items,
  clinicians,
  services,
  onChange,
}: {
  items: HomeCareOrder[];
  clinicians: Clinician[];
  services: HomeCareService[];
  onChange: (items: HomeCareOrder[]) => void;
}) {
  const [deleting, setDeleting] = useState<HomeCareOrder | null>(null);
  const serviceOptions = services.length > 0
    ? services
    : SERVICE_OPTIONS.map((name) => ({ id: "", name }));
  const update = (index: number, patch: Partial<HomeCareOrder>) =>
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));

  return (
    <SectionFrame
      icon={<Home className="h-4 w-4" />}
      title="Home Care"
      subtitle="In-home nursing, wound care and community health interventions"
    >
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-xl border border-border bg-muted/60 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_.8fr_.95fr_auto]">
              <select
                aria-label="Home care service"
                className={fieldClass}
                value={item.serviceId || item.service}
                onChange={(event) => {
                  const selected = serviceOptions.find((service) => (service.id || service.name) === event.target.value);
                  update(index, {
                    serviceId: selected?.id ?? "",
                    service: selected?.name ?? event.target.value,
                  });
                }}
              >
                {!serviceOptions.some((service) => service.name === item.service) && item.service
                  ? <option value={item.serviceId || item.service}>{item.service}</option>
                  : null}
                {serviceOptions.map((service) => (
                  <option key={service.id || service.name} value={service.id || service.name}>{service.name}</option>
                ))}
              </select>
              <select aria-label="Priority" className={fieldClass} value={item.priority} onChange={(event) => update(index, { priority: event.target.value })}>
                <option>Routine</option>
                <option>Urgent</option>
              </select>
              <select aria-label="Frequency" className={fieldClass} value={item.frequency} onChange={(event) => update(index, { frequency: event.target.value })}>
                <option>Daily</option>
                <option>Weekly</option>
                <option>As needed</option>
              </select>
              <button type="button" aria-label={`Delete ${item.service}`} onClick={() => setDeleting(item)} className="flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label>
                <FieldLabel>Start date</FieldLabel>
                <input type="date" className={fieldClass} value={item.startDate} onChange={(event) => update(index, { startDate: event.target.value })} />
              </label>
              <label>
                <FieldLabel>Duration</FieldLabel>
                <div className="relative">
                  <input aria-label="Duration in days" type="number" min={1} className={`${fieldClass} pr-12`} value={item.duration} onChange={(event) => update(index, { duration: Number(event.target.value) })} />
                  <span className="pointer-events-none absolute right-3 top-2.5 text-[10px] text-muted-foreground">days</span>
                </div>
              </label>
              <label>
                <FieldLabel>Number of visits</FieldLabel>
                <input type="number" min={1} className={fieldClass} placeholder="e.g. 10" value={item.numberOfVisits} onChange={(event) => update(index, { numberOfVisits: Number(event.target.value) })} />
              </label>
            </div>

            <label className="mt-3 block">
              <FieldLabel>Clinical instructions</FieldLabel>
              <textarea className={areaClass} placeholder="Enter clinical instructions, monitoring notes, or special requirements..." value={item.instructions} onChange={(event) => update(index, { instructions: event.target.value })} />
            </label>

            <FieldLabel>Fulfillment method</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${item.fulfillmentMethod === "hospital" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                <input className="mt-0.5 accent-primary" type="radio" name={`fulfillment-${item.id}`} checked={item.fulfillmentMethod === "hospital"} onChange={() => update(index, { fulfillmentMethod: "hospital" })} />
                <span><strong className="block text-[11px] text-foreground">Assign hospital provider</strong><span className="text-[9px] leading-4 text-muted-foreground">Assign a nurse, CHW, or physiotherapist from your hospital team</span></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${item.fulfillmentMethod === "network" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <input className="mt-0.5 accent-primary" type="radio" name={`fulfillment-${item.id}`} checked={item.fulfillmentMethod === "network"} onChange={() => update(index, { fulfillmentMethod: "network", clinicianId: "" })} />
                <span><strong className="block text-[11px] text-foreground">Tracmedy care network</strong><span className="text-[9px] leading-4 text-muted-foreground">Record Tracmedy as the requested provider-assignment route</span></span>
              </label>
            </div>

            {item.fulfillmentMethod === "hospital" ? (
              <label className="mt-3 block">
                <FieldLabel>Assigned nurse / CHW</FieldLabel>
                <select aria-label="Assigned nurse or community health worker" className={fieldClass} value={item.clinicianId} onChange={(event) => update(index, { clinicianId: event.target.value })}>
                  <option value="">Select available clinician</option>
                  {clinicians.map((clinician) => <option key={clinician.id} value={clinician.id}>{clinician.name}{clinician.role ? ` - ${clinician.role}` : ""}</option>)}
                </select>
              </label>
            ) : (
              <div className="mt-3 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[10px] leading-4 text-destructive">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>The request will be submitted to the Tracmedy care network when this care-plan change is saved.</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <AddRowButton onClick={() => onChange([...items, newHomeCareOrder(services)])}>Add home care order</AddRowButton>
      <DeleteDialog
        label={deleting?.service ?? "home care order"}
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        onConfirm={() => {
          if (deleting) onChange(items.filter((item) => item.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </SectionFrame>
  );
}
