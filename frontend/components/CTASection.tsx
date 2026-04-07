"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

export default function CTASection(): ReactElement {
  const rootRef = useRef<HTMLElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const block = blockRef.current;
    const section = rootRef.current;
    if (!block || !section) return;

    let cancelled = false;
    let cleanupTween: (() => void) | null = null;

    const init = async (): Promise<void> => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (cancelled) return;

      const tween = gsap.fromTo(
        block,
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 90%",
            end: "top 40%",
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section
      ref={rootRef}
      id="contatti"
      className="pointer-events-auto sticky top-0 flex min-h-screen w-full items-center justify-center px-6 py-24"
      aria-labelledby="omnia-cta-title"
      data-testid="omnia-cta"
    >
      <div
        ref={blockRef}
        className="mx-auto flex w-full max-w-xl flex-col items-center will-change-transform"
      >
        <h2
          id="omnia-cta-title"
          className="font-display text-center text-5xl font-800 text-white md:text-7xl"
        >
          Pronto a Scalare?
        </h2>
        <p className="font-body mt-6 text-center text-omnia-gray-200">
          Parliamo del tuo prossimo progetto. Nessun commerciale, solo strategia.
        </p>

        <form
          className="mt-14 w-full space-y-8"
          onSubmit={onSubmit}
          data-testid="omnia-cta-form"
        >
          <div>
            <label htmlFor="omnia-name" className="sr-only">
              Nome
            </label>
            <input
              id="omnia-name"
              name="name"
              type="text"
              required
              placeholder="Nome"
              autoComplete="name"
              className="font-body w-full border-b border-omnia-gray-400 bg-transparent py-3 text-white outline-none transition-colors duration-300 placeholder:text-omnia-gray-300 focus:border-omnia-cyan"
              data-testid="omnia-cta-name"
            />
          </div>
          <div>
            <label htmlFor="omnia-email" className="sr-only">
              Email
            </label>
            <input
              id="omnia-email"
              name="email"
              type="email"
              required
              placeholder="Email"
              autoComplete="email"
              className="font-body w-full border-b border-omnia-gray-400 bg-transparent py-3 text-white outline-none transition-colors duration-300 placeholder:text-omnia-gray-300 focus:border-omnia-cyan"
              data-testid="omnia-cta-email"
            />
          </div>
          <div>
            <label htmlFor="omnia-budget" className="sr-only">
              Budget stimato
            </label>
            <select
              id="omnia-budget"
              name="budget"
              required
              className="font-body w-full cursor-pointer border-b border-omnia-gray-400 bg-transparent py-3 text-white outline-none transition-colors duration-300 focus:border-omnia-cyan"
              data-testid="omnia-cta-budget"
              defaultValue=""
            >
              <option value="" disabled>
                Budget stimato
              </option>
              <option value="5-15">€5k-15k</option>
              <option value="15-50">€15k-50k</option>
              <option value="50+">€50k+</option>
            </select>
          </div>
          <div>
            <label htmlFor="omnia-message" className="sr-only">
              Messaggio
            </label>
            <textarea
              id="omnia-message"
              name="message"
              rows={4}
              required
              placeholder="Messaggio"
              className="font-body w-full resize-none border-b border-omnia-gray-400 bg-transparent py-3 text-white outline-none transition-colors duration-300 placeholder:text-omnia-gray-300 focus:border-omnia-cyan"
              data-testid="omnia-cta-message"
            />
          </div>
          <div className="flex flex-col items-center gap-6 pt-4">
            <button
              type="submit"
              className="font-display rounded-full bg-gradient-to-r from-omnia-cyan to-omnia-magenta px-10 py-4 text-lg font-700 text-omnia-dark transition-transform hover:scale-105"
              data-testid="omnia-cta-submit"
              aria-label="Invia richiesta di contatto"
            >
              Iniziamo
            </button>
            {submitted ? (
              <p
                className="font-body omnia-thanks-fade text-center text-sm text-omnia-cyan"
                role="status"
                data-testid="omnia-cta-thanks"
              >
                Grazie, ti ricontatteremo entro 24h.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
