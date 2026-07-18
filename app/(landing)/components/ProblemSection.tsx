import ScrollReveal from "./ScrollReveal";
 
const ProblemSection = () => (
  <section className="py-10 sm:py-14 lg:py-16 bg-surface relative overflow-hidden" id="problem">
    {/* Background decoration */}
    <div className="absolute inset-0 pointer-events-none">
      <svg className="absolute top-0 right-0 w-96 h-96 opacity-[0.03]" viewBox="0 0 400 400" fill="none">
        <circle cx="350" cy="50" r="300" className="stroke-primary" strokeWidth="1" />
        <circle cx="350" cy="50" r="200" className="stroke-primary" strokeWidth="1" />
        <circle cx="350" cy="50" r="100" className="stroke-primary" strokeWidth="1" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-80 h-80 opacity-[0.03]" viewBox="0 0 400 400" fill="none">
        <path d="M0 400L400 0M0 300L300 0M0 200L200 0" className="stroke-destructive" strokeWidth="2" />
      </svg>
    </div>
 
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">
      <ScrollReveal>
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-1.5 text-sm font-bold text-destructive mb-6">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" className="stroke-destructive" strokeWidth="1.5" /><path d="M8 5v3.5M8 10.5v.5" className="stroke-destructive" strokeWidth="1.5" strokeLinecap="round" /></svg>
            The Problem
          </div>
          <h2 className="text-lg font-bold md:text-3xl tracking-tight text-foreground">The Visibility Gap</h2>
          <h3 className="mt-2 text-lg sm:text-xl font-semibold text-muted-foreground">Healthcare continuity should not end at discharge.</h3>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Millions of patients are discharged every day with little to no structured follow-up. The gap between hospital care and home recovery remains one of the biggest blind spots in modern healthcare.
          </p>
        </div>
      </ScrollReveal>
 
      {/* Problem 1 - Left illustration, right text */}
      <ScrollReveal>
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12 mb-10 sm:mb-14">
          <div className="flex-shrink-0 w-full max-w-[240px] lg:w-1/3">
            <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              {/* Hospital building */}
              <rect x="100" y="60" width="200" height="180" rx="12" className="fill-primary/5 stroke-primary/30" strokeWidth="2" />
              <rect x="160" y="30" width="80" height="50" rx="8" className="fill-primary/8 stroke-primary/30" strokeWidth="2" />
              {/* Cross */}
              <rect x="188" y="40" width="24" height="6" rx="2" className="fill-primary" />
              <rect x="197" y="33" width="6" height="20" rx="2" className="fill-primary" />
              {/* Windows */}
              <rect x="125" y="90" width="35" height="30" rx="4" className="fill-secondary/20 stroke-primary/20" strokeWidth="1.5" />
              <rect x="182" y="90" width="35" height="30" rx="4" className="fill-secondary/20 stroke-primary/20" strokeWidth="1.5" />
              <rect x="240" y="90" width="35" height="30" rx="4" className="fill-secondary/20 stroke-primary/20" strokeWidth="1.5" />
              <rect x="125" y="140" width="35" height="30" rx="4" className="fill-secondary/20 stroke-primary/20" strokeWidth="1.5" />
              <rect x="240" y="140" width="35" height="30" rx="4" className="fill-secondary/20 stroke-primary/20" strokeWidth="1.5" />
              {/* Door */}
              <rect x="175" y="180" width="50" height="60" rx="6" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
              <circle cx="215" cy="210" r="3" className="fill-primary/40" />
              {/* Patient walking away */}
              <circle cx="320" cy="175" r="12" className="fill-muted-foreground/20 stroke-muted-foreground/40" strokeWidth="2" />
              <path d="M320 187v35M310 210h20M315 222l-8 18M325 222l8 18" className="stroke-muted-foreground/40" strokeWidth="2" strokeLinecap="round" />
              {/* Dotted path from door to patient */}
              <path d="M225 210h30l20-10h20" className="stroke-destructive/40" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
              {/* Question marks */}
              <text x="340" y="170" className="fill-destructive/50" fontSize="18" fontWeight="bold">?</text>
              <text x="350" y="155" className="fill-destructive/30" fontSize="14" fontWeight="bold">?</text>
            </svg>
          </div>
          <div className="lg:w-3/5">
            <h4 className="text-xl text-primary font-bold mb-3">Discharge Without Structure</h4>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Patients leave the hospital with instructions that fade quickly. There&apos;s no structured plan for what comes next — no clear steps, no timeline, and no way to track if recovery is on course.
            </p>
          </div>
        </div>
      </ScrollReveal>
 
      {/* Problem 2 - Right illustration, left text */}
      <ScrollReveal>
        <div className="flex flex-col lg:flex-row-reverse items-center gap-6 lg:gap-12 mb-10 sm:mb-14">
          <div className="flex-shrink-0 w-full max-w-[240px] lg:w-1/3">
            <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              {/* Left circle - Hospital */}
              <circle cx="120" cy="150" r="70" className="fill-primary/5 stroke-primary/30" strokeWidth="2" />
              <path d="M108 140h24M120 128v24" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
              <text x="96" y="185" className="fill-primary/60" fontSize="11" fontWeight="600">Hospital</text>
              {/* Right circle - Patient */}
              <circle cx="280" cy="150" r="70" className="fill-destructive/5 stroke-destructive/30" strokeWidth="2" />
              <circle cx="280" cy="140" r="12" className="fill-muted-foreground/20 stroke-muted-foreground/40" strokeWidth="2" />
              <path d="M280 152v20M272 162h16" className="stroke-muted-foreground/40" strokeWidth="2" strokeLinecap="round" />
              <text x="262" y="185" className="fill-destructive/60" fontSize="11" fontWeight="600">Patient</text>
              {/* Broken connection line */}
              <path d="M190 145h10" className="stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" />
              <path d="M205 145h10" className="stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" />
              {/* X mark in middle */}
              <path d="M196 140l8 10M204 140l-8 10" className="stroke-destructive" strokeWidth="2.5" strokeLinecap="round" />
              {/* Signal waves from patient */}
              <path d="M330 125a30 30 0 010 50" className="stroke-destructive/20" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M340 115a45 45 0 010 70" className="stroke-destructive/15" strokeWidth="2" strokeLinecap="round" fill="none" />
              {/* Small alert dots */}
              <circle cx="355" cy="130" r="4" className="fill-destructive/30" />
              <circle cx="360" cy="165" r="3" className="fill-destructive/20" />
            </svg>
          </div>
          <div className="lg:w-3/5">
            <h4 className="text-xl text-primary font-bold mb-3">Zero Continuous Oversight</h4>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Once a patient walks out, the connection breaks. There&apos;s no visibility into their recovery journey — no data, no updates, and no way for providers to intervene before things go wrong.
            </p>
          </div>
        </div>
      </ScrollReveal>
 
      {/* Problem 3 - Left illustration, right text */}
      <ScrollReveal>
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12 mb-10 sm:mb-14">
          <div className="flex-shrink-0 w-full max-w-[240px] lg:w-1/3">
            <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              {/* House */}
              <path d="M200 60L100 140h20v110h160V140h20L200 60z" className="fill-primary/5 stroke-primary/25" strokeWidth="2" strokeLinejoin="round" />
              {/* Door */}
              <rect x="175" y="195" width="50" height="55" rx="4" className="fill-primary/8 stroke-primary/20" strokeWidth="1.5" />
              <circle cx="215" cy="222" r="3" className="fill-primary/30" />
              {/* Windows */}
              <rect x="125" y="160" width="35" height="28" rx="3" className="fill-secondary/15 stroke-primary/15" strokeWidth="1.5" />
              <rect x="240" y="160" width="35" height="28" rx="3" className="fill-secondary/15 stroke-primary/15" strokeWidth="1.5" />
              {/* Person inside (silhouette) */}
              <circle cx="200" cy="170" r="8" className="fill-muted-foreground/15" />
              <path d="M200 178v15" className="stroke-muted-foreground/20" strokeWidth="2" />
              {/* Warning symbols around house */}
              <circle cx="85" cy="115" r="16" className="fill-destructive/8 stroke-destructive/30" strokeWidth="1.5" />
              <path d="M85 108v8M85 120v2" className="stroke-destructive/50" strokeWidth="2" strokeLinecap="round" />
              <circle cx="315" cy="115" r="16" className="fill-destructive/8 stroke-destructive/30" strokeWidth="1.5" />
              <path d="M315 108v8M315 120v2" className="stroke-destructive/50" strokeWidth="2" strokeLinecap="round" />
              <circle cx="85" cy="220" r="16" className="fill-destructive/8 stroke-destructive/30" strokeWidth="1.5" />
              <path d="M85 213v8M85 225v2" className="stroke-destructive/50" strokeWidth="2" strokeLinecap="round" />
              {/* Wavy lines suggesting symptoms */}
              <path d="M320 180c5-8 10 8 15 0s10 8 15 0" className="stroke-destructive/25" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M320 200c5-8 10 8 15 0s10 8 15 0" className="stroke-destructive/20" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="lg:w-3/5">
            <h4 className="text-xl text-primary font-bold mb-3">Recovery Happens Alone</h4>
            <p className="text-lg text-muted-foreground leading-relaxed">
              At home, symptoms go unnoticed and complications develop quietly. Without support, monitoring, or a structured recovery framework, patients are left to navigate healing entirely on their own.
            </p>
          </div>
        </div>
      </ScrollReveal>
 
      {/* Problem 4 - Right illustration, left text */}
      <ScrollReveal>
        <div className="flex flex-col lg:flex-row-reverse items-center gap-6 lg:gap-12 mb-10 sm:mb-14">
          <div className="flex-shrink-0 w-full max-w-[240px] lg:w-1/3">
            <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              {/* Big warning triangle */}
              <path d="M200 40L60 260h280L200 40z" className="fill-destructive/5 stroke-destructive/25" strokeWidth="2" strokeLinejoin="round" />
              <rect x="194" y="100" width="12" height="80" rx="4" className="fill-destructive/40" />
              <circle cx="200" cy="210" r="8" className="fill-destructive/40" />
              {/* Clock suggesting late */}
              <circle cx="330" cy="80" r="30" className="fill-primary/5 stroke-primary/25" strokeWidth="2" />
              <path d="M330 65v15h12" className="stroke-primary/40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Arrow looping back to hospital */}
              <path d="M90 100c-20 0-30 15-30 30v60c0 15 10 25 25 25h15" className="stroke-muted-foreground/30" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M95 210l10 5-2-10" className="stroke-muted-foreground/30 fill-muted-foreground/20" strokeWidth="1.5" />
              {/* Downward trend line */}
              <path d="M280 240l20-15 20-5 20-20 20-35" className="stroke-destructive/40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="280" cy="240" r="3" className="fill-destructive/50" />
              <circle cx="300" cy="225" r="3" className="fill-destructive/50" />
              <circle cx="320" cy="220" r="3" className="fill-destructive/50" />
              <circle cx="340" cy="200" r="3" className="fill-destructive/50" />
              <circle cx="360" cy="165" r="3" className="fill-destructive/50" />
            </svg>
          </div>
          <div className="lg:w-3/5">
            <h4 className="text-xl text-primary font-bold mb-3">Late Detection, Worse Outcomes</h4>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Hospitals only learn something is wrong when the patient returns — often in worse condition than before. By then, what could have been a simple intervention becomes an emergency readmission.
            </p>
          </div>
        </div>
      </ScrollReveal>
 
      {/* Bottom callout */}
      <ScrollReveal delay={0.2}>
        <div className="relative rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="flex-shrink-0">
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16">
              <circle cx="32" cy="32" r="28" className="fill-primary/10 stroke-primary" strokeWidth="2" />
              <path d="M20 32h24M32 20v24" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
              <path d="M22 22l20 20M42 22L22 42" className="stroke-destructive/30" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xl md:text-xl text-primary font-bold">
              This is not a medical failure — it is a visibility failure.
            </p>
            <p className="mt-2 text-muted-foreground text-base md:text-lg">
              Healthcare today is built around visits. Recovery, however, happens at home — without structure, support, or continuous oversight.
            </p>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);
 
export default ProblemSection;
 
 



