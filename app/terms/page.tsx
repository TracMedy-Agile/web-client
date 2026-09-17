"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Scale } from "lucide-react";
import TracmedyFooter from "@/app/(landing)/components/TracmedyFooter";
import TracmedyHeader from "@/app/(landing)/components/TracmedyHeader";
import { getTermsOfService, type TermsOfService } from "@/lib/api/legal";

const defaultBody = [
  "By accessing or using Tracmedy, you agree to these Terms of Service. If you do not agree, do not use the platform.",
  "Tracmedy is a healthcare continuity and care-coordination platform. It supports post-discharge monitoring, care episodes, tasks, reminders, check-ins, notes, and alerts. Tracmedy is not a substitute for professional medical advice, diagnosis, treatment, or emergency services.",
  "You must provide accurate information, keep your account credentials confidential, and promptly report suspected unauthorised access. You are responsible for activity performed through your account.",
  "Use the platform only for its intended healthcare coordination purpose. Do not misuse the service, interfere with its operation, attempt unauthorised access, reverse-engineer it, upload harmful content, or violate applicable law.",
  "Patients and care teams remain responsible for clinical decisions. Clinicians must review information and use their professional judgment; alerts, reminders, and automated features do not replace clinical assessment.",
  "Tracmedy and its licensors retain rights in the platform, software, designs, text, logos, and other materials. You may use the service only as permitted by these terms and may not copy or redistribute protected materials without permission.",
  "We may suspend or terminate access where necessary to protect users, comply with law, address security concerns, or respond to a material breach of these terms. You may stop using the service at any time.",
  "We may update these terms as the service or legal requirements change. Updated terms will be posted on this page with a revised effective date. Continued use after an update means you accept the revised terms.",
  "To the extent permitted by law, Tracmedy is not liable for indirect or consequential loss arising from use of the platform. Nothing in these terms limits a right or liability that cannot legally be limited.",
  "Questions about these terms can be sent to hello@tracmedy.com. These terms are governed by the applicable laws of the Federal Republic of Nigeria, subject to any mandatory local consumer or privacy rights.",
];

export default function TermsPage() {
  const [terms, setTerms] = useState<TermsOfService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getTermsOfService()
      .then((content) => {
        if (!active) return;
        setTerms(content);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load the latest terms.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const body = terms?.body.length ? terms.body : defaultBody;

  return (
    <div className="min-h-screen bg-background">
      <TracmedyHeader />
      <main>
        <section className="bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Scale className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-primary">Legal</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">{terms?.title || "Terms of Service"}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">These terms explain the rules, responsibilities, and limitations that apply when using Tracmedy.</p>
            <p className="mt-4 text-sm text-muted-foreground">Effective date: February 2026 · Last reviewed: February 2026</p>
          </div>
        </section>

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <article className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Terms of Service</h2>
                  <p className="mt-2 text-sm font-semibold text-muted-foreground">Last updated: {terms?.lastUpdated || "February 2026"}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" aria-hidden="true" /></div>
              </div>
              <div className="space-y-5 text-sm leading-7 text-muted-foreground sm:text-base">
                {body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </article>
            {isLoading ? <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />Checking for the latest terms</div> : null}
            {!isLoading && error ? <p className="mt-6 text-center text-xs text-muted-foreground">The published terms are shown. Latest terms could not be refreshed.</p> : null}
          </div>
        </section>
      </main>
      <TracmedyFooter />
    </div>
  );
}