import Link from "next/link";
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
}

const LOAD_LABEL: Record<ClinicianWorkload["load"], string> = {
  high: "High load",
  moderate: "Moderate",
  low: "Low load",
};

const LOAD_COLOR: Record<ClinicianWorkload["load"], string> = {
  high: "bg-red-500 text-red-600",
  moderate: "bg-amber-500 text-amber-600",
  low: "bg-emerald-500 text-emerald-600",
};

export default function WorkloadStatus({ clinicians = [] }: WorkloadStatusProps) {
  const hasData = clinicians.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Clinician Workload Status</h2>
          <p className="text-sm text-muted-foreground">Real-time resource utilization and capacity tracking</p>
        </div>
        {hasData && (
          <Link href="/dashboard/team" className="text-sm font-medium text-primary hover:underline">
            View all &rarr;
          </Link>
        )}
      </div>

      {hasData ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {clinicians.map((clinician) => {
            const [dotColor, textColor] = LOAD_COLOR[clinician.load].split(" ");
            return (
              <div key={clinician.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{clinician.name}</p>
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium", textColor)}>
                    <span className={cn("h-2 w-2 rounded-full", dotColor)} />
                    {LOAD_LABEL[clinician.load]}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Episodes</p>
                    <p className="mt-1 font-semibold text-foreground">{clinician.episodes}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Alerts</p>
                    <p className="mt-1 font-semibold text-foreground">{clinician.alerts}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Avg</p>
                    <p className="mt-1 font-semibold text-foreground">{clinician.avgMinutes} min</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-4 py-6">
          <div className="flex items-center gap-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 w-20 rounded-full border border-dashed border-border" />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Awaiting clinical input...</p>
        </div>
      )}
    </div>
  );
}



