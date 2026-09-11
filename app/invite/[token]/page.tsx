"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, HeartHandshake, Loader2, ShieldAlert, UserRound, XCircle } from "lucide-react";
import TracmedyFooter from "@/app/(landing)/components/TracmedyFooter";
import TracmedyHeader from "@/app/(landing)/components/TracmedyHeader";
import {
  acceptCaregiverInvitation,
  declineCaregiverInvitation,
  getCaregiverInvitation,
} from "@/lib/api/caregiver-invitations";
import type { components } from "@/docs/types/api";

type Invitation = components["schemas"]["InvitationLookupResponseDto"];
type InvitationState = "pending" | "accepted" | "declined" | "expired";

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getInvitationState(invitation: Invitation): InvitationState {
  const status = invitation.status.trim().toLowerCase();
  if (invitation.expired || status === "expired") return "expired";
  if (status === "accepted" || status === "active") return "accepted";
  if (status === "declined" || status === "rejected") return "declined";
  return "pending";
}

export default function CaregiverInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loadedToken, setLoadedToken] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;

    getCaregiverInvitation(token)
      .then((result) => {
        if (!active) return;
        setInvitation(result);
        setError("");
        setActionMessage("");
        setLoadedToken(token);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load this invitation.");
        setActionMessage("");
        setLoadedToken(token);
      });

    return () => {
      active = false;
    };
  }, [token]);



  const isLoading = Boolean(token) && loadedToken !== token;
  const state = useMemo(() => invitation ? getInvitationState(invitation) : null, [invitation]);
  async function handleAction(action: "accept" | "decline") {
    if (!token || !invitation || state !== "pending") return;
    setIsActing(true);
    setError("");
    setActionMessage("");
    try {
      if (action === "accept") {
        await acceptCaregiverInvitation(token);
        setInvitation((current) => current ? { ...current, status: "accepted" } : current);
        setActionMessage("Invitation accepted. You can now access the patient’s shared care information.");
      } else {
        await declineCaregiverInvitation(token);
        setInvitation((current) => current ? { ...current, status: "declined" } : current);
        setActionMessage("Invitation declined. No caregiver access was granted.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update this invitation.");
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TracmedyHeader />
      <main className="flex-1 bg-surface px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HeartHandshake className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Caregiver invitation</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              {invitation ? `${invitation.patientName} invited you to help with their care` : "You have a Tracmedy caregiver invitation"}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
              Review the invitation below and choose whether to join the patient’s care circle.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 text-sm font-semibold text-muted-foreground shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              Loading invitation
            </div>
          ) : null}

          {!isLoading && error ? (
            <section className="rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-sm" aria-live="polite">
              <ShieldAlert className="mx-auto h-9 w-9 text-destructive" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold text-foreground">Invitation unavailable</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
              {error.toLowerCase().includes("sign in") ? (
                <Link href="/login" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                  Sign in to continue
                </Link>
              ) : null}
            </section>
          ) : null}

          {!isLoading && invitation && state ? (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4 rounded-xl bg-primary/5 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Patient</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{invitation.patientName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {humanize(invitation.relationship)} · {humanize(invitation.role)}
                  </p>
                </div>
              </div>

              {state === "pending" ? (
                <>
                  <p className="mt-6 text-sm leading-6 text-muted-foreground">
                    You have been invited to support <span className="font-bold text-foreground">{invitation.patientName}</span> as a {humanize(invitation.role).toLowerCase()}.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={() => void handleAction("accept")}
                      disabled={isActing}
                      className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                      Accept invitation
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAction("decline")}
                      disabled={isActing}
                      className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-bold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Decline
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5 text-center" aria-live="polite">
                  {state === "accepted" ? <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" /> : null}
                  {state === "declined" ? <XCircle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /> : null}
                  {state === "expired" ? <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" /> : null}
                  <h2 className="mt-3 text-lg font-bold text-foreground">
                    {state === "accepted" ? "Invitation already accepted" : null}
                    {state === "declined" ? "Invitation already declined" : null}
                    {state === "expired" ? "Invitation expired" : null}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {state === "accepted" ? "This caregiver relationship is already active." : null}
                    {state === "declined" ? "This invitation is no longer available to accept." : null}
                    {state === "expired" ? "Ask the patient to send a new caregiver invitation." : null}
                  </p>
                </div>
              )}

              {actionMessage ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700" aria-live="polite">{actionMessage}</p> : null}
              {error ? <p className="mt-5 rounded-xl bg-destructive/5 px-4 py-3 text-center text-sm font-semibold text-destructive" aria-live="polite">{error}</p> : null}
            </section>
          ) : null}

          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
            Tracmedy keeps caregiver access limited to the relationship approved by the patient. Need help? <Link href="/support" className="font-bold text-primary hover:underline">Contact support</Link>.
          </p>
        </div>
      </main>
      <TracmedyFooter />
    </div>
  );
}