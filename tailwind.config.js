/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./overlay.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        radiant: "#5fb36a",
        dire: "#c2453a",
        gold: "#e7b94b",
      },
    },
  },
  plugins: [],
};
