import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Set by `tauri dev` when targeting a physical device on the network.
const host = process.env.TAURI_DEV_HOST;

// Vite options tailored for Tauri: https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
    // Workspace packages (e.g. @monorepo-template/i18n via use-intl) can resolve
    // their own React copy; two Reacts break every hook with "dispatcher is
    // null" and the window renders blank. Force a single instance.
    dedupe: ["react", "react-dom"],
  },
  // Keep Rust compiler errors visible in the terminal.
  clearScreen: false,
  server: {
    // Tauri expects a fixed port (see `build.devUrl` in tauri.conf.json).
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  // Produce code the system webviews (WKWebView, WebView2, WebKitGTK) can run.
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
