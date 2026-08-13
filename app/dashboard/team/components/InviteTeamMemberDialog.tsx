"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, LockKeyhole, ShieldCheck, Sparkles, UserRoundPlus } from "lucide-react";
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
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { inviteTeamMember, type InviteTeamMemberInput, type InviteTeamMemberResult } from "@/lib/api/clinicians";
import { cn } from "@/lib/utils";

type AccessLevel = "standard" | "custom" | "full";
type TeamRole = InviteTeamMemberInput["role"];
type TeamPermission = NonNullable<InviteTeamMemberInput["permissions"]>[number];

type InviteTeamMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: (result: InviteTeamMemberResult) => void | Promise<void>;
};

const DEFAULT_PERMISSIONS = [
  "View connected patients",
  "Manage care episodes",
  "Acknowledge alerts",
  "Send messages",
  "View appointments",
];

const ACCESS_LEVELS: Array<{
  value: AccessLevel;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
}> = [
  {
    value: "standard",
    title: "Standard Access",
    description: "Clinical access for day-to-day patient care.",
    icon: ShieldCheck,
  },
  {
    value: "custom",
    title: "Custom Access",
    description: "Choose individual permissions for this member.",
    icon: Sparkles,
  },
  {
    value: "full",
    title: "Full Access",
    description: "Complete clinical and administrative access.",
    icon: LockKeyhole,
  },
];

const PERMISSION_GROUPS = [
  {
    title: "Clinical Care",
    items: ["View connected patients", "Manage care episodes", "Acknowledge alerts", "Send messages"],
  },
  {
    title: "Appointments",
    items: ["View appointments", "Manage appointments"],
  },
  {
    title: "Insights",
    items: ["View reports and analytics", "Export reports"],
  },
  {
    title: "Administration",
    items: ["View team", "Manage team members", "View audit logs", "Manage hospital settings"],
  },
] as const;

const PERMISSION_MAP: Record<string, TeamPermission> = {
  "View connected patients": "care_episode",
  "Manage care episodes": "care_episode",
  "Acknowledge alerts": "care_episode",
  "Send messages": "care_episode",
  "View appointments": "appointments",
  "Manage appointments": "appointments",
  "View reports and analytics": "view_all_reports",
  "Export reports": "view_all_reports",
  "View team": "manage_team_members",
  "Manage team members": "manage_team_members",
  "View audit logs": "audit_log",
  "Manage hospital settings": "configure_settings",
};

function mapRole(value: string): TeamRole {
  if (value === "hospital_admin") return "admin";
  if (value === "nurse") return "nurse";
  return "doctor";
}

function mapPermissions(accessLevel: AccessLevel, selected: string[]): TeamPermission[] {
  if (accessLevel === "full") return ["full_system_access"];
  const source = accessLevel === "standard" ? DEFAULT_PERMISSIONS : selected;
  return Array.from(new Set(source.map((permission) => PERMISSION_MAP[permission]).filter(Boolean)));
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
  const [ward, setWard] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("standard");
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_PERMISSIONS);
  const [sendEmail, setSendEmail] = useState(true);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = useMemo(
    () => Boolean(fullName || email || role || specialty || ward || accessLevel !== "standard"),
    [accessLevel, email, fullName, role, specialty, ward],
  );

  function resetForm() {
    setFullName("");
    setEmail("");
    setRole("");
    setSpecialty("");
    setWard("");
    setAccessLevel("standard");
    setPermissions(DEFAULT_PERMISSIONS);
    setSendEmail(true);
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

  function togglePermission(permission: string, checked: boolean) {
    setPermissions((current) =>
      checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission),
    );
  }

  async function submitInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await inviteTeamMember({
        name: fullName.trim(),
        email: email.trim(),
        role: mapRole(role),
        ...(ward.trim() ? { ward: ward.trim() } : {}),
        ...(specialty.trim() ? { specialty: specialty.trim() } : {}),
        accessProfile: accessLevel === "full" ? "full_access" : "limited",
        permissions: mapPermissions(accessLevel, permissions),
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

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent
          className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl bg-card p-0"
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
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRoundPlus className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="text-xl">Add New Team Member</DialogTitle>
                  <DialogDescription className="mt-1">
                    Invite a clinician or administrator to your hospital workspace.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="team-full-name">Full name</Label>
                  <Input
                    id="team-full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="e.g. Dr. Emeka Nwosu"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-email">Email address</Label>
                  <Input
                    id="team-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@hospital.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-role">Role</Label>
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
                  <Label htmlFor="team-specialty">Specialty</Label>
                  <Input
                    id="team-specialty"
                    value={specialty}
                    onChange={(event) => setSpecialty(event.target.value)}
                    placeholder={role === "doctor" ? "e.g. Cardiology" : "Optional"}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="team-ward">Assign ward</Label>
                  <Input
                    id="team-ward"
                    value={ward}
                    onChange={(event) => setWard(event.target.value)}
                    placeholder="e.g. Surgical Ward"
                  />
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Access level</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {ACCESS_LEVELS.map(({ value, title, description, icon: Icon }) => {
                    const selected = accessLevel === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setAccessLevel(value)}
                        className={cn(
                          "relative rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
                        )}
                      >
                        <span className="mb-3 flex items-start justify-between gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border",
                              selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                            )}
                          >
                            {selected ? <Check className="h-3 w-3" /> : null}
                          </span>
                        </span>
                        <span className="block text-sm font-semibold text-foreground">{title}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {accessLevel === "custom" ? (
                <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div>
                    <p className="font-semibold text-foreground">Custom permissions</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select exactly what this team member can see and manage.
                    </p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    {PERMISSION_GROUPS.map((group) => (
                      <fieldset key={group.title}>
                        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {group.title}
                        </legend>
                        <div className="space-y-2">
                          {group.items.map((permission) => (
                            <label key={permission} className="flex items-center gap-2 text-sm text-foreground">
                              <Checkbox
                                checked={permissions.includes(permission)}
                                onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                              />
                              {permission}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </div>
              ) : null}

              {accessLevel === "full" ? (
                <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Full administrative access</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      This member would be able to manage users, permissions, hospital settings, and protected audit data.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <Label htmlFor="send-invite-email" className="font-semibold">Send invitation email</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Email a secure account setup link when the invitation is created.
                  </p>
                </div>
                <Switch id="send-invite-email" checked={sendEmail} onCheckedChange={setSendEmail} />
              </div>
            </div>

            <DialogFooter className="border-t border-border px-6 py-4">
              <Button type="button" variant="ghost" onClick={requestClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <UserRoundPlus className="h-4 w-4" />
                {isSubmitting ? "Adding..." : "Add Team Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">Discard invitation?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Your invitation details have not been saved. Closing now will discard your changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                resetForm();
                setDiscardOpen(false);
                onOpenChange(false);
              }}
            >
              Discard invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

