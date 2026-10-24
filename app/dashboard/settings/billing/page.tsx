"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Download, FileText, ReceiptText, RotateCcw, ShieldOff, TrendingUp, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { activateFacilityBilling, getFacilityBillingEstimate, getFacilityBillingSubscription, getFacilityInvoices, getFacilityPaymentMethod, getFacilityUsageSummary, getSubscriptionSummary, payFacilityInvoice, reactivateSubscription, verifyFacilityPayment, type FacilityBillingEstimate, type FacilityBillingSubscription, type FacilityInvoice, type FacilityPaymentMethod, type FacilityUsageSummary, type SubscriptionSummary } from "@/lib/api/settings";
import { BillingTabs, formatInvoiceDate, formatInvoiceMoney } from "@/app/dashboard/settings/billing/components";

const fallbackSubscription: SubscriptionSummary = {
  planName: "Free Plan",
  status: "Active",
  billingPeriod: "Current billing period",
  estimatedTotal: 0,
  currency: "NGN",
  renewalDate: "--",
  monthlyFeeLabel: "Not supplied",
  estimatedInvoiceDate: "--",
  episodeRate: null,
  usage: { activeCareEpisodes: 0, billableEpisodes: 0, appointments: 0, activeClinicians: 0 },
};

// Facility plans (FacilityBillingSubscriptionDto.plan): starter | professional | enterprise.
// Plan changes are admin-only (web-admin), so hospitals request upgrades through support.
const TOP_FACILITY_PLAN = "enterprise";

function formatPlanName(plan: string | null | undefined) {
  const value = (plan ?? "").trim();
  if (!value) return "--";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default function BillingSettingsPage() {
  const [subscription, setSubscription] = useState<SubscriptionSummary>(fallbackSubscription);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [estimate, setEstimate] = useState<FacilityBillingEstimate | null>(null);
  const [usageSummary, setUsageSummary] = useState<FacilityUsageSummary | null>(null);
  const [facilityBilling, setFacilityBilling] = useState<FacilityBillingSubscription | null>(null);
  const [outstandingInvoice, setOutstandingInvoice] = useState<FacilityInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<FacilityPaymentMethod | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  useEffect(() => {
    capturePostHogEvent("settings_billing_viewed");
    let isMounted = true;
    const query = new URLSearchParams(window.location.search);
    const reference = query.get("reference");
    const invoiceReference = query.get("billing") === "invoice" ? reference : query.get("invoiceReference");
    const loadSummary = () => getSubscriptionSummary().then((summary) => {
      if (isMounted) setSubscription(summary);
    });
    const load = invoiceReference
      ? verifyFacilityPayment(invoiceReference).then((result) => {
          if (isMounted) {
            setNotice(result.status === "success" ? "Payment verified. Your invoice is now settled." : `Payment status: ${result.status}.`);
            window.history.replaceState({}, "", window.location.pathname);
          }
          return loadSummary();
        })
      : reference
        // Return from the facility activation / payment-method checkout — verify against
        // facility billing, not the personal (patient) subscription endpoint.
        ? verifyFacilityPayment(reference).then((result) => {
            if (isMounted) {
              setNotice(result.status === "success" ? "Payment verified. Your billing details are up to date." : `Payment status: ${result.status}.`);
              window.history.replaceState({}, "", window.location.pathname);
            }
            return loadSummary();
          })
        : loadSummary();
    load
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

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getFacilityBillingEstimate(), getFacilityUsageSummary(), getFacilityBillingSubscription(), getFacilityInvoices(), getFacilityPaymentMethod()]).then(([estimateResult, usageResult, billingResult, invoicesResult, paymentMethodResult]) => {
      if (!isMounted) return;
      if (estimateResult.status === "fulfilled") setEstimate(estimateResult.value);
      if (usageResult.status === "fulfilled") setUsageSummary(usageResult.value);
      if (billingResult.status === "fulfilled") setFacilityBilling(billingResult.value);
      if (invoicesResult.status === "fulfilled") {
        const invoice = invoicesResult.value.invoices.find((item) => item.status === "PENDING_PAYMENT" || item.status === "OVERDUE");
        setOutstandingInvoice(invoice ?? null);
      }
      if (paymentMethodResult.status === "fulfilled") setPaymentMethod(paymentMethodResult.value);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const lineItems = useMemo(() => [
    ...(estimate?.lines ?? []).map((line) => ({ label: line.label, quantity: line.quantity ?? 1, amount: line.amountKobo / 100 })),
    { label: "Appointments", quantity: subscription.usage.appointments, amount: 0 },
    { label: "Active Clinicians", quantity: subscription.usage.activeClinicians, amount: 0 },
  ], [estimate, subscription]);

  async function payInvoice() {
    if (!outstandingInvoice) return;
    setNotice("");
    try {
      const checkout = await payFacilityInvoice(outstandingInvoice.id, `${window.location.origin}${window.location.pathname}?billing=invoice`);
      if (!checkout.authorizationUrl) throw new Error("The invoice checkout URL was not returned.");
      window.location.assign(checkout.authorizationUrl);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Unable to start invoice payment.");
      toast.error("Unable to start invoice payment.");
    }
  }

  async function updatePaymentMethod() {
    setNotice("");
    try {
      const callbackUrl = `${window.location.origin}${window.location.pathname}`;
      const checkout = await activateFacilityBilling(callbackUrl);
      if (!checkout.authorizationUrl) throw new Error("The payment method checkout URL was not returned.");
      window.location.assign(checkout.authorizationUrl);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Unable to start payment method update.");
      toast.error("Unable to start payment method update.");
    }
  }

  async function reactivateNow() {
    setIsReactivating(true);
    setNotice("");
    try {
      await reactivateSubscription();
      capturePostHogEvent("settings_billing_reactivated");
      toast.success("Subscription reactivated. Auto-renewal is restored.");
      const updated = await getFacilityBillingSubscription();
      setFacilityBilling(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unable to reactivate subscription.";
      setNotice(msg);
      toast.error(msg);
    } finally {
      setIsReactivating(false);
    }
  }

  function downloadOutstandingInvoice() {
    if (!outstandingInvoice) return;
    if (outstandingInvoice.downloadUrl) {
      window.open(outstandingInvoice.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setNotice("The invoice download is not available yet.");
    toast.info("Invoice download is not available yet.");
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
      {facilityBilling?.status === "RESTRICTED" ? (
        <div className="mb-6 rounded-lg border border-destructive bg-destructive/5 p-5">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldOff className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold uppercase tracking-wide text-destructive">Account Restricted</p>
              <h2 className="mt-1 text-base font-bold text-foreground">New billable work is paused</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This workspace has been restricted due to an unresolved invoice. You can still view all existing patient
                records, care episodes, and historical data — but creating new care episodes, appointments, and other
                billable activity is paused until the outstanding balance is cleared.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {outstandingInvoice ? (
                  <Button type="button" onClick={payInvoice} disabled={!outstandingInvoice.canPay} className="h-9 rounded-lg px-5 text-sm font-semibold">
                    Pay Outstanding Invoice
                  </Button>
                ) : null}
                <Button type="button" variant="outline" asChild className="h-9 rounded-lg px-5 text-sm font-semibold">
                  <Link href="/dashboard/settings/billing/invoices">View Invoices</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {facilityBilling?.scheduledCancelAt && facilityBilling.status !== "CANCELLED" ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Subscription Scheduled for Cancellation</p>
              <p className="mt-2 text-base font-bold text-foreground">{formatPlanName(facilityBilling.plan)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Status: <span className="font-semibold text-foreground">{facilityBilling.status}</span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-muted-foreground">Access Until</p>
              <p className="mt-1 text-base font-bold text-foreground">
                {facilityBilling.currentPeriodEnd ? formatInvoiceDate(facilityBilling.currentPeriodEnd) : "End of current period"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cancels: {formatInvoiceDate(facilityBilling.scheduledCancelAt)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Your subscription will remain active until the period ends. Reactivate before expiry to restore auto-renewal.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={reactivateNow}
              disabled={isReactivating}
              className="h-9 shrink-0 rounded-lg border-amber-300 bg-white px-4 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-400"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {isReactivating ? "Reactivating..." : "Reactivate"}
            </Button>
          </div>
        </div>
      ) : null}
      {facilityBilling?.outstandingBanner?.present ? (
        <div className="mb-6 rounded-lg border border-destructive bg-destructive/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Overdue Invoice</p>
              <p className="mt-2 text-2xl font-bold text-destructive">{facilityBilling.outstandingBanner.invoiceNumber || facilityBilling.outstandingBanner.invoiceId}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {facilityBilling.outstandingBanner.dueAt ? 
                  `Due ${formatInvoiceDate(facilityBilling.outstandingBanner.dueAt)}` : 
                  "Due date unavailable"}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-muted-foreground">Outstanding Amount</p>
              <p className="mt-1 text-2xl font-bold text-destructive">
                {formatInvoiceMoney(
                  (facilityBilling.outstandingBanner.amountKobo ?? 0) / 100, 
                  "NGN"
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {facilityBilling.outstandingBanner.daysOverdue ?? 0} days overdue ·
                {facilityBilling.outstandingBanner.graceDaysLeft ?? 0} grace days left
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={payInvoice} className="h-10 rounded-lg px-5 font-semibold">
              Pay Now
            </Button>
          </div>
        </div>
      ) : null}
      <SettingsPanel title="Current Cycle" hideHeader>
        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-border bg-card shadow-sm p-5">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="mt-3 h-7 w-48 rounded bg-muted" />
                <div className="mt-3 h-3 w-32 rounded bg-muted/70" />
                <div className="mt-6 h-20 rounded-lg bg-card" />
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-5">
                <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-lg bg-muted" /><div className="space-y-2"><div className="h-4 w-32 rounded bg-muted" /><div className="h-3 w-40 rounded bg-muted/70" /></div></div>
                <div className="mt-5 flex gap-3"><div className="h-10 w-48 rounded-lg bg-muted" /><div className="h-10 w-36 rounded-lg bg-muted" /></div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border bg-card shadow-sm p-5">
                  <div className="h-9 w-9 rounded-lg bg-muted" />
                  <div className="mt-3 h-6 w-16 rounded bg-muted" />
                  <div className="mt-2 h-3 w-28 rounded bg-muted/70" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-xl border border-border bg-card shadow-sm p-4">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="mt-3 h-3 w-24 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4"><div className="h-4 w-32 rounded bg-muted" /></div>
              <div className="divide-y divide-border">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between px-5 py-4">
                    <div className="h-3 w-40 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
         ) : (
           <>
             <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-border bg-card shadow-sm p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-muted-foreground">Current Billing Period</p><h2 className="mt-2 text-2xl font-bold text-foreground">{formatPlanName(facilityBilling?.plan)}</h2>{facilityBilling?.plan.toLowerCase() === TOP_FACILITY_PLAN ? <p className="mt-1 text-xs font-medium text-muted-foreground">Highest plan, all features included</p> : null}<p className="mt-2 text-sm text-muted-foreground">{facilityBilling?.currentPeriodStart && facilityBilling.currentPeriodEnd ? formatInvoiceDate(facilityBilling.currentPeriodStart) + " – " + formatInvoiceDate(facilityBilling.currentPeriodEnd) : subscription.billingPeriod}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{facilityBilling?.status || subscription.status}</span></div>
                {outstandingInvoice ? (
                  <div className="mt-6 rounded-lg border border-border bg-primary/5 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div><p className="text-sm font-semibold text-muted-foreground">Outstanding Invoice</p><p className="mt-2 text-2xl font-bold text-foreground">{outstandingInvoice.invoiceNumber || outstandingInvoice.id}</p><p className="mt-2 text-sm text-muted-foreground">{outstandingInvoice.periodStart && outstandingInvoice.periodEnd ? `${formatInvoiceDate(outstandingInvoice.periodStart)} – ${formatInvoiceDate(outstandingInvoice.periodEnd)}` : "Billing period unavailable"}</p></div>
                      <div className="text-left sm:text-right"><p className="text-sm font-semibold text-muted-foreground">Total due</p><p className="mt-1 text-2xl font-bold text-primary">{formatInvoiceMoney(outstandingInvoice.amountKobo / 100, "NGN")}</p><p className="mt-1 text-sm text-muted-foreground">Due {outstandingInvoice.dueAt ? formatInvoiceDate(outstandingInvoice.dueAt) : "Date unavailable"}</p></div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{outstandingInvoice.status === "OVERDUE" ? "Overdue" : "Pending payment"}</span><span className="text-sm text-muted-foreground">{outstandingInvoice.canPay ? "Payment is ready" : "Payment unavailable"}</span></div>
                    <div className="mt-5 flex flex-wrap gap-3"><Button type="button" onClick={payInvoice} disabled={!outstandingInvoice.canPay} className="h-10 rounded-lg px-5 font-semibold">Pay Now</Button><Button type="button" variant="outline" onClick={downloadOutstandingInvoice} disabled={!outstandingInvoice.downloadUrl} className="h-10 rounded-lg px-5 font-semibold"><Download className="h-4 w-4" />Download Invoice</Button></div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-lg bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-muted-foreground">Estimated invoice total</p><p className="mt-2 text-3xl font-bold text-primary">{estimate ? formatInvoiceMoney(estimate.estimatedTotalKobo / 100, "NGN") : formatInvoiceMoney(subscription.estimatedTotal, subscription.currency)}</p></div><div className="text-left sm:text-right"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Estimated invoice date</p><p className="mt-1 text-sm font-semibold text-foreground">{estimate ? formatInvoiceDate(estimate.estimatedGenerationDate) : subscription.estimatedInvoiceDate}</p></div></div>
                    <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly subscription fee</p><p className="mt-1 text-sm font-semibold text-foreground">{subscription.monthlyFeeLabel}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billable episodes</p><p className="mt-1 text-sm font-semibold text-foreground">{estimate ? estimate.activeEpisodeCount : subscription.usage.billableEpisodes}</p><p className="mt-1 text-xs text-muted-foreground">{estimate ? estimate.lines.map((line) => line.quantity ? line.quantity + " × " + formatInvoiceMoney((line.unitPriceKobo ?? 0) / 100, "NGN") : line.label).join(" · ") : "Estimate unavailable"}</p></div></div>
                    <p className="mt-4 text-sm text-muted-foreground">Billing period: {facilityBilling?.currentPeriodStart && facilityBilling.currentPeriodEnd ? formatInvoiceDate(facilityBilling.currentPeriodStart) + " – " + formatInvoiceDate(facilityBilling.currentPeriodEnd) : subscription.billingPeriod}</p><p className="mt-1 text-sm text-muted-foreground">Cycle anchor: {facilityBilling?.cycleAnchorDate ? formatInvoiceDate(facilityBilling.cycleAnchorDate) : "Not supplied"} · {facilityBilling?.autoRenew ? "Renews monthly" : "Auto-renewal off"}</p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-5">
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></span><div><h3 className="text-base font-bold text-foreground">Payment Method</h3><p className="mt-1 text-sm text-muted-foreground">{paymentMethod ? `${paymentMethod.provider}${paymentMethod.brand ? ` · ${paymentMethod.brand}` : ""}${paymentMethod.last4 ? ` ending in ${paymentMethod.last4}` : ""}` : "No payment method on file"}</p></div></div>
                <p className="mt-4 text-sm text-muted-foreground">{paymentMethod?.confirmedAt ? `Confirmed ${formatInvoiceDate(paymentMethod.confirmedAt)}` : "Payment details are masked and managed by the payment gateway."}</p><div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={updatePaymentMethod} className="h-10 rounded-lg font-semibold">Update Payment Method</Button>{facilityBilling && facilityBilling.plan.toLowerCase() !== TOP_FACILITY_PLAN ? (
                    <Button type="button" variant="outline" asChild className="h-10 rounded-lg font-semibold"><Link href="/support">Contact us to upgrade</Link></Button>
                  ) : null}<Button type="button" variant="outline" asChild className="h-10 rounded-lg font-semibold text-destructive hover:text-destructive"><Link href="/dashboard/settings/billing/cancel-subscription">Cancel Subscription</Link></Button></div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Metric icon={<TrendingUp className="h-5 w-5" />} label="Active Care Episodes" value={usageSummary ? usageSummary.activeEpisodes : subscription.usage.activeCareEpisodes} />
              <Metric icon={<ReceiptText className="h-5 w-5" />} label="Appointments Completed This Cycle" value={usageSummary ? usageSummary.appointmentsCompleted : subscription.usage.appointments} />
              <Metric icon={<UsersRound className="h-5 w-5" />} label="Active Clinicians" value={subscription.usage.activeClinicians} />
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-5"><h3 className="text-base font-bold text-foreground">Billing Lifecycle</h3><div className="mt-5 grid gap-3 md:grid-cols-4">{["Usage tracked", "Draft invoice", "Invoice generated", "Payment processed"].map((step, index) => <div key={step} className="rounded-xl border border-border bg-card shadow-sm p-4"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span><p className="mt-3 text-sm font-bold text-foreground">{step}</p></div>)}</div></div>

              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Billing Breakdown</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Review current-cycle usage and estimated charges.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/settings/billing/invoices" className="text-sm font-semibold text-primary hover:underline">View invoice history</Link>
                    <Button type="button" variant="outline" onClick={exportDraft} className="h-10 rounded-lg font-semibold">
                      <Download className="h-4 w-4" />Export Draft
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-card text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-bold">Item</th>
                        <th className="px-5 py-3 font-bold">Quantity</th>
                        <th className="px-5 py-3 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lineItems.map((item) => (
                        <tr key={item.label}>
                          <td className="px-5 py-4 font-semibold text-foreground">
                            <FileText className="mr-2 inline h-4 w-4 text-primary" />
                            {item.label}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{item.quantity}</td>
                          <td className="px-5 py-4 text-right font-bold text-foreground">
                            {formatInvoiceMoney(item.amount, subscription.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {notice ? <SaveNotice>{notice}</SaveNotice> : null}
                </div>
              </>
            )}
          </SettingsPanel>
      </div>
    );
  }

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="rounded-xl border border-border bg-card shadow-sm p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span><p className="mt-4 text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-foreground">{value}</p></div>;
}