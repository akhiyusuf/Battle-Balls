import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base: the build works at any path — the Pages workflow serves it
  // at /Battle-Balls/, and the committed docs/ copy works at /Battle-Balls/docs/.
  base: "./",
});
