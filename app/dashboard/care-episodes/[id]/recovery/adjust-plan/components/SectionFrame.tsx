"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const fieldClass = "h-9 w-full rounded-md border border-[#DDE3EC] bg-white px-3 text-[12px] font-medium text-[#526078] outline-none focus:border-[#76A8E8] focus:ring-2 focus:ring-[#E7F2FF]";
export const areaClass = "min-h-16 w-full resize-y rounded-md border border-[#DDE3EC] bg-white px-3 py-2 text-[12px] leading-5 text-[#526078] outline-none focus:border-[#76A8E8] focus:ring-2 focus:ring-[#E7F2FF]";

export function SectionFrame({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-xl border-[#DDE3EC] bg-white shadow-none">
      <div className="border-b border-[#E8EDF3] px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-[14px] font-bold text-[#172033]"><span className="text-[#0873DC]">{icon}</span>{title}</h2>
        <p className="mt-0.5 text-[9px] font-medium text-[#95A2B5]">{subtitle}</p>
      </div>
      <CardContent className="p-4 sm:px-5 sm:py-4">{children}</CardContent>
    </Card>
  );
}

export function AddRowButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-[#DDE3EC] bg-white px-3 text-[11px] font-semibold text-[#526078] shadow-sm hover:bg-[#F8FAFC]"><Plus className="h-3.5 w-3.5" />{children}</button>;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.05em] text-[#7D8BA0]">{children}</span>;
}

export function DeleteDialog({ label, open, onOpenChange, onConfirm }: { label: string; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-xl bg-white">
        <AlertDialogHeader><AlertDialogTitle>Delete {label}?</AlertDialogTitle><AlertDialogDescription>This removes it from the draft. The deletion becomes permanent when the care plan is saved.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
