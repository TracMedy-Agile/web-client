"use client";

import { useState, type ReactNode } from "react";
import { Ban, Check, ChevronDown, ChevronRight, KeyRound, LockKeyhole, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

export type RoleAccessLevel = "Standard Access" | "Full Access";

export const roleAccess = [
  {
    role: "Doctor",
    accessLevel: "Standard Access" as RoleAccessLevel,
    description: "Full clinical oversight and patient record management within assigned wards.",
    permissionCount: 6,
    previewPermissions: ["Edit Care Records", "Approve Prescriptions", "View Analytics"],
    permissions: ["View Care Episodes", "Edit Care Records", "Approve Prescriptions", "Manage Care Team", "View Analytics", "Export Reports"],
    lastUpdated: "Oct 12, 2026",
  },
  {
    role: "Nurse",
    accessLevel: "Standard Access" as RoleAccessLevel,
    description: "Care delivery, monitoring, and clinical documentation for designated patients.",
    permissionCount: 4,
    previewPermissions: ["Record Vital Signs", "Administer Meds", "View Patient Timeline"],
    permissions: ["View Care Episodes", "Record Vital Signs", "Administer Meds", "View Patient Timeline"],
    lastUpdated: "Oct 12, 2026",
  },
  {
    role: "Hospital Admin",
    accessLevel: "Full Access" as RoleAccessLevel,
    description: "Facility-level management, billing control, and operational governance.",
    permissionCount: 12,
    previewPermissions: ["Manage Staffing", "Configure Facilities", "Override Settings"],
    permissions: ["Manage Staffing", "Configure Facilities", "Override Settings", "Manage Billing", "Manage Team Members", "Manage Roles", "View Audit Log", "Export Reports", "Manage Integrations", "Configure Alerts", "View Analytics", "Manage Subscription"],
    lastUpdated: "Oct 12, 2026",
  },
] as const;

export const permissionPolicies = [
  { key: "applyStandardAccess", title: "Apply Standard Access by Default", description: "New invites are mapped to pre-defined clinical roles.", defaultChecked: true },
  { key: "allowCustomAccess", title: "Allow Custom Access", description: "Enable permission overrides for specific individuals.", defaultChecked: true },
  { key: "requireConfirmation", title: "Require Confirmation for Elevated Access", description: "System prompts when granting Admin or Owner level.", defaultChecked: true },
  { key: "recordAuditLog", title: "Record Changes in Audit Log", description: "Every permission toggle creates a non-erasable record.", defaultChecked: true },
  { key: "notifyOwner", title: "Notify Owner on Full Access", description: 'Sends alert when any user is granted "Full Workspace".', defaultChecked: false },
  { key: "preventHigherAssignment", title: "Prevent Higher Assignment", description: "Admins cannot grant roles higher than their own.", defaultChecked: true },
] as const;

export type PermissionPolicyKey = (typeof permissionPolicies)[number]["key"];

export const grantOptions = ["Owners Only", "Owners and Admins", "Department Heads"] as const;

export const administrativePowers = [
  { key: "fullWorkspaceAccess", label: "Full Workspace Access", icon: KeyRound, grantedTo: "Owners Only" },
  { key: "editRolePermissions", label: "Edit Role Permissions", icon: ShieldCheck, grantedTo: "Owners and Admins" },
  { key: "inviteTeamMembers", label: "Invite Team Members", icon: UserPlus, grantedTo: "Department Heads" },
  { key: "manageTeamMembers", label: "Manage Team Members", icon: Users, grantedTo: "Owners and Admins" },
  { key: "suspendMembers", label: "Suspend Members", icon: Ban, grantedTo: "Owners and Admins" },
] as const;

export const dependencyRows = [
  { permission: "Manage Care Episodes", requires: "View Care Episodes" },
  { permission: "Manage Appointments", requires: "View Appointments" },
  { permission: "Acknowledge Alerts", requires: "View Alerts" },
  { permission: "Send Messages", requires: "View Messages" },
  { permission: "Export Reports", requires: "View Reports & Analytics" },
  { permission: "Manage Team Members", requires: "View Team" },
] as const;

export function unavailableRolePolicy(action: string) {
  capturePostHogEvent("settings_roles_action_unavailable", { action });
  toast.info("Roles and permissions settings endpoint is not available yet.");
}

type RoleCardProps = { role: string; accessLevel: RoleAccessLevel; description: string; permissionCount: number; previewPermissions: readonly string[]; permissions: readonly string[]; lastUpdated: string };

export function RoleCard({ role, accessLevel, description, permissionCount, previewPermissions, permissions, lastUpdated }: RoleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const permissionListId = "role-permissions-" + role.toLowerCase().replaceAll(" ", "-");

  return (
    <div className="flex min-h-[300px] h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Role</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">{role}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Access type</p>
          <span className={cn("mt-1 inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", accessLevel === "Full Access" ? "bg-slate-100 text-slate-600" : "bg-sky-100 text-primary")}>
            {accessLevel}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={permissionListId}
        onClick={() => setIsExpanded((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 self-start text-sm font-bold text-primary"
      >
        {isExpanded ? "Hide" : "Preview"} ({permissionCount} permissions)
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isExpanded ? (
        <div id={permissionListId} className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">All permissions</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {permissions.map((permission) => (
              <li key={permission} className="flex items-start gap-2 text-xs text-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                {permission}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul aria-label="Preview permissions" className="mt-3 flex-1 space-y-2">
        {previewPermissions.map((permission) => (
          <li key={permission} className="flex items-center gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            {permission}
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
    </div>
  );
}

export function PolicyToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

export function AdministrativePowerTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-bold">Administrative Power</th>
              <th className="px-5 py-3 text-right font-bold">Who Can Grant/Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {administrativePowers.map((power) => {
              const Icon = power.icon;
              return (
                <tr key={power.key}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="font-bold text-foreground">{power.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Select defaultValue={power.grantedTo} onValueChange={() => unavailableRolePolicy(`Change who can grant ${power.label}`)}>
                      <SelectTrigger className="ml-auto h-10 w-[190px] rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {grantOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DependencyRulesPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
      >
        <div>
          <span className="flex items-center gap-2 text-lg font-bold text-foreground">
            Permission Dependency Rules
            <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">View logical relationships between hospital permission sets.</p>
        </div>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="border-t border-border px-5 py-5 sm:px-6">
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-card text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-bold">Permission</th>
                  <th className="px-5 py-3 font-bold">Automatically Requires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dependencyRows.map((row) => (
                  <tr key={row.permission}>
                    <td className="px-5 py-4 font-bold text-foreground">{row.permission}</td>
                    <td className="px-5 py-4 text-muted-foreground">→ {row.requires}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UnsavedFooter({ dirty, children }: { dirty: boolean; children?: ReactNode }) {
  return (
    <div className={cn("mt-10 flex flex-col gap-3 border-t border-border bg-card px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:px-12", !dirty && "opacity-90")}>
      <p className="text-sm text-foreground">{dirty ? "You have unsaved changes in policy configurations." : "Permission policy changes will appear here before saving."}</p>
      <div className="flex gap-3">{children}</div>
    </div>
  );
}

