"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Download, FileText, Loader2, ReceiptText, TrendingUp, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getSubscriptionSummary, type SubscriptionSummary } from "@/lib/api/settings";
import { BillingTabs } from "@/app/dashboard/settings/billing/components";

const fallbackSubscription: SubscriptionSummary = {
  planName: "Free Plan",
  status: "Active",
  billingPeriod: "Current billing period",
  estimatedTotal: 0,
  currency: "NGN",
  renewalDate: "--",
  usage: { activeCareEpisodes: 0, appointments: 0, activeClinicians: 0 },
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default function BillingSettingsPage() {
  const [subscription, setSubscription] = useState<SubscriptionSummary>(fallbackSubscription);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    capturePostHogEvent("settings_billing_viewed");
    let isMounted = true;
    getSubscriptionSummary()
      .then((summary) => {
        if (isMounted) setSubscription(summary);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setNotice(error instanceof Error ? error.message : "Unable to load subscription details.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const lineItems = useMemo(() => [
    { label: "Active Care Episodes", quantity: subscription.usage.activeCareEpisodes, amount: 0 },
    { label: "Appointments", quantity: subscription.usage.appointments, amount: 0 },
    { label: "Active Clinicians", quantity: subscription.usage.activeClinicians, amount: 0 },
  ], [subscription]);

  function unavailable(action: string) {
    setNotice(`${action} is waiting for billing backend contracts.`);
    capturePostHogEvent("settings_billing_action_unavailable", { action });
    toast.info("Billing endpoint is not available yet.");
  }

  function exportDraft() {
    const rows = [["Item", "Quantity", "Amount"], ...lineItems.map((item) => [item.label, String(item.quantity), String(item.amount)])];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "billing-draft.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    capturePostHogEvent("settings_billing_exported", { format: "csv" });
  }

  return (
    <div>
      <SettingsHeader title="Billing & Subscription" description="Review the current billing cycle, estimated charges, payment method, and usage summary." />
      <BillingTabs />
      <SettingsPanel title="Current Cycle" description="The current billing period and exportable draft breakdown for this workspace.">
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center text-sm font-semibold text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />Loading billing details...</div>
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg border border-border bg-background p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-muted-foreground">Current Billing Period</p><h2 className="mt-2 text-2xl font-bold text-foreground">{subscription.planName}</h2><p className="mt-2 text-sm text-muted-foreground">{subscription.billingPeriod}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{subscription.status}</span></div>
                <div className="mt-6 rounded-lg bg-card p-4 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Estimated invoice total</p><p className="mt-2 text-3xl font-bold text-primary">{formatMoney(subscription.estimatedTotal, subscription.currency)}</p><p className="mt-2 text-sm text-muted-foreground">Renewal date: {subscription.renewalDate}</p></div>
              </div>
              <div className="rounded-lg border border-border bg-background p-5">
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></span><div><h3 className="text-base font-bold text-foreground">Payment Method</h3><p className="mt-1 text-sm text-muted-foreground">No payment method on file</p></div></div>
                <div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => unavailable("Update payment method")} className="h-10 rounded-lg font-semibold">Update Payment Method</Button><Button type="button" variant="outline" asChild className="h-10 rounded-lg font-semibold text-destructive hover:text-destructive"><Link href="/dashboard/settings/billing/cancel-subscription">Cancel Subscription</Link></Button></div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Metric icon={<TrendingUp className="h-5 w-5" />} label="Active Care Episodes" value={subscription.usage.activeCareEpisodes} />
              <Metric icon={<ReceiptText className="h-5 w-5" />} label="Appointments" value={subscription.usage.appointments} />
              <Metric icon={<UsersRound className="h-5 w-5" />} label="Active Clinicians" value={subscription.usage.activeClinicians} />
            </div>

            <div className="rounded-lg border border-border bg-background p-5"><h3 className="text-base font-bold text-foreground">Billing Lifecycle</h3><div className="mt-5 grid gap-3 md:grid-cols-4">{["Usage tracked", "Draft invoice", "Invoice generated", "Payment processed"].map((step, index) => <div key={step} className="rounded-lg border border-border bg-card p-4"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span><p className="mt-3 text-sm font-bold text-foreground">{step}</p></div>)}</div></div>

            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-base font-bold text-foreground">Detailed Billing Breakdown</h3><p className="mt-1 text-sm text-muted-foreground">Draft CSV export is handled by the frontend.</p></div><Button type="button" variant="outline" onClick={exportDraft} className="h-10 rounded-lg font-semibold"><Download className="h-4 w-4" />Export Draft</Button></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-card text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Item</th><th className="px-5 py-3 font-bold">Quantity</th><th className="px-5 py-3 text-right font-bold">Amount</th></tr></thead><tbody className="divide-y divide-border">{lineItems.map((item) => <tr key={item.label}><td className="px-5 py-4 font-semibold text-foreground"><FileText className="mr-2 inline h-4 w-4 text-primary" />{item.label}</td><td className="px-5 py-4 text-muted-foreground">{item.quantity}</td><td className="px-5 py-4 text-right font-bold text-foreground">{formatMoney(item.amount, subscription.currency)}</td></tr>)}</tbody></table></div>
            </div>
            {notice ? <SaveNotice>{notice}</SaveNotice> : null}
          </>
        )}
      </SettingsPanel>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-background p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span><p className="mt-4 text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-foreground">{value}</p></div>;
}
