"use client";

import { CircleAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const reasons = ["Patient non-adherence to current plan", "Worsening symptoms observed", "Improvement allows reduced monitoring"];

export function ChangeJustification({ selected, details, onSelectedChange, onDetailsChange }: { selected: string[]; details: string; onSelectedChange: (value: string[]) => void; onDetailsChange: (value: string) => void }) {
  return (
    <section id="change-justification" className="rounded-xl border border-amber-400 bg-amber-50/40 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-foreground"><CircleAlert className="h-4 w-4 text-amber-500" />Change justification <span className="ml-1 text-[8px] font-bold uppercase tracking-wide text-red-500">Required</span></h2>
      <p className="mt-3 text-[10px] font-semibold text-muted-foreground">Reason for this care plan update</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{reasons.map((reason) => <label key={reason} className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-4 text-muted-foreground"><Checkbox checked={selected.includes(reason)} onCheckedChange={(checked) => onSelectedChange(checked ? [...selected, reason] : selected.filter((item) => item !== reason))} className="mt-0.5 h-4 w-4" />{reason}</label>)}</div>
      <textarea aria-label="Additional change justification" value={details} onChange={(event) => onDetailsChange(event.target.value)} placeholder="Add any additional details for this change..." className="mt-3 min-h-16 w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground outline-none focus:border-amber-400" />
      <p className="mt-3 text-[9px] text-muted-foreground">This justification is recorded in the audit log alongside your identity, the timestamp, and a summary of changes.</p>
    </section>
  );
}
