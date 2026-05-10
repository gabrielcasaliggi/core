import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#000814",
          900: "#000d1f",
          800: "#001430",
          700: "#001d45",
          600: "#002459",
          500: "#002d70",
        },
        vertia: {
          // Hyper-Network palette
          indigo:   "#4F46E5",   // Electric Indigo — acento primario de marca
          cyan:     "#06B6D4",   // Cyber Cyan — datos / telemetría
          rose:     "#F43F5E",   // Neon Rose — alertas / ciberseguridad
          green:    "#10B981",   // Emerald Phosphor — estado OK
          amber:    "#F59E0B",   // Warning
          // Legacy (mantener compatibilidad)
          blue:     "#0ea5e9",
          purple:   "#7c3aed",
          red:      "#ef4444",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "ui-monospace", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow":   "ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        "ping-slower": "ping 4s cubic-bezier(0, 0, 0.2, 1) infinite",
        "spin-slow":   "spin 8s linear infinite",
        "spin-xslow":  "spin 16s linear infinite",
        "scan-in":     "scanIn 0.25s steps(8, end) both",
        "blink-once":  "blinkOnce 0.3s steps(3, end) both",
      },
      keyframes: {
        scanIn: {
          "0%":   { clipPath: "inset(0 0 100% 0)", opacity: "0" },
          "60%":  { opacity: "0.7" },
          "100%": { clipPath: "inset(0 0 0% 0)",   opacity: "1" },
        },
        blinkOnce: {
          "0%, 40%, 80%": { opacity: "0" },
          "20%, 60%":     { opacity: "1" },
          "100%":         { opacity: "1" },
        },
      },
      dropShadow: {
        "indigo": ["0 0 6px rgba(79,70,229,0.8)",   "0 0 18px rgba(79,70,229,0.4)"],
        "cyan":   ["0 0 6px rgba(6,182,212,0.7)",   "0 0 14px rgba(6,182,212,0.35)"],
        "rose":   ["0 0 6px rgba(244,63,94,0.8)",   "0 0 16px rgba(244,63,94,0.4)"],
        "green":  ["0 0 6px rgba(16,185,129,0.7)",  "0 0 14px rgba(16,185,129,0.35)"],
        "amber":  ["0 0 6px rgba(245,158,11,0.7)",  "0 0 14px rgba(245,158,11,0.35)"],
        "red":    ["0 0 6px rgba(239,68,68,0.7)",   "0 0 14px rgba(239,68,68,0.35)"],
      },
    },
  },
  plugins: [],
};

export default config;
