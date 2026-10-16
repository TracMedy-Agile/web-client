"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

import { SaveNotice, SettingsHeader } from "@/app/dashboard/settings/components";
import { BillingTabs } from "@/app/dashboard/settings/billing/components";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { cancelSubscription, type CancelFacilityBillingDto } from "@/lib/api/settings";

const consequences = [
  "New billing benefits stop at the end of the active cycle.",
  "Any overdue invoices remain payable after cancellation.",
  "Workspace access can be limited if outstanding invoices remain unresolved.",
];

export default function CancelSubscriptionPage() {
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    capturePostHogEvent("settings_cancel_subscription_viewed");
  }, []);

  async function handleCancelSubmit() {
    if (!reason) {
      setNotice("Please select a cancellation reason");
      return;
    }

    setNotice("");
    setIsLoading(true);

    try {
      const input: CancelFacilityBillingDto = {
        reason: reason as CancelFacilityBillingDto["reason"],
        ...(feedback && { feedback }), // Only include feedback if it's not empty
      };

      const result = await cancelSubscription(input);
      
      // Handle the response - assuming it returns a FacilityBillingMessage
      if (result) {
        capturePostHogEvent("settings_cancel_subscription_confirmed", { reason });
        // Redirect to the billing page or a confirmation page
        window.location.href = "/dashboard/settings/billing";
      }
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Failed to cancel subscription");
      console.error("Cancellation error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <SettingsHeader title="Billing & Subscription" description="Review the impact before cancelling the current subscription." />
      <BillingTabs />
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card shadow-sm">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></span><div><h1 className="text-xl font-bold text-foreground">Cancel Subscription</h1><p className="mt-1 text-sm leading-6 text-muted-foreground">Free Plan is currently active for this workspace.</p></div></div>
          <Button type="button" variant="ghost" size="icon" asChild className="h-9 w-9 rounded-lg"><Link href="/dashboard/settings/billing" aria-label="Close cancel subscription"><X className="h-4 w-4" /></Link></Button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <section className="rounded-lg border border-border bg-background p-4"><p className="text-sm font-bold text-foreground">Plan Summary</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Summary label="Plan" value="Free Plan" /><Summary label="Status" value="Active" /><Summary label="Amount" value="NGN 0" /></div></section>
          <section className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"><p className="text-sm font-bold text-destructive">Before you continue</p><ul className="mt-3 space-y-3">{consequences.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-foreground"><Check className="mt-1 h-4 w-4 shrink-0 text-destructive" />{item}</li>)}</ul></section>
           <label className="block space-y-2"><span className="text-sm font-bold text-foreground">Cancellation Reason</span><Select value={reason} onValueChange={setReason}><SelectTrigger className="h-11 rounded-lg border-border bg-background"><SelectValue placeholder="Select a reason" /></SelectTrigger><SelectContent><SelectItem value="too_expensive">Too expensive</SelectItem><SelectItem value="missing_features">Missing features</SelectItem><SelectItem value="switching">Switching platform</SelectItem><SelectItem value="temporary_pause">Temporary pause</SelectItem><SelectItem value="low_usage">Low usage</SelectItem><SelectItem value="technical_issues">Technical issues</SelectItem><SelectItem value="poor_ux">Poor experience</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></label>
           {reason === "other" && (
             <label className="block space-y-2">
               <span className="text-sm font-bold text-foreground">Optional Feedback</span>
               <textarea
                 value={feedback}
                 onChange={(e) => setFeedback(e.target.value)}
                 placeholder="Please share your feedback (optional)"
                 className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:focus-visible:outline-none file:border-0 file:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                 rows={3}
               />
             </label>
           )}
           <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span><strong className="block text-sm text-foreground">I understand the consequences of cancelling this subscription.</strong><span className="mt-1 block text-sm leading-6 text-muted-foreground">This action submits a cancellation request to the billing system.</span></span></label>
           {notice ? <SaveNotice tone="error">{notice}</SaveNotice> : null}
        </div>

         <footer className="flex flex-col-reverse gap-3 border-t border-border px-6 py-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" asChild className="h-11 rounded-lg px-5 font-semibold"><Link href="/dashboard/settings/billing">Keep Subscription</Link></Button><Button type="button" asChild disabled={!confirmed || isLoading} onClick={handleCancelSubmit} className="h-11 rounded-lg bg-destructive px-5 font-semibold text-destructive-foreground hover:bg-destructive/90">{isLoading ? "Cancelling..." : "Cancel Subscription"}</Button></footer>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-card p-3"><p className="text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold text-foreground">{value}</p></div>;
}
