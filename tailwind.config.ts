import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f0eee9",
        ink: "#0f172a",
        brand: {
          50:  "#faf4fc",
          100: "#f5e9f9",
          200: "#ebd1f0",
          300: "#d9a7e0",
          400: "#b56dc1",
          500: "#82399F",
          600: "#6f2f88",
          700: "#5b2570",
          800: "#441855",
          900: "#2e0e3b"
        },
        gold: {
          300: "#E2C988",
          400: "#D6B873",
          500: "#C9A961",
          600: "#B08F4A",
          700: "#8E7339"
        },
        estado: {
          pendiente:    "#94a3b8",
          contactado:   "#10806a",
          alta:         "#b91552",
          no_interesado:"#64748b"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
        hand: ["var(--font-hand)", "Caveat", "cursive"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04)",
        card: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        lift: "0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)"
      },
      backgroundImage: {
        "brand-grad": "linear-gradient(135deg, #82399F 0%, #441855 100%)",
        "gold-grad":  "linear-gradient(135deg, #E2C988 0%, #B08F4A 100%)"
      },
      letterSpacing: {
        smallcaps: "0.04em"
      }
    }
  },
  plugins: []
};
export default config;
