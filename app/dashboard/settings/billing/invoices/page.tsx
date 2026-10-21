"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Search } from "lucide-react";
import { Field, inputClassName, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { BillingTabs, formatInvoiceDate, formatInvoiceMoney } from "@/app/dashboard/settings/billing/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getFacilityInvoices, payFacilityInvoice, verifyFacilityPayment, type FacilityInvoice } from "@/lib/api/settings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const pageSize = 6;

type StatusFilter = "all" | FacilityInvoice["status"];

const STATUS_LABELS: Record<FacilityInvoice["status"], string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

function statusLabel(status: string) {
  return STATUS_LABELS[status as FacilityInvoice["status"]] ?? status.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function naira(kobo: number) {
  return formatInvoiceMoney(kobo / 100, "NGN");
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<FacilityInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"error" | "success">("error");

  useEffect(() => {
    capturePostHogEvent("settings_invoices_viewed");
    let isMounted = true;
    const loadInvoices = () => getFacilityInvoices().then((result) => {
      if (isMounted) setInvoices(result.invoices);
    });

    // Returning from Paystack (Pay Now) — verify the payment before showing the list.
    const query = new URLSearchParams(window.location.search);
    const reference = query.get("billing") === "invoice" ? query.get("reference") : null;
    const load = reference
      ? verifyFacilityPayment(reference).then((result) => {
          if (!isMounted) return;
          setNoticeTone(result.status === "success" ? "success" : "error");
          setNotice(result.status === "success" ? "Payment verified. The invoice is now marked as paid." : `Payment status: ${result.status}.`);
          window.history.replaceState({}, "", window.location.pathname);
        }).then(loadInvoices)
      : loadInvoices();

    load.catch((error: unknown) => {
      if (!isMounted) return;
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Unable to load invoice history.");
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredInvoices = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const invoiceLabel = (invoice.invoiceNumber || invoice.id).toLowerCase();
      const period = `${invoice.periodStart ?? ""} ${invoice.periodEnd ?? ""}`.toLowerCase();
      const matchesSearch = !normalized || invoiceLabel.includes(normalized) || period.includes(normalized);
      const matchesStatus = status === "all" || invoice.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, status]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleInvoices = filteredInvoices.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function payInvoice(invoice: FacilityInvoice) {
    try {
      const checkout = await payFacilityInvoice(invoice.id, `${window.location.origin}${window.location.pathname}?billing=invoice`);
      if (!checkout.authorizationUrl) throw new Error("The invoice checkout URL was not returned.");
      window.location.assign(checkout.authorizationUrl);
    } catch (error: unknown) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Unable to start invoice payment.");
      toast.error("Unable to start invoice payment.");
    }
  }

  function downloadInvoice(invoice: FacilityInvoice) {
    if (!invoice.downloadUrl) {
      toast.info("Invoice download is not available yet.");
      return;
    }
    window.open(invoice.downloadUrl, "_blank", "noopener,noreferrer");
    capturePostHogEvent("settings_invoice_downloaded", { invoice_id: invoice.id, status: invoice.status });
  }

  function viewInvoice(invoice: FacilityInvoice) {
    if (invoice.downloadUrl) {
      window.open(invoice.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setNoticeTone("error");
    setNotice("A viewable invoice document is not available yet.");
    toast.info("Invoice document is not available yet.");
  }

  function exportInvoices() {
    const rows = [["Invoice", "Period", "Subscription Fee", "Episodes Billed + Charges", "Total", "Status", "Paid On"], ...filteredInvoices.map((invoice) => [
      invoice.invoiceNumber || invoice.id,
      invoice.periodStart && invoice.periodEnd ? `${formatInvoiceDate(invoice.periodStart)} - ${formatInvoiceDate(invoice.periodEnd)}` : "",
      naira(invoice.platformFeeKobo),
      `${invoice.episodeCount} episodes + ${naira(invoice.episodeChargeKobo)}`,
      naira(invoice.amountKobo),
      statusLabel(invoice.status),
      invoice.paidAt ? formatInvoiceDate(invoice.paidAt) : "",
    ])];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "settings-invoices.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    capturePostHogEvent("settings_invoices_exported", { result_count: filteredInvoices.length });
  }

  return <div>
    <SettingsHeader title="Billing & Subscription" description="Search, filter, review, and export hospital subscription invoices." />
    <BillingTabs />
    <SettingsPanel title="Invoices" description="Invoice history is shown in a paginated table with facility-scoped billing data.">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
        <Field label="Search by invoice"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search invoice" className={`${inputClassName} pl-9`} /></div></Field>
        <Field label="Status"><Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setPage(1); }}><SelectTrigger className={selectClassName}><SelectValue placeholder="All status" /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="PENDING_PAYMENT">Pending payment</SelectItem><SelectItem value="OVERDUE">Overdue</SelectItem><SelectItem value="PAID">Paid</SelectItem><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></Field>
        <Button type="button" variant="outline" onClick={exportInvoices} className="h-11 rounded-lg px-5 font-semibold"><Download className="h-4 w-4" />Export</Button>
      </div>
      {notice ? <p role="status" className={cn("mt-4 text-sm font-semibold", noticeTone === "success" ? "text-emerald-700" : "text-destructive")}>{notice}</p> : null}
      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-background"><div className="overflow-x-auto"><table aria-label="Invoice history" className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-card text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Invoice</th><th className="px-4 py-3 font-bold">Period</th><th className="px-4 py-3 text-right font-bold">Subscription Fee</th><th className="px-4 py-3 font-bold">Episodes Billed + Charges</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Total</th><th className="px-4 py-3 text-right font-bold">Actions</th></tr></thead><tbody className="divide-y divide-border">{visibleInvoices.map((invoice) => <tr key={invoice.id}><td className="whitespace-nowrap px-4 py-4 font-bold text-foreground">{invoice.invoiceNumber || invoice.id}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{invoice.periodStart && invoice.periodEnd ? `${formatInvoiceDate(invoice.periodStart)} – ${formatInvoiceDate(invoice.periodEnd)}` : "—"}</td><td className="whitespace-nowrap px-4 py-4 text-right text-muted-foreground">{naira(invoice.platformFeeKobo)}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{invoice.episodeCount} {invoice.episodeCount === 1 ? "episode" : "episodes"} + {naira(invoice.episodeChargeKobo)}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{statusLabel(invoice.status)}{invoice.status === "PAID" && invoice.paidAt ? <span className="block text-xs">{formatInvoiceDate(invoice.paidAt)}</span> : null}</td><td className="whitespace-nowrap px-4 py-4 text-right font-bold text-foreground">{naira(invoice.amountKobo)}</td><td className="whitespace-nowrap px-4 py-4"><div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => viewInvoice(invoice)} className="h-9 rounded-lg"><Eye className="h-4 w-4" />View</Button><Button type="button" variant="outline" size="sm" onClick={() => downloadInvoice(invoice)} className="h-9 rounded-lg"><Download className="h-4 w-4" />Download</Button>{invoice.canPay ? <Button type="button" size="sm" onClick={() => payInvoice(invoice)} className="h-9 rounded-lg">Pay Now</Button> : null}</div></td></tr>)}</tbody></table></div>{visibleInvoices.length === 0 ? <p className="px-5 py-10 text-center text-muted-foreground">No invoices found</p> : null}</div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Showing {visibleInvoices.length} of {filteredInvoices.length} invoices</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-9 rounded-lg">Previous</Button><span className="flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-bold text-foreground">{safePage} / {totalPages}</span><Button type="button" variant="outline" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-9 rounded-lg">Next</Button></div></div>
    </SettingsPanel>
  </div>;
}