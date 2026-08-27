"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Database, FileText, Loader2, ShieldCheck, Users } from "lucide-react";
import TracmedyFooter from "@/app/(landing)/components/TracmedyFooter";
import TracmedyHeader from "@/app/(landing)/components/TracmedyHeader";
import { getPrivacySummary, type PrivacySummary } from "@/lib/api/legal";

function PolicyList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">No details are available yet.</p>;
  }

  return (
    <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const [policy, setPolicy] = useState<PrivacySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getPrivacySummary()
      .then((summary) => {
        if (!active) return;
        setPolicy(summary);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load privacy policy.");
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
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-primary">Legal</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
              {policy?.title || "Privacy Policy"}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              {policy?.description || "Review how Tracmedy handles patient, caregiver, and hospital data across connected care workflows."}
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                Loading privacy policy
              </div>
            ) : null}

            {!isLoading && error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm font-semibold text-destructive">
                {error}
              </div>
            ) : null}

            {!isLoading && policy && !error ? (
              <div className="grid gap-6">
                <PolicySection title="Stored data">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <PolicyList items={policy.storedData} />
                </PolicySection>

                <PolicySection title="Data usage">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <PolicyList items={policy.dataUsage} />
                </PolicySection>

                <PolicySection title="Access policy">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {policy.accessPolicy || "No access policy details are available yet."}
                  </p>
                </PolicySection>

                <PolicySection title="Ownership statement">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {policy.ownershipStatement || "No ownership statement is available yet."}
                  </p>
                </PolicySection>
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <TracmedyFooter />
    </div>
  );
}