/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"DM Serif Display"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        sun: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        slate: {
          25: "#fcfcfd",
          75: "#f4f5f7",
        },
      },
    },
  },
  plugins: [],
};
