import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// On GitHub Pages a project site is served from https://<user>.github.io/<repo>/,
// so the production build needs the repo name as its base path. Dev stays at "/".
// If you rename the repo (or use a custom domain / user-site), update BASE.
const BASE = "/tax-calculator/";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? BASE : "/",
}));
