import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative";
}

export default function MetricCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  change,
  changeType = "positive",
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
        {change && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              changeType === "positive" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
            )}
          >
            {change}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
