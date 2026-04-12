use serde::Serialize;
use std::env;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

pub const APP_UPDATER_EVENT: &str = "odetool://updater";
const AUTO_UPDATE_DISABLE_ENV: &str = "ODETOOL_DISABLE_AUTO_UPDATE";
const AUTO_UPDATE_DEBUG_ENV: &str = "ODETOOL_ENABLE_AUTO_UPDATE_IN_DEBUG";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppUpdaterStatusPayload {
    stage: &'static str,
    message: String,
    version: Option<String>,
    current_version: Option<String>,
    downloaded_bytes: Option<u64>,
    content_length: Option<u64>,
}

fn env_flag(name: &str) -> bool {
    env::var(name)
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

fn emit_updater_status(
    app: &AppHandle,
    stage: &'static str,
    message: impl Into<String>,
    version: Option<String>,
    current_version: Option<String>,
    downloaded_bytes: Option<u64>,
    content_length: Option<u64>,
) {
    let _ = app.emit(
        APP_UPDATER_EVENT,
        AppUpdaterStatusPayload {
            stage,
            message: message.into(),
            version,
            current_version,
            downloaded_bytes,
            content_length,
        },
    );
}

pub fn start_auto_update(app: AppHandle) {
    if env_flag(AUTO_UPDATE_DISABLE_ENV) {
        return;
    }

    if cfg!(debug_assertions) && !env_flag(AUTO_UPDATE_DEBUG_ENV) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        emit_updater_status(
            &app,
            "checking",
            "Checking for updates...",
            None,
            None,
            None,
            None,
        );

        let updater = match app.updater_builder().build() {
            Ok(updater) => updater,
            Err(err) => {
                emit_updater_status(
                    &app,
                    "error",
                    format!("Update check could not start: {err}"),
                    None,
                    None,
                    None,
                    None,
                );
                return;
            }
        };

        let update = match updater.check().await {
            Ok(update) => update,
            Err(err) => {
                emit_updater_status(
                    &app,
                    "error",
                    format!("Update check failed: {err}"),
                    None,
                    None,
                    None,
                    None,
                );
                return;
            }
        };

        let Some(update) = update else {
            emit_updater_status(
                &app,
                "up_to_date",
                "You already have the latest version.",
                None,
                None,
                None,
                None,
            );
            return;
        };

        let next_version = Some(update.version.clone());
        let current_version = Some(update.current_version.clone());
        emit_updater_status(
            &app,
            "available",
            format!("Update {} is available. Downloading now...", update.version),
            next_version.clone(),
            current_version.clone(),
            Some(0),
            None,
        );

        let progress_app = app.clone();
        let progress_version = next_version.clone();
        let progress_current_version = current_version.clone();
        let mut downloaded_bytes = 0u64;
        let download_result = update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded_bytes = downloaded_bytes.saturating_add(chunk_length as u64);
                    emit_updater_status(
                        &progress_app,
                        "downloading",
                        "Downloading update...",
                        progress_version.clone(),
                        progress_current_version.clone(),
                        Some(downloaded_bytes),
                        content_length,
                    );
                },
                || {
                    emit_updater_status(
                        &progress_app,
                        "installing",
                        "Installing update...",
                        progress_version.clone(),
                        progress_current_version.clone(),
                        None,
                        None,
                    );
                },
            )
            .await;

        if let Err(err) = download_result {
            emit_updater_status(
                &app,
                "error",
                format!("Update download failed: {err}"),
                next_version,
                current_version,
                None,
                None,
            );
            return;
        }

        emit_updater_status(
            &app,
            "installed",
            "Update installed. Restarting...",
            None,
            None,
            None,
            None,
        );

        app.restart();
    });
}
