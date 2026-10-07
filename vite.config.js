import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path matches the GitHub Pages project-page URL (repo name).
// Update if the deploy target changes (e.g. a custom domain uses "/").
export default defineConfig({
  plugins: [react()],
  // Pierce County fork (illumipath/system-flow-story-pierce), modified 2026-10-07: SFS_BASE overrides it, e.g. SFS_BASE=/kc/
  // when the build is served from that path on another site.
  base: process.env.SFS_BASE ?? "/system-flow-story/",
});
