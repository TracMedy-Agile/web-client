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
  FileLock2,
  Mail,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NetworkErrorState from "@/components/system/NetworkErrorState";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getFacilityClinician, type ClinicianProfile } from "@/lib/api/clinicians";
import { cn } from "@/lib/utils";
import TeamMemberActions from "../components/TeamMemberActions";

function initials(name: string | null) {
  return (name || "Team Member")
    .split(/s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatAppointmentType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
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
    permissions: ["View connected patients", "Manage care episodes", "Acknowledge alerts", "Send messages"],
  },
  {
    title: "Appointments",
    icon: CalendarCheck,
    permissions: ["View appointments", "Manage appointments"],
  },
  {
    title: "Insights",
    icon: Activity,
    permissions: ["View reports and analytics", "Export reports"],
  },
  {
    title: "Administration",
    icon: ShieldCheck,
    permissions: ["View team", "Manage team members", "View audit logs", "Manage hospital settings"],
  },
] as const;

export default function TeamMemberPage() {
  const params = useParams<{ id: string }>();
  const memberId = params.id;
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setProfile(await getFacilityClinician(memberId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load this team member.");
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    capturePostHogEvent("team_member_viewed", { member_id: memberId });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile, memberId]);

  const workingDays = useMemo(() => {
    if (!profile) return [];
    return Object.entries(profile.weeklyAvailability)
      .filter(([, value]) => value.isWorking)
      .map(([day, value]) => `${day} ${value.start || ""}-${value.end || ""}`);
  }, [profile]);

  if (isLoading) return <MemberSkeleton />;
  if (error || !profile) return <NetworkErrorState onRetry={loadProfile} />;

  const name = profile.name || "Unnamed clinician";
  const analytics = profile.analytics;

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
              {initials(profile.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="member-title" className="truncate text-2xl font-bold text-foreground">{name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Facility clinician
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Clinician{profile.department ? ` · ${profile.department}` : ""}
              </p>
            </div>
          </div>
          <TeamMemberActions
            memberId={profile.id}
            name={name}
            email={profile.email}
            specialty={profile.department || ""}
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
              { label: "Daily Capacity", value: profile.dailyCapacity, detail: "Appointments per day", icon: CalendarDays },
              { label: "Assigned Today", value: profile.assignedToday, detail: "Confirmed workload", icon: UserRoundCheck },
              { label: "Remaining Today", value: profile.remainingToday, detail: "Open capacity", icon: UsersRound },
              { label: "Utilization", value: `${profile.utilizationPercentage}%`, detail: profile.workloadThresholdWarning ? "Workload warning" : "Within threshold", icon: Activity },
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
                  ["Confirmed", analytics.totalConfirmed],
                  ["In person", analytics.inPerson],
                  ["Teleconsultation", analytics.teleconsultation],
                  ["Nurse check-in", analytics.nurseCheckin],
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
                  <span className="text-muted-foreground">{profile.utilizationPercentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", profile.workloadThresholdWarning ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${Math.min(100, Math.max(0, profile.utilizationPercentage))}%` }}
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
                    <dd className="mt-1 break-all text-sm font-medium text-foreground">{profile.email}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Specialty</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{profile.department || "Not specified"}</dd>
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
          <UnavailableNotice>
            Account role, access profile, and assigned permissions are not included in the clinician profile response.
          </UnavailableNotice>
          <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
            <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-foreground">Role Summary</h2>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Clinician</p>
                  <p className="text-xs text-muted-foreground">Directory classification</p>
                </div>
              </div>
              <p className="mt-5 rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">
                A permissions API is required before the access level can be displayed or changed.
              </p>
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
                    {permissions.map((permission) => (
                      <div key={permission} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                        <span className="text-sm text-foreground">{permission}</span>
                        <span className="text-xs font-medium text-muted-foreground">Unavailable</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="escalation" className="space-y-4">
          <UnavailableNotice>
            Critical-alert escalation eligibility and verification are not included in the current API contract.
          </UnavailableNotice>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Eligibility", "Not available"],
              ["Consent", "Not available"],
              ["WhatsApp verification", "Not available"],
              ["Approved date", "Not available"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-3 font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">WhatsApp Critical Alert Escalations</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Receive eligible critical alerts through the approved WhatsApp escalation channel.
                </p>
              </div>
            </div>
            <Switch disabled aria-label="WhatsApp critical alert escalation unavailable" />
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <UnavailableNotice>
            Invitations, sign-ins, permission changes, status updates, and deletion events require a dedicated member activity endpoint.
          </UnavailableNotice>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Today&apos;s Appointment Activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live schedule data available from the clinician profile.
                </p>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {profile.todayAppointments.length} appointments
              </span>
            </div>
            {profile.todayAppointments.length ? (
              <div className="mt-5 divide-y divide-border">
                {profile.todayAppointments.map((appointment) => (
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

function UnavailableNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
      <FileLock2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <p className="text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
