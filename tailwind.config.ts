import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary blue — used for buttons, links, primary actions throughout the app
        chocolate: {
          DEFAULT: "#49789d",
          dark: "#3a6890",
          light: "#6a9cbd",
        },
        // Darker blue — used for button hover states (bg-chocolate hover:bg-dark-red)
        "dark-red": "#3a6890",
        // Accent blue — focus rings, icons, highlights (same family as chocolate)
        gold: {
          DEFAULT: "#49789d",
          light: "#6a9cbd",
          dark: "#3a6890",
        },
        // Light blue tint — soft backgrounds, empty states, badges
        cream: {
          DEFAULT: "#daeaf5",
          light: "#eef5fb",
          dark: "#c5d9ea",
        },
        // Dark navy — sidebar background and dark surfaces
        navy: {
          DEFAULT: "#1e3a52",
          dark: "#16293d",
          medium: "#2d5070",
        },
        // Coral red — secondary accent for destructive actions and alerts
        coral: {
          DEFAULT: "#E8475F",
          dark: "#c0344a",
        },
        app: {
          bg: "#f0f6fb",
          sidebar: "#1e3a52",
          "sidebar-hover": "#2d5070",
          "sidebar-active": "#49789d",
          accent: "#49789d",
          "accent-hover": "#3a6890",
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
