"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NetworkErrorState from "@/components/system/NetworkErrorState";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getFacilityClinician,
  getTeamMember,
  getTeamMemberActivity,
  getTeamMemberEscalationPreference,
  updateTeamMemberEscalationPreference,
  type ClinicianProfile,
  type EscalationPreference,
  type TeamMember,
  type TeamMemberActivityEntry,
  type UpdateEscalationPreferenceInput,
} from "@/lib/api/clinicians";
import { cn } from "@/lib/utils";
import TeamMemberActions from "../components/TeamMemberActions";

type EscalationChannel = UpdateEscalationPreferenceInput["channels"][number];
type SeverityThreshold = NonNullable<UpdateEscalationPreferenceInput["whatsappSeverityThreshold"]>;

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending invite",
  suspended: "Suspended",
};

function initials(name: string | null) {
  return (name || "Team Member")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatAppointmentType(value: string) {
  return humanize(value);
}

function humanize(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function statusLabel(value?: string | null) {
  if (!value) return "Not configured";
  return STATUS_LABELS[value] ?? humanize(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function MemberSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5" aria-label="Loading team member">
      <div className="h-5 w-44 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
      <div className="h-[520px] animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}

const PERMISSION_GROUPS = [
  {
    title: "Clinical Care",
    icon: Stethoscope,
    permissions: [{ label: "Care episodes and connected patients", key: "care_episode" }],
  },
  {
    title: "Appointments",
    icon: CalendarCheck,
    permissions: [{ label: "Appointments", key: "appointments" }],
  },
  {
    title: "Insights",
    icon: Activity,
    permissions: [{ label: "Reports and analytics", key: "view_all_reports" }],
  },
  {
    title: "Administration",
    icon: ShieldCheck,
    permissions: [
      { label: "Manage team members", key: "manage_team_members" },
      { label: "View audit logs", key: "audit_log" },
      { label: "Manage hospital settings", key: "configure_settings" },
      { label: "Full system access", key: "full_system_access" },
    ],
  },
] as const;

const SEVERITIES: SeverityThreshold[] = ["info", "low", "moderate", "high", "critical"];

function hasPermission(member: TeamMember, permission: string) {
  return member.permissions.includes("full_system_access") || member.permissions.includes(permission);
}

function channelsFromPreference(preference: EscalationPreference | null, member: TeamMember | null): EscalationChannel[] {
  const channels = preference?.channels ?? member?.escalationChannels ?? [];
  return channels.filter((channel): channel is EscalationChannel =>
    channel === "sms" || channel === "email" || channel === "in_app" || channel === "whatsapp",
  );
}

export default function TeamMemberPage() {
  const params = useParams<{ id: string }>();
  const memberId = params.id;
  const [member, setMember] = useState<TeamMember | null>(null);
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [escalation, setEscalation] = useState<EscalationPreference | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [severity, setSeverity] = useState<SeverityThreshold>("critical");
  const [activityEntries, setActivityEntries] = useState<TeamMemberActivityEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [isEscalationLoading, setIsEscalationLoading] = useState(true);
  const [isSavingEscalation, setIsSavingEscalation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [escalationError, setEscalationError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const teamMember = await getTeamMember(memberId);
      setMember(teamMember);
      try {
        setProfile(await getFacilityClinician(teamMember.userId || teamMember.id));
      } catch {
        setProfile(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load this team member.");
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  const loadActivity = useCallback(async () => {
    setIsActivityLoading(true);
    setActivityError(null);
    try {
      const response = await getTeamMemberActivity(memberId, { page: 1, limit: 10 });
      setActivityEntries(response.data);
      setActivityTotal(response.meta.total);
    } catch (requestError) {
      setActivityError(requestError instanceof Error ? requestError.message : "Unable to load team member activity.");
    } finally {
      setIsActivityLoading(false);
    }
  }, [memberId]);

  const loadEscalation = useCallback(async () => {
    setIsEscalationLoading(true);
    setEscalationError(null);
    try {
      const preference = await getTeamMemberEscalationPreference(memberId);
      setEscalation(preference);
      setWhatsappPhone(preference.whatsappPhone || "");
      setSeverity((preference.whatsappSeverityThreshold || "critical") as SeverityThreshold);
    } catch (requestError) {
      setEscalationError(requestError instanceof Error ? requestError.message : "Unable to load escalation preferences.");
    } finally {
      setIsEscalationLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    capturePostHogEvent("team_member_viewed", { member_id: memberId });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
    void loadActivity();
    void loadEscalation();
  }, [loadActivity, loadEscalation, loadProfile, memberId]);

  const workingDays = useMemo(() => {
    if (!profile) return [];
    return Object.entries(profile.weeklyAvailability)
      .filter(([, value]) => value.isWorking)
      .map(([day, value]) => `${day} ${value.start || ""}-${value.end || ""}`);
  }, [profile]);

  async function saveEscalationPreference(nextChannels?: EscalationChannel[]) {
    if (!member) return;
    const channels = nextChannels ?? channelsFromPreference(escalation, member);
    setIsSavingEscalation(true);
    try {
      const preference = await updateTeamMemberEscalationPreference(member.id, {
        channels,
        ...(whatsappPhone.trim() ? { whatsappPhone: whatsappPhone.trim() } : {}),
        whatsappSeverityThreshold: severity,
      });
      setEscalation(preference);
      setWhatsappPhone(preference.whatsappPhone || "");
      setSeverity((preference.whatsappSeverityThreshold || severity) as SeverityThreshold);
      capturePostHogEvent("team_escalation_preference_updated", { member_id: member.id, channels });
      toast.success("Escalation preferences updated");
    } catch (requestError) {
      toast.error("Escalation preference could not be saved", {
        description: requestError instanceof Error ? requestError.message : "Unable to update escalation preferences.",
      });
    } finally {
      setIsSavingEscalation(false);
    }
  }

  if (isLoading) return <MemberSkeleton />;
  if (error || !member) return <NetworkErrorState onRetry={loadProfile} />;

  const name = member.name || profile?.name || "Unnamed clinician";
  const department = member.ward || member.specialty || profile?.department || "Not specified";
  const analytics = profile?.analytics;
  const dailyCapacity = profile?.dailyCapacity ?? 0;
  const assignedToday = profile?.assignedToday ?? member.assignedPatientCount;
  const remainingToday = profile?.remainingToday ?? 0;
  const utilization = profile?.utilizationPercentage ?? 0;
  const hasWorkloadWarning = profile?.workloadThresholdWarning ?? false;
  const todayAppointments = profile?.todayAppointments ?? [];
  const activeChannels = channelsFromPreference(escalation, member);
  const whatsappEnabled = activeChannels.includes("whatsapp");

  return (
    <section className="mx-auto w-full max-w-[1500px] space-y-5" aria-labelledby="member-title">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/team" className="inline-flex items-center gap-1.5 hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Team
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{name}</span>
      </nav>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="member-title" className="truncate text-2xl font-bold text-foreground">{name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {statusLabel(member.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusLabel(member.role)} · {department}
              </p>
            </div>
          </div>
          <TeamMemberActions
            memberId={member.id}
            name={name}
            email={member.email}
            specialty={member.specialty || ""}
            ward={member.ward || ""}
            role={member.role}
            status={member.status}
            accessProfile={member.accessProfile}
            permissions={member.permissions}
            onChanged={loadProfile}
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto rounded-xl border border-border bg-card px-2">
          <TabsList className="h-14 min-w-max justify-start bg-transparent p-0">
            {[
              ["overview", "Overview"],
              ["access", "Role & Access"],
              ["escalation", "Alert Escalation"],
              ["activity", "Activity"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-14 rounded-none border-b-2 border-transparent px-5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Daily Capacity", value: dailyCapacity, detail: profile ? "Appointments per day" : "Clinician profile unavailable", icon: CalendarDays },
              { label: "Assigned Today", value: assignedToday, detail: profile ? "Confirmed workload" : "Assigned patients", icon: UserRoundCheck },
              { label: "Remaining Today", value: remainingToday, detail: "Open capacity", icon: UsersRound },
              { label: "Utilization", value: `${utilization}%`, detail: hasWorkloadWarning ? "Workload warning" : "Within threshold", icon: Activity },
            ].map(({ label, value, detail, icon: Icon }) => (
              <article key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-foreground">Appointment Summary</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Confirmed", analytics?.totalConfirmed ?? 0],
                  ["In person", analytics?.inPerson ?? 0],
                  ["Teleconsultation", analytics?.teleconsultation ?? 0],
                  ["Nurse check-in", analytics?.nurseCheckin ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-muted/60 p-4">
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Today&apos;s utilization</span>
                  <span className="text-muted-foreground">{utilization}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", hasWorkloadWarning ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }}
                  />
                </div>
              </div>
            </div>

            <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-foreground">Contact Details</h2>
              <dl className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
                    <dd className="mt-1 break-all text-sm font-medium text-foreground">{member.email}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ward / Specialty</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{department}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Working schedule</dt>
                    <dd className="mt-1 text-sm font-medium leading-6 text-foreground">
                      {workingDays.length ? workingDays.join(", ") : "Not configured"}
                    </dd>
                  </div>
                </div>
              </dl>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
            <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-foreground">Role Summary</h2>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{statusLabel(member.role)}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel(member.systemRole)}</p>
                </div>
              </div>
              <dl className="mt-5 space-y-3 rounded-lg bg-muted p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Access profile</dt>
                  <dd className="font-semibold text-foreground">{statusLabel(member.accessProfile)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Invite state</dt>
                  <dd className="font-semibold text-foreground">{statusLabel(member.inviteState)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Invited</dt>
                  <dd className="text-right font-semibold text-foreground">{formatDateTime(member.invitedAt)}</dd>
                </div>
              </dl>
            </aside>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map(({ title, icon: Icon, permissions }) => (
                <article key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h2 className="font-semibold text-foreground">{title}</h2>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {permissions.map((permission) => {
                      const enabled = hasPermission(member, permission.key);
                      return (
                        <div key={permission.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                          <span className="text-sm text-foreground">{permission.label}</span>
                          <span className={cn("text-xs font-medium", enabled ? "text-emerald-700" : "text-muted-foreground")}>
                            {enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="escalation" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Preferred channels", activeChannels.length ? activeChannels.map(statusLabel).join(", ") : "None"],
              ["WhatsApp phone", whatsappPhone || "Not configured"],
              ["WhatsApp threshold", statusLabel(severity)],
              ["Last login", formatDateTime(member.lastLoginAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-3 font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-foreground">WhatsApp Critical Alert Escalations</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Receive eligible critical alerts through the approved WhatsApp escalation channel.
                  </p>
                  {escalationError ? <p className="mt-2 text-sm text-destructive">{escalationError}</p> : null}
                </div>
              </div>
              <Switch
                checked={whatsappEnabled}
                disabled={isEscalationLoading || isSavingEscalation}
                aria-label="WhatsApp critical alert escalation"
                onCheckedChange={(checked) => {
                  const nextChannels = checked
                    ? Array.from(new Set([...activeChannels, "whatsapp" as EscalationChannel]))
                    : activeChannels.filter((channel) => channel !== "whatsapp");
                  void saveEscalationPreference(nextChannels);
                }}
              />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="escalation-whatsapp-phone">WhatsApp phone</Label>
                <Input
                  id="escalation-whatsapp-phone"
                  value={whatsappPhone}
                  onChange={(event) => setWhatsappPhone(event.target.value)}
                  placeholder="+2348012345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="escalation-severity">Severity threshold</Label>
                <Select value={severity} onValueChange={(value) => setSeverity(value as SeverityThreshold)}>
                  <SelectTrigger id="escalation-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((item) => (
                      <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void saveEscalationPreference()} disabled={isEscalationLoading || isSavingEscalation}>
                {isSavingEscalation ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Member Audit Activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invitations, sign-ins, permission changes, status updates, and deletion events from the facility audit feed.
                </p>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{activityTotal} records</span>
            </div>
            {isActivityLoading ? (
              <div className="mt-5 space-y-3" aria-label="Loading member audit activity">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : activityError ? (
              <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-foreground">Unable to load member activity</p>
                <p className="mt-1 text-sm text-muted-foreground">{activityError}</p>
                <button type="button" onClick={loadActivity} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Retry
                </button>
              </div>
            ) : activityEntries.length ? (
              <div className="mt-5 divide-y divide-border">
                {activityEntries.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-muted/60 px-4 py-10 text-center">
                <Activity className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium text-foreground">No member activity recorded yet</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Today&apos;s Appointment Activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live schedule data available from the clinician profile when the member has a clinician profile.
                </p>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {todayAppointments.length} appointments
              </span>
            </div>
            {todayAppointments.length ? (
              <div className="mt-5 divide-y divide-border">
                {todayAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CalendarCheck className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{appointment.patientName || "Patient name unavailable"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatAppointmentType(appointment.type)}</p>
                      </div>
                    </div>
                    <div className="text-sm sm:text-right">
                      <p className="font-semibold text-foreground">{appointment.time}</p>
                      <p className="text-xs capitalize text-muted-foreground">{appointment.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-muted/60 px-4 py-10 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium text-foreground">No appointments scheduled today</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function ActivityRow({ entry }: { entry: TeamMemberActivityEntry }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Activity className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{humanize(entry.action)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.targetSummary}</p>
          <p className="mt-1 text-xs text-muted-foreground">Actor: {entry.actorName}</p>
        </div>
      </div>
      <div className="text-sm sm:text-right">
        <p className="font-medium text-foreground">{humanize(entry.module)}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
      </div>
    </div>
  );
}

