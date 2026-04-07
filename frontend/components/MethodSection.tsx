"use client";

import { useEffect, useRef, type ReactElement } from "react";

export default function MethodSection(): ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const roasRef = useRef<HTMLSpanElement>(null);
  const loadRef = useRef<HTMLSpanElement>(null);
  const revRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const roasEl = roasRef.current;
    const loadEl = loadRef.current;
    const revEl = revRef.current;
    if (!roasEl || !loadEl || !revEl) return;

    let cancelled = false;
    let stKill: (() => void) | null = null;

    const init = async (): Promise<void> => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (cancelled) return;

      const mainEl = document.querySelector("main#main");
      if (!mainEl) return;

      const st = ScrollTrigger.create({
        trigger: mainEl,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const t = gsap.utils.clamp(0, 1, (self.progress - 0.65) / 0.1);
          const roas = Math.round(gsap.utils.interpolate(0, 340, t));
          const load = Number(gsap.utils.interpolate(0, 1.2, t).toFixed(1));
          const rev = Number(gsap.utils.interpolate(0, 2.8, t).toFixed(1));
          roasEl.textContent = `+${roas}%`;
          loadEl.textContent = `< ${load.toFixed(1)}s`;
          revEl.textContent = `€${rev.toFixed(1)}M`;
        },
      });

      stKill = () => {
        st.kill();
      };

      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });
    };

    void init();

    return () => {
      cancelled = true;
      stKill?.();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="metodo"
      className="pointer-events-auto sticky top-0 flex min-h-screen w-full items-center px-6 py-24"
      aria-labelledby="omnia-method-title"
      data-testid="omnia-method"
    >
      <div className="mx-auto w-full max-w-3xl text-center">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.25em] text-omnia-magenta">
          IL METODO
        </p>
        <h2
          id="omnia-method-title"
          className="font-display mt-4 text-4xl font-700 text-white md:text-6xl"
        >
          Dati Prima. Creatività Dopo. Risultati Sempre.
        </h2>
        <p className="font-body mx-auto mt-8 max-w-2xl text-lg text-omnia-gray-200">
          Ogni progetto parte da un audit tecnico e competitivo. Progettiamo
          l&apos;infrastruttura intorno ai tuoi KPI reali — non intorno a
          template preconfezionati.
        </p>

        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          <div className="will-change-auto">
            <p
              className="font-display text-5xl font-800 text-omnia-cyan"
              aria-live="polite"
            >
              <span ref={roasRef}>+0%</span>
            </p>
            <p className="font-body mt-2 text-sm text-omnia-gray-300">
              ROAS medio
            </p>
          </div>
          <div className="will-change-auto">
            <p
              className="font-display text-5xl font-800 text-omnia-magenta"
              aria-live="polite"
            >
              <span ref={loadRef}>&lt; 0.0s</span>
            </p>
            <p className="font-body mt-2 text-sm text-omnia-gray-300">
              Load Time medio
            </p>
          </div>
          <div className="will-change-auto">
            <p
              className="font-display text-5xl font-800 text-white"
              aria-live="polite"
            >
              <span ref={revRef}>€0.0M</span>
            </p>
            <p className="font-body mt-2 text-sm text-omnia-gray-300">
              Revenue generato per i clienti nel 2024
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
