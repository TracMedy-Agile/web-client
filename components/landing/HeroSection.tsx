'use client'
import { motion } from "framer-motion";
import Image from "next/image";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden py-12 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            className="flex flex-col gap-6 sm:gap-8"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-bold text-primary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Healthcare Continuity for Africa
            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl lg:text-7xl">
              From discharge to recovery — <span className="text-primary">without the gaps.</span>
            </h1>

            <p className="text-base sm:text-lg leading-relaxed text-muted-foreground max-w-xl">
              Tracmedy connects patients and hospitals through structured post-care monitoring, so no one is left navigating recovery alone.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a className="flex h-14 items-center justify-center rounded-xl bg-primary px-8 text-base font-bold text-primary-foreground shadow-xl shadow-primary/25 hover:translate-y-[-2px] transition-all" href="#waitlist">
                Join the Waitlist
              </a>
              <a className="flex h-14 items-center justify-center rounded-xl border-2 border-border bg-surface px-8 text-base font-bold text-foreground hover:bg-muted transition-all" href="#how-it-works">
                How It Works
              </a>
            </div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          >
            <div className="relative z-10 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary p-1 shadow-2xl">
              <Image 
                src="/hero-image.jpg" 
                alt="Doctor looking at a digital health dashboard" 
                width={800} 
                height={450}
                className="aspect-video w-full rounded-xl object-cover" 
              />
            </div>
            <div className="absolute -bottom-6 -left-6 z-20 hidden sm:block">
              <div className="glass-card rounded-2xl p-4 shadow-xl flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Patient Recovery</p>
                  <p className="text-lg font-black text-foreground">98% Progress</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;