"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Scale } from "lucide-react";
import TracmedyFooter from "@/app/(landing)/components/TracmedyFooter";
import TracmedyHeader from "@/app/(landing)/components/TracmedyHeader";
import { getTermsOfService, type TermsOfService } from "@/lib/api/legal";

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
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load terms of service.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
            <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
              {terms?.title || "Terms of Service"}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Review the service terms that apply when using Tracmedy patient, caregiver, and hospital dashboard experiences.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                Loading terms of service
              </div>
            ) : null}

            {!isLoading && error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm font-semibold text-destructive">
                {error}
              </div>
            ) : null}

            {!isLoading && terms && !error ? (
              <article className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
                <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{terms.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-muted-foreground">Last updated: {terms.lastUpdated}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>

                {terms.body.length > 0 ? (
                  <div className="space-y-5 text-sm leading-7 text-muted-foreground sm:text-base">
                    {terms.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">No terms content is available yet.</p>
                )}
              </article>
            ) : null}
          </div>
        </section>
      </main>
      <TracmedyFooter />
    </div>
  );
}