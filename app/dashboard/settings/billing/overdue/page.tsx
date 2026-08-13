"use client";

import { useEffect } from "react";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { BillingLifecycle, BillingTabs, InvoiceBreakdown, InvoiceStateCard, overdueInvoice } from "@/app/dashboard/settings/billing/components";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export default function OverdueInvoicePage() {
  useEffect(() => {
    capturePostHogEvent("settings_invoice_state_viewed", { state: "overdue", invoice_id: overdueInvoice.id });
  }, []);

  return (
    <div>
      <SettingsHeader title="Billing & Subscription" description="Review overdue invoice status and payment actions for the current workspace." />
      <BillingTabs />
      <SettingsPanel title="Overdue Invoice" description="This invoice is past the due date and should be resolved to keep billing current.">
        <SaveNotice tone="error">This invoice is overdue. Payment and server invoice actions are waiting for billing backend contracts.</SaveNotice>
        <InvoiceStateCard invoice={overdueInvoice} tone="overdue" />
        <BillingLifecycle activeStep={1} />
        <InvoiceBreakdown invoice={overdueInvoice} />
      </SettingsPanel>
    </div>
  );
}
