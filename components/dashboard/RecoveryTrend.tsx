"use client";

import { useEffect, useState } from "react";
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
  range?: (typeof RANGES)[number];
  isLoading?: boolean;
  onRangeChange?: (range: (typeof RANGES)[number]) => void;
}

const RANGES = ["7d", "30d"] as const;

export default function RecoveryTrend({ data = [], range = "7d", isLoading = false, onRangeChange }: RecoveryTrendProps) {
  const [mounted, setMounted] = useState(false);
  const hasData = data.length > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Recovery Trend</h2>
          <p className="mt-1 text-sm text-muted-foreground">Patient recovery score movement over time</p>
        </div>

        {hasData ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full bg-primary" />
                Active patients
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full border-t border-dashed border-muted-foreground" />
                Mean
              </span>
            </div>
            <div className="flex w-fit rounded-xl bg-muted p-1 text-xs font-bold">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRangeChange?.(r)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition-colors",
                    range === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-6 h-72 w-full animate-pulse rounded-2xl bg-muted/40" />
      ) : hasData ? (
        <div className="mt-6 h-72 w-full rounded-2xl bg-background/50 p-3">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 4" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)" }}
                  labelStyle={{ color: "var(--color-foreground)", fontWeight: 700 }}
                />
                <Line type="monotone" dataKey="active" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="mean" stroke="var(--color-muted-foreground)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-xl bg-muted/40" />
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/30 text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <p className="font-bold text-foreground">No recovery data yet</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Trend analysis will appear automatically as patients submit check-ins and care-plan activity.
          </p>
        </div>
      )}
    </section>
  );
}