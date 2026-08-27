"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  LockKeyhole,
  ShieldCheck,
  Sliders,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { inviteTeamMember, type InviteTeamMemberInput, type InviteTeamMemberResult } from "@/lib/api/clinicians";
import { cn } from "@/lib/utils";

type AccessLevel = "standard" | "custom" | "full";
type TeamRole = InviteTeamMemberInput["role"];
type BackendTeamPermission = NonNullable<InviteTeamMemberInput["permissions"]>[number];

type InviteTeamMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: (result: InviteTeamMemberResult) => void | Promise<void>;
};

const ACCESS_LEVELS: Array<{
  value: AccessLevel;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
}> = [
  {
    value: "standard",
    title: "Standard Clinician",
    description: "Access to assigned patients and care episodes only.",
    icon: ShieldCheck,
  },
  {
    value: "custom",
    title: "Custom Access",
    description: "Set detailed access permissions per module.",
    icon: Sliders,
  },
  {
    value: "full",
    title: "Full Access",
    description: "Full administrative control across all settings.",
    icon: LockKeyhole,
  },
];

type PermissionItem = {
  id: string;
  label: string;
  default: boolean;
  locked?: boolean;
  lockNote?: string;
};

const PERMISSION_GROUPS: {
  key: string;
  title: string;
  icon: typeof ShieldCheck;
  sections: { title: string; items: PermissionItem[] }[];
}[] = [
  {
    key: "clinical",
    title: "Clinical Care",
    icon: ShieldCheck,
    sections: [
      {
        title: "PATIENTS",
        items: [
          { id: "connected_patients", label: "Connected Patients", default: true },
        ],
      },
      {
        title: "CARE EPISODES",
        items: [
          { id: "care_episode", label: "Care Episodes", default: true, locked: true, lockNote: "Care Episodes was automatically enabled because it is required." },
        ],
      },
      {
        title: "APPOINTMENTS",
        items: [
          { id: "view_appointments", label: "View Appointments", default: true },
          { id: "manage_appointments", label: "Manage Appointments", default: false },
        ],
      },
      {
        title: "ALERTS",
        items: [
          { id: "alerts", label: "Alerts", default: false },
        ],
      },
      {
        title: "MESSAGES",
        items: [
          { id: "messages", label: "Messages", default: false },
        ],
      },
    ],
  },
  {
    key: "insights",
    title: "Insights",
    icon: Sliders,
    sections: [
      {
        title: "",
        items: [
          { id: "view_reports_analytics", label: "View reports & analytics", default: true },
          { id: "export_reports", label: "Export reports", default: true },
        ],
      },
    ],
  },
  {
    key: "administration",
    title: "Administration",
    icon: LockKeyhole,
    sections: [
      {
        title: "",
        items: [
          { id: "view_team", label: "View team", default: true },
          { id: "manage_team_members", label: "Manage team members", default: true },
          { id: "view_audit_logs", label: "View audit logs", default: true },
        ],
      },
    ],
  },
];

const PERMISSION_TO_API: Record<string, BackendTeamPermission> = {
  connected_patients: "care_episode",
  care_episode: "care_episode",
  view_appointments: "appointments",
  manage_appointments: "appointments",
  alerts: "care_episode",
  messages: "care_episode",
  view_reports_analytics: "view_all_reports",
  export_reports: "view_all_reports",
  view_team: "manage_team_members",
  manage_team_members: "manage_team_members",
  view_audit_logs: "audit_log",
};

function getDefaultPermissions(): string[] {
  const defaults: string[] = [];
  for (const group of PERMISSION_GROUPS) {
    for (const section of group.sections) {
      for (const item of section.items) {
        if (item.default) defaults.push(item.id);
      }
    }
  }
  return defaults;
}

function mapRole(value: string): TeamRole {
  if (value === "hospital_admin") return "admin";
  if (value === "nurse") return "nurse";
  return "doctor";
}

function mapPermissionsToApi(accessLevel: AccessLevel, selected: string[]): BackendTeamPermission[] {
  if (accessLevel === "full") return ["full_system_access"];
  const source = accessLevel === "standard" ? getDefaultPermissions() : selected;
  return Array.from(new Set(source.map((p) => PERMISSION_TO_API[p]).filter(Boolean)));
}

export default function InviteTeamMemberDialog({
  open,
  onOpenChange,
  onInvited,
}: InviteTeamMemberDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("standard");
  const [permissions, setPermissions] = useState<string[]>(getDefaultPermissions());
  const [sendEmail, setSendEmail] = useState(true);
  const [fullAccessConfirmed, setFullAccessConfirmed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string>("clinical");

  const isDirty = useMemo(
    () => Boolean(fullName || email || role || specialty || accessLevel !== "standard"),
    [accessLevel, email, fullName, role, specialty],
  );

  function resetForm() {
    setFullName("");
    setEmail("");
    setRole("");
    setSpecialty("");
    setAccessLevel("standard");
    setPermissions(getDefaultPermissions());
    setSendEmail(true);
    setFullAccessConfirmed(false);
    setExpandedGroup("clinical");
  }

  function closeAndReset() {
    resetForm();
    onOpenChange(false);
  }

  function requestClose() {
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleDialogChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  function togglePermission(permissionId: string, checked: boolean) {
    setPermissions((current) =>
      checked ? [...new Set([...current, permissionId])] : current.filter((item) => item !== permissionId),
    );
  }

  function getGroupEnabledCount(groupKey: string) {
    const group = PERMISSION_GROUPS.find((g) => g.key === groupKey);
    if (!group) return 0;
    let count = 0;
    for (const section of group.sections) {
      for (const item of section.items) {
        if (permissions.includes(item.id)) count++;
      }
    }
    return count;
  }

  async function submitInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accessLevel === "full" && !fullAccessConfirmed) return;
    setIsSubmitting(true);
    try {
      const result = await inviteTeamMember({
        name: fullName.trim(),
        email: email.trim(),
        role: mapRole(role),
        ...(specialty.trim() ? { specialty: specialty.trim() } : {}),
        accessProfile: accessLevel === "full" ? "full_access" : "limited",
        permissions: mapPermissionsToApi(accessLevel, permissions),
      });
      capturePostHogEvent("team_member_invited", {
        member_id: result.memberId,
        access_level: accessLevel,
        role,
        send_email: sendEmail,
        status: result.status,
      });
      toast.success("Team member invited", {
        description: sendEmail
          ? "The invitation was created and can be accepted by the team member."
          : "The invitation was created. Copy the invite token from the backend response if email delivery is disabled later.",
      });
      await onInvited?.(result);
      closeAndReset();
    } catch (requestError) {
      toast.error("Invitation could not be sent", {
        description: requestError instanceof Error ? requestError.message : "Unable to invite this team member.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Configuration summary for custom
  const clinicalCount = getGroupEnabledCount("clinical");
  const insightsCount = getGroupEnabledCount("insights");
  const adminCount = getGroupEnabledCount("administration");
  const totalPermissions = clinicalCount + insightsCount + adminCount;

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent
          className="max-h-[92vh] max-w-[720px] overflow-y-auto rounded-2xl bg-card p-0"
          onEscapeKeyDown={(event) => {
            if (isDirty) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isDirty) event.preventDefault();
          }}
        >
          <form onSubmit={submitInvitation}>
            <DialogHeader className="border-b border-border px-6 py-5 pr-14">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#023E8A]/10 text-[#023E8A]">
                  <UserRoundPlus className="h-5 w-5" />
                </span>
                <DialogTitle className="text-xl font-bold">Add New Team Member</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-6 px-6 py-6">
              {/* Form fields */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="team-full-name" className="text-sm font-medium text-foreground">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="team-full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="e.g. Dr. Fatima Bello"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="team-email" className="text-sm font-medium text-foreground">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="team-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="bello@hospital.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="team-role" className="text-sm font-medium text-foreground">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <Select value={role} onValueChange={setRole} required>
                    <SelectTrigger id="team-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="nurse">Nurse</SelectItem>
                      <SelectItem value="physiotherapist">Physiotherapist</SelectItem>
                      <SelectItem value="hospital_admin">Hospital Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="team-specialty" className="text-sm font-medium text-foreground">
                    Specialty
                  </label>
                  <Input
                    id="team-specialty"
                    value={specialty}
                    onChange={(event) => setSpecialty(event.target.value)}
                    placeholder="e.g. Cardiology"
                  />
                </div>
              </div>

              {/* Access Level */}
              <div className="space-y-3">
                <p className="text-sm font-bold uppercase tracking-wide text-foreground">Access Level</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {ACCESS_LEVELS.map(({ value, title, description, icon: Icon }) => {
                    const selected = accessLevel === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setAccessLevel(value);
                          if (value !== "full") setFullAccessConfirmed(false);
                        }}
                        className={cn(
                          "relative flex items-start gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected ? "border-[#023E8A] bg-[#023E8A]/5" : "border-border bg-card hover:border-[#023E8A]/40",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#023E8A]/10 text-[#023E8A]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-semibold", selected ? "text-[#023E8A]" : "text-foreground")}>{title}</span>
                          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{description}</span>
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                            selected ? "border-[#023E8A] bg-[#023E8A] text-white" : "border-border",
                          )}
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Standard: Info banner */}
              {accessLevel === "standard" ? (
                <div className="flex gap-3 rounded-xl border-l-4 border-l-amber-400 bg-amber-50 px-4 py-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#023E8A]" />
                  <div>
                    <p className="text-sm font-semibold text-[#023E8A]">Standard Set Implementation</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      This member will receive the standard permission set configured for the selected role. Existing role defaults can be managed from{" "}
                      <span className="font-medium text-[#023E8A] underline">Roles & Permissions.</span>
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Custom: Permissions Configuration */}
              {accessLevel === "custom" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Permissions Configuration</p>
                  </div>

                  {PERMISSION_GROUPS.map((group) => {
                    const isExpanded = expandedGroup === group.key;
                    const enabledCount = getGroupEnabledCount(group.key);
                    const GroupIcon = group.icon;

                    return (
                      <div key={group.key} className={cn("rounded-xl border", isExpanded ? "border-[#023E8A]/30 bg-[#023E8A]/5" : "border-border bg-card")}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3"
                          onClick={() => setExpandedGroup(isExpanded ? "" : group.key)}
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center gap-2">
                            <GroupIcon className="h-4 w-4 text-[#023E8A]" />
                            <span className="text-sm font-semibold text-foreground">{group.title}</span>
                            <span className="rounded-full bg-[#023E8A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              {enabledCount} Enabled
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-[#023E8A]/20 px-4 py-4">
                            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                              {group.sections.map((section) => (
                                <div key={section.title || "default"}>
                                  {section.title ? (
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{section.title}</p>
                                  ) : null}
                                  <div className="space-y-2.5">
                                    {section.items.map((item) => (
                                      <div key={item.id}>
                                        <label className="flex items-center gap-2.5 text-sm text-foreground">
                                          <Checkbox
                                            checked={permissions.includes(item.id)}
                                            onCheckedChange={(checked) => togglePermission(item.id, checked === true)}
                                            disabled={item.locked}
                                            className={cn(
                                              permissions.includes(item.id) && "border-[#023E8A] bg-[#023E8A] text-white",
                                            )}
                                          />
                                          <span>{item.label}</span>
                                          {item.locked ? <LockKeyhole className="h-3 w-3 text-muted-foreground" /> : null}
                                        </label>
                                        {item.locked && item.lockNote ? (
                                          <p className="ml-7 mt-0.5 text-[11px] italic text-muted-foreground">{item.lockNote}</p>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {/* Configuration Summary */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-foreground">Configuration Summary</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Clinical: {clinicalCount}  Insights: {insightsCount}  Admin: {adminCount}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-foreground">{totalPermissions}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Permissions</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Full Access: Confirmation checkbox */}
              {accessLevel === "full" ? (
                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <Checkbox
                    checked={fullAccessConfirmed}
                    onCheckedChange={(checked) => setFullAccessConfirmed(checked === true)}
                    className="mt-0.5 border-red-400 data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
                  />
                  <p className="text-sm font-medium leading-5 text-red-600">
                    I understand that this member will receive unrestricted workspace access and that I am responsible for any actions taken by this account.
                  </p>
                </div>
              ) : null}

              {/* Send invitation email */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-border p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Send invitation email</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Member will receive access instructions via email.
                  </p>
                </div>
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
              </div>
            </div>

            <DialogFooter className="border-t border-border px-6 py-4">
              <Button type="button" variant="ghost" onClick={requestClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="gap-2 bg-[#023E8A] hover:bg-[#023E8A]/90"
                disabled={isSubmitting || (accessLevel === "full" && !fullAccessConfirmed)}
              >
                <UserRoundPlus className="h-4 w-4" />
                {isSubmitting ? "Adding..." : "Add Team Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discard Dialog - TM-06 */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
            <AlertDialogTitle className="text-center text-lg">Discard Invitation?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              You have unsaved invitation details for{" "}
              <span className="font-semibold text-foreground">{fullName || "this member"}</span>.
              Leaving now will discard all entered information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
            <AlertDialogCancel className="mt-0">Continue Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                resetForm();
                setDiscardOpen(false);
                onOpenChange(false);
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
