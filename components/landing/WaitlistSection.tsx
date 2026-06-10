'use client'
import { useState } from "react";
import ScrollReveal from "./ScrollReveal";

const WaitlistSection = () => {
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const fullName = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/waitlist/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone }),
      });

      if (!res.ok) {
        const json = await res.json();
        setErrorMsg(json?.message ?? "Failed to subscribe. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setErrorMsg("A network error occurred. Please try again.");
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
          <div className="rounded-3xl bg-primary-foreground/10 backdrop-blur-md p-8 md:p-16 border border-primary-foreground/20 shadow-2xl text-center">
            <h2 className="text-4xl font-black mb-4">Join the Waitlist</h2>
            <p className="text-primary-foreground/70 text-lg mb-10 max-w-2xl mx-auto">
              Be the first to know when we launch and receive exclusive early
              access.
            </p>

            {submitted ? (
              <div className="text-2xl font-bold">
                🎉 You&apos;re on the list! We&apos;ll be in touch.
              </div>
            ) : (
              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto text-left"
                onSubmit={handleSubmit}
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
                    required
                  />
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
                    required
                  />
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
                  />
                </div>
                <button
                  className="md:col-span-2 h-16 w-full rounded-xl bg-secondary text-secondary-foreground font-black text-xl hover:brightness-110 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Joining..." : "Secure My Early Access"}
                </button>
              </form>
            )}

            {errorMsg && (
              <div className="mt-4 p-4 rounded-xl bg-destructive/20 text-destructive border border-destructive/50 text-sm font-bold">
                {errorMsg}
              </div>
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