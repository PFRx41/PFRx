/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        blue: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        green: {
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        purple: {
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
      },
    },
  },
  plugins: [],
};