/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0A1929",
        panel: "#0F2A43",
        panel2: "#132F4C",
        line: "#1c3e5e",
        cyan: { DEFAULT: "#22D3EE", bright: "#38BDF8" },
        ink: "#E5EEF5",
        sub: "#7fa3c4",
        pass: "#34D399",
        warn: "#FBBF24",
        fail: "#F87171"
      },
      fontFamily: {
        sans: ["Sarabun", "Prompt", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
