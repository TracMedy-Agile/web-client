"use client";

import { CircleAlert } from "lucide-react";
export function ChangeJustification({ details, onDetailsChange }: { details: string; onDetailsChange: (value: string) => void }) {
  return (
    <section id="change-justification" className="rounded-xl border border-amber-400 bg-amber-50/40 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-foreground"><CircleAlert className="h-4 w-4 text-amber-500" />Change justification <span className="ml-1 text-[8px] font-bold uppercase tracking-wide text-red-500">Required</span></h2>
      <p className="mt-3 text-[10px] font-semibold text-muted-foreground">Reason for this care plan update</p>
      <textarea id="care-plan-change-justification" required aria-label="Change justification" value={details} onChange={(event) => onDetailsChange(event.target.value)} placeholder="e.g. Patient non-adherent to current plan · Worsening symptoms observed · Improvement allows reduced monitoring" className="mt-3 min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-3 text-[12px] leading-5 text-foreground outline-none placeholder:text-muted-foreground focus:border-amber-400 focus:ring-2 focus:ring-amber-200" />
      <p className="mt-3 text-[9px] text-muted-foreground">This justification is recorded in the audit log alongside your identity, the timestamp, and a summary of changes.</p>
    </section>
  );
}
