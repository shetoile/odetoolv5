use serde_json::Value;
use std::path::PathBuf;
use std::process::Child;
use std::sync::Mutex;

pub struct LocalAiState {
    pub server_process: Mutex<Option<Child>>,
}

impl LocalAiState {
    pub fn new() -> Self {
        Self {
            server_process: Mutex::new(None),
        }
    }
}

pub fn get_model_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("models").join("mistral-7b-v0.3.Q4_K_M.gguf"))
}

pub fn is_model_downloaded(app: &tauri::AppHandle) -> bool {
    get_model_path(app).map(|p| p.exists()).unwrap_or(false)
}

#[tauri::command]
pub async fn start_local_ai_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, LocalAiState>,
) -> Result<String, String> {
    let _ = (app, state);
    Err(crate::AI_REBUILD_DISABLED_MESSAGE.to_string())
}

#[tauri::command]
pub async fn stop_local_ai_server(state: tauri::State<'_, LocalAiState>) -> Result<String, String> {
    let _ = state;
    Err(crate::AI_REBUILD_DISABLED_MESSAGE.to_string())
}

#[tauri::command]
pub async fn check_local_ai_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, LocalAiState>,
) -> Result<Value, String> {
    let _ = state;

    Ok(serde_json::json!({
        "modelDownloaded": is_model_downloaded(&app),
        "serverRunning": false,
        "legacyBackendEnabled": false,
        "message": crate::AI_REBUILD_DISABLED_MESSAGE,
    }))
}
