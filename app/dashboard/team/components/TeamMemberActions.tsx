"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Pencil, RotateCcw, Trash2, UserRoundX } from "lucide-react";
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

type PendingAction = "suspend" | "reactivate" | "remove" | null;

type TeamMemberActionsProps = {
  memberId: string;
  name: string;
  email: string;
  specialty: string;
};

const ACTION_COPY = {
  suspend: {
    title: "Suspend team member?",
    description: "Suspension should block workspace access without deleting the member's clinical history.",
    button: "Suspend member",
    icon: UserRoundX,
  },
  reactivate: {
    title: "Reactivate team member?",
    description: "Reactivation should restore the member's approved workspace permissions.",
    button: "Reactivate member",
    icon: RotateCcw,
  },
  remove: {
    title: "Remove team member?",
    description: "This should permanently remove the member after active clinical assignments have been handled.",
    button: "Remove member",
    icon: Trash2,
  },
} as const;

export default function TeamMemberActions({
  memberId,
  name,
  email,
  specialty,
}: TeamMemberActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [editedName, setEditedName] = useState(name);
  const [editedEmail, setEditedEmail] = useState(email);
  const [editedSpecialty, setEditedSpecialty] = useState(specialty);
  const [editedRole, setEditedRole] = useState("clinician");

  function reportUnavailable(action: string) {
    capturePostHogEvent("team_api_unavailable", { action, member_id: memberId });
    toast.error("Change could not be saved", {
      description: "The required team-management endpoint is not available in the current API contract.",
    });
  }

  function openEdit() {
    capturePostHogEvent("team_member_edit_opened", { member_id: memberId });
    setEditOpen(true);
  }

  function openStatus(action: Exclude<PendingAction, null>) {
    capturePostHogEvent(
      action === "remove" ? "team_member_remove_opened" : "team_member_status_opened",
      { member_id: memberId, action },
    );
    setPendingAction(action);
  }

  const actionCopy = pendingAction ? ACTION_COPY[pendingAction] : null;
  const ActionIcon = actionCopy?.icon ?? AlertTriangle;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 bg-card">
            Actions
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={openEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit member
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openStatus("suspend")}>
            <UserRoundX className="mr-2 h-4 w-4" />
            Suspend member
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openStatus("reactivate")}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reactivate member
          </DropdownMenuItem>
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
        <DialogContent className="max-w-xl rounded-2xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              reportUnavailable("edit");
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Edit Member
              </DialogTitle>
              <DialogDescription>
                Update the team member&apos;s workspace profile.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6 sm:grid-cols-2">
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
                  onChange={(event) => setEditedEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-member-role">Role</Label>
                <Select value={editedRole} onValueChange={setEditedRole}>
                  <SelectTrigger id="edit-member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinician">Clinician</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                    <SelectItem value="hospital_admin">Hospital Administrator</SelectItem>
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
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={pendingAction === "reactivate" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              onClick={() => {
                if (pendingAction) reportUnavailable(pendingAction);
                setPendingAction(null);
              }}
            >
              {actionCopy?.button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
