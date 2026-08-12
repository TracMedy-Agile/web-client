import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export function SettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </header>
  );
}

export function SettingsPanel({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-6 px-5 py-5 sm:px-6">{children}</div>
      {footer ? <div className="flex flex-col-reverse gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div> : null}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-6 text-primary">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function SaveNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "error" }) {
  return (
    <p
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium",
        tone === "success" && "bg-emerald-50 text-emerald-700",
        tone === "error" && "bg-destructive/10 text-destructive",
        tone === "info" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

export const inputClassName = "h-11 rounded-lg border-border bg-background text-sm font-medium text-foreground shadow-none focus-visible:ring-primary/20";

export const selectClassName = "h-11 rounded-lg border-border bg-background text-sm font-medium text-foreground shadow-none focus:ring-primary/20";
