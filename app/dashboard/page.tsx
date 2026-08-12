"use client";

import { useEffect, useState } from "react";
import DashboardMetricCards from "@/components/dashboard/DashboardMetricCards";
import RecoveryTrend, { type RecoveryTrendPoint } from "@/components/dashboard/RecoveryTrend";
import LiveAlerts, { type LiveAlert } from "@/components/dashboard/LiveAlerts";
import WorkloadStatus, { type ClinicianWorkload } from "@/components/dashboard/WorkloadStatus";
import { getDashboardClinicianWorkload, getDashboardLiveAlerts } from "@/lib/api/dashboard";

const EMPTY_RECOVERY_TREND: RecoveryTrendPoint[] = [];
const POLL_INTERVAL_MS = 60_000;

export default function DashboardPage() {
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [clinicianWorkload, setClinicianWorkload] = useState<ClinicianWorkload[]>([]);

  useEffect(() => {
    let ignore = false;

    const loadDashboardPanels = async () => {
      const [alertsResult, workloadResult] = await Promise.allSettled([
        getDashboardLiveAlerts(),
        getDashboardClinicianWorkload(),
      ]);

      if (ignore) return;
      setLiveAlerts(alertsResult.status === "fulfilled" ? alertsResult.value : []);
      setClinicianWorkload(workloadResult.status === "fulfilled" ? workloadResult.value : []);
    };

    void loadDashboardPanels();
    const interval = window.setInterval(() => void loadDashboardPanels(), POLL_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground md:text-2xl">Command Center</h1>
        <p className="text-sm text-muted-foreground">What requires your attention right now</p>
      </div>

      <DashboardMetricCards />

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecoveryTrend data={EMPTY_RECOVERY_TREND} />
        </div>
        <LiveAlerts alerts={liveAlerts} />
      </div>

      <WorkloadStatus clinicians={clinicianWorkload} />
    </div>
  );
}