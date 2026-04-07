import type { ReactElement } from "react";
import Navbar from "@/components/Navbar";
import ScrollProgress from "@/components/ScrollProgress";
import FrameCanvas from "@/components/FrameCanvas";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import MethodSection from "@/components/MethodSection";
import CTASection from "@/components/CTASection";

export default function HomePage(): ReactElement {
  return (
    <>
      <Navbar />
      <ScrollProgress />
      <FrameCanvas />
      <main
        id="main"
        className="pointer-events-none relative z-[2] h-[500vh] bg-transparent"
        data-testid="omnia-main"
      >
        <div className="h-[100vh]">
          <HeroSection />
        </div>
        <div className="h-[50vh]" aria-hidden />
        <div className="h-[100vh]">
          <ServicesSection />
        </div>
        <div className="h-[50vh]" aria-hidden />
        <div className="h-[100vh]">
          <MethodSection />
        </div>
        <div className="h-[50vh]" aria-hidden />
        <div className="relative h-[50vh]">
          <CTASection />
        </div>
      </main>
      <footer
        className="pointer-events-auto relative z-[2] border-t border-omnia-gray-500/40 bg-omnia-darker/90 px-6 py-8 text-center text-xs text-omnia-gray-300"
        data-testid="omnia-gdpr-footer"
      >
        <p>
          Trattiamo i dati secondo il GDPR. Contattaci per informazioni su
          privacy e cookie.
        </p>
      </footer>
    </>
  );
}
