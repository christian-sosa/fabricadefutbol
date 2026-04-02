import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        foreground: "#f1f5f9",
        muted: "#94a3b8",
        accent: "#10b981",
        card: "#0f172a",
        border: "#1e293b",
        success: "#15803d",
        danger: "#b91c1c",
        warning: "#d97706"
      }
    }
  },
  plugins: []
};

export default config;
