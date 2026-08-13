"use client";

import type { ReactNode } from "react";
import { BarChart3, CalendarDays, LockKeyhole, ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

export const roleAccess = [
  { role: "Doctor", description: "Clinical access for patient monitoring and care decisions.", permissions: ["View connected patients", "Manage care episodes", "Acknowledge alerts", "Send messages"], icon: Stethoscope },
  { role: "Nurse", description: "Operational access for appointment and patient follow-up work.", permissions: ["View appointments", "Manage appointments", "Acknowledge alerts"], icon: CalendarDays },
  { role: "Hospital Admin", description: "Workspace administration, audit, and protected settings access.", permissions: ["View team", "Manage team members", "View audit logs", "Manage hospital settings"], icon: LockKeyhole },
] as const;

export const permissionGroups = [
  { title: "Clinical Care", items: ["View connected patients", "Manage care episodes", "Acknowledge alerts", "Send messages"], icon: Stethoscope },
  { title: "Appointments", items: ["View appointments", "Manage appointments"], icon: CalendarDays },
  { title: "Insights", items: ["View reports and analytics", "Export reports"], icon: BarChart3 },
  { title: "Administration", items: ["View team", "Manage team members", "View audit logs", "Manage hospital settings"], icon: ShieldCheck },
] as const;

export const workspaceRows = [
  { member: "Doctor", profile: "Standard Access", grants: "Clinical care, alerts, messaging" },
  { member: "Nurse", profile: "Standard Access", grants: "Appointments, alerts, follow-ups" },
  { member: "Hospital Admin", profile: "Full Access", grants: "Team, audit log, settings" },
];

export const dependencyRows = [
  { permission: "Manage team members", requires: "View team" },
  { permission: "Export reports", requires: "View reports and analytics" },
  { permission: "Manage hospital settings", requires: "View audit logs" },
];

export function unavailableRolePolicy(action: string) {
  capturePostHogEvent("settings_roles_action_unavailable", { action });
  toast.info("Roles and permissions settings endpoint is not available yet.");
}

export function RoleCard({ role, description, permissions, icon: Icon }: (typeof roleAccess)[number]) {
  return <div className="rounded-lg border border-border bg-background p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><h3 className="mt-4 text-base font-bold text-foreground">{role}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-4 flex flex-wrap gap-2">{permissions.map((permission) => <span key={permission} className="rounded-full bg-card px-2.5 py-1 text-xs font-bold text-muted-foreground">{permission}</span>)}</div></div>;
}

export function PolicyToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-foreground">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} aria-label={title} /></div>;
}

export function RolesTable({ expanded = false }: { expanded?: boolean }) {
  return <div className="overflow-hidden rounded-lg border border-border bg-background"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-card text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Workspace Role</th><th className="px-5 py-3 font-bold">Access Profile</th><th className="px-5 py-3 font-bold">Granted Access</th>{expanded ? <th className="px-5 py-3 text-right font-bold">Action</th> : null}</tr></thead><tbody className="divide-y divide-border">{workspaceRows.map((row) => <tr key={row.member}><td className="px-5 py-4 font-bold text-foreground">{row.member}</td><td className="px-5 py-4 text-muted-foreground">{row.profile}</td><td className="px-5 py-4 text-muted-foreground">{row.grants}</td>{expanded ? <td className="px-5 py-4 text-right"><Button type="button" variant="outline" size="sm" onClick={() => unavailableRolePolicy("Edit workspace administration grant")} className="h-9 rounded-lg">Edit</Button></td> : null}</tr>)}</tbody></table></div></div>;
}

export function DependencyRules() {
  return <div className="overflow-hidden rounded-lg border border-border bg-background"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-card text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Permission</th><th className="px-5 py-3 font-bold">Requires</th></tr></thead><tbody className="divide-y divide-border">{dependencyRows.map((row) => <tr key={row.permission}><td className="px-5 py-4 font-bold text-foreground">{row.permission}</td><td className="px-5 py-4 text-muted-foreground">{row.requires}</td></tr>)}</tbody></table></div>;
}

export function UnsavedFooter({ dirty, children }: { dirty: boolean; children?: ReactNode }) {
  return <div className={cn("sticky bottom-0 z-10 mt-5 flex flex-col gap-3 rounded-lg border border-border bg-card px-5 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between", !dirty && "opacity-90")}><p className="text-sm font-semibold text-muted-foreground">{dirty ? "You have unsaved permission policy changes." : "Permission policy changes will appear here before saving."}</p><div className="flex gap-3">{children}</div></div>;
}
