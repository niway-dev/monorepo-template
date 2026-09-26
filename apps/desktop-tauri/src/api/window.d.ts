import type { DesktopApi } from "./types";

declare global {
  interface Window {
    /** Installed by `main.tsx` before the first render; replaced by a fake in tests. */
    api: DesktopApi;
  }
}
