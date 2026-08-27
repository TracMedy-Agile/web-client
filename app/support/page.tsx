"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, Headphones, Loader2, Mail, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import TracmedyFooter from "@/app/(landing)/components/TracmedyFooter";
import TracmedyHeader from "@/app/(landing)/components/TracmedyHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupportFaq, submitSupportTicket, type SupportFaq } from "@/lib/api/support";

async function hasAccessToken() {
  const response = await fetch("/api/auth/get-token").catch(() => null);
  if (!response?.ok) return false;

  const payload: unknown = await response.json().catch(() => null);
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as { accessToken?: unknown }).accessToken === "string" &&
      (payload as { accessToken: string }).accessToken.trim(),
  );
}

export default function SupportPage() {
  const router = useRouter();
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [isLoadingFaq, setIsLoadingFaq] = useState(true);
  const [faqError, setFaqError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    getSupportFaq()
      .then((items) => {
        if (!active) return;
        setFaqs(items);
        setOpenFaqId(items[0]?.id ?? null);
        setFaqError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFaqError(error instanceof Error ? error.message : "Unable to load support FAQs.");
      })
      .finally(() => {
        if (active) setIsLoadingFaq(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
      const authenticated = await hasAccessToken();
      if (!authenticated) {
        router.push("/login");
        return;
      }

      await submitSupportTicket({ subject: trimmedSubject, message: trimmedMessage });
      setSubject("");
      setMessage("");
      toast.success("Support ticket submitted.");
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : "Unable to submit support ticket.";
      if (/sign in|session|unauthorized/i.test(messageText)) {
        router.push("/login");
        return;
      }
      toast.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TracmedyHeader />
      <main>
        <section className="bg-surface">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8 lg:py-20">
            <div className="flex flex-col justify-center">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Headphones className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
                Support
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Get help with Tracmedy account access, patient recovery workflows, alerts, appointments, and hospital dashboard questions.
              </p>
              <div className="mt-8 flex flex-col gap-3 text-sm font-semibold text-foreground sm:flex-row sm:items-center">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                  hello@tracmedy.com
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-bold text-foreground">Contact support</h2>
              <div className="mt-6 space-y-5">
                <div>
                  <label htmlFor="support-subject" className="mb-2 block text-sm font-bold text-foreground">
                    Subject
                  </label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Briefly describe the issue"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="support-message" className="mb-2 block text-sm font-bold text-foreground">
                    Message
                  </label>
                  <Textarea
                    id="support-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Share the details our team should know"
                    className="min-h-36 resize-none"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <Button type="submit" className="h-12 w-full rounded-lg text-base font-bold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  Submit ticket
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">Explore our FAQs</h2>

            <div className="mt-10 space-y-4">
              {isLoadingFaq ? (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-sm font-semibold text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  Loading FAQs
                </div>
              ) : null}

              {!isLoadingFaq && faqError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm font-semibold text-destructive">
                  {faqError}
                </div>
              ) : null}

              {!isLoadingFaq && !faqError && faqs.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-sm font-semibold text-muted-foreground">
                  No FAQs are available yet.
                </div>
              ) : null}

              {faqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div key={faq.id} className="rounded-xl border border-border bg-card p-6">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 text-left font-bold text-foreground"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      aria-expanded={isOpen}
                      aria-controls={`support-faq-${faq.id}`}
                    >
                      <span>{faq.question}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {isOpen ? (
                      <p id={`support-faq-${faq.id}`} className="mt-4 text-sm leading-6 text-muted-foreground">
                        {faq.answer}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <TracmedyFooter />
    </div>
  );
}