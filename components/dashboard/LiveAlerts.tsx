import Link from "next/link";
import { AlertTriangle, Building2, Clock3, RefreshCw, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiveAlert {
  id: string;
  patientName: string;
  severity: "critical" | "moderate";
  description: string;
  time: string;
  actionLabel: string;
  actionHref: string;
}

interface LiveAlertsProps {
  alerts?: LiveAlert[];
  isLoading?: boolean;
}

function LiveAlertsSkeleton() {
  return (
    <div className="mt-5 animate-pulse space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-full max-w-[220px] rounded bg-muted/70" />
            </div>
            <div className="h-5 w-16 shrink-0 rounded-full bg-muted" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-8 w-24 rounded-lg bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LiveAlerts({ alerts = [], isLoading = false }: LiveAlertsProps) {
  const hasAlerts = alerts.length > 0;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Live Alerts
          </h2>
        </div>
        {hasAlerts ? (
          <Link href="/dashboard/alerts" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary hover:underline">
            View all <span aria-hidden="true">&rarr;</span>
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <LiveAlertsSkeleton />
      ) : hasAlerts ? (
        <div className="mt-5 space-y-3">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className={cn(
                "rounded-2xl border p-4 transition hover:shadow-sm",
                alert.severity === "critical" ? "border-red-100 bg-red-50/70" : "border-amber-100 bg-amber-50/70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground">{alert.patientName}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{alert.description}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em]",
                    alert.severity === "critical" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700",
                  )}
                >
                  {alert.severity}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {alert.time}
                </span>
                <Link
                  href={alert.actionHref}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  {alert.actionLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-border bg-muted/40">
            <Building2 className="h-10 w-10 text-primary" />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-primary">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-card text-primary shadow">
              <RefreshCw className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="font-bold text-foreground">No active alerts</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
            Clinical notifications will appear here once patients register and begin syncing data from the mobile app.
          </p>
        </div>
      )}
    </section>
  );
}