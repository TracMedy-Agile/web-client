"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  FilterX,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NetworkErrorState from "@/components/system/NetworkErrorState";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getTeamMembers, type TeamMember } from "@/lib/api/clinicians";
import { cn } from "@/lib/utils";
import InviteTeamMemberDialog from "./components/InviteTeamMemberDialog";
import TeamMemberActions from "./components/TeamMemberActions";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending invite",
  suspended: "Suspended",
};

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  pending: "bg-amber-500/10 text-amber-700",
  suspended: "bg-destructive/10 text-destructive",
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

function statusLabel(value: string) {
  return STATUS_LABELS[value] ?? humanize(value);
}

function statusClass(value: string) {
  return STATUS_CLASSES[value] ?? "bg-muted text-muted-foreground";
}

function memberDepartment(member: TeamMember) {
  return member.ward || member.specialty || "Not specified";
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setMembers(await getTeamMembers());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load the hospital team.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    capturePostHogEvent("team_viewed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMembers();
  }, [loadMembers]);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map(memberDepartment)
            .filter((item) => item !== "Not specified"),
        ),
      ).sort(),
    [members],
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(members.map((member) => member.status))).filter(Boolean).sort(),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch =
        !term ||
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.role.toLowerCase().includes(term) ||
        member.systemRole.toLowerCase().includes(term) ||
        (member.ward || "").toLowerCase().includes(term) ||
        (member.specialty || "").toLowerCase().includes(term);
      const matchesDepartment = department === "all" || memberDepartment(member) === department;
      const matchesStatus = status === "all" || member.status === status;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [department, members, search, status]);

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const visibleMembers = filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeAccounts = members.filter((member) => member.status === "active").length;
  const pendingInvites = members.filter((member) => member.status === "pending" || member.inviteState === "pending").length;
  const assignedPatients = members.reduce((sum, member) => sum + member.assignedPatientCount, 0);

  const summaries = [
    { label: "Total Members", value: members.length, icon: UsersRound, detail: "Facility workspace" },
    { label: "Active Accounts", value: activeAccounts, icon: Activity, detail: "Can access the workspace" },
    { label: "Pending Invites", value: pendingInvites, icon: CalendarClock, detail: "Awaiting acceptance" },
    { label: "Assigned Patients", value: assignedPatients, icon: Stethoscope, detail: "Active episode load" },
  ];

  function openInvitation() {
    capturePostHogEvent("team_member_invite_opened");
    setInviteOpen(true);
  }

  if (error) {
    return <NetworkErrorState onRetry={loadMembers} />;
  }

  return (
    <section className="mx-auto w-full max-w-[1500px] space-y-6" aria-labelledby="team-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="team-title" className="text-2xl font-bold tracking-tight text-foreground">
            Team Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View clinicians in your facility and manage their workspace access.
          </p>
        </div>
        <Button className="h-11 rounded-lg px-5 font-semibold sm:self-center" onClick={openInvitation}>
          <UserRoundPlus className="h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      {isLoading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaries.map(({ label, value, icon: Icon, detail }) => (
            <article key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-6 text-muted-foreground">
            This directory uses live team-management data, including roles, access profiles, assigned patients, invitation status, and account status.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-11 pl-10"
              placeholder="Search by name, email, role, or specialty"
              aria-label="Search team members"
            />
          </div>
          <Select
            value={department}
            onValueChange={(value) => {
              setDepartment(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11 w-full lg:w-52" aria-label="Filter by ward or specialty">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wards</SelectItem>
              {departments.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11 w-full lg:w-48" aria-label="Filter by account status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((value) => (
                <SelectItem key={value} value={value}>{statusLabel(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {search || department !== "all" || status !== "all" ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => {
                setSearch("");
                setDepartment("all");
                setStatus("all");
                setPage(1);
              }}
            >
              <FilterX className="h-4 w-4" />
              Reset
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4" aria-label="Loading team members">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex min-h-[430px] flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-primary/5 bg-primary/10 text-primary">
              <CircleUserRound className="h-10 w-10" />
            </span>
            <h2 className="mt-6 text-xl font-bold text-foreground">Build Your Clinical Team</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Invite doctors, nurses, and administrators to collaborate on patient care.
            </p>
            <Button className="mt-6" onClick={openInvitation}>
              <UserRoundPlus className="h-4 w-4" />
              Add Team Member
            </Button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <Search className="h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-4 font-semibold text-foreground">No matching team members</h2>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or reset your filters.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border lg:hidden">
              {visibleMembers.map((member) => (
                <article key={member.id} className="p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {initials(member.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/team/${member.id}`}
                            className="block truncate text-sm font-semibold text-foreground hover:text-primary"
                          >
                            {member.name || "Unnamed clinician"}
                          </Link>
                          <p className="mt-0.5 break-all text-xs text-muted-foreground">{member.email}</p>
                        </div>
                        <TeamMemberActions
                          memberId={member.id}
                          name={member.name}
                          email={member.email}
                          specialty={member.specialty || ""}
                          ward={member.ward || ""}
                          role={member.role}
                          status={member.status}
                          accessProfile={member.accessProfile}
                          permissions={member.permissions}
                          onChanged={loadMembers}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusClass(member.status))}>
                          {statusLabel(member.status)}
                        </span>
                        <span className="text-xs text-muted-foreground">{memberDepartment(member)}</span>
                      </div>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Assigned patients</dt>
                      <dd className="mt-1 font-semibold text-foreground">{member.assignedPatientCount}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Role</dt>
                      <dd className="mt-1 font-semibold text-foreground">{statusLabel(member.role)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Access</dt>
                      <dd className="mt-1 font-semibold text-foreground">{statusLabel(member.accessProfile)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Last login</dt>
                      <dd className="mt-1 truncate font-semibold text-foreground" title={member.lastLoginAt || "Never"}>{formatDate(member.lastLoginAt)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left">
                <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-[32%] px-4 py-3">Full name</th>
                    <th className="hidden w-[18%] px-4 py-3 xl:table-cell">Role / Ward</th>
                    <th className="w-[16%] px-4 py-3 xl:w-[13%]">Assigned patients</th>
                    <th className="hidden w-[15%] px-4 py-3 2xl:table-cell">Access</th>
                    <th className="w-[18%] px-4 py-3 xl:w-[15%]">Status</th>
                    <th className="hidden w-[16%] px-4 py-3 2xl:table-cell">Last login</th>
                    <th className="w-28 px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleMembers.map((member) => (
                    <tr key={member.id} className="transition hover:bg-muted/40">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {initials(member.name)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/team/${member.id}`}
                              className="block truncate text-sm font-semibold text-foreground hover:text-primary"
                            >
                              {member.name || "Unnamed clinician"}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden truncate px-4 py-4 text-sm text-foreground xl:table-cell" title={memberDepartment(member)}>
                        <span className="block font-medium">{statusLabel(member.role)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{memberDepartment(member)}</span>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-foreground">{member.assignedPatientCount}</td>
                      <td className="hidden px-4 py-4 2xl:table-cell">
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {statusLabel(member.accessProfile)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusClass(member.status))}>
                          {statusLabel(member.status)}
                        </span>
                      </td>
                      <td className="hidden truncate px-4 py-4 text-sm text-muted-foreground 2xl:table-cell" title={member.lastLoginAt || "Never"}>
                        {formatDate(member.lastLoginAt)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <TeamMemberActions
                          memberId={member.id}
                          name={member.name}
                          email={member.email}
                          specialty={member.specialty || ""}
                          ward={member.ward || ""}
                          role={member.role}
                          status={member.status}
                          accessProfile={member.accessProfile}
                          permissions={member.permissions}
                          onChanged={loadMembers}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, filteredMembers.length)} of {filteredMembers.length} team members
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-20 text-center font-medium text-foreground">
                  {page} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next page"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <InviteTeamMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={loadMembers} />
    </section>
  );
}

