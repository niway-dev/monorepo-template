//! The native tray menu. It is drawn by the OS, so React never sees it — which
//! is why the Rust core needs translations at all.
//!
//! The strings come from the very catalogs the renderer uses
//! (`packages/i18n/messages/*.json`), embedded at compile time. There is no
//! second copy to drift.

use std::sync::OnceLock;

use serde_json::Value;
use tauri::menu::{CheckMenuItem, Menu, MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

use crate::error::Result;
use crate::settings::{self, Locale, SettingsPatch};

const TRAY_ID: &str = "main";
const SHOW_ID: &str = "show";
const QUIT_ID: &str = "quit";
const LOCALE_PREFIX: &str = "locale:";

const EN: &str = include_str!("../../../../packages/i18n/messages/en.json");
const ES: &str = include_str!("../../../../packages/i18n/messages/es.json");

fn catalog(locale: Locale) -> &'static Value {
    static EN_CATALOG: OnceLock<Value> = OnceLock::new();
    static ES_CATALOG: OnceLock<Value> = OnceLock::new();
    let (cell, source) = match locale {
        Locale::En => (&EN_CATALOG, EN),
        Locale::Es => (&ES_CATALOG, ES),
    };
    cell.get_or_init(|| serde_json::from_str(source).expect("i18n catalog is valid JSON"))
}

/// Look up a dotted key ("tray.show"), falling back to English, then to the key.
pub fn translate(locale: Locale, key: &str) -> String {
    let lookup = |locale| {
        key.split('.')
            .try_fold(catalog(locale), |node, part| node.get(part))
            .and_then(Value::as_str)
            .map(str::to_owned)
    };
    lookup(locale)
        .or_else(|| lookup(Locale::En))
        .unwrap_or_else(|| key.to_owned())
}

fn build_menu(app: &AppHandle, locale: Locale) -> Result<Menu<Wry>> {
    let t = |key: &str| translate(locale, key);

    let mut languages = SubmenuBuilder::new(app, t("language.label"));
    for candidate in Locale::ALL {
        let item = CheckMenuItem::with_id(
            app,
            format!("{LOCALE_PREFIX}{}", candidate.code()),
            t(&format!("language.{}", candidate.code())),
            true,
            candidate == locale,
            None::<&str>,
        )?;
        languages = languages.item(&item);
    }

    Ok(MenuBuilder::new(app)
        .item(&MenuItem::with_id(
            app,
            SHOW_ID,
            t("tray.show"),
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&languages.build()?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            QUIT_ID,
            t("tray.quit"),
            true,
            None::<&str>,
        )?)
        .build()?)
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn create(app: &AppHandle, locale: Locale) -> Result<()> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(translate(locale, "common.appName"))
        .menu(&build_menu(app, locale)?)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == SHOW_ID {
                show_main_window(app);
            } else if id == QUIT_ID {
                app.exit(0);
            } else if let Some(code) = id.strip_prefix(LOCALE_PREFIX) {
                let patch = SettingsPatch {
                    locale: Some(Locale::normalize(code)),
                    ..Default::default()
                };
                if let Err(error) = settings::apply(app, patch) {
                    eprintln!("failed to change the locale from the tray: {error}");
                }
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Rebuild the menu — called on every settings change.
pub fn refresh(app: &AppHandle, locale: Locale) -> Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(build_menu(app, locale)?))?;
        tray.set_tooltip(Some(translate(locale, "common.appName")))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn translates_from_the_shared_catalogs() {
        assert_eq!(translate(Locale::En, "tray.quit"), "Quit");
        assert_ne!(translate(Locale::Es, "tray.quit"), "Quit");
    }

    #[test]
    fn falls_back_to_the_key_when_missing() {
        assert_eq!(translate(Locale::Es, "no.such.key"), "no.such.key");
    }

    /// The tray asks for every locale's label; a locale added to Rust but not to
    /// the catalogs would otherwise show a raw key.
    #[test]
    fn every_locale_has_the_tray_strings() {
        for locale in Locale::ALL {
            for key in ["tray.show", "tray.quit", "language.label", "common.appName"] {
                assert_ne!(
                    translate(locale, key),
                    key,
                    "{key} missing for {}",
                    locale.code()
                );
            }
        }
    }
}
