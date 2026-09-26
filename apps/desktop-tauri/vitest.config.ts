import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Renderer tests only — the Rust core has its own suite (`bun run test:rust`).
 * Everything runs in jsdom: the screens need a DOM, and Tauri's `mockIPC`
 * installs itself on `window`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
    // Mirrors vite.config.ts: one React for the app and the workspace packages.
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    server: {
      deps: {
        // Vitest externalizes node_modules, so `use-intl` (a dependency of
        // packages/i18n) would resolve React through Node and pick up a second
        // copy. Inlining routes it through Vite, where `dedupe` applies.
        inline: [/use-intl/],
      },
    },
  },
});
