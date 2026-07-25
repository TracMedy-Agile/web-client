"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const fieldClass = "h-9 w-full rounded-md border border-border bg-card px-3 text-[12px] font-medium text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
export const areaClass = "min-h-16 w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-[12px] leading-5 text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function SectionFrame({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-xl border-border bg-card shadow-none">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-[14px] font-bold text-foreground"><span className="text-primary">{icon}</span>{title}</h2>
        <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">{subtitle}</p>
      </div>
      <CardContent className="p-4 sm:px-5 sm:py-4">{children}</CardContent>
    </Card>
  );
}

export function AddRowButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-[11px] font-semibold text-muted-foreground shadow-sm hover:bg-muted/40"><Plus className="h-3.5 w-3.5" />{children}</button>;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{children}</span>;
}

export function DeleteDialog({ label, open, onOpenChange, onConfirm }: { label: string; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-xl bg-card">
        <AlertDialogHeader><AlertDialogTitle>Delete {label}?</AlertDialogTitle><AlertDialogDescription>This removes it from the draft. The deletion becomes permanent when the care plan is saved.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
