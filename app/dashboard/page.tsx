"use client";

import { useEffect, useState } from "react";
import DashboardMetricCards from "@/components/dashboard/DashboardMetricCards";
import RecoveryTrend, { type RecoveryTrendPoint } from "@/components/dashboard/RecoveryTrend";
import LiveAlerts, { type LiveAlert } from "@/components/dashboard/LiveAlerts";
import WorkloadStatus, { type ClinicianWorkload } from "@/components/dashboard/WorkloadStatus";
import {
  getDashboardClinicianWorkload,
  getDashboardLiveAlerts,
  getDashboardRecoveryTrend,
  type DashboardRecoveryTrendRange,
} from "@/lib/api/dashboard";

const POLL_INTERVAL_MS = 60_000;

export default function DashboardPage() {
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [clinicianWorkload, setClinicianWorkload] = useState<ClinicianWorkload[]>([]);
  const [recoveryTrend, setRecoveryTrend] = useState<RecoveryTrendPoint[]>([]);
  const [recoveryRange, setRecoveryRange] = useState<DashboardRecoveryTrendRange>("7d");
  const [isRecoveryTrendLoading, setIsRecoveryTrendLoading] = useState(true);
  const [isPanelsLoading, setIsPanelsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadDashboardPanels = async (showLoading: boolean) => {
      if (showLoading) setIsPanelsLoading(true);
      const [alertsResult, workloadResult] = await Promise.allSettled([
        getDashboardLiveAlerts(),
        getDashboardClinicianWorkload(),
      ]);

      if (ignore) return;
      setLiveAlerts(alertsResult.status === "fulfilled" ? alertsResult.value : []);
      setClinicianWorkload(workloadResult.status === "fulfilled" ? workloadResult.value : []);
      if (showLoading) setIsPanelsLoading(false);
    };

    void loadDashboardPanels(true);
    const interval = window.setInterval(() => void loadDashboardPanels(false), POLL_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, []);


  useEffect(() => {
    let ignore = false;

    async function loadRecoveryTrend() {
      setIsRecoveryTrendLoading(true);
      try {
        const points = await getDashboardRecoveryTrend(recoveryRange);
        if (!ignore) setRecoveryTrend(points);
      } catch {
        if (!ignore) setRecoveryTrend([]);
      } finally {
        if (!ignore) setIsRecoveryTrendLoading(false);
      }
    }

    void loadRecoveryTrend();
    return () => {
      ignore = true;
    };
  }, [recoveryRange]);
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground md:text-2xl">Command Center</h1>
        <p className="text-sm text-muted-foreground">What requires your attention right now</p>
      </div>

      <DashboardMetricCards />

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 md:space-y-6 lg:col-span-2">
          <RecoveryTrend data={recoveryTrend} range={recoveryRange} isLoading={isRecoveryTrendLoading} onRangeChange={setRecoveryRange} />
          <WorkloadStatus clinicians={clinicianWorkload} isLoading={isPanelsLoading} />
        </div>
        <LiveAlerts alerts={liveAlerts} isLoading={isPanelsLoading} />
      </div>
    </div>
  );
}
