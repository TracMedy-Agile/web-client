import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative";
  changeTitle?: string;
  description?: string;
}

export default function MetricCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  change,
  changeType = "positive",
  changeTitle,
  description,
}: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="absolute right-0 top-0 h-20 w-20 -translate-y-1/2 translate-x-1/2 rounded-full bg-secondary/20 transition group-hover:bg-secondary/30" />
      <div className="flex items-center justify-between gap-3">
        <div className={cn("relative flex h-11 w-11 items-center justify-center rounded-xl", iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
        {change ? (
          <span
            title={changeTitle}
            className={cn(
              "relative rounded-full px-2.5 py-1 text-xs font-bold",
              changeType === "positive" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
            )}
          >
            {change}
          </span>
        ) : null}
      </div>
      <p className="mt-5 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground md:text-[32px]">{value}</p>
      {description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}