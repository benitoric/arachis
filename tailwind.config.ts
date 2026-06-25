import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode controlled by a `.dark` class on <html> (toggle + localStorage)
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Neutrals routed through CSS variables ──────────────────────────
        // The whole gray ramp + white/black resolve to variables that flip in
        // dark mode (see globals.css). This makes the hundreds of existing
        // bg-white / text-gray-* / border-gray-* utilities adapt automatically.
        white: "var(--c-white)",
        black: "var(--c-black)",
        gray: {
          50: "var(--c-gray-50)",
          100: "var(--c-gray-100)",
          200: "var(--c-gray-200)",
          300: "var(--c-gray-300)",
          400: "var(--c-gray-400)",
          500: "var(--c-gray-500)",
          600: "var(--c-gray-600)",
          700: "var(--c-gray-700)",
          800: "var(--c-gray-800)",
          900: "var(--c-gray-900)",
          950: "var(--c-gray-950)",
        },

        // ── Brand ──────────────────────────────────────────────────────────
        // Bright amber from the logo. Used as a FILL (buttons, active states,
        // badges) and always paired with dark `ink` text for contrast.
        brand: {
          light: "#F7CE6B",
          DEFAULT: "#F0B838",
          dark: "#D29A1E",
        },
        // Near-black from the logo — text that sits on amber, and dark chrome.
        ink: {
          DEFAULT: "#1B1C20",
          soft: "#3A3C44",
        },

        // ── Semantic accent (legacy token names kept to avoid mass edits) ───
        // Used as foreground (text/icons/rings) on light surfaces, so it is a
        // deep, legible amber in light mode and bright amber in dark mode.
        chocolate: {
          DEFAULT: "var(--accent)",
          dark: "var(--accent-strong)",
          light: "var(--accent-soft)",
        },
        "dark-red": "var(--accent-strong)",
        gold: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-soft)",
          dark: "var(--accent-strong)",
        },
        // Soft amber wash for badges / empty states / soft headers.
        cream: {
          DEFAULT: "var(--soft)",
          light: "var(--soft)",
          dark: "var(--soft-strong)",
        },
        // Charcoal surfaces (sidebar, login gradient). Dark in both modes.
        navy: {
          DEFAULT: "var(--charcoal)",
          dark: "var(--charcoal-deep)",
          medium: "var(--charcoal-2)",
        },
        coral: {
          DEFAULT: "var(--danger)",
          dark: "var(--danger-strong)",
        },
        app: {
          bg: "var(--app-bg)",
          sidebar: "var(--charcoal)",
          "sidebar-hover": "var(--charcoal-2)",
          "sidebar-active": "#F0B838",
          accent: "var(--accent)",
          "accent-hover": "var(--accent-strong)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
