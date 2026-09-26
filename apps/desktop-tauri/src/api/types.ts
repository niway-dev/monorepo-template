import type { CreateTodo, TodoBase, UpdateTodo } from "@monorepo-template/domain/schemas";
import type { Locale } from "@monorepo-template/i18n";
import type { AppSettings, Locale as NativeLocale, ThemePreference } from "../bindings";

export type { AppSettings, ThemePreference };

/** Theme preference values, for the settings picker. */
export const THEME_PREFERENCES = [
  "system",
  "light",
  "dark",
] as const satisfies readonly ThemePreference[];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/**
 * The Rust core keeps its own `Locale` enum (the tray needs it). These two
 * checks fail `check-types` the moment it and `@monorepo-template/i18n` disagree.
 */
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const localesAgree: Equal<Locale, NativeLocale> = true;
const themesComplete: Equal<(typeof THEME_PREFERENCES)[number], ThemePreference> = true;
void localesAgree;
void themesComplete;

/**
 * Everything the renderer may do, on `window.api`. It has the same shape as the
 * Electron app's preload bridge, so the screens and their tests are portable
 * between the two runtimes.
 */
export interface DesktopApi {
  settings: {
    get(): Promise<AppSettings>;
    setLocale(locale: Locale): Promise<AppSettings>;
    setTheme(theme: ThemePreference): Promise<AppSettings>;
    /** Subscribe to changes made outside the renderer (e.g. the tray). Returns an unsubscribe. */
    onChanged(listener: (settings: AppSettings) => void): () => void;
  };
  todos: {
    list(): Promise<TodoBase[]>;
    create(input: CreateTodo): Promise<TodoBase>;
    update(id: string, input: UpdateTodo): Promise<TodoBase | null>;
    remove(id: string): Promise<boolean>;
  };
}
