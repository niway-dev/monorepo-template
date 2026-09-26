import { useEffect } from "react";

/**
 * Toggles the `.dark` class that `@monorepo-template/tokens` keys its dark
 * palette on.
 *
 * There is deliberately no branch on the stored preference here: the Rust core
 * calls `set_theme` on the window from it, and the system webview makes
 * `prefers-color-scheme` follow the window's appearance. So "system", "light" and "dark"
 * all arrive through the same media query, and the OS-level change is picked up
 * for free.
 */
export function ThemeEffect() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (): void => {
      document.documentElement.classList.toggle("dark", query.matches);
    };

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return null;
}
