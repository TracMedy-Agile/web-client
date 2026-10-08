"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, Headphones, Loader2, Mail, Paperclip, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupportFaq, submitSupportTicket, type SupportFaq } from "@/lib/api/support";

export default function HelpSupportPage() {
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoadingFaq, setIsLoadingFaq] = useState(true);
  const [faqError, setFaqError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getSupportFaq()
      .then((items) => {
        if (!active) return;
        setFaqs(items);
        setOpenFaqId(items[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (active) setFaqError(error instanceof Error ? error.message : "Unable to load support FAQs.");
      })
      .finally(() => {
        if (active) setIsLoadingFaq(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleFaqs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return faqs;
    return faqs.filter((faq) => `${faq.question} ${faq.answer}`.toLowerCase().includes(query));
  }, [faqs, search]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject || !trimmedMessage) {
      toast.error("Enter a subject and message before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitSupportTicket({ subject: trimmedSubject, message: trimmedMessage, attachments });
      setSubject("");
      setMessage("");
      setAttachments([]);
      toast.success("Support ticket submitted.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to submit support ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <section className="rounded-2xl bg-primary px-6 py-8 text-white shadow-sm sm:px-8 sm:py-10">
        <div className="flex max-w-2xl items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <Headphones className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">How can we help you?</h1>
            <p className="mt-2 text-sm leading-6 text-white/80 sm:text-base">
              Find answers to common questions or search our help center for guidance.
            </p>
          </div>
        </div>
        <label className="relative mt-7 block max-w-2xl">
          <span className="sr-only">Search help articles</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search for help..."
            className="h-12 rounded-xl border-0 bg-white pl-12 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-white/70"
          />
        </label>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Frequently asked questions</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Browse answers to common Tracmedy questions.</p>
            </div>
            <Headphones className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          </div>

          <div className="mt-5 space-y-3">
            {isLoadingFaq ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border p-8 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" /> Loading FAQs
              </div>
            ) : null}
            {!isLoadingFaq && faqError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm font-semibold text-destructive">{faqError}</div>
            ) : null}
            {!isLoadingFaq && !faqError && visibleFaqs.length === 0 ? (
              <div className="rounded-xl border border-border p-8 text-center text-sm font-semibold text-muted-foreground">No matching help articles found.</div>
            ) : null}
            {visibleFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="rounded-xl border border-border bg-background">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-bold text-foreground"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={`dashboard-support-faq-${faq.id}`}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {isOpen ? <p id={`dashboard-support-faq-${faq.id}`} className="border-t border-border px-4 py-4 text-sm leading-6 text-muted-foreground">{faq.answer}</p> : null}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">Contact support</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Can&apos;t find what you need? Send our team a message and we&apos;ll get back to you.</p>
          <p className="mt-4 text-sm font-bold text-primary">hello@tracmedy.com</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-bold text-foreground">Subject</span>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Briefly describe the issue" disabled={isSubmitting} required />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-foreground">Message</span>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Share the details our team should know" className="min-h-28 resize-none" disabled={isSubmitting} required />
            </label>
            <label htmlFor="dashboard-support-attachments" className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <Paperclip className="h-4 w-4 text-primary" aria-hidden="true" /> Attach screenshots or logs (optional)
              <input id="dashboard-support-attachments" type="file" multiple accept="image/png,image/jpeg,application/pdf,.log,.txt" className="sr-only" disabled={isSubmitting} onChange={(event) => setAttachments(Array.from(event.target.files ?? []))} />
            </label>
            {attachments.length > 0 ? <p className="text-xs text-muted-foreground">{attachments.map((file) => file.name).join(", ")}</p> : null}            <Button type="submit" className="h-11 w-full rounded-xl font-bold" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Send message
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}