import { Megaphone, TrendingUp, Users, CalendarCheck } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import RecoveryTrend, { type RecoveryTrendPoint } from "@/components/dashboard/RecoveryTrend";
import LiveAlerts, { type LiveAlert } from "@/components/dashboard/LiveAlerts";
import WorkloadStatus, { type ClinicianWorkload } from "@/components/dashboard/WorkloadStatus";

const RECOVERY_TREND: RecoveryTrendPoint[] = [
  { day: "Mon", active: 38, mean: 30 },
  { day: "Tue", active: 40, mean: 32 },
  { day: "Wed", active: 60, mean: 38 },
  { day: "Thu", active: 50, mean: 45 },
  { day: "Fri", active: 38, mean: 50 },
  { day: "Sat", active: 88, mean: 58 },
  { day: "Sun", active: 82, mean: 60 },
];

const LIVE_ALERTS: LiveAlert[] = [
  {
    id: "1",
    patientName: "Amara Okonkwo",
    severity: "critical",
    description: "Missed weight stabilization milestone",
    time: "12 min ago",
    actionLabel: "Review",
  },
  {
    id: "2",
    patientName: "David Adeyemi",
    severity: "moderate",
    description: "Abnormal blood pressure reading",
    time: "24 min ago",
    actionLabel: "View Details",
  },
  {
    id: "3",
    patientName: "Chinedu Okafor",
    severity: "critical",
    description: "SpO₂ levels dropped below threshold",
    time: "25 min ago",
    actionLabel: "View Details",
  },
];

const CLINICIAN_WORKLOAD: ClinicianWorkload[] = [
  { id: "1", name: "Dr. Sarah Kimani", load: "high", episodes: 12, alerts: 8, avgMinutes: 18 },
  { id: "2", name: "Dr. Ibrahim Musa", load: "moderate", episodes: 9, alerts: 4, avgMinutes: 12 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground md:text-2xl">Command Center</h1>
        <p className="text-sm text-muted-foreground">What requires your attention right now</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <MetricCard
          icon={Users}
          iconClassName="bg-secondary/30 text-primary"
          label="Active Care Episode"
          value={8}
          change="+2%"
          changeType="positive"
        />
        <MetricCard
          icon={CalendarCheck}
          iconClassName="bg-secondary/30 text-primary"
          label="Appointments"
          value={3}
          change="-1%"
          changeType="negative"
        />
        <MetricCard
          icon={Megaphone}
          iconClassName="bg-red-50 text-red-500"
          label="Alerts"
          value={3}
          change="-5%"
          changeType="negative"
        />
        <MetricCard
          icon={TrendingUp}
          iconClassName="bg-emerald-50 text-emerald-500"
          label="Avg Recovery %"
          value="62%"
          change="+4%"
          changeType="positive"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecoveryTrend data={RECOVERY_TREND} />
        </div>
        <LiveAlerts alerts={LIVE_ALERTS} />
      </div>

      <WorkloadStatus clinicians={CLINICIAN_WORKLOAD} />
    </div>
  );
}





