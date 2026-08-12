"use client";

import { useEffect } from "react";
import { CreditCard, RefreshCw } from "lucide-react";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { BillingLifecycle, BillingTabs, InvoiceBreakdown, InvoiceStateCard, overdueInvoiceVariant, unavailableBillingAction } from "@/app/dashboard/settings/billing/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export default function OverdueVariantPage() {
  useEffect(() => {
    capturePostHogEvent("settings_invoice_state_viewed", { state: "overdue_retry", invoice_id: overdueInvoiceVariant.id });
  }, []);

  return (
    <div>
      <SettingsHeader title="Billing & Subscription" description="Review retry options for an overdue invoice." />
      <BillingTabs />
      <SettingsPanel title="Overdue Invoice" description="This overdue state highlights payment retry and payment-method recovery actions.">
        <SaveNotice tone="error">Payment retry and payment-method update are waiting for billing backend contracts. Download remains frontend-managed.</SaveNotice>
        <InvoiceStateCard invoice={overdueInvoiceVariant} tone="overdue" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><RefreshCw className="h-5 w-5" /></span><h3 className="mt-4 text-base font-bold text-foreground">Retry Payment</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Attempt payment again once the billing payment endpoint is available.</p><Button type="button" onClick={() => unavailableBillingAction("Retry overdue payment", overdueInvoiceVariant.id)} className="mt-4 h-10 rounded-lg font-semibold">Retry Payment</Button></div>
          <div className="rounded-lg border border-border bg-background p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></span><h3 className="mt-4 text-base font-bold text-foreground">Update Payment Method</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Replace an expired or failed card before retrying the invoice.</p><Button type="button" variant="outline" onClick={() => unavailableBillingAction("Update payment method", overdueInvoiceVariant.id)} className="mt-4 h-10 rounded-lg font-semibold">Update Payment Method</Button></div>
        </div>
        <BillingLifecycle activeStep={1} />
        <InvoiceBreakdown invoice={overdueInvoiceVariant} />
      </SettingsPanel>
    </div>
  );
}
