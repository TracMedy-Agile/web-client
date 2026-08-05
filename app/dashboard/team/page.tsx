"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Ellipsis,
  FilterX,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  getFacilityClinicians,
  type ClinicianDirectoryEntry,
} from "@/lib/api/clinicians";
import { cn } from "@/lib/utils";
import InviteTeamMemberDialog from "./components/InviteTeamMemberDialog";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<ClinicianDirectoryEntry["status"], string> = {
  available: "Available",
  near_capacity: "Near capacity",
  full: "At capacity",
  unavailable: "Unavailable",
  off_duty: "Off duty",
  covering: "Covering",
};

const STATUS_CLASSES: Record<ClinicianDirectoryEntry["status"], string> = {
  available: "bg-emerald-500/10 text-emerald-700",
  near_capacity: "bg-amber-500/10 text-amber-700",
  full: "bg-destructive/10 text-destructive",
  unavailable: "bg-muted text-muted-foreground",
  off_duty: "bg-muted text-muted-foreground",
  covering: "bg-primary/10 text-primary",
};

function initials(name: string | null) {
  return (name || "Team Member")
    .split(/s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function showUnavailableAction(action: string, memberId?: string) {
  capturePostHogEvent("team_api_unavailable", { action, member_id: memberId });
  toast.error(`${action} is not available yet`, {
    description: "The required team-management endpoint is missing from the current API contract.",
  });
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

function MemberActionMenu({ member }: { member: ClinicianDirectoryEntry }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${member.name || "team member"}`}>
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/team/${member.id}`}>View profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => showUnavailableAction("Edit member", member.id)}>
          Edit member
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => showUnavailableAction("Suspend member", member.id)}>
          Suspend member
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => showUnavailableAction("Remove member", member.id)}
        >
          Remove member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<ClinicianDirectoryEntry[]>([]);
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
      setMembers(await getFacilityClinicians({ limit: 100 }));
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
            .map((member) => member.department)
            .filter((item): item is string => Boolean(item)),
        ),
      ).sort(),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch =
        !term ||
        member.name?.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.department?.toLowerCase().includes(term);
      const matchesDepartment = department === "all" || member.department === department;
      const matchesStatus = status === "all" || member.status === status;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [department, members, search, status]);

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const visibleMembers = filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const assignedToday = members.reduce((sum, member) => sum + member.assignedAppointments, 0);
  const totalCapacity = members.reduce((sum, member) => sum + member.dailyCapacity, 0);
  const availableToday = members.filter((member) =>
    ["available", "near_capacity", "covering"].includes(member.status),
  ).length;

  const summaries = [
    { label: "Total Clinicians", value: members.length, icon: UsersRound, detail: "Facility directory" },
    { label: "Available Today", value: availableToday, icon: Activity, detail: "Includes covering staff" },
    { label: "Assigned Today", value: assignedToday, icon: CalendarClock, detail: "Appointments" },
    { label: "Daily Capacity", value: totalCapacity, icon: Stethoscope, detail: "Combined appointments" },
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
            This directory uses live clinician data. Account roles, wards, last login, assigned-patient totals, and access profiles are not exposed by the current API.
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
              placeholder="Search by name, email, or specialty"
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
            <SelectTrigger className="h-11 w-full lg:w-52" aria-label="Filter by specialty">
              <SelectValue placeholder="All specialties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All specialties</SelectItem>
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
            <SelectTrigger className="h-11 w-full lg:w-48" aria-label="Filter by availability">
              <SelectValue placeholder="All availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All availability</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
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
                        <MemberActionMenu member={member} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLASSES[member.status])}>
                          {STATUS_LABELS[member.status]}
                        </span>
                        <span className="text-xs text-muted-foreground">{member.department || "Specialty not specified"}</span>
                      </div>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Assigned today</dt>
                      <dd className="mt-1 font-semibold text-foreground">{member.assignedAppointments}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Daily capacity</dt>
                      <dd className="mt-1 font-semibold text-foreground">{member.dailyCapacity}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Utilization</dt>
                      <dd className="mt-1 font-semibold text-foreground">{member.capacityUtilization}%</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Schedule</dt>
                      <dd className="mt-1 truncate font-semibold text-foreground" title={member.schedule}>{member.schedule}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left">
                <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-[38%] px-4 py-3 xl:w-[30%]">Full name</th>
                    <th className="hidden w-[18%] px-4 py-3 xl:table-cell">Specialty</th>
                    <th className="w-[20%] px-4 py-3 xl:w-[15%]">Assigned today</th>
                    <th className="hidden w-[16%] px-4 py-3 2xl:table-cell">Capacity</th>
                    <th className="w-[24%] px-4 py-3 xl:w-[18%]">Availability</th>
                    <th className="hidden w-[20%] px-4 py-3 2xl:table-cell">Schedule</th>
                    <th className="w-16 px-4 py-3 text-right">Actions</th>
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
                      <td className="hidden truncate px-4 py-4 text-sm text-foreground xl:table-cell" title={member.department || "Not specified"}>
                        {member.department || "Not specified"}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-foreground">{member.assignedAppointments}</td>
                      <td className="hidden px-4 py-4 2xl:table-cell">
                        <div className="w-full max-w-28">
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>{member.capacityUtilization}%</span>
                            <span>{member.dailyCapacity}/day</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, member.capacityUtilization))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLASSES[member.status])}>
                          {STATUS_LABELS[member.status]}
                        </span>
                      </td>
                      <td className="hidden truncate px-4 py-4 text-sm text-muted-foreground 2xl:table-cell" title={member.schedule}>
                        {member.schedule}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <MemberActionMenu member={member} />
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

      <InviteTeamMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </section>
  );
}
