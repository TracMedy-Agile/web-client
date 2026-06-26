"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export interface RecoveryTrendPoint {
  day: string;
  active: number;
  mean: number;
}

interface RecoveryTrendProps {
  data?: RecoveryTrendPoint[];
}

const RANGES = ["7d", "30d"] as const;

export default function RecoveryTrend({ data = [] }: RecoveryTrendProps) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("7d");
  const hasData = data.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recovery Trend</h2>
          <p className="text-sm text-muted-foreground">Patient recovery trends over time</p>
        </div>

        {hasData && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-primary" />
                ACTIVE PATIENTS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full border-t border-dashed border-muted-foreground" />
                MEAN
              </span>
            </div>
            <div className="flex rounded-lg bg-background p-1 text-xs font-medium">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-3 py-1 transition-colors",
                    range === r ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasData ? (
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 15, 30, 45, 60, 75, 90, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                label={{ value: "Recovery Score", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }}
              />
              <Tooltip />
              <Line type="monotone" dataKey="active" stroke="#023e8a" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="mean" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/30">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <p className="font-medium text-foreground">No data to display.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Trend analysis data will appear here automatically as they sync from the mobile app.
          </p>
        </div>
      )}
    </div>
  );
}
