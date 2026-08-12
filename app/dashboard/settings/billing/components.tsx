"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Download, FileText, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

export type InvoiceStatus = "outstanding" | "overdue" | "paid";

export type SettingsInvoice = {
  id: string;
  status: InvoiceStatus;
  period: string;
  issuedAt: string;
  dueAt: string;
  amount: number;
  currency: string;
  lineItems: Array<{ label: string; quantity: number; amount: number }>;
};

export const outstandingInvoice: SettingsInvoice = {
  id: "INV-2026-008",
  status: "outstanding",
  period: "Aug 1, 2026 - Aug 31, 2026",
  issuedAt: "Aug 1, 2026",
  dueAt: "Aug 15, 2026",
  amount: 0,
  currency: "NGN",
  lineItems: [
    { label: "Active Care Episodes", quantity: 0, amount: 0 },
    { label: "Appointments", quantity: 0, amount: 0 },
    { label: "Active Clinicians", quantity: 0, amount: 0 },
  ],
};

export const overdueInvoice: SettingsInvoice = {
  ...outstandingInvoice,
  id: "INV-2026-007",
  status: "overdue",
  period: "Jul 1, 2026 - Jul 31, 2026",
  issuedAt: "Jul 1, 2026",
  dueAt: "Jul 15, 2026",
};

export const postCancellationOverdueInvoice: SettingsInvoice = {
  ...overdueInvoice,
  id: "INV-2026-007-CANCELLED",
};

export const overdueInvoiceVariant: SettingsInvoice = {
  ...overdueInvoice,
  id: "INV-2026-007-RETRY",
  dueAt: "Jul 22, 2026",
};

export const invoiceHistory: SettingsInvoice[] = [outstandingInvoice, overdueInvoice, { ...outstandingInvoice, id: "INV-2026-006", status: "paid", period: "Jun 1, 2026 - Jun 30, 2026", issuedAt: "Jun 1, 2026", dueAt: "Jun 15, 2026" }];

const tabs = [
  { href: "/dashboard/settings/billing", label: "Current Cycle" },
  { href: "/dashboard/settings/billing/outstanding", label: "Outstanding Invoice" },
  { href: "/dashboard/settings/billing/overdue", label: "Overdue Invoice" },
  { href: "/dashboard/settings/billing/overdue-after-cancellation", label: "After Cancellation" },
  { href: "/dashboard/settings/billing/overdue-variant", label: "Overdue Retry" },
  { href: "/dashboard/settings/billing/invoices", label: "Invoices" },
] as const;

export function BillingTabs() {
  const pathname = usePathname() || "";
  return (
    <nav aria-label="Billing sections" className="mb-5 overflow-x-auto rounded-lg border border-border bg-card p-1 shadow-sm">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return <Link key={tab.href} href={tab.href} className={cn("rounded-md px-4 py-2 text-sm font-bold transition", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{tab.label}</Link>;
        })}
      </div>
    </nav>
  );
}

export function formatInvoiceMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function downloadInvoice(invoice: SettingsInvoice) {
  const rows = [["Invoice", invoice.id], ["Period", invoice.period], ["Issued", invoice.issuedAt], ["Due", invoice.dueAt], ["Status", invoice.status], [], ["Item", "Quantity", "Amount"], ...invoice.lineItems.map((item) => [item.label, String(item.quantity), String(item.amount)])];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${invoice.id.toLowerCase()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  capturePostHogEvent("settings_invoice_downloaded", { invoice_id: invoice.id, status: invoice.status });
}

export function unavailableBillingAction(action: string, invoiceId?: string) {
  capturePostHogEvent("settings_billing_action_unavailable", { action, invoice_id: invoiceId });
  toast.info("Billing endpoint is not available yet.");
}

export function InvoiceStateCard({ invoice, tone }: { invoice: SettingsInvoice; tone: "outstanding" | "overdue" }) {
  const overdue = tone === "overdue";
  const Icon = overdue ? AlertTriangle : ReceiptText;
  return (
    <div className={cn("rounded-lg border p-5", overdue ? "border-destructive/30 bg-destructive/5" : "border-primary/25 bg-primary/5")}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg", overdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}><Icon className="h-6 w-6" /></span>
          <div><p className="text-sm font-bold uppercase text-muted-foreground">{overdue ? "Overdue Invoice" : "Outstanding Invoice"}</p><h2 className="mt-2 text-2xl font-bold text-foreground">{invoice.id}</h2><p className="mt-2 text-sm text-muted-foreground">{invoice.period}</p></div>
        </div>
        <div className="text-left lg:text-right"><p className="text-sm font-semibold text-muted-foreground">Amount Due</p><p className={cn("mt-2 text-3xl font-bold", overdue ? "text-destructive" : "text-primary")}>{formatInvoiceMoney(invoice.amount, invoice.currency)}</p><p className="mt-2 text-sm text-muted-foreground">Due {invoice.dueAt}</p></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><Button type="button" onClick={() => unavailableBillingAction("Pay invoice", invoice.id)} className="h-10 rounded-lg px-5 font-semibold">Pay Now</Button><Button type="button" variant="outline" onClick={() => downloadInvoice(invoice)} className="h-10 rounded-lg px-5 font-semibold"><Download className="h-4 w-4" />Download Invoice</Button></div>
    </div>
  );
}

export function InvoiceBreakdown({ invoice }: { invoice: SettingsInvoice }) {
  return <div className="overflow-hidden rounded-lg border border-border bg-background"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-card text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Item</th><th className="px-5 py-3 font-bold">Quantity</th><th className="px-5 py-3 text-right font-bold">Amount</th></tr></thead><tbody className="divide-y divide-border">{invoice.lineItems.map((item) => <tr key={item.label}><td className="px-5 py-4 font-semibold text-foreground"><FileText className="mr-2 inline h-4 w-4 text-primary" />{item.label}</td><td className="px-5 py-4 text-muted-foreground">{item.quantity}</td><td className="px-5 py-4 text-right font-bold text-foreground">{formatInvoiceMoney(item.amount, invoice.currency)}</td></tr>)}</tbody></table></div>;
}

export function BillingLifecycle({ activeStep }: { activeStep: number }) {
  const steps: Array<{ label: string; icon: ReactNode }> = [{ label: "Invoice generated", icon: <FileText className="h-4 w-4" /> }, { label: "Payment pending", icon: <Clock3 className="h-4 w-4" /> }, { label: "Payment received", icon: <CheckCircle2 className="h-4 w-4" /> }];
  return <div className="grid gap-3 md:grid-cols-3">{steps.map((step, index) => <div key={step.label} className={cn("rounded-lg border p-4", index <= activeStep ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground")}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-sm">{step.icon}</span><p className="mt-3 text-sm font-bold">{step.label}</p></div>)}</div>;
}
