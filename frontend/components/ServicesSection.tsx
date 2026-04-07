"use client";

import { useEffect, useRef, type ReactElement } from "react";

const SERVICES: ReadonlyArray<{
  title: string;
  body: string;
}> = [
  {
    title: "Performance Marketing",
    body:
      "Campagne Google Ads, Meta e LinkedIn con tracking granulare e ottimizzazione settimanale del ROAS.",
  },
  {
    title: "Sviluppo Web & App",
    body:
      "Architetture headless, e-commerce ad alte prestazioni, e web app su misura con Next.js, React e cloud-native.",
  },
  {
    title: "Strategia & Automazione",
    body:
      "Funnel di conversione, CRM integration e marketing automation che scalano il tuo revenue senza scalare il team.",
  },
];

export default function ServicesSection(): ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const cardsRoot = cardsRef.current;
    if (!section || !cardsRoot) return;

    const cardEls = cardsRoot.querySelectorAll<HTMLElement>("[data-service-card]");
    if (cardEls.length === 0) return;

    let cancelled = false;
    let cleanupTween: (() => void) | null = null;

    const init = async (): Promise<void> => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (cancelled) return;

      const tween = gsap.fromTo(
        cardEls,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          stagger: 0.12,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 95%",
            end: "top 20%",
            scrub: true,
          },
        },
      );

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

  return (
    <section
      ref={sectionRef}
      id="servizi"
      className="pointer-events-auto sticky top-0 flex min-h-screen w-full items-center px-6 py-24"
      aria-labelledby="omnia-services-heading"
      data-testid="omnia-services"
    >
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <h2
            id="omnia-services-heading"
            className="font-body text-xs font-semibold uppercase tracking-[0.25em] text-omnia-cyan"
          >
            COSA FACCIAMO
          </h2>
          <div ref={cardsRef} className="mt-10 flex flex-col gap-5">
            {SERVICES.map((s, i) => (
              <article
                key={s.title}
                data-service-card
                className="rounded-2xl border border-omnia-gray-400/30 bg-omnia-gray-500/40 p-6 backdrop-blur-md will-change-transform"
                data-testid={`omnia-service-card-${i}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <svg
                    className="h-8 w-8 shrink-0 text-omnia-cyan"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M4 16h24M16 4v24"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeOpacity="0.35"
                    />
                  </svg>
                  <h3 className="font-display text-xl font-700 text-white">
                    {s.title}
                  </h3>
                </div>
                <p className="font-body text-omnia-gray-200">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div
          className="pointer-events-none hidden min-h-[40vh] lg:col-span-7 lg:block"
          aria-hidden
        />
      </div>
    </section>
  );
}
