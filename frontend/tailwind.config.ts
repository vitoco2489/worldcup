import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pitch: "#0f172a",
        card: "#1e293b",
        primary: "#22c55e",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;
