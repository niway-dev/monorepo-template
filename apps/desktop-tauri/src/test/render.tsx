import type { ReactElement } from "react";
import { render as rtlRender } from "@testing-library/react";
import { I18nRoot } from "@/app/i18n-root";
import { SettingsProvider } from "@/app/settings-context";
import type { AppSettings } from "@/api/types";

const DEFAULT_SETTINGS: AppSettings = { locale: "en", theme: "system" };

/** Renders inside the same providers `main.tsx` mounts, so components see real translations. */
export function renderWithProviders(ui: ReactElement, settings: AppSettings = DEFAULT_SETTINGS) {
  return rtlRender(
    <SettingsProvider initialSettings={settings}>
      <I18nRoot>{ui}</I18nRoot>
    </SettingsProvider>,
  );
}
