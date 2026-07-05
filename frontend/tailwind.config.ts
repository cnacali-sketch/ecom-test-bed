import type { Config } from "tailwindcss";

// Tailwind CSS v4 auto-detects content and reads theme tokens from
// `@theme` in app/globals.css. This file is kept for structural parity /
// editor tooling and to document where to extend the design system if the
// project later needs config-driven (rather than CSS-driven) theme values.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
};

export default config;
