import BackToTop from "@/components/landing/BackToTop";
import FAQSection from "@/components/landing/FAQSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import PlatformSection from "@/components/landing/PlatformSection";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import TracmedyFooter from "@/components/landing/TracmedyFooter";
import TracmedyHeader from "@/components/landing/TracmedyHeader";
import WaitlistSection from "@/components/landing/WaitlistSection";
import HeroSection from "@/components/landing/HeroSection";


const LandingPage = () => (
  <div className="min-h-screen bg-background">
    <TracmedyHeader />
    <main>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <PlatformSection />
      <FAQSection />
      <WaitlistSection />
    </main>
    <TracmedyFooter />
    <BackToTop />
  </div>
);

export default LandingPage;
