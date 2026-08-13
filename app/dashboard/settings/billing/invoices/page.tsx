"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Search } from "lucide-react";

import { Field, inputClassName, selectClassName, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { BillingTabs, downloadInvoice, formatInvoiceMoney, invoiceHistory, unavailableBillingAction } from "@/app/dashboard/settings/billing/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

const pageSize = 6;

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    capturePostHogEvent("settings_invoices_viewed");
  }, []);

  const filteredInvoices = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return invoiceHistory.filter((invoice) => {
      const matchesSearch = !normalized || invoice.id.toLowerCase().includes(normalized) || invoice.period.toLowerCase().includes(normalized);
      const matchesStatus = status === "all" || invoice.status === status;
      const matchesDate = dateRange === "all" || invoice.period.toLowerCase().includes(dateRange);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [dateRange, search, status]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleInvoices = filteredInvoices.slice((safePage - 1) * pageSize, safePage * pageSize);

  function exportInvoices() {
    const rows = [["Invoice ID", "Status", "Period", "Issued", "Due", "Amount"], ...filteredInvoices.map((invoice) => [invoice.id, invoice.status, invoice.period, invoice.issuedAt, invoice.dueAt, String(invoice.amount)])];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "settings-invoices.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    capturePostHogEvent("settings_invoices_exported", { result_count: filteredInvoices.length });
  }

  return (
    <div>
      <SettingsHeader title="Billing & Subscription" description="Search, filter, review, and export hospital subscription invoices." />
      <BillingTabs />
      <SettingsPanel title="Invoices" description="Invoice history is shown in a paginated table with frontend export support.">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto] lg:items-end">
          <Field label="Search by ID">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search invoice" className={`${inputClassName} pl-9`} /></div>
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="outstanding">Outstanding</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select>
          </Field>
          <Field label="Date Range">
            <Select value={dateRange} onValueChange={(value) => { setDateRange(value); setPage(1); }}><SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All dates</SelectItem><SelectItem value="aug">August 2026</SelectItem><SelectItem value="jul">July 2026</SelectItem><SelectItem value="jun">June 2026</SelectItem></SelectContent></Select>
          </Field>
          <Button type="button" variant="outline" onClick={exportInvoices} className="h-11 rounded-lg px-5 font-semibold"><Download className="h-4 w-4" />Export</Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-card text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Invoice ID</th><th className="px-5 py-3 font-bold">Period</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3 font-bold">Due Date</th><th className="px-5 py-3 text-right font-bold">Amount</th><th className="px-5 py-3 text-right font-bold">Actions</th></tr></thead><tbody className="divide-y divide-border">{visibleInvoices.map((invoice) => <tr key={invoice.id}><td className="px-5 py-4 font-bold text-foreground">{invoice.id}</td><td className="px-5 py-4 text-muted-foreground">{invoice.period}</td><td className="px-5 py-4"><span className={statusClass(invoice.status)}>{invoice.status}</span></td><td className="px-5 py-4 text-muted-foreground">{invoice.dueAt}</td><td className="px-5 py-4 text-right font-bold text-foreground">{formatInvoiceMoney(invoice.amount, invoice.currency)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => unavailableBillingAction("View invoice", invoice.id)} className="h-9 rounded-lg"><Eye className="h-4 w-4" />View</Button><Button type="button" variant="outline" size="sm" onClick={() => downloadInvoice(invoice)} className="h-9 rounded-lg"><Download className="h-4 w-4" />Download</Button>{invoice.status !== "paid" ? <Button type="button" size="sm" onClick={() => unavailableBillingAction("Pay invoice", invoice.id)} className="h-9 rounded-lg">Pay</Button> : null}</div></td></tr>)}</tbody></table></div>
          {visibleInvoices.length === 0 ? <p className="px-5 py-10 text-center text-sm font-semibold text-muted-foreground">No invoices match your filters.</p> : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Showing {visibleInvoices.length} of {filteredInvoices.length} invoices</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-9 rounded-lg">Previous</Button><span className="flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-bold text-foreground">{safePage} / {totalPages}</span><Button type="button" variant="outline" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-9 rounded-lg">Next</Button></div></div>
      </SettingsPanel>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "paid") return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-700";
  if (status === "overdue") return "rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold capitalize text-destructive";
  return "rounded-full bg-primary/10 px-3 py-1 text-xs font-bold capitalize text-primary";
}
