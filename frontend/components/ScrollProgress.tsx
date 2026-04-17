"use client";

import { useEffect, useRef, type ReactElement } from "react";

export default function ScrollProgress(): ReactElement {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    let cancelled = false;
    let tweenKill: (() => void) | null = null;

    const init = async (): Promise<void> => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (cancelled) return;

      const mainEl = document.querySelector("main#main");
      if (!mainEl) return;

      gsap.set(el, { scaleX: 0, transformOrigin: "left center" });

      const tween = gsap.to(el, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: mainEl,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      });

      tweenKill = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    };

    void init();

    return () => {
      cancelled = true;
      tweenKill?.();
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[60] h-[2px] w-full origin-left bg-gradient-to-r from-omnia-cyan to-omnia-magenta will-change-transform"
      ref={barRef}
      aria-hidden
      data-testid="omnia-scroll-progress"
    />
  );
}
