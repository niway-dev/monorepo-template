mod bindings;
mod db;
mod error;
mod settings;
mod todos;
mod tray;
#[cfg(not(debug_assertions))]
mod updater;

use std::sync::Mutex;

use tauri::{Manager, WindowEvent};

/// Composition root. Everything the app depends on is constructed here — the
/// database, the settings store, the tray — and handed to Tauri as managed
/// state, so no command reaches for a global.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let bindings = bindings::builder();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(bindings.invoke_handler())
        .setup(move |app| {
            bindings.mount_events(app);

            let data_dir = app.path().app_data_dir()?;
            let config_dir = app.path().app_config_dir()?;

            app.manage(todos::Db(Mutex::new(db::open(&data_dir.join("app.db"))?)));

            let store = settings::SettingsStore::load(config_dir.join("settings.json"));
            let initial = store.get();
            app.manage(store);

            settings::apply_theme(app.handle(), initial.theme);
            tray::create(app.handle(), initial.locale)?;

            #[cfg(not(debug_assertions))]
            updater::spawn_background_check(app.handle().clone());

            Ok(())
        })
        // Closing the window hides it: the tray stays alive, which is what makes
        // this a background-capable desktop app. Quit lives in the tray menu.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the tauri application");

    app.run(|_app, _event| {
        // macOS: clicking the Dock icon brings the hidden window back. The path is
        // fully qualified because `RunEvent::Reopen` only exists on macOS: an
        // unconditional `use` is an unused import — a clippy error — everywhere else.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = _event {
            tray::show_main_window(_app);
        }
    });
}
