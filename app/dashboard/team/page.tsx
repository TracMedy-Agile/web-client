"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Search,
  ShieldAlert,
  Stethoscope,
  Syringe,
  UserRoundPlus,
  Users,
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
import AccessDeniedState from "@/components/system/AccessDeniedState";
import NetworkErrorState from "@/components/system/NetworkErrorState";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getTeamMemberRequestId, getTeamMembers, type TeamMember } from "@/lib/api/clinicians";
import { errorMessage, isAccessDeniedError, isNetworkError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import InviteTeamMemberDialog from "./components/InviteTeamMemberDialog";

const PAGE_SIZE = 6;

const ROLE_LABELS: Record<string, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  admin: "Admin",
  hospital_admin: "Admin",
  physiotherapist: "Physiotherapist",
};

const ROLE_CLASSES: Record<string, string> = {
  doctor: "bg-[#023E8A]/10 text-[#023E8A] border border-[#023E8A]/20",
  nurse: "bg-teal-500/10 text-teal-700 border border-teal-500/20",
  admin: "bg-slate-500/10 text-slate-700 border border-slate-500/20",
  hospital_admin: "bg-slate-500/10 text-slate-700 border border-slate-500/20",
  physiotherapist: "bg-purple-500/10 text-purple-700 border border-purple-500/20",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  suspended: "bg-red-500",
};

const STATUS_TEXT: Record<string, string> = {
  active: "text-emerald-600",
  pending: "text-amber-600",
  suspended: "text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending",
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

function humanize(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function roleLabel(value: string) {
  return ROLE_LABELS[value] ?? humanize(value);
}

function roleClass(value: string) {
  return ROLE_CLASSES[value] ?? "bg-muted text-muted-foreground border border-border";
}

function statusLabel(value: string) {
  return STATUS_LABELS[value] ?? humanize(value);
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-[120px] animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  );
}

function exportTeamMembers(members: TeamMember[]) {
  const headers = ["Full Name", "Role", "Specialty", "Assigned Patients", "Status", "Last Login", "Email"];
  const rows = members.map((m) => [
    m.name,
    roleLabel(m.role),
    m.specialty || m.ward || "",
    String(m.assignedPatientCount),
    statusLabel(m.status),
    m.lastLoginAt || "Never",
    m.email,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "team-members.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setMembers(await getTeamMembers());
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    capturePostHogEvent("team_viewed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMembers();
  }, [loadMembers]);

  const roleOptions = useMemo(
    () => Array.from(new Set(members.map((m) => m.role))).filter(Boolean).sort(),
    [members],
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(members.map((m) => m.status))).filter(Boolean).sort(),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch =
        !term ||
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus = status === "all" || member.status === status;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, search, roleFilter, status]);

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const visibleMembers = filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary card counts
  const doctorCount = members.filter((m) => m.role === "doctor").length;
  const nurseCount = members.filter((m) => m.role === "nurse").length;
  const adminCount = members.filter((m) => m.role === "admin" || m.role === "hospital_admin").length;
  const totalCount = members.length;

  const summaries = [
    { label: "Doctors", value: doctorCount, icon: Stethoscope, color: "text-[#023E8A]", bg: "bg-[#023E8A]/10" },
    { label: "Nurses", value: nurseCount, icon: Syringe, color: "text-teal-600", bg: "bg-teal-500/10" },
    { label: "Admin Staffs", value: adminCount, icon: Users, color: "text-[#023E8A]", bg: "bg-[#023E8A]/10" },
    { label: "Total Team Members", value: totalCount, icon: UsersRound, color: "text-[#023E8A]", bg: "bg-[#023E8A]/10" },
  ];

  function openInvitation() {
    capturePostHogEvent("team_member_invite_opened");
    setInviteOpen(true);
  }

  function getPaginationNumbers() {
    const pages: (number | "ellipsis")[] = [];
    if (pageCount <= 5) {
      for (let i = 1; i <= pageCount; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(pageCount - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < pageCount - 2) pages.push("ellipsis");
      pages.push(pageCount);
    }
    return pages;
  }

  if (isAccessDeniedError(error)) {
    return <AccessDeniedState description="Team Management is available to users granted team-management access by the hospital." />;
  }

  if (error) {
    if (isNetworkError(error)) return <NetworkErrorState onRetry={loadMembers} />;

    return (
      <section role="alert" className="mx-auto flex min-h-[520px] w-full max-w-[900px] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-14 text-center shadow-sm">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="mt-5 text-2xl font-bold text-foreground">Unable to load Team Management</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{errorMessage(error, "Unable to load the hospital team.")}</p>
        <Button type="button" onClick={() => void loadMembers()} className="mt-6 h-11 rounded-lg px-5 font-semibold">Try Again</Button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1500px] space-y-6" aria-labelledby="team-title">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="team-title" className="text-2xl font-bold tracking-tight text-foreground">
            Team Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your clinical staff and roles
          </p>
        </div>
        <Button className="h-11 gap-2 rounded-lg bg-[#023E8A] px-5 font-semibold hover:bg-[#023E8A]/90 sm:self-center" onClick={openInvitation}>
          <UserRoundPlus className="h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <SummarySkeleton />
      ) : members.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaries.map(({ label, value, icon: Icon, color, bg }) => (
            <article key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bg, color)}>
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
            </article>
          ))}
        </div>
      ) : null}

      {/* Table container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Filters */}
        {members.length > 0 ? (
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
                placeholder="Search by name"
                aria-label="Search team members"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-11 w-full lg:w-40" aria-label="Filter by role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roleOptions.map((item) => (
                    <SelectItem key={item} value={item}>{roleLabel(item)}</SelectItem>
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
                <SelectTrigger className="h-11 w-full lg:w-40" aria-label="Filter by status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((value) => (
                    <SelectItem key={value} value={value}>{statusLabel(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => exportTeamMembers(filteredMembers)}
                aria-label="Export team members"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        ) : null}

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-3 p-4" aria-label="Loading team members">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : members.length === 0 ? (
          /* TM-02 Empty State */
          <div className="flex min-h-[480px] flex-col items-center justify-center px-6 py-14 text-center" style={{ background: "linear-gradient(180deg, rgba(144, 224, 239, 0.08) 0%, rgba(2, 62, 138, 0.04) 100%)" }}>
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#023E8A]/5" />
              <div className="absolute inset-3 rounded-full bg-[#023E8A]/8" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                <UserRoundPlus className="h-8 w-8 text-[#023E8A]" />
              </div>
            </div>
            <h2 className="mt-6 text-xl font-bold text-foreground">Build Your Clinical Team.</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Invite your doctors, nurses, and staff to begin managing patient outcomes together
            </p>
            <Button className="mt-6 gap-2 bg-[#023E8A] hover:bg-[#023E8A]/90" onClick={openInvitation}>
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
            {/* Mobile cards */}
            <div className="divide-y divide-border lg:hidden">
              {visibleMembers.map((member) => (
                <article key={member.id} className="p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary bg-cover bg-center text-sm font-bold text-primary-foreground"
                      style={member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : undefined}
                    >
                      {member.avatarUrl ? null : initials(member.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/team/${getTeamMemberRequestId(member)}`}
                        className="block truncate text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {member.name || "Unnamed clinician"}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-semibold", roleClass(member.role))}>
                          {roleLabel(member.role)}
                        </span>
                        <span className="text-xs text-muted-foreground">{member.specialty || member.ward || "Not specified"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[member.status] ?? "bg-gray-400")} />
                          <span className={STATUS_TEXT[member.status] ?? "text-muted-foreground"}>{statusLabel(member.status)}</span>
                        </span>
                        <span>{member.assignedPatientCount} patients</span>
                        <span>{formatRelativeTime(member.lastLoginAt)}</span>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/team/${getTeamMemberRequestId(member)}`}
                      className="flex items-center gap-1.5 text-sm font-medium text-[#023E8A] hover:text-[#023E8A]/80"
                      aria-label={`View ${member.name}`}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Full Name</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Speciality</th>
                    <th className="px-5 py-3.5">Assigned Patient</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Last Login</th>
                    <th className="px-5 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleMembers.map((member) => (
                    <tr key={member.id} className="transition hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 bg-cover bg-center text-sm font-bold text-slate-600"
                            style={member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : undefined}
                          >
                            {member.avatarUrl ? null : initials(member.name)}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {member.name || "Unnamed clinician"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn("inline-flex rounded px-2.5 py-1 text-xs font-semibold", roleClass(member.role))}>
                          {roleLabel(member.role)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">
                        {member.specialty || member.ward || "Not specified"}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">
                        {member.assignedPatientCount}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[member.status] ?? "bg-gray-400")} />
                          <span className={cn("text-sm font-medium", STATUS_TEXT[member.status] ?? "text-muted-foreground")}>
                            {statusLabel(member.status)}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {formatRelativeTime(member.lastLoginAt)}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/team/${getTeamMemberRequestId(member)}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#023E8A] hover:text-[#023E8A]/80"
                          aria-label={`View ${member.name}`}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing <span className="font-medium text-foreground">{(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredMembers.length)}</span> of <span className="font-medium text-foreground">{filteredMembers.length}</span> Team Members
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPaginationNumbers().map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                  ) : (
                    <Button
                      key={item}
                      variant={page === item ? "default" : "outline"}
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-lg text-sm",
                        page === item && "bg-[#023E8A] text-white hover:bg-[#023E8A]/90",
                      )}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
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
