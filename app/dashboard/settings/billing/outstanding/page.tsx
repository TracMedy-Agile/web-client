"use client";

import { useEffect } from "react";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { BillingLifecycle, BillingTabs, InvoiceBreakdown, InvoiceStateCard, outstandingInvoice } from "@/app/dashboard/settings/billing/components";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export default function OutstandingInvoicePage() {
  useEffect(() => {
    capturePostHogEvent("settings_invoice_state_viewed", { state: "outstanding", invoice_id: outstandingInvoice.id });
  }, []);

  return (
    <div>
      <SettingsHeader title="Billing & Subscription" description="Review invoice status and billing actions for the current workspace." />
      <BillingTabs />
      <SettingsPanel title="Outstanding Invoice" description="The latest invoice has been generated and is awaiting payment.">
        <SaveNotice>Invoice payment actions are waiting for billing backend contracts. Download is handled on the frontend.</SaveNotice>
        <InvoiceStateCard invoice={outstandingInvoice} tone="outstanding" />
        <BillingLifecycle activeStep={1} />
        <InvoiceBreakdown invoice={outstandingInvoice} />
      </SettingsPanel>
    </div>
  );
}
