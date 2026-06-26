import Image from "next/image";
import ScrollReveal from "./ScrollReveal";
import Link from "next/dist/client/link";

const PlatformSection = () => (
  <section className="py-12 sm:py-16 lg:py-20">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tight text-foreground">Launching Soon on iOS, Android &amp; Web</h2>
        </div>
      </ScrollReveal>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ScrollReveal>
          <div className="bg-secondary/30 rounded-3xl p-10 flex flex-col items-center overflow-hidden relative h-full">
            <div className="relative z-10 text-center">
              <h4 className="text-3xl font-bold text-foreground">iOS &amp; Android</h4>
              <p className="mt-4 text-muted-foreground max-w-sm mx-auto">
                A patient-centric app built for easy recovery logging even on low-bandwidth networks.
              </p>
            </div>
            <div className="mt-8 max-w-70 mx-auto">
              <Image src="/mobile-app-mockup.png" alt="Tracmedy mobile app preview" width={280} height={560} className="w-full h-auto rounded-2xl" />
            </div>
            <div className="mt-6 flex gap-4 flex-wrap justify-center">
              <a href="#" className="block">
                <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" className="h-11" />
              </a>
              <a href="#" className="block">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" className="h-11" />
              </a>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="bg-surface border border-border rounded-3xl p-10 flex flex-col justify-between overflow-hidden relative h-full">
            <div className="relative z-10">
              <h4 className="text-3xl font-bold text-foreground">Clinician Web Dashboard</h4>
              <p className="mt-4 text-muted-foreground max-w-sm">
                Hospitals gain real-time visibility into post-discharge recovery, enabling structured follow-ups and early intervention.
              </p>
              <Link href="/welcome" className="inline-block  text-primary  text-sm font-semibold hover:text-[#01317a] transition-colors">
                Request Demo →
              </Link>
            </div>
            <div className="mt-10 rounded-xl overflow-hidden border border-border shadow-lg flex-1 relative min-h-50">
              <Image src="/dashboard-image.png" alt="Data dashboard showing health statistics" fill className="object-cover" />
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default PlatformSection;