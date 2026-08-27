"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, MailPlus, Pencil, RotateCcw, Trash2, UserRoundX } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  reactivateTeamMember,
  removeTeamMember,
  resendTeamMemberInvite,
  suspendTeamMember,
  updateTeamMember,
  type UpdateTeamMemberInput,
} from "@/lib/api/clinicians";

type PendingAction = "suspend" | "reactivate" | "remove" | null;
type EditableRole = NonNullable<UpdateTeamMemberInput["role"]>;
type AccessProfile = NonNullable<UpdateTeamMemberInput["accessProfile"]>;
type BackendTeamPermission = NonNullable<UpdateTeamMemberInput["permissions"]>[number];
type TeamPermission = BackendTeamPermission | "connected_patients" | "alerts" | "messages";

type TeamMemberActionsProps = {
  memberId: string;
  name: string;
  email: string;
  specialty: string;
  ward?: string;
  role?: string;
  status?: string;
  accessProfile?: string;
  permissions?: string[];
  canEditMember?: boolean;
  onAccessDenied?: () => void;
  onChanged?: () => void | Promise<void>;
};

const ACTION_COPY = {
  suspend: {
    title: "Suspend team member?",
    description: "Suspension blocks workspace access without deleting the member's clinical history.",
    button: "Suspend member",
    icon: UserRoundX,
  },
  reactivate: {
    title: "Reactivate team member?",
    description: "Reactivation restores the member's approved workspace permissions.",
    button: "Reactivate member",
    icon: RotateCcw,
  },
  remove: {
    title: "Remove team member?",
    description: "This permanently removes the member after active clinical assignments have been handled.",
    button: "Remove member",
    icon: Trash2,
  },
} as const;

type PermissionOption = { id: string; value: TeamPermission; label: string };

const PERMISSIONS: PermissionOption[] = [
  { id: "connected_patients", value: "connected_patients", label: "Connected patients" },
  { id: "care_episode", value: "care_episode", label: "Care episodes" },
  { id: "appointments", value: "appointments", label: "Appointments" },
  { id: "alerts", value: "alerts", label: "Alerts" },
  { id: "messages", value: "messages", label: "Messages" },
  { id: "manage_team_members", value: "manage_team_members", label: "Manage team members" },
  { id: "audit_log", value: "audit_log", label: "Audit log" },
  { id: "view_all_reports", value: "view_all_reports", label: "Reports and analytics" },
  { id: "configure_settings", value: "configure_settings", label: "Hospital settings" },
  { id: "full_system_access", value: "full_system_access", label: "Full system access" },
];

const PERMISSION_TO_BACKEND: Record<TeamPermission, BackendTeamPermission> = {
  connected_patients: "care_episode",
  care_episode: "care_episode",
  appointments: "appointments",
  alerts: "care_episode",
  messages: "care_episode",
  manage_team_members: "manage_team_members",
  audit_log: "audit_log",
  view_all_reports: "view_all_reports",
  configure_settings: "configure_settings",
  full_system_access: "full_system_access",
};

function toBackendPermissions(values: TeamPermission[]): BackendTeamPermission[] {
  return Array.from(new Set(values.map((permission) => PERMISSION_TO_BACKEND[permission])));
}

function normalizeRole(value?: string): EditableRole {
  if (value === "admin" || value === "doctor" || value === "nurse") return value;
  if (value === "hospital_admin") return "admin";
  return "doctor";
}

function normalizeAccessProfile(value?: string): AccessProfile {
  return value === "full_access" ? "full_access" : "limited";
}

function normalizeTeamPermission(value: string): TeamPermission | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "view_connected_patients" || normalized === "manage_patients") return "connected_patients";
  if (normalized === "view_care_episodes" || normalized === "manage_care_episodes") return "care_episode";
  if (normalized === "view_alerts" || normalized === "acknowledge" || normalized === "acknowledge_alerts") return "alerts";
  if (normalized === "view_messages" || normalized === "send_messages") return "messages";
  return PERMISSIONS.some((permission) => permission.value === normalized) ? normalized as TeamPermission : null;
}

function allPermissions(): TeamPermission[] {
  return PERMISSIONS.map((permission) => permission.value);
}

function normalizePermissions(values?: string[]): TeamPermission[] {
  return Array.from(new Set((values || []).map(normalizeTeamPermission).filter((value): value is TeamPermission => Boolean(value))));
}

function permissionsForAccessProfile(profile: AccessProfile, values?: string[]): TeamPermission[] {
  return profile === "full_access" ? allPermissions() : normalizePermissions(values);
}

export default function TeamMemberActions({
  memberId,
  name,
  email,
  specialty,
  ward = "",
  role,
  status,
  accessProfile,
  permissions,
  canEditMember = true,
  onAccessDenied,
  onChanged,
}: TeamMemberActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [editedName, setEditedName] = useState(name);
  const [editedEmail] = useState(email);
  const [editedSpecialty, setEditedSpecialty] = useState(specialty);
  const [editedWard, setEditedWard] = useState(ward);
  const [editedRole, setEditedRole] = useState<EditableRole>(normalizeRole(role));
  const [editedAccessProfile, setEditedAccessProfile] = useState<AccessProfile>(normalizeAccessProfile(accessProfile));
  const [editedPermissions, setEditedPermissions] = useState<TeamPermission[]>(permissionsForAccessProfile(normalizeAccessProfile(accessProfile), permissions));
  const [isWorking, setIsWorking] = useState(false);

  function openEdit() {
    if (!canEditMember) {
      capturePostHogEvent("team_member_edit_denied", { member_id: memberId });
      onAccessDenied?.();
      return;
    }
    capturePostHogEvent("team_member_edit_opened", { member_id: memberId });
    setEditedName(name);
    setEditedSpecialty(specialty);
    setEditedWard(ward);
    setEditedRole(normalizeRole(role));
    const nextAccessProfile = normalizeAccessProfile(accessProfile);
    setEditedAccessProfile(nextAccessProfile);
    setEditedPermissions(permissionsForAccessProfile(nextAccessProfile, permissions));
    setEditOpen(true);
  }

  function openStatus(action: Exclude<PendingAction, null>) {
    capturePostHogEvent(
      action === "remove" ? "team_member_remove_opened" : "team_member_status_opened",
      { member_id: memberId, action },
    );
    setPendingAction(action);
  }

  function changeAccessProfile(value: AccessProfile) {
    setEditedAccessProfile(value);
    setEditedPermissions((current) =>
      value === "full_access" ? allPermissions() : current.filter((permission) => permission !== "full_system_access"),
    );
  }

  function togglePermission(permission: TeamPermission, checked: boolean) {
    if (permission === "full_system_access" && checked) {
      setEditedAccessProfile("full_access");
      setEditedPermissions(allPermissions());
      return;
    }

    if (!checked) setEditedAccessProfile("limited");
    setEditedPermissions((current) => {
      const next = checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission);
      return checked ? next : next.filter((item) => item !== "full_system_access");
    });
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);
    try {
      const nextPermissions = toBackendPermissions(editedAccessProfile === "full_access" ? allPermissions() : editedPermissions.filter((permission) => permission !== "full_system_access"));
      await updateTeamMember(memberId, {
        name: editedName.trim(),
        role: editedRole,
        ward: editedWard.trim(),
        specialty: editedSpecialty.trim(),
        accessProfile: editedAccessProfile,
        permissions: nextPermissions,
      });
      capturePostHogEvent("team_member_updated", { member_id: memberId, role: editedRole, access_profile: editedAccessProfile });
      toast.success("Team member updated");
      setEditOpen(false);
      await onChanged?.();
    } catch (requestError) {
      toast.error("Change could not be saved", {
        description: requestError instanceof Error ? requestError.message : "Unable to update this team member.",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function resendInvite() {
    setIsWorking(true);
    try {
      const result = await resendTeamMemberInvite(memberId);
      capturePostHogEvent("team_member_invite_resent", { member_id: memberId, status: result.status });
      toast.success("Invitation resent");
      await onChanged?.();
    } catch (requestError) {
      toast.error("Invitation could not be resent", {
        description: requestError instanceof Error ? requestError.message : "Unable to resend the invitation.",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setIsWorking(true);
    try {
      if (pendingAction === "suspend") {
        await suspendTeamMember(memberId, { reason: "Suspended from Team Management." });
        capturePostHogEvent("team_member_suspended", { member_id: memberId });
        toast.success("Team member suspended");
      } else if (pendingAction === "reactivate") {
        await reactivateTeamMember(memberId);
        capturePostHogEvent("team_member_reactivated", { member_id: memberId });
        toast.success("Team member reactivated");
      } else {
        await removeTeamMember(memberId);
        capturePostHogEvent("team_member_removed", { member_id: memberId });
        toast.success("Team member removed");
      }
      setPendingAction(null);
      await onChanged?.();
    } catch (requestError) {
      toast.error("Change could not be saved", {
        description: requestError instanceof Error ? requestError.message : "Unable to complete this action.",
      });
    } finally {
      setIsWorking(false);
    }
  }

  const actionCopy = pendingAction ? ACTION_COPY[pendingAction] : null;
  const ActionIcon = actionCopy?.icon ?? AlertTriangle;
  const isSuspended = status === "suspended";
  const canResendInvite = status === "pending";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 bg-card" disabled={isWorking}>
            Actions
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={openEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit member
          </DropdownMenuItem>
          {canResendInvite ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void resendInvite();
              }}
            >
              <MailPlus className="mr-2 h-4 w-4" />
              Resend invite
            </DropdownMenuItem>
          ) : null}
          {isSuspended ? (
            <DropdownMenuItem onSelect={() => openStatus("reactivate")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reactivate member
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => openStatus("suspend")}>
              <UserRoundX className="mr-2 h-4 w-4" />
              Suspend member
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => openStatus("remove")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Edit Member
              </DialogTitle>
              <DialogDescription>
                Update the team member&apos;s workspace profile, role, and permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto py-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-member-name">Full name</Label>
                <Input
                  id="edit-member-name"
                  value={editedName}
                  onChange={(event) => setEditedName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-member-email">Email address</Label>
                <Input
                  id="edit-member-email"
                  type="email"
                  value={editedEmail}
                  disabled
                  aria-describedby="edit-member-email-note"
                />
                <p id="edit-member-email-note" className="text-xs text-muted-foreground">
                  Email changes are not supported by the team update endpoint.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-member-role">Role</Label>
                <Select value={editedRole} onValueChange={(value) => setEditedRole(value as EditableRole)}>
                  <SelectTrigger id="edit-member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Hospital Administrator</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-member-specialty">Specialty</Label>
                <Input
                  id="edit-member-specialty"
                  value={editedSpecialty}
                  onChange={(event) => setEditedSpecialty(event.target.value)}
                  placeholder="Not specified"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-member-ward">Ward</Label>
                <Input
                  id="edit-member-ward"
                  value={editedWard}
                  onChange={(event) => setEditedWard(event.target.value)}
                  placeholder="Not specified"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-member-access">Access profile</Label>
                <Select value={editedAccessProfile} onValueChange={(value) => changeAccessProfile(value as AccessProfile)}>
                  <SelectTrigger id="edit-member-access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="limited">Limited</SelectItem>
                    <SelectItem value="full_access">Full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <fieldset className="space-y-3 rounded-xl border border-border p-4 sm:col-span-2">
                <legend className="px-1 text-sm font-semibold text-foreground">Permissions</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PERMISSIONS.map((permission) => (
                    <label key={permission.id} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={editedPermissions.includes(permission.value)}
                        onCheckedChange={(checked) => togglePermission(permission.value, checked === true)}
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={isWorking}>
                Cancel
              </Button>
              <Button type="submit" disabled={isWorking}>{isWorking ? "Saving..." : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ActionIcon className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">{actionCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {actionCopy?.description}
              <span className="mt-2 block font-medium text-foreground">{name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isWorking}
              className={pendingAction === "reactivate" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              onClick={(event) => {
                event.preventDefault();
                void confirmAction();
              }}
            >
              {isWorking ? "Saving..." : actionCopy?.button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

