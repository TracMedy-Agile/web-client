'use client'
import { useState } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

const navLinks = [
  { label: "The Problem", href: "/#problem" },
  { label: "Solution", href: "/#solution" },
  { label: "How It Works", href: "/#how-it-works" },
];

const TracmedyHeader = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const captureWaitlistClick = () => {
    capturePostHogEvent("waitlist_cta_clicked");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Tracmedy home">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden">
              <Image src="/tracmedy_logo.svg" alt="Tracmedy logo" width={40} height={40} className="h-full w-full object-cover" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-primary">Tracmedy</span>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            {navLinks.map((l) => (
              <Link key={l.href} className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors" href={l.href}>{l.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link className="hidden sm:inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-all" href="/#waitlist" onClick={captureWaitlistClick}>
              Join Waitlist
            </Link>
            <button className="md:hidden flex items-center justify-center h-10 w-10 shrink-0" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 z-50 h-full w-72 bg-surface shadow-2xl p-4 sm:p-8 flex flex-col gap-6 md:hidden"
            >
              <button className="self-end mb-4" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={24} />
              </button>
              {navLinks.map((l) => (
                <Link key={l.href} className="text-lg font-semibold text-foreground hover:text-primary transition-colors" href={l.href} onClick={() => setMobileOpen(false)}>{l.label}</Link>
              ))}
              <Link className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground text-center" href="/#waitlist" onClick={() => {
                captureWaitlistClick();
                setMobileOpen(false);
              }}>Join Waitlist</Link>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default TracmedyHeader;

