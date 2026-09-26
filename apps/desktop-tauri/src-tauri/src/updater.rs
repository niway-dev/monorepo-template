//! Background auto-update, release builds only.
//!
//! On launch the app checks the endpoint in `tauri.conf.json`
//! (`plugins.updater`), and if a newer signed build exists it downloads and
//! installs it; the new version runs from the next launch. The check lives here,
//! in Rust, so the webview needs no updater permission at all.
//!
//! A fresh clone ships a placeholder endpoint and public key, so the check fails
//! and is logged — never fatal. See the README's "Auto-update" section.

use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

pub fn spawn_background_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = check_and_install(&app).await {
            eprintln!("update check failed: {error}");
        }
    });
}

async fn check_and_install(app: &AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await?;
    }
    Ok(())
}
