'use client'
import { useState } from "react";
import { toast } from "sonner";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import ScrollReveal from "./ScrollReveal";
import { apiSubmitWaitlist } from "@/lib/api/auth";

type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WaitlistSection = () => {
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    const form = e.currentTarget;
    const formData = new FormData(form);

    const fullName = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const nextFieldErrors: FieldErrors = {};

    if (!fullName) {
      nextFieldErrors.name = "Full name is required.";
    }

    if (!email) {
      nextFieldErrors.email = "Email address is required.";
    } else if (!emailPattern.test(email)) {
      nextFieldErrors.email = "Enter a valid email address.";
    }

    if (!phone) {
      nextFieldErrors.phone = "Phone number is required.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setLoading(true);

    try {
      const result = await apiSubmitWaitlist({ fullName, email, phone });

      if (!result.ok) {
        toast.error(result.message ?? "Failed to subscribe. Please try again.");
        setLoading(false);
        return;
      }

      capturePostHogEvent("waitlist_submitted");
      toast.success("You joined the Tracmedy waitlist.");
      setSubmitted(true);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("A network error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <section
      className="py-12 sm:py-16 lg:py-20 bg-primary text-primary-foreground"
      id="waitlist"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="rounded-3xl bg-primary-foreground/10 backdrop-blur-md p-4 sm:p-8 md:p-16 border border-primary-foreground/20 shadow-2xl text-center">
            <h2 className="text-lg font-bold md:text-3xl mb-4">Join the Waitlist</h2>
            <p className="text-primary-foreground/70 text-lg mb-10 max-w-2xl mx-auto">
              Be the first to know when we launch and receive exclusive early
              access.
            </p>

            {submitted ? (
              <div className="text-2xl font-bold">
                You&apos;re on the list! We&apos;ll be in touch.
              </div>
            ) : (
              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto text-left"
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-primary-foreground/60">
                    Full Name
                  </label>
                  <input
                    name="name"
                    className="w-full rounded-xl bg-primary-foreground/5 border border-primary-foreground/20 px-4 py-3 text-primary-foreground placeholder-primary-foreground/40 focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="John Doe"
                    type="text"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "waitlist-name-error" : undefined}
                    required
                  />
                  {fieldErrors.name && (
                    <p className="text-sm font-semibold text-red-400" id="waitlist-name-error">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-primary-foreground/60">
                    Email Address
                  </label>
                  <input
                    name="email"
                    className="w-full rounded-xl bg-primary-foreground/5 border border-primary-foreground/20 px-4 py-3 text-primary-foreground placeholder-primary-foreground/40 focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="john@hospital.com"
                    type="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "waitlist-email-error" : undefined}
                    required
                  />
                  {fieldErrors.email && (
                    <p className="text-sm font-semibold text-red-400" id="waitlist-email-error">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-primary-foreground/60">
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    className="w-full rounded-xl bg-primary-foreground/5 border border-primary-foreground/20 px-4 py-3 text-primary-foreground placeholder-primary-foreground/40 focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="+234 800 000 0000"
                    type="tel"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "waitlist-phone-error" : undefined}
                    required
                  />
                  {fieldErrors.phone && (
                    <p className="text-sm font-semibold text-red-400" id="waitlist-phone-error">
                      {fieldErrors.phone}
                    </p>
                  )}
                </div>
                <button
                  className="md:col-span-2 h-16 w-full rounded-xl bg-secondary text-secondary-foreground font-bold text-xl hover:brightness-110 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Joining..." : "Secure My Early Access"}
                </button>
              </form>
            )}

            <p className="mt-6 text-sm text-primary-foreground/60">
              By joining, you agree to our privacy policy and terms of service.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default WaitlistSection;


