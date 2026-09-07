"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  LogIn,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AccessDeniedState from "@/components/system/AccessDeniedState";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import NetworkErrorState from "@/components/system/NetworkErrorState";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getFacilityClinician,
  getTeamMember,
  getTeamMemberRequestId,
  getTeamMemberActivity,
  getTeamMemberEscalationPreference,
  updateTeamMemberEscalationPreference,
  type ClinicianProfile,
  type EscalationPreference,
  type TeamMember,
  type TeamMemberActivityEntry,
  type UpdateEscalationPreferenceInput,
} from "@/lib/api/clinicians";
import { errorMessage, isAccessDeniedError, isNetworkError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import TeamMemberActions from "../components/TeamMemberActions";

type EscalationChannel = UpdateEscalationPreferenceInput["channels"][number];
type WhatsappSeverityThreshold = NonNullable<UpdateEscalationPreferenceInput["whatsappSeverityThreshold"]>;

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending invite",
  suspended: "Suspended",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  pending: "bg-amber-500/10 text-amber-700",
  suspended: "bg-red-500/10 text-red-700",
};

function initials(name: string | null) {
  return (name || "Team Member")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatActivityDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `Today, ${formatTime(value)}`;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function isToday(value?: string | null) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
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
    bgColor: "bg-blue-50",
    permissions: [
      { label: "Connected patients", key: "connected_patients" },
      { label: "Care episodes", key: "care_episode" },
      { label: "View appointments", key: "appointments" },
      { label: "Manage appointments", key: "appointments" },
      { label: "Alerts", key: "alerts" },
      { label: "Messages", key: "messages" },
    ],
  },
  {
    title: "Insights",
    icon: BarChart3,
    bgColor: "bg-blue-50",
    permissions: [
      { label: "View reports & analytics", key: "view_all_reports" },
      { label: "Export reports", key: "view_all_reports" },
    ],
  },
  {
    title: "Administration",
    icon: Shield,
    bgColor: "bg-blue-50",
    permissions: [
      { label: "View team", key: "manage_team_members" },
      { label: "Manage team members", key: "manage_team_members" },
      { label: "View audit logs", key: "audit_log" },
      { label: "Manage hospital settings", key: "configure_settings" },
    ],
  },
] as const;

// connected_patients/alerts/messages collapse into the single `care_episode` backend value on save
// (see TeamMemberActions.tsx) — the backend never stores those three literal strings. Treat them as
// granted whenever `care_episode` is present, or these three would always show unchecked even for a
// member who genuinely has that access.
const CARE_EPISODE_BUNDLED_PERMISSIONS = new Set(["connected_patients", "alerts", "messages"]);

function hasPermission(member: TeamMember, permission: string) {
  if (member.accessProfile === "full_access" || member.permissions.includes("full_system_access")) return true;
  if (member.permissions.includes(permission)) return true;
  return CARE_EPISODE_BUNDLED_PERMISSIONS.has(permission) && member.permissions.includes("care_episode");
}

function channelsFromPreference(preference: EscalationPreference | null, member: TeamMember | null): EscalationChannel[] {
  const channels = preference?.channels ?? member?.escalationChannels ?? [];
  return channels.filter((channel): channel is EscalationChannel =>
    channel === "sms" || channel === "email" || channel === "in_app" || channel === "whatsapp",
  );
}

function whatsappSeverityThreshold(value: string | null | undefined): WhatsappSeverityThreshold {
  return value === "info" || value === "low" || value === "moderate" || value === "high" || value === "critical"
    ? value
    : "critical";
}

function getActivityIcon(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("login") || normalized.includes("logged")) return LogIn;
  if (normalized.includes("permission") || normalized.includes("custom")) return Shield;
  if (normalized.includes("whatsapp") || normalized.includes("phone") || normalized.includes("verify")) return Smartphone;
  if (normalized.includes("activat") || normalized.includes("account")) return UserCheck;
  if (normalized.includes("invite") || normalized.includes("sent")) return Mail;
  return Activity;
}

function getActivityIconColor(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("login")) return "bg-blue-50 text-blue-600 border-blue-200";
  if (normalized.includes("permission")) return "bg-purple-50 text-purple-600 border-purple-200";
  if (normalized.includes("whatsapp") || normalized.includes("verify")) return "bg-green-50 text-green-600 border-green-200";
  if (normalized.includes("activat")) return "bg-teal-50 text-teal-600 border-teal-200";
  if (normalized.includes("invite")) return "bg-indigo-50 text-indigo-600 border-indigo-200";
  return "bg-blue-50 text-blue-600 border-blue-200";
}

export default function TeamMemberPage() {
  const params = useParams<{ id: string }>();
  const memberId = params.id;
  const [member, setMember] = useState<TeamMember | null>(null);
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [escalation, setEscalation] = useState<EscalationPreference | null>(null);
  const [activityEntries, setActivityEntries] = useState<TeamMemberActivityEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [isEscalationLoading, setIsEscalationLoading] = useState(true);
  const [isSavingEscalation, setIsSavingEscalation] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [escalationError, setEscalationError] = useState<string | null>(null);
  const [editAccessDenied, setEditAccessDenied] = useState(false);
  const { hasPermission: hasCurrentUserPermission } = useDashboardUser();

  const loadActivity = useCallback(async (targetMember: TeamMember, pageNum = 1, append = false) => {
    const requestMemberId = getTeamMemberRequestId(targetMember);
    setIsActivityLoading(true);
    setActivityError(null);
    try {
      const response = await getTeamMemberActivity(requestMemberId, { page: pageNum, limit: 10 });
      setActivityEntries((prev) => append ? [...prev, ...response.data] : response.data);
      setActivityTotal(response.meta.total);
      setActivityPage(pageNum);
    } catch (requestError) {
      setActivityError(requestError instanceof Error ? requestError.message : "Unable to load team member activity.");
    } finally {
      setIsActivityLoading(false);
    }
  }, []);

  const loadEscalation = useCallback(async (targetMember: TeamMember) => {
    const requestMemberId = getTeamMemberRequestId(targetMember);
    setIsEscalationLoading(true);
    setEscalationError(null);
    try {
      const preference = await getTeamMemberEscalationPreference(requestMemberId);
      setEscalation(preference);
    } catch (requestError) {
      setEscalationError(requestError instanceof Error ? requestError.message : "Unable to load escalation preferences.");
    } finally {
      setIsEscalationLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const teamMember = await getTeamMember(memberId);
      setMember(teamMember);
      void loadActivity(teamMember);
      void loadEscalation(teamMember);
      try {
        setProfile(await getFacilityClinician(teamMember.userId || teamMember.id));
      } catch {
        setProfile(null);
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsLoading(false);
    }
  }, [loadActivity, loadEscalation, memberId]);

  useEffect(() => {
    capturePostHogEvent("team_member_viewed", { member_id: memberId });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile, memberId]);

  async function toggleWhatsapp(checked: boolean) {
    if (!member) return;
    const currentChannels = channelsFromPreference(escalation, member);
    const nextChannels = checked
      ? Array.from(new Set([...currentChannels, "whatsapp" as EscalationChannel]))
      : currentChannels.filter((channel) => channel !== "whatsapp");
    setIsSavingEscalation(true);
    try {
      const requestMemberId = getTeamMemberRequestId(member);
      const preference = await updateTeamMemberEscalationPreference(requestMemberId, {
        channels: nextChannels,
        whatsappSeverityThreshold: whatsappSeverityThreshold(escalation?.whatsappSeverityThreshold),
      });
      setEscalation(preference);
      capturePostHogEvent("team_escalation_preference_updated", { member_id: requestMemberId, channels: nextChannels });
      toast.success("Escalation preferences updated");
    } catch (requestError) {
      toast.error("Escalation preference could not be saved", {
        description: requestError instanceof Error ? requestError.message : "Unable to update escalation preferences.",
      });
    } finally {
      setIsSavingEscalation(false);
    }
  }

  if (editAccessDenied) {
    return <AccessDeniedState description="Hospital settings permission is required to edit team member profiles and permissions." />;
  }

  if (isLoading) return <MemberSkeleton />;
  if (isAccessDeniedError(error)) {
    return <AccessDeniedState description="This team member profile is available to users granted team-management access by the hospital." />;
  }
  if (error || !member) {
    if (isNetworkError(error)) return <NetworkErrorState onRetry={loadProfile} />;
    return (
      <section role="alert" className="mx-auto flex min-h-[520px] w-full max-w-[900px] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-14 text-center shadow-sm">
        <ShieldCheck className="h-12 w-12 text-destructive" />
        <h2 className="mt-5 text-2xl font-bold text-foreground">Unable to load team member</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{errorMessage(error, "Unable to load this team member.")}</p>
        <Button type="button" onClick={() => void loadProfile()} className="mt-6 h-11 rounded-lg px-5 font-semibold">Try Again</Button>
      </section>
    );
  }

  const name = member.name || profile?.name || "Unnamed clinician";
  const department = member.ward || member.specialty || profile?.department || "Not specified";
  const activeChannels = channelsFromPreference(escalation, member);
  const whatsappEnabled = activeChannels.includes("whatsapp");
  const enabledPermissionCount = PERMISSION_GROUPS.reduce((sum, g) => {
    return sum + g.permissions.filter((p) => hasPermission(member, p.key)).length;
  }, 0);

  return (
    <section className="mx-auto w-full max-w-[1500px] space-y-5" aria-labelledby="member-title">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/team" className="hover:text-primary">Team</Link>
        <span className="text-muted-foreground/50">&gt;</span>
        <span className="text-muted-foreground">Team Member</span>
        <span className="text-muted-foreground/50">&gt;</span>
        <span className="font-semibold text-foreground">View Profile</span>
      </nav>

      {/* Profile Header */}
      <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#023E8A] text-xl font-bold text-white">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="member-title" className="truncate text-2xl font-bold text-foreground">{name}</h1>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                  STATUS_BADGE[member.status] ?? "bg-muted text-muted-foreground",
                )}>
                  {statusLabel(member.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusLabel(member.role)} &bull; {department}
              </p>
            </div>
          </div>
          <TeamMemberActions
            memberId={getTeamMemberRequestId(member)}
            name={name}
            email={member.email}
            specialty={member.specialty || ""}
            ward={member.ward || ""}
            role={member.role}
            status={member.status}
            accessProfile={member.accessProfile}
            permissions={member.permissions}
            canEditMember={hasCurrentUserPermission("configure_settings")}
            onAccessDenied={() => setEditAccessDenied(true)}
            onChanged={loadProfile}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
          {[
            ["overview", "Overview"],
            ["access", "Role & Access"],
            ["escalation", "Alert Escalation"],
            ["activity", "Activity"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-12 rounded-none border-b-2 border-transparent px-5 text-sm font-medium text-muted-foreground data-[state=active]:border-[#023E8A] data-[state=active]:bg-transparent data-[state=active]:text-[#023E8A] data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ===== OVERVIEW TAB - TM-07 ===== */}
        <TabsContent value="overview" className="space-y-5">
          {/* Info Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Login</span>
              </div>
              <p className="mt-3 text-xl font-bold text-foreground">{isToday(member.lastLoginAt) ? "Today" : formatDate(member.lastLoginAt)}</p>
              {isToday(member.lastLoginAt) ? <p className="text-sm text-muted-foreground">at {formatTime(member.lastLoginAt)}</p> : null}
            </article>
            <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                  <Calendar className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date Added</span>
              </div>
              <p className="mt-3 text-xl font-bold text-foreground">{formatDate(member.invitedAt)}</p>
              {member.invitedBy ? <p className="text-sm text-muted-foreground">by {member.invitedBy.name}</p> : null}
            </article>
            <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                  <Calendar className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date Added</span>
              </div>
              <p className="mt-3 text-xl font-bold text-foreground">{formatDate(member.invitedAt)}</p>
              {member.invitedBy ? <p className="text-sm text-muted-foreground">by {member.invitedBy.name}</p> : null}
            </article>
            <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                  <Shield className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access Level</span>
              </div>
              <p className="mt-3 text-xl font-bold text-foreground">{humanize(member.accessProfile)}</p>
              <p className="text-sm text-muted-foreground">{enabledPermissionCount} active permissions granted</p>
            </article>
          </div>

          {/* Assignment Summary + Contact Details */}
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            {/* Assignment Summary */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Assignment Summary</h2>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-0 divide-x divide-border sm:grid-cols-4">
                {[
                  { value: member.assignedPatientCount, label: "PATIENTS", color: "text-[#023E8A]" },
                  { value: profile?.analytics?.totalConfirmed ?? 0, label: "CARE\nEPISODES", color: "text-[#023E8A]" },
                  { value: profile?.todayAppointments?.length ?? 0, label: "APPOINTMENTS", color: "text-[#023E8A]" },
                  { value: 0, label: "ALERTS", color: "text-red-500", dot: true },
                ].map(({ value, label, color, dot }) => (
                  <div key={label} className="relative px-4 py-2 text-center first:pl-0 last:pr-0">
                    {dot ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" /> : null}
                    <p className={cn("text-3xl font-bold", color)}>{value}</p>
                    <p className="mt-1 whitespace-pre-line text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Details */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Contact Details</h2>
                <button type="button" className="text-sm font-medium text-[#023E8A] hover:underline" aria-label="Edit contact details">Edit</button>
              </div>
              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Work Email</p>
                  <div className="mt-2 flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{member.email}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</p>
                  <div className="mt-2 flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{escalation?.whatsappPhone || "Not configured"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Account Information</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Status</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", member.status === "active" ? "bg-emerald-500" : member.status === "suspended" ? "bg-red-500" : "bg-amber-500")} />
                  <span className="text-sm font-medium text-foreground">{statusLabel(member.status)} User</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Member Since</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDate(member.invitedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Last Updated</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDate(member.lastLoginAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Verification</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#023E8A]" />
                  <span className="text-sm font-medium text-[#023E8A]">Verified Identity</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== ROLE & ACCESS TAB - TM-08 ===== */}
        <TabsContent value="access" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
            {/* Role Summary Sidebar */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Role Summary</h2>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                    <Stethoscope className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned Role</p>
                    <p className="text-sm font-bold text-foreground">{statusLabel(member.role)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                    <Activity className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Specialty</p>
                    <p className="text-sm font-bold text-foreground">{member.specialty || "Not specified"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                    <Shield className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Access Level</p>
                    <p className="text-sm font-bold text-foreground">{humanize(member.accessProfile)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                    <UserPlus className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Permission Source</p>
                    <p className="text-sm font-bold text-foreground">Manual/Custom</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Last Update: {formatDate(member.lastLoginAt)}
                </div>
                {member.invitedBy ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    By: <span className="font-medium text-[#023E8A]">{member.invitedBy.name}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {/* Permission Groups */}
            <div className="space-y-4">
              {PERMISSION_GROUPS.map(({ title, icon: Icon, bgColor, permissions }) => {
                const enabledCount = permissions.filter((p) => hasPermission(member, p.key)).length;
                return (
                  <article key={title} className={cn("rounded-xl border border-border p-5 shadow-sm", bgColor)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-[#023E8A]" />
                        <h3 className="font-semibold text-foreground">{title}</h3>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#023E8A]">{enabledCount} Permissions Enabled</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {permissions.map((permission) => {
                        const enabled = hasPermission(member, permission.key);
                        return (
                          <div key={permission.label} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-foreground">{permission.label}</span>
                            <div className={cn(
                              "flex h-5 w-5 items-center justify-center rounded",
                              enabled ? "bg-[#023E8A] text-white" : "border border-border bg-white",
                            )}>
                              {enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ===== ALERT ESCALATION TAB - TM-09 ===== */}
        <TabsContent value="escalation" className="space-y-5">
          {escalationError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm font-semibold text-foreground">Unable to load escalation preferences</p>
              <p className="mt-1 text-sm text-muted-foreground">{escalationError}</p>
              <button type="button" onClick={() => void loadEscalation(member)} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Retry</button>
            </div>
          ) : (
            <>
              {/* Status Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                      <Shield className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Escalation Eligibility</p>
                  <p className="text-lg font-bold text-[#023E8A]">Eligible by Role</p>
                </article>
                <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Compliance</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Consent Status</p>
                  <p className="text-lg font-bold text-green-600">Granted</p>
                </article>
                <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                      <Smartphone className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Security</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">WhatsApp Verification</p>
                  <p className="text-lg font-bold text-[#023E8A]">{escalation?.whatsappPhone ? "Verified" : "Not Verified"}</p>
                </article>
                <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                      <Calendar className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Verified On</p>
                  <p className="text-lg font-bold text-[#023E8A]">{formatDate(member.invitedAt)}</p>
                </article>
              </div>

              {/* WhatsApp Toggle */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#023E8A]">
                      <MessageSquare className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-foreground">WhatsApp Critical Alert Escalations Status</h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                        This clinician will receive high-priority alert escalations through WhatsApp for assigned patients during configured care hours.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={whatsappEnabled}
                    disabled={isEscalationLoading || isSavingEscalation}
                    aria-label="WhatsApp critical alert escalation"
                    onCheckedChange={toggleWhatsapp}
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Role default: on. Clinician can opt-out via personal settings.</span>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== ACTIVITY TAB - TM-10 ===== */}
        <TabsContent value="activity" className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Member Activity Log</h2>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last 30 Days</span>
              </div>
            </div>

            {isActivityLoading && activityEntries.length === 0 ? (
              <div className="mt-5 space-y-3" aria-label="Loading member activity">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : activityError ? (
              <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-foreground">Unable to load member activity</p>
                <p className="mt-1 text-sm text-muted-foreground">{activityError}</p>
                <button type="button" onClick={() => void loadActivity(member)} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Retry</button>
              </div>
            ) : activityEntries.length > 0 ? (
              <div className="relative mt-5">
                {/* Timeline line */}
                <div className="absolute left-[18px] top-0 h-full w-[2px] bg-border" />

                <div className="space-y-0">
                  {activityEntries.map((entry) => {
                    const EntryIcon = getActivityIcon(entry.action);
                    const iconColor = getActivityIconColor(entry.action);
                    return (
                      <div key={entry.id} className="relative flex gap-4 pb-8 last:pb-0">
                        <div className={cn(
                          "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white",
                          iconColor,
                        )}>
                          <EntryIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 pt-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-foreground">{humanize(entry.action)}</p>
                              <p className="mt-0.5 text-sm text-muted-foreground">{entry.targetSummary}</p>
                              {entry.actorName ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  by <span className="font-medium text-[#023E8A]">{entry.actorName}</span>
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                              {formatActivityDate(entry.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More */}
                {activityEntries.length < activityTotal ? (
                  <div className="mt-4 border-t border-border pt-4 text-center">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#023E8A] hover:text-[#023E8A]/80"
                      onClick={() => void loadActivity(member, activityPage + 1, true)}
                      disabled={isActivityLoading}
                    >
                      Load More
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-muted/60 px-4 py-10 text-center">
                <Activity className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium text-foreground">No member activity recorded yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
