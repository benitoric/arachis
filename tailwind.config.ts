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
        white: "rgb(var(--c-white) / <alpha-value>)",
        black: "rgb(var(--c-black) / <alpha-value>)",
        gray: {
          50: "rgb(var(--c-gray-50) / <alpha-value>)",
          100: "rgb(var(--c-gray-100) / <alpha-value>)",
          200: "rgb(var(--c-gray-200) / <alpha-value>)",
          300: "rgb(var(--c-gray-300) / <alpha-value>)",
          400: "rgb(var(--c-gray-400) / <alpha-value>)",
          500: "rgb(var(--c-gray-500) / <alpha-value>)",
          600: "rgb(var(--c-gray-600) / <alpha-value>)",
          700: "rgb(var(--c-gray-700) / <alpha-value>)",
          800: "rgb(var(--c-gray-800) / <alpha-value>)",
          900: "rgb(var(--c-gray-900) / <alpha-value>)",
          950: "rgb(var(--c-gray-950) / <alpha-value>)",
        },

        // ── Brand (fixed — do not flip between modes) ──────────────────────
        // Bright amber from the logo. Used as a FILL (buttons, active states,
        // badges) and always paired with dark `ink` text for contrast.
        brand: {
          light: "rgb(var(--brand-light) / <alpha-value>)",
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
        },
        // Near-black from the logo — text that sits on amber, and dark chrome.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
        },
        // Constant white — for text/icons on always-dark surfaces (sidebar).
        snow: "rgb(var(--snow) / <alpha-value>)",

        // ── Semantic accent (legacy token names kept to avoid mass edits) ───
        // Used as foreground (text/icons/rings) on light surfaces, so it is a
        // deep, legible amber in light mode and bright amber in dark mode.
        chocolate: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark: "rgb(var(--accent-strong) / <alpha-value>)",
          light: "rgb(var(--accent-soft) / <alpha-value>)",
        },
        "dark-red": "rgb(var(--accent-strong) / <alpha-value>)",
        gold: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          light: "rgb(var(--accent-soft) / <alpha-value>)",
          dark: "rgb(var(--accent-strong) / <alpha-value>)",
        },
        // Soft amber wash for badges / empty states / soft headers.
        cream: {
          DEFAULT: "rgb(var(--soft) / <alpha-value>)",
          light: "rgb(var(--soft) / <alpha-value>)",
          dark: "rgb(var(--soft-strong) / <alpha-value>)",
        },
        // Charcoal surfaces (sidebar, login gradient). Dark in both modes.
        navy: {
          DEFAULT: "rgb(var(--charcoal) / <alpha-value>)",
          dark: "rgb(var(--charcoal-deep) / <alpha-value>)",
          medium: "rgb(var(--charcoal-2) / <alpha-value>)",
        },
        coral: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          dark: "rgb(var(--danger-strong) / <alpha-value>)",
        },
        app: {
          bg: "rgb(var(--app-bg) / <alpha-value>)",
          sidebar: "rgb(var(--charcoal) / <alpha-value>)",
          "sidebar-hover": "rgb(var(--charcoal-2) / <alpha-value>)",
          "sidebar-active": "rgb(var(--brand) / <alpha-value>)",
          accent: "rgb(var(--accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--accent-strong) / <alpha-value>)",
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
