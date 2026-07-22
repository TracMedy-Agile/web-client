import BackToTop from "@/app/(landing)/components/BackToTop";
import FAQSection from "@/app/(landing)/components/FAQSection";
import HowItWorksSection from "@/app/(landing)/components/HowItWorksSection";
import PlatformSection from "@/app/(landing)/components/PlatformSection";
import ProblemSection from "@/app/(landing)/components/ProblemSection";
import SolutionSection from "@/app/(landing)/components/SolutionSection";
import TracmedyFooter from "@/app/(landing)/components/TracmedyFooter";
import TracmedyHeader from "@/app/(landing)/components/TracmedyHeader";
import WaitlistSection from "@/app/(landing)/components/WaitlistSection";
import HeroSection from "@/app/(landing)/components/HeroSection";
import LandingPageTracker from "@/app/(landing)/components/LandingPageTracker";


const LandingPage = () => (
  <div className="min-h-screen bg-background">
    <LandingPageTracker />
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
