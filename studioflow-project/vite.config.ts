import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import studioflowPlugin from "./scripts/lib/vite-studioflow-plugin.mjs";

export default defineConfig({
  plugins: [react(), studioflowPlugin()],
  base: process.env.STUDIOFLOW_BASE_PATH || "/"
});
