"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { BillingLifecycle, BillingTabs, InvoiceBreakdown, InvoiceStateCard, postCancellationOverdueInvoice } from "@/app/dashboard/settings/billing/components";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export default function OverdueAfterCancellationPage() {
  useEffect(() => {
    capturePostHogEvent("settings_post_cancellation_overdue_viewed", { invoice_id: postCancellationOverdueInvoice.id });
  }, []);

  return (
    <div>
      <SettingsHeader title="Billing & Subscription" description="Review the overdue invoice state after subscription cancellation." />
      <BillingTabs />
      <SettingsPanel title="Overdue Invoice After Cancellation" description="Cancellation does not clear outstanding invoices. The overdue balance remains payable.">
        <SaveNotice tone="error"><span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Subscription cancelled with an overdue invoice still open.</span></SaveNotice>
        <InvoiceStateCard invoice={postCancellationOverdueInvoice} tone="overdue" />
        <BillingLifecycle activeStep={1} />
        <InvoiceBreakdown invoice={postCancellationOverdueInvoice} />
      </SettingsPanel>
    </div>
  );
}
