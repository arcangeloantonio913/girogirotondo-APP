"use client";

import { useEffect, useRef, type ReactElement } from "react";

export default function HeroSection(): ReactElement {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let cancelled = false;
    let cleanupTween: (() => void) | null = null;

    const init = async (): Promise<void> => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (cancelled) return;

      gsap.from(content, {
        opacity: 0,
        duration: 1.1,
        ease: "power2.out",
      });

      const mainEl = document.querySelector("main#main");
      if (!mainEl) return;

      const tween = gsap.to(content, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: mainEl,
          start: "top top",
          end: "+=100vh",
          scrub: true,
        },
      });

      cleanupTween = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    };

    void init();

    return () => {
      cancelled = true;
      cleanupTween?.();
    };
  }, []);

  const scrollToMetodo = (): void => {
    document.getElementById("metodo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="pointer-events-auto sticky top-0 flex h-screen w-full items-center justify-center px-6"
      aria-labelledby="omnia-hero-title"
      data-testid="omnia-hero"
    >
      <div
        ref={contentRef}
        className="mx-auto flex max-w-5xl flex-col items-center text-center will-change-[opacity]"
      >
        <p className="font-body text-xs uppercase tracking-[0.35em] text-omnia-gray-300">
          DIGITAL INFRASTRUCTURE AGENCY
        </p>
        <h1
          id="omnia-hero-title"
          className="font-display mt-6 text-5xl font-800 leading-[0.95] text-white [text-shadow:0_2px_40px_rgba(0,0,0,0.85)] md:text-7xl lg:text-8xl"
        >
          Non Costruiamo Siti Web.{" "}
          <span className="bg-gradient-to-r from-omnia-cyan to-omnia-magenta bg-clip-text text-transparent">
            Macchine da Conversione.
          </span>
        </h1>
        <p className="font-body mt-8 max-w-2xl text-lg font-300 text-omnia-gray-200 md:text-xl">
          Infrastrutture digitali progettate per generare ROI misurabile. Non
          promesse, risultati.
        </p>
        <button
          type="button"
          className="mt-10 rounded-full border border-omnia-cyan px-8 py-3 font-body text-omnia-cyan transition-colors duration-300 hover:bg-omnia-cyan hover:text-omnia-dark"
          data-testid="omnia-hero-cta"
          aria-label="Scopri il metodo Omnia"
          onClick={scrollToMetodo}
        >
          Scopri il Metodo
        </button>
      </div>
    </section>
  );
}
