import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-syne)", "Syne", "sans-serif"],
        body: ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
      },
      fontWeight: {
        300: "300",
        800: "800",
      },
      colors: {
        omnia: {
          cyan: "#00F0FF",
          magenta: "#FF00E5",
          dark: "#050508",
          darker: "#020204",
          gray: {
            100: "#E8E8EA",
            200: "#B0B0B8",
            300: "#6B6B78",
            400: "#35353F",
            500: "#1A1A22",
          },
        },
      },
      backgroundImage: {
        "omnia-glow-cyan":
          "radial-gradient(ellipse at center, rgba(0, 240, 255, 0.25) 0%, transparent 70%)",
        "omnia-glow-magenta":
          "radial-gradient(ellipse at center, rgba(255, 0, 229, 0.22) 0%, transparent 70%)",
        "omnia-glow-dual":
          "radial-gradient(ellipse at 30% 40%, rgba(0, 240, 255, 0.18) 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(255, 0, 229, 0.15) 0%, transparent 55%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
