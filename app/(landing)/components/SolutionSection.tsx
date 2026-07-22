import { BarChart3, Activity, Network } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const cards = [
  { icon: <BarChart3 size={28} />, title: "Structured Recovery", desc: "Automated protocols that guide patients through their recovery journey step-by-step.", variant: "primary" as const },
  { icon: <Activity size={28} />, title: "Real-Time Monitoring", desc: "Immediate alerts for clinicians when patient recovery data deviates from healthy trends.", variant: "secondary" as const },
  { icon: <Network size={28} />, title: "Connected Care System", desc: "A unified layer connecting hospitals, doctors, and patients across the African continent.", variant: "primary" as const },
];

const SolutionSection = () => (
  <section className="py-12 sm:py-16 lg:py-20" id="solution">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="mb-16 text-center lg:text-left">
          <h2 className="text-lg font-bold md:text-3xl tracking-tight text-foreground">Our Solution</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">Tracmedy connects patients and hospitals after discharge through guided monitoring, medication tracking, and real-time clinical visibility.</p>
        </div>
      </ScrollReveal>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {cards.map((c, i) => (
          <ScrollReveal key={c.title} delay={i * 0.15}>
            <div className="group relative flex flex-col gap-6 rounded-2xl border border-border bg-surface p-4 sm:p-8 transition-all hover:border-primary/50 hover:shadow-xl h-full">
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl shadow-lg ${c.variant === "primary" ? "bg-primary text-primary-foreground shadow-primary/20" : "bg-secondary text-secondary-foreground shadow-secondary/20"}`}>
                {c.icon}
              </div>
              <div>
                <h4 className="text-lg font-bold md:text-xl text-foreground">{c.title}</h4>
                <p className="mt-3 text-muted-foreground">{c.desc}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default SolutionSection;


