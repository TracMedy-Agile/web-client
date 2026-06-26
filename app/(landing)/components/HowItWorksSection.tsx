import ScrollReveal from "./ScrollReveal";
 
const steps = [
  { num: 1, title: "Visit Happens", desc: "Patients have a physical or telemedicine consultation.", side: "left" },
  { num: 2, title: "Care Episode Opens", desc: "Instructions, medications, and follow-up plan are activated.", side: "right" },
  { num: 3, title: "Daily Monitoring", desc: "Patient receives guided check-ins and reminders.", side: "left" },
  { num: 4, title: "Early Intervention", desc: "If risk increases, clinicians are alerted before complications escalate.", side: "right" },
];
 
const HowItWorksSection = () => (
  <section className="py-12 sm:py-16 lg:py-20 bg-muted overflow-hidden" id="how-it-works">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="text-center mb-20">
          <h2 className="text-4xl font-black text-foreground">How Tracmedy Works</h2>
          <p className="mt-4 text-lg text-muted-foreground">From discharge to continuous care.</p>
        </div>
      </ScrollReveal>
      <div className="flex flex-col gap-12 max-w-4xl mx-auto">
        {steps.map((s, i) => (
          <ScrollReveal key={s.num} delay={i * 0.1}>
            <div
              className={`flex items-center gap-8 transition-all hover:translate-x-0 hover:rotate-0 ${
                s.side === "left" ? "translate-x-[-20px] rotate-[-1deg]" : "translate-x-[20px] rotate-[1deg]"
              }`}
            >
              {s.side === "left" && (
                <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-black shadow-lg">
                  {s.num}
                </div>
              )}
              <div className={`flex-1 bg-surface p-8 rounded-2xl shadow-md ${s.side === "left" ? "border-l-4 border-primary" : "border-r-4 border-secondary text-right"}`}>
                <h4 className="text-xl font-bold text-primary">{s.title}</h4>
                <p className="mt-2 text-muted-foreground">{s.desc}</p>
              </div>
              {s.side === "right" && (
                <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-2xl font-black shadow-lg">
                  {s.num}
                </div>
              )}
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);
 
export default HowItWorksSection;


