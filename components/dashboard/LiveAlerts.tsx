import Link from "next/link";
import { AlertTriangle, Building2, RefreshCw, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiveAlert {
  id: string;
  patientName: string;
  severity: "critical" | "moderate";
  description: string;
  time: string;
  actionLabel: string;
}

interface LiveAlertsProps {
  alerts?: LiveAlert[];
}

export default function LiveAlerts({ alerts = [] }: LiveAlertsProps) {
  const hasAlerts = alerts.length > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Live Alerts
        </h2>
        {hasAlerts && (
          <Link href="/dashboard/alerts" className="text-sm font-medium text-primary hover:underline">
            View all &rarr;
          </Link>
        )}
      </div>

      {hasAlerts ? (
        <div className="mt-4 space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "rounded-xl border p-4",
                alert.severity === "critical" ? "border-red-100 bg-red-50/60" : "border-amber-100 bg-amber-50/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{alert.patientName}</p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold",
                    alert.severity === "critical" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600",
                  )}
                >
                  {alert.severity === "critical" ? "CRITICAL" : "MODERATE"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">{alert.time}</p>
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {alert.actionLabel} &rarr;
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-border">
            <Building2 className="h-10 w-10 text-primary" />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-primary">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-card text-primary shadow">
              <RefreshCw className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="font-semibold text-foreground">Awaiting Patient Records</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Live alerts and clinical notifications will appear here once patients register and begin syncing data via
            the Tracmedy mobile app.
          </p>
        </div>
      )}
    </div>
  );
}


