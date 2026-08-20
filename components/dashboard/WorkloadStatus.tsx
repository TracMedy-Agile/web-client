import Link from "next/link";
import { Activity, ArrowRight, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClinicianWorkload {
  id: string;
  name: string;
  load: "high" | "moderate" | "low";
  episodes: number;
  alerts: number;
  avgMinutes: number;
}

interface WorkloadStatusProps {
  clinicians?: ClinicianWorkload[];
  isLoading?: boolean;
}

function WorkloadStatusSkeleton() {
  return (
    <div className="mt-6 grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <article key={index} className="rounded-2xl border border-border/80 bg-background/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-3 w-40 rounded bg-muted/70" />
            </div>
            <div className="h-6 w-20 shrink-0 rounded-full bg-muted" />
          </div>
          <div className="mt-5 h-2 rounded-full bg-muted" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, cellIndex) => (
              <div key={cellIndex} className="rounded-xl bg-card p-3">
                <div className="h-3 w-12 rounded bg-muted" />
                <div className="mt-2 h-5 w-8 rounded bg-muted" />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

const LOAD_LABEL: Record<ClinicianWorkload["load"], string> = {
  high: "High load",
  moderate: "Moderate",
  low: "Low load",
};

const LOAD_COLOR: Record<ClinicianWorkload["load"], { dot: string; text: string; bar: string; bg: string }> = {
  high: { dot: "bg-red-500", text: "text-red-600", bar: "bg-red-500", bg: "bg-red-50" },
  moderate: { dot: "bg-amber-500", text: "text-amber-700", bar: "bg-amber-500", bg: "bg-amber-50" },
  low: { dot: "bg-emerald-500", text: "text-emerald-600", bar: "bg-emerald-500", bg: "bg-emerald-50" },
};

function workloadPercent(clinician: ClinicianWorkload) {
  return Math.min(100, Math.max(8, clinician.episodes * 7 + clinician.alerts * 6));
}

export default function WorkloadStatus({ clinicians = [], isLoading = false }: WorkloadStatusProps) {
  const hasData = clinicians.length > 0;

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Activity className="h-5 w-5 text-primary" />
            Clinician Workload Status
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Resource utilization and alert load across care teams</p>
        </div>
        {hasData ? (
          <Link href="/dashboard/team" className="inline-flex w-fit items-center gap-1 text-sm font-bold text-primary hover:underline">
            View team <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <WorkloadStatusSkeleton />
      ) : hasData ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {clinicians.map((clinician) => {
            const colors = LOAD_COLOR[clinician.load];
            const percent = workloadPercent(clinician);
            return (
              <article key={clinician.id} className="rounded-2xl border border-border/80 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{clinician.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Average response: {clinician.avgMinutes} min</p>
                  </div>
                  <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", colors.bg, colors.text)}>
                    <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
                    {LOAD_LABEL[clinician.load]}
                  </span>
                </div>
                <div className="mt-5 h-2 rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", colors.bar)} style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xs font-medium text-muted-foreground">Episodes</p>
                    <p className="mt-1 text-lg font-extrabold text-foreground">{clinician.episodes}</p>
                  </div>
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xs font-medium text-muted-foreground">Alerts</p>
                    <p className="mt-1 text-lg font-extrabold text-foreground">{clinician.alerts}</p>
                  </div>
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xs font-medium text-muted-foreground">Load</p>
                    <p className="mt-1 text-lg font-extrabold text-foreground">{percent}%</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/30 text-primary">
            <UsersRound className="h-6 w-6" />
          </div>
          <p className="font-bold text-foreground">Awaiting clinical input</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Workload distribution appears as care episodes, alerts, and team activity are recorded.
          </p>
        </div>
      )}
    </section>
  );
}