'use client'
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from 'framer-motion';
import ScrollReveal from './ScrollReveal';

const faqs = [
  { q: "Is Tracmedy a replacement for hospital systems or EMRs?", a: "No. Tracmedy does not replace hospital EMRs or internal systems. It acts as a post-discharge continuity layer that connects hospital visits to structured recovery monitoring at home. Hospitals continue using their existing systems while Tracmedy extends visibility beyond discharge." },
  { q: "How does Tracmedy reduce avoidable readmissions?", a: "Tracmedy activates structured monitoring after each visit. Patients receive guided check-ins, medication reminders, and follow-up prompts, while clinicians receive early alerts when symptoms worsen or adherence drops. This enables intervention before complications escalate, helping reduce preventable readmissions." },
  { q: "Is patient data secure?", a: "Yes. Tracmedy uses encrypted data transmission and secure cloud infrastructure. Access is role-based, and hospitals only see their own patients. Sensitive data such as QR tokens and health identifiers do not expose raw medical records without authentication." },
  { q: "How does Tracmedy work during a hospital visit?", a: "During a physical or telemedicine consultation, the clinician scans the patient's Tracmedy ID or enters their Health ID. This opens a structured Care Episode that activates monitoring on the patient's mobile app and visibility on the hospital dashboard. Recovery tracking begins immediately after the visit." },
  { q: "Can patients use Tracmedy without a hospital?", a: "Yes. Patients can create an account, store medical records, and track medications independently. However, full continuity features are activated when a hospital or clinician links a Care Episode to the patient's account." },
  { q: "Is Tracmedy available across Africa?", a: "Tracmedy is designed specifically for African healthcare systems and supports mobile and web access. The platform is built to work alongside existing hospital workflows and expand structured post-care monitoring across the region." },
];

const FAQSection = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-surface">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <h2 className="text-center text-3xl font-bold mb-12 text-foreground">Explore our FAQs</h2>
        </ScrollReveal>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <ScrollReveal key={i} delay={i * 0.08}>
              <div className="border border-border rounded-xl p-6">
                <button
                  className="flex w-full items-center justify-between text-left font-bold text-foreground"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span>{f.q}</span>
                  <ChevronDown size={20} className={`shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="mt-4 text-muted-foreground text-sm">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;


