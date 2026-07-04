import { useState } from "react";
import { Clock3, RefreshCcw } from "lucide-react";

type AppointmentEmptyStateProps = {
  onRefresh?: () => void | Promise<void>;
};

export default function AppointmentEmptyState({ onRefresh }: AppointmentEmptyStateProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center px-4 sm:px-6 py-20 text-center">
      <div className="relative mb-16 flex h-44 w-44 items-center justify-center rounded-full bg-[#EEF0FF] shadow-[0_28px_60px_rgba(2,62,138,0.13)]">
        <div className="absolute h-36 w-36 rounded-full bg-[#F8FAFF]" />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-[0_24px_45px_rgba(15,23,42,0.16)]">
          <Clock3 className="h-14 w-14 text-primary" strokeWidth={2.8} />
        </div>
      </div>

      <h2 className="text-lg font-bold md:text-2xl text-[#111827]">No upcoming appointments</h2>
      <p className="mt-6 max-w-[560px] text-base font-medium leading-7 text-[#4B5563]">
        Your schedule is currently clear. New patient bookings will appear
        <br className="hidden sm:block" />
        here as they are scheduled.
      </p>

      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="mt-7 flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white">
          <RefreshCcw className={isRefreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </span>
        {isRefreshing ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}

