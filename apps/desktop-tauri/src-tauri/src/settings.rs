//! The app's persisted preferences, as a small JSON file in the config dir.
//!
//! Every change — from the renderer or from the tray — goes through [`apply`],
//! so the file, the window theme, the tray menu and the renderer can never
//! disagree.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, State, Theme};
use tauri_specta::Event;

use crate::error::{to_message, Result};
use crate::tray;

/// Mirrors `SUPPORTED_LOCALES` in `@monorepo-template/i18n`. The renderer
/// asserts at compile time that the generated type and the package's `Locale`
/// agree, so adding a locale there without adding it here fails `check-types`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    En,
    Es,
}

impl Locale {
    pub const ALL: [Locale; 2] = [Locale::En, Locale::Es];

    pub fn code(self) -> &'static str {
        match self {
            Locale::En => "en",
            Locale::Es => "es",
        }
    }

    /// Same rule as the package's `normalizeLocale`: "es-419" → es, unknown → en.
    pub fn normalize(input: &str) -> Locale {
        let base = input.split('-').next().unwrap_or_default().to_lowercase();
        Locale::ALL
            .into_iter()
            .find(|locale| locale.code() == base)
            .unwrap_or(Locale::En)
    }
}

/// "system" follows the OS; the renderer resolves it through `prefers-color-scheme`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct AppSettings {
    pub locale: Locale,
    pub theme: ThemePreference,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            locale: Locale::En,
            theme: ThemePreference::System,
        }
    }
}

/// Emitted to every window whenever settings change, wherever the change came from.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct SettingsChanged(pub AppSettings);

/// Partial update, as the setters produce it.
#[derive(Debug, Default, Clone, Copy)]
pub struct SettingsPatch {
    pub locale: Option<Locale>,
    pub theme: Option<ThemePreference>,
}

pub struct SettingsStore {
    path: PathBuf,
    cache: Mutex<AppSettings>,
}

impl SettingsStore {
    /// Takes a path rather than resolving the config dir itself, so it can be
    /// tested against a temp directory without a Tauri runtime.
    pub fn load(path: PathBuf) -> Self {
        let cache = Mutex::new(read(&path));
        Self { path, cache }
    }

    pub fn get(&self) -> AppSettings {
        *self.cache.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn update(&self, patch: SettingsPatch) -> Result<AppSettings> {
        let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        let next = AppSettings {
            locale: patch.locale.unwrap_or(cache.locale),
            theme: patch.theme.unwrap_or(cache.theme),
        };
        write(&self.path, &next)?;
        *cache = next;
        Ok(next)
    }
}

/// A missing, corrupt or hand-edited file must not stop the app from launching:
/// fall back per field and let the next write heal it.
fn read(path: &Path) -> AppSettings {
    let defaults = AppSettings::default();
    let Ok(text) = std::fs::read_to_string(path) else {
        return defaults;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
        return defaults;
    };
    AppSettings {
        locale: value["locale"]
            .as_str()
            .map(Locale::normalize)
            .unwrap_or(defaults.locale),
        theme: serde_json::from_value(value["theme"].clone()).unwrap_or(defaults.theme),
    }
}

/// Write-then-rename: a crash mid-write leaves the previous file intact.
fn write(path: &Path, settings: &AppSettings) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(
        &tmp,
        format!("{}\n", serde_json::to_string_pretty(settings)?),
    )?;
    std::fs::rename(tmp, path)?;
    Ok(())
}

/// Push the theme to every window. The webview's `prefers-color-scheme` follows
/// the window appearance, which is how the renderer picks it up.
pub fn apply_theme(app: &AppHandle, theme: ThemePreference) {
    let native = match theme {
        ThemePreference::System => None,
        ThemePreference::Light => Some(Theme::Light),
        ThemePreference::Dark => Some(Theme::Dark),
    };
    for window in app.webview_windows().values() {
        let _ = window.set_theme(native);
    }
}

/// The single path for every settings change: persist, then fan out.
pub fn apply(app: &AppHandle, patch: SettingsPatch) -> Result<AppSettings> {
    let settings = app.state::<SettingsStore>().update(patch)?;
    apply_theme(app, settings.theme);
    tray::refresh(app, settings.locale)?;
    SettingsChanged(settings).emit(app)?;
    Ok(settings)
}

#[tauri::command]
#[specta::specta]
pub fn settings_get(store: State<'_, SettingsStore>) -> AppSettings {
    store.get()
}

#[tauri::command]
#[specta::specta]
pub fn settings_set_locale(
    app: AppHandle,
    locale: Locale,
) -> std::result::Result<AppSettings, String> {
    apply(
        &app,
        SettingsPatch {
            locale: Some(locale),
            ..Default::default()
        },
    )
    .map_err(to_message)
}

#[tauri::command]
#[specta::specta]
pub fn settings_set_theme(
    app: AppHandle,
    theme: ThemePreference,
) -> std::result::Result<AppSettings, String> {
    apply(
        &app,
        SettingsPatch {
            theme: Some(theme),
            ..Default::default()
        },
    )
    .map_err(to_message)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("desktop-tauri-{name}-{}", uuid::Uuid::new_v4()));
        dir.join("settings.json")
    }

    #[test]
    fn falls_back_to_defaults_without_a_file() {
        assert_eq!(
            SettingsStore::load(temp_path("missing")).get(),
            AppSettings::default()
        );
    }

    #[test]
    fn persists_updates_across_loads() {
        let path = temp_path("persist");
        let store = SettingsStore::load(path.clone());
        store
            .update(SettingsPatch {
                locale: Some(Locale::Es),
                ..Default::default()
            })
            .unwrap();
        let reloaded = SettingsStore::load(path).get();
        assert_eq!(
            reloaded,
            AppSettings {
                locale: Locale::Es,
                theme: ThemePreference::System
            }
        );
    }

    #[test]
    fn sanitizes_a_hand_edited_file_per_field() {
        let path = temp_path("sanitize");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, r#"{ "locale": "es-419", "theme": "neon" }"#).unwrap();
        assert_eq!(
            SettingsStore::load(path).get(),
            AppSettings {
                locale: Locale::Es,
                theme: ThemePreference::System
            }
        );
    }

    #[test]
    fn survives_a_corrupt_file() {
        let path = temp_path("corrupt");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "{ not json").unwrap();
        assert_eq!(SettingsStore::load(path).get(), AppSettings::default());
    }
}
