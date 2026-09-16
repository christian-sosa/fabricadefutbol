import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b1210",
        foreground: "#f8fafc",
        muted: "#a7b5ad",
        accent: "#34d399",
        "accent-foreground": "#07120d",
        card: "#111a17",
        border: "#293c31",
        // Keep existing utility classes in the same neutral, green-tinted system.
        slate: {
          50: "#f8fafc",
          100: "#f0f5f1",
          200: "#dde5df",
          300: "#c8d3cb",
          400: "#a7b5ad",
          500: "#8a9e91",
          600: "#62766a",
          700: "#536a5b",
          800: "#293c31",
          900: "#111a17",
          950: "#0b1210"
        },
        success: "#15803d",
        danger: "#b91c1c",
        warning: "#d97706"
      }
    }
  },
  plugins: []
};

export default config;
