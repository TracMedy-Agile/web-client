"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Database, FileText, Loader2, ShieldCheck, Users } from "lucide-react";
import TracmedyFooter from "@/app/(landing)/components/TracmedyFooter";
import TracmedyHeader from "@/app/(landing)/components/TracmedyHeader";
import { getPrivacySummary, type PrivacySummary } from "@/lib/api/legal";

const defaultStoredData = [
  "Account and contact details such as your name, email address, phone number, and role.",
  "Patient and care information entered by you or an authorised healthcare provider, including care episodes, medications, symptoms, notes, and recovery progress.",
  "Technical and usage information such as device, browser, IP address, security events, and interactions with the service.",
];

const defaultDataUsage = [
  "Provide, secure, and maintain the Tracmedy healthcare continuity platform.",
  "Coordinate care episodes, follow-up tasks, reminders, check-ins, and alerts between patients, hospitals, and authorised clinicians.",
  "Respond to support requests, improve reliability, and communicate important service or policy updates.",
  "Meet legal, regulatory, fraud-prevention, and audit obligations.",
];

function PolicyList({ items }: { items: string[] }) {
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
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load the latest policy details.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const storedData = policy?.storedData.length ? policy.storedData : defaultStoredData;
  const dataUsage = policy?.dataUsage.length ? policy.dataUsage : defaultDataUsage;

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
              {policy?.description || "This policy explains what information Tracmedy collects, why we use it, how it is protected, and the choices available to patients, clinicians, hospitals, and visitors."}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Effective date: February 2026 · Last reviewed: February 2026</p>
          </div>
        </section>

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
            <PolicySection title="1. Information we collect">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="h-5 w-5" aria-hidden="true" />
              </div>
              <PolicyList items={storedData} />
            </PolicySection>

            <PolicySection title="2. How we use information">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <PolicyList items={dataUsage} />
            </PolicySection>

            <PolicySection title="3. Health information and care coordination">
              <p className="text-sm leading-6 text-muted-foreground">
                Tracmedy processes health information only to support the care workflow selected by a patient, hospital, or authorised clinician. Care information is used for structured monitoring, recovery follow-up, medication and task coordination, clinical notes, and alerts. Tracmedy is a care coordination tool and does not replace professional medical advice, diagnosis, or emergency services.
              </p>
            </PolicySection>

            <PolicySection title="4. Sharing and disclosure">
              <p className="text-sm leading-6 text-muted-foreground">
                We do not sell personal or health information. Information may be shared with the hospital and clinicians authorised for a patient&apos;s care episode, with vendors that process data on our behalf under confidentiality and security obligations, or when required to comply with law, protect safety, prevent fraud, or enforce our terms.
              </p>
            </PolicySection>

            <PolicySection title="5. Access controls and security">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                We use encrypted connections, access controls, authentication, audit trails, and least-privilege permissions designed to protect information. Hospitals and care teams receive access only to the records and functions authorised for their role and facility. No internet service can guarantee absolute security, so please protect your credentials and contact us promptly about suspected unauthorised access.
              </p>
              {policy?.accessPolicy ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{policy.accessPolicy}</p> : null}
            </PolicySection>

            <PolicySection title="6. Retention and deletion">
              <p className="text-sm leading-6 text-muted-foreground">
                We retain information for as long as needed to provide the service, maintain care continuity, meet legal and clinical recordkeeping obligations, resolve disputes, and enforce agreements. You may request access, correction, or deletion of personal information by contacting hello@tracmedy.com. Some information may need to be retained where the law or a legitimate healthcare recordkeeping obligation requires it.
              </p>
            </PolicySection>

            <PolicySection title="7. Cookies and analytics">
              <p className="text-sm leading-6 text-muted-foreground">
                Tracmedy may use essential cookies or similar technologies to keep sessions secure, remember preferences, understand service performance, and improve the experience. We do not use cookies to sell health information. Browser settings can be used to manage non-essential cookies, although disabling essential cookies may affect functionality.
              </p>
            </PolicySection>

            <PolicySection title="8. Your choices and rights">
              <p className="text-sm leading-6 text-muted-foreground">
                Depending on your location and applicable law, you may request access to, correction of, portability of, or deletion of your personal information, object to or restrict certain processing, and withdraw consent where processing is based on consent. Requests can be sent to hello@tracmedy.com; we may verify your identity before responding.
              </p>
            </PolicySection>

            <PolicySection title="9. Children&apos;s privacy">
              <p className="text-sm leading-6 text-muted-foreground">
                Tracmedy is not intended for children to create accounts independently. Where a minor&apos;s information is needed for care, it must be provided or authorised by a parent, guardian, hospital, or other lawful representative.
              </p>
            </PolicySection>

            <PolicySection title="10. Changes and contact">
              <p className="text-sm leading-6 text-muted-foreground">
                We may update this policy as our services or legal obligations change. We will post the updated policy on this page and revise the effective date. Questions, privacy requests, or concerns can be sent to <a className="font-semibold text-primary underline-offset-4 hover:underline" href="mailto:hello@tracmedy.com">hello@tracmedy.com</a>. Tracmedy is based in Lagos, Nigeria.
              </p>
              {policy?.ownershipStatement ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{policy.ownershipStatement}</p> : null}
            </PolicySection>

            {isLoading ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-5 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                Checking for the latest policy details
              </div>
            ) : null}
            {!isLoading && error ? <p className="text-center text-xs text-muted-foreground">The policy is shown with the current published information. Latest policy details could not be refreshed.</p> : null}
          </div>
        </section>
      </main>
      <TracmedyFooter />
    </div>
  );
}