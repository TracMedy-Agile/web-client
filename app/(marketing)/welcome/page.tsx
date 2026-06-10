import Navbar from "@/components/landing/welcome/Navbar";
import FloatingIcons from "@/components/landing/welcome/FloatingIcons";
import HeroSection from "@/components/landing/welcome/HeroSection";
import FeatureCards from "@/components/landing/welcome/FeatureCards";

export default function WelcomePage() {
  return (
    <main
      className="min-h-screen relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #dde8f8 0%, #c5d9f5 30%, #a8c4ef 60%, #3a6fc4 100%)",
      }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 h-52 z-0"
        style={{
          background: "linear-gradient(180deg, transparent 0%, #1a3a8f 100%)",
        }}
      />
      <FloatingIcons />
      <Navbar />
      <HeroSection />
      <FeatureCards />
    </main>
  );
}