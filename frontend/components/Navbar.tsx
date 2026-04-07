"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";

const NAV_LINKS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "servizi", label: "Servizi" },
  { id: "metodo", label: "Metodo" },
  { id: "contatti", label: "Contatti" },
];

export default function Navbar(): ReactElement {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 100);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToId = useCallback((id: string): void => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <nav
      className={`pointer-events-auto fixed left-0 top-0 z-50 w-full transition-colors duration-300 ${
        scrolled
          ? "border-b border-omnia-gray-500/30 bg-omnia-darker/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
      data-testid="omnia-navbar"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5">
        <a
          href="#main"
          className="font-display text-xl font-800 tracking-[0.2em] text-white"
          data-testid="omnia-nav-logo"
          onClick={(e) => {
            e.preventDefault();
            scrollToId("main");
          }}
        >
          OMNIA
        </a>
        <div className="flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className="font-body text-sm tracking-wide text-omnia-gray-200 transition-colors hover:text-omnia-cyan"
              data-testid={`omnia-nav-${link.id}`}
              onClick={() => scrollToId(link.id)}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
