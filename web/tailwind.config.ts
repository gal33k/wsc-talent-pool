import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base:         "var(--bg-base)",
        elevated:     "var(--bg-elevated)",
        hover:        "var(--bg-hover)",
        input:        "var(--bg-input)",
        border:       "var(--border)",
        "border-strong": "var(--border-strong)",
        "border-faint":  "var(--border-faint)",
        text:         "var(--text)",
        dim:          "var(--text-dim)",
        mute:         "var(--text-mute)",
        faint:        "var(--text-faint)",
        accent:       "var(--accent)",
        "accent-hi":  "var(--accent-hi)",
        "accent-dim": "var(--accent-dim)",
        good:         "var(--good)",
        bad:          "var(--bad)",
        warn:         "var(--warn)",
        info:         "var(--info)",
      },
      fontFamily: {
        sans:  ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Instrument Serif", "ui-serif", "Georgia", "serif"],
        mono:  ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.03em",
        tightish: "-0.015em",
      },
    },
  },
  plugins: [],
} satisfies Config;
