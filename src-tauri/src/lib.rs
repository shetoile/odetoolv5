use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::ImageEncoder;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::hash::{Hash, Hasher};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use rust_xlsxwriter::Workbook;
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use tauri::{Emitter, Manager};
use tokio::sync::OnceCell;
#[cfg(target_os = "windows")]
use windows::Globalization::Language;
#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::{HWND, LPARAM, RECT, WPARAM},
    Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS},
    Globalization::{
        GetUserDefaultLocaleName, GetUserDefaultUILanguage, GetUserPreferredUILanguages,
        LCIDToLocaleName, MUI_LANGUAGE_NAME,
    },
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::Input::KeyboardAndMouse::GetKeyboardLayout,
    UI::WindowsAndMessaging::{
        GetWindowRect, GetWindowThreadProcessId, PostMessageW, SetWindowPos, ShowWindow,
        ShowWindowAsync,
        SWP_NOACTIVATE,
        SWP_NOOWNERZORDER, SWP_NOZORDER, SW_MINIMIZE, SW_RESTORE, WM_CLOSE,
    },
};

pub mod ai_server;
pub mod app_updater;
pub mod document_parser;
pub mod ticket_ai;

const ROOT_PARENT_ID: &str = "__ROOT__";
const SCHEMA_SQL: &str = include_str!("../surreal-schema.surql");
const MIRROR_FOLDER_NAME: &str = "ODETool_Pro_Mirror";
const LEGACY_MIRROR_FOLDER_NAMES: [&str; 0] = [];
const INTERNAL_STATE_DIR_NAME: &str = "mirror_state";
const MIRROR_NODE_FILES_DIR_NAME: &str = "node_files";
const MIRROR_SHARE_PACKAGES_DIR_NAME: &str = "share_packages";
const POWERPOINT_PREVIEW_DIR_NAME: &str = "powerpoint_previews";
const QUICK_APP_HTML_INSTANCES_DIR_NAME: &str = "quick_app_html_instances";
const QUICK_APP_HTML_SNAPSHOT_STORE_FILE: &str = "quick_app_html_snapshots.json";
const USER_ACCOUNT_STORE_FILE: &str = "user_accounts.json";
const ODE_CONTEXT_FILE_NAME: &str = ".ode-context";
const MIRROR_PROJECTION_INDEX_FILE: &str = ".ode_projection_index.json";
const PROJECT_PROJECTION_INDEX_FILE: &str = "project_projection_index.json";
const INTERNAL_WORKSPACE_ROOT_PREFIX: &str = "workspace://internal/";
const MAX_PROJECT_IMPORT_NODES: usize = 25_000;
const UPDATE_NODE_CONTENT_QUERY: &str =
    "UPDATE node SET content = $text WHERE nodeId = $node_id OR node_id = $node_id;";
const UPDATE_NODE_DESCRIPTION_QUERY: &str =
    "UPDATE node SET description = $description, updatedAt = $updated_at WHERE nodeId = $node_id OR node_id = $node_id;";
pub(crate) const AI_REBUILD_DISABLED_MESSAGE: &str =
    "Legacy AI is disabled while ODETool AI is being rebuilt.";
const USER_ACCOUNT_STORE_VERSION: u32 = 2;
const QUICK_APP_HTML_SNAPSHOT_STORE_VERSION: u32 = 1;
const USER_ACCOUNT_REMEMBER_SESSION_MIN_MS: i64 = 60 * 60 * 1000;
const USER_ACCOUNT_REMEMBER_SESSION_MAX_MS: i64 = 5 * 365 * 24 * 60 * 60 * 1000;

static DB: OnceCell<Arc<Surreal<Db>>> = OnceCell::const_new();
static WINDOWS_ICON_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct SingleInstanceProbeState {
    activation_count: AtomicU64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowsLanguageSnapshot {
    input_locale: Option<String>,
    ui_locale: Option<String>,
    culture_locale: Option<String>,
    preferred_locales: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuickAppUrlPreview {
    url: String,
    final_url: String,
    title: Option<String>,
    description: Option<String>,
    excerpt: Option<String>,
    content_type: Option<String>,
    reachable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuickAppHtmlSnapshotRecord {
    namespace: String,
    scope: String,
    owner_id: Option<String>,
    owner_label: Option<String>,
    quick_app_id: String,
    title: Option<String>,
    current_url: Option<String>,
    #[serde(default)]
    entries: BTreeMap<String, String>,
    #[serde(default)]
    field_entries: BTreeMap<String, String>,
    document_text: Option<String>,
    updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct QuickAppHtmlSnapshotStore {
    version: u32,
    records: Vec<QuickAppHtmlSnapshotRecord>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncQuickAppHtmlSnapshotInput {
    namespace: String,
    scope: String,
    owner_id: Option<String>,
    owner_label: Option<String>,
    quick_app_id: String,
    title: Option<String>,
    current_url: Option<String>,
    entries: BTreeMap<String, String>,
    field_entries: BTreeMap<String, String>,
    document_text: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuickAppHtmlSnapshotSeed {
    scope: String,
    owner_id: Option<String>,
    owner_label: Option<String>,
    quick_app_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiPromptUserContentPart {
    #[serde(rename = "type")]
    part_type: String,
    text: Option<String>,
    image_url: Option<String>,
}

const TREE_SPREADSHEET_TREE_SHEET_NAME: &str = "Tree";
const TREE_SPREADSHEET_HEADERS: [&str; 5] = [
    "Number",
    "Title",
    "Description",
    "Deliverables",
    "Tasks",
];
const TREE_SPREADSHEET_META_SHEET_NAME: &str = "Meta";
const TREE_SPREADSHEET_META_TITLE_KEY: &str = "title";
const TREE_SPREADSHEET_META_GOAL_KEY: &str = "goal";
const TREE_SPREADSHEET_META_DOCUMENT_NAME_KEY: &str = "documentName";
const TREE_SPREADSHEET_META_OUTPUT_LANGUAGE_KEY: &str = "outputLanguage";
const TREE_SPREADSHEET_META_NOTES_KEY: &str = "notes";
const TREE_SPREADSHEET_META_SOURCE_LABELS_KEY: &str = "sourceLabels";

impl SingleInstanceProbeState {
    fn new() -> Self {
        Self {
            activation_count: AtomicU64::new(0),
        }
    }

    fn mark_activation(&self) -> u64 {
        self.activation_count.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn current_count(&self) -> u64 {
        self.activation_count.load(Ordering::SeqCst)
    }
}

fn windows_powershell_command() -> Command {
    let mut command = Command::new("powershell");
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiRebuildStatusPayload {
    phase: String,
    legacy_surface_enabled: bool,
    legacy_backend_enabled: bool,
    available_workflows: Vec<String>,
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowsWindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowsWindowLayoutState {
    current_bounds: WindowsWindowBounds,
    monitor_bounds: WindowsWindowBounds,
    work_area_bounds: WindowsWindowBounds,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, Default)]
struct WindowsWindowFrameInsets {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowsPrimaryWindowFitOptions {
    prefer_center: Option<bool>,
    fill_work_area: Option<bool>,
    cover_taskbar: Option<bool>,
    margin: Option<i32>,
}

fn db_err<E: std::fmt::Display>(err: E) -> String {
    format!("{err}")
}

fn focus_primary_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn load_embedded_app_icon() -> Result<tauri::image::Image<'static>, String> {
    let rgba = image::load_from_memory_with_format(
        include_bytes!("../icons/icon.png"),
        image::ImageFormat::Png,
    )
    .map_err(|err| format!("failed to decode embedded app icon: {err}"))?
    .into_rgba8();
    let (width, height) = rgba.dimensions();
    Ok(tauri::image::Image::new_owned(rgba.into_raw(), width, height))
}

fn apply_primary_window_icon(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    match load_embedded_app_icon() {
        Ok(icon) => {
            if let Err(err) = window.set_icon(icon) {
                eprintln!("failed to apply primary window icon: {err}");
            }
        }
        Err(err) => {
            eprintln!("{err}");
        }
    }
}

#[cfg(target_os = "windows")]
fn get_primary_webview_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "primary window is not available".to_string())
}

#[cfg(target_os = "windows")]
fn rect_to_windows_window_bounds(rect: RECT) -> WindowsWindowBounds {
    WindowsWindowBounds {
        x: rect.left,
        y: rect.top,
        width: rect.right.saturating_sub(rect.left) as u32,
        height: rect.bottom.saturating_sub(rect.top) as u32,
    }
}

#[cfg(target_os = "windows")]
fn get_windows_window_rect_bounds(hwnd: HWND) -> Result<WindowsWindowBounds, String> {
    let mut rect: RECT = unsafe { std::mem::zeroed() };
    unsafe { GetWindowRect(hwnd, &mut rect) }
        .map_err(|err| format!("failed to read primary window bounds: {err}"))?;
    Ok(rect_to_windows_window_bounds(rect))
}

#[cfg(target_os = "windows")]
fn get_windows_window_visible_rect(hwnd: HWND) -> Result<RECT, String> {
    let mut rect: RECT = unsafe { std::mem::zeroed() };
    unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            (&mut rect as *mut RECT).cast(),
            std::mem::size_of::<RECT>() as u32,
        )
    }
    .map_err(|err| format!("failed to read primary window visible frame bounds: {err}"))?;
    Ok(rect)
}

#[cfg(target_os = "windows")]
fn get_windows_window_visible_bounds(hwnd: HWND) -> Result<WindowsWindowBounds, String> {
    Ok(rect_to_windows_window_bounds(get_windows_window_visible_rect(hwnd)?))
}

#[cfg(target_os = "windows")]
fn get_windows_window_frame_insets(hwnd: HWND) -> WindowsWindowFrameInsets {
    let raw_rect = match {
        let mut rect: RECT = unsafe { std::mem::zeroed() };
        unsafe { GetWindowRect(hwnd, &mut rect) }.map(|_| rect)
    } {
        Ok(rect) => rect,
        Err(_) => return WindowsWindowFrameInsets::default(),
    };
    let visible_rect = match get_windows_window_visible_rect(hwnd) {
        Ok(rect) => rect,
        Err(_) => return WindowsWindowFrameInsets::default(),
    };

    WindowsWindowFrameInsets {
        left: (visible_rect.left - raw_rect.left).max(0),
        top: (visible_rect.top - raw_rect.top).max(0),
        right: (raw_rect.right - visible_rect.right).max(0),
        bottom: (raw_rect.bottom - visible_rect.bottom).max(0),
    }
}

#[cfg(target_os = "windows")]
fn get_windows_window_work_area_bounds(hwnd: HWND) -> Result<WindowsWindowBounds, String> {
    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    if monitor.0.is_null() {
        return Err("failed to resolve the primary monitor for the window".to_string());
    }

    let mut info: MONITORINFO = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
    unsafe { GetMonitorInfoW(monitor, &mut info) }
        .ok()
        .map_err(|err| format!("failed to read the monitor work area: {err}"))?;
    Ok(rect_to_windows_window_bounds(info.rcWork))
}

#[cfg(target_os = "windows")]
fn get_windows_window_monitor_bounds(hwnd: HWND) -> Result<WindowsWindowBounds, String> {
    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    if monitor.0.is_null() {
        return Err("failed to resolve the primary monitor for the window".to_string());
    }

    let mut info: MONITORINFO = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
    unsafe { GetMonitorInfoW(monitor, &mut info) }
        .ok()
        .map_err(|err| format!("failed to read the monitor bounds: {err}"))?;
    Ok(rect_to_windows_window_bounds(info.rcMonitor))
}

#[cfg(target_os = "windows")]
fn build_windows_window_layout_state(hwnd: HWND) -> Result<WindowsWindowLayoutState, String> {
    Ok(WindowsWindowLayoutState {
        current_bounds: get_windows_window_visible_bounds(hwnd)?,
        monitor_bounds: get_windows_window_monitor_bounds(hwnd)?,
        work_area_bounds: get_windows_window_work_area_bounds(hwnd)?,
    })
}

#[cfg(target_os = "windows")]
fn apply_windows_window_bounds(
    hwnd: HWND,
    bounds: &WindowsWindowBounds,
) -> Result<WindowsWindowLayoutState, String> {
    let frame_insets = get_windows_window_frame_insets(hwnd);
    let target_x = bounds.x.saturating_sub(frame_insets.left);
    let target_y = bounds.y.saturating_sub(frame_insets.top);
    let target_width = bounds
        .width
        .max(1)
        .saturating_add(frame_insets.left.max(0) as u32)
        .saturating_add(frame_insets.right.max(0) as u32)
        .min(i32::MAX as u32) as i32;
    let target_height = bounds
        .height
        .max(1)
        .saturating_add(frame_insets.top.max(0) as u32)
        .saturating_add(frame_insets.bottom.max(0) as u32)
        .min(i32::MAX as u32) as i32;
    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        SetWindowPos(
            hwnd,
            None,
            target_x,
            target_y,
            target_width,
            target_height,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
        )
        .map_err(|err| format!("failed to apply primary window bounds: {err}"))?;
    }
    build_windows_window_layout_state(hwnd)
}

#[cfg(target_os = "windows")]
fn fit_windows_window_to_work_area(
    hwnd: HWND,
    options: Option<&WindowsPrimaryWindowFitOptions>,
) -> Result<WindowsWindowLayoutState, String> {
    let current_bounds = get_windows_window_rect_bounds(hwnd)?;
    let monitor_bounds = get_windows_window_monitor_bounds(hwnd)?;
    let work_area_bounds = get_windows_window_work_area_bounds(hwnd)?;
    let margin = options.and_then(|value| value.margin).unwrap_or(0).max(0);
    let fill_work_area = options
        .and_then(|value| value.fill_work_area)
        .unwrap_or(false);
    let cover_taskbar = options
        .and_then(|value| value.cover_taskbar)
        .unwrap_or(false);
    let prefer_center = options
        .and_then(|value| value.prefer_center)
        .unwrap_or(false);
    let target_area_bounds = if cover_taskbar {
        monitor_bounds
    } else {
        work_area_bounds
    };

    let max_width = std::cmp::max(1, target_area_bounds.width as i32 - margin.saturating_mul(2));
    let max_height = std::cmp::max(1, target_area_bounds.height as i32 - margin.saturating_mul(2));
    let target_width = if fill_work_area {
        max_width
    } else {
        std::cmp::min(current_bounds.width.min(i32::MAX as u32) as i32, max_width)
    };
    let target_height = if fill_work_area {
        max_height
    } else {
        std::cmp::min(current_bounds.height.min(i32::MAX as u32) as i32, max_height)
    };

    let mut target_x = current_bounds.x;
    let mut target_y = current_bounds.y;

    if fill_work_area {
        target_x = target_area_bounds.x + margin;
        target_y = target_area_bounds.y + margin;
    } else if prefer_center {
        target_x = target_area_bounds.x + ((target_area_bounds.width as i32 - target_width) / 2);
        target_y = target_area_bounds.y + ((target_area_bounds.height as i32 - target_height) / 2);
    }

    let min_x = target_area_bounds.x + margin;
    let min_y = target_area_bounds.y + margin;
    let max_x = std::cmp::max(
        min_x,
        target_area_bounds.x + target_area_bounds.width as i32 - margin - target_width,
    );
    let max_y = std::cmp::max(
        min_y,
        target_area_bounds.y + target_area_bounds.height as i32 - margin - target_height,
    );
    target_x = target_x.clamp(min_x, max_x);
    target_y = target_y.clamp(min_y, max_y);

    apply_windows_window_bounds(
        hwnd,
        &WindowsWindowBounds {
            x: target_x,
            y: target_y,
            width: target_width as u32,
            height: target_height as u32,
        },
    )
}

#[cfg(target_os = "windows")]
fn minimize_windows_window(hwnd: HWND) {
    unsafe {
        if !ShowWindowAsync(hwnd, SW_MINIMIZE).as_bool() {
            let _ = ShowWindow(hwnd, SW_MINIMIZE);
        }
    }
}

#[cfg(target_os = "windows")]
fn request_close_windows_window(hwnd: HWND) -> Result<(), String> {
    unsafe { PostMessageW(Some(hwnd), WM_CLOSE, WPARAM(0), LPARAM(0)) }
        .map_err(|err| format!("failed to request primary window close: {err}"))
}

fn normalize_windows_extended_path(path: PathBuf) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let raw = path.to_string_lossy();
        if let Some(stripped) = raw.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
        return path;
    }
    #[cfg(not(target_os = "windows"))]
    {
        path
    }
}

fn paths_equal_for_platform(left: &Path, right: &Path) -> bool {
    #[cfg(target_os = "windows")]
    {
        left.to_string_lossy()
            .eq_ignore_ascii_case(right.to_string_lossy().as_ref())
    }
    #[cfg(not(target_os = "windows"))]
    {
        left == right
    }
}

fn normalize_path_for_compare(path: &Path) -> PathBuf {
    normalize_windows_extended_path(path.to_path_buf())
}

fn canonicalize_for_compare(path: &Path) -> Option<PathBuf> {
    if !path.exists() {
        return None;
    }
    fs::canonicalize(path)
        .ok()
        .map(normalize_windows_extended_path)
}

fn path_compare_key(path: &Path) -> String {
    let normalized = canonicalize_for_compare(path).unwrap_or_else(|| normalize_path_for_compare(path));
    let text = normalized.to_string_lossy().trim().to_string();
    #[cfg(target_os = "windows")]
    {
        text.to_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        text
    }
}

fn path_compare_key_from_str(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(path_compare_key(Path::new(trimmed)))
}

fn collect_sibling_file_source_keys(siblings: &[NodeRecord]) -> HashSet<String> {
    siblings
        .iter()
        .filter(|node| node.node_type.eq_ignore_ascii_case("file"))
        .flat_map(|node| {
            ["mirrorFilePath", "importedFromPath"]
                .into_iter()
                .filter_map(|key| {
                    node.properties
                        .get(key)
                        .and_then(|value| value.as_str())
                        .and_then(path_compare_key_from_str)
                })
        })
        .collect()
}

fn paths_refer_to_same_location(left: &Path, right: &Path) -> bool {
    let normalized_left = normalize_path_for_compare(left);
    let normalized_right = normalize_path_for_compare(right);
    if paths_equal_for_platform(&normalized_left, &normalized_right) {
        return true;
    }
    match (
        canonicalize_for_compare(left),
        canonicalize_for_compare(right),
    ) {
        (Some(canonical_left), Some(canonical_right)) => {
            paths_equal_for_platform(&canonical_left, &canonical_right)
        }
        _ => false,
    }
}

fn files_appear_in_sync(source: &Path, target: &Path) -> bool {
    if !target.exists() || !target.is_file() {
        return false;
    }
    if paths_refer_to_same_location(source, target) {
        return true;
    }
    let Ok(source_meta) = fs::metadata(source) else {
        return false;
    };
    let Ok(target_meta) = fs::metadata(target) else {
        return false;
    };
    if source_meta.len() != target_meta.len() {
        return false;
    }
    match (source_meta.modified(), target_meta.modified()) {
        (Ok(source_modified), Ok(target_modified)) => source_modified == target_modified,
        _ => false,
    }
}

fn path_is_within_root(candidate: &Path, root: &Path) -> bool {
    let normalized_candidate = canonicalize_for_compare(candidate)
        .unwrap_or_else(|| normalize_path_for_compare(candidate));
    let normalized_root =
        canonicalize_for_compare(root).unwrap_or_else(|| normalize_path_for_compare(root));

    #[cfg(target_os = "windows")]
    {
        let candidate_text = normalized_candidate
            .to_string_lossy()
            .replace('/', "\\")
            .to_lowercase();
        let mut root_text = normalized_root
            .to_string_lossy()
            .replace('/', "\\")
            .to_lowercase();
        while root_text.ends_with('\\') && root_text.len() > 2 {
            root_text.pop();
        }
        if candidate_text == root_text {
            return true;
        }
        let root_prefix = format!("{root_text}\\");
        candidate_text.starts_with(&root_prefix)
    }
    #[cfg(not(target_os = "windows"))]
    {
        normalized_candidate.starts_with(&normalized_root)
    }
}

fn path_storage_key(path: &Path) -> String {
    let normalized =
        canonicalize_for_compare(path).unwrap_or_else(|| normalize_path_for_compare(path));
    #[cfg(target_os = "windows")]
    {
        return normalized
            .to_string_lossy()
            .replace('/', "\\")
            .to_lowercase();
    }
    #[cfg(not(target_os = "windows"))]
    {
        normalized.to_string_lossy().to_string()
    }
}

fn get_mirror_root_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let desktop = app
        .path()
        .desktop_dir()
        .map_err(|err| format!("failed to resolve desktop path: {err}"))?;
    let mirror_root = desktop.join(MIRROR_FOLDER_NAME);
    if !mirror_root.exists() {
        for legacy_name in LEGACY_MIRROR_FOLDER_NAMES {
            let legacy_path = desktop.join(legacy_name);
            if !legacy_path.exists() {
                continue;
            }
            if let Err(err) = fs::rename(&legacy_path, &mirror_root) {
                eprintln!(
                    "failed to migrate legacy mirror root {:?} to {:?}: {err}",
                    legacy_path, mirror_root
                );
            } else {
                break;
            }
        }
    }
    Ok(mirror_root)
}

fn ensure_mirror_root_exists(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = get_mirror_root_path(app)?;
    fs::create_dir_all(&path)
        .map_err(|err| format!("failed to create mirror root {:?}: {err}", path))?;
    Ok(path)
}

fn get_internal_state_root_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data path: {err}"))?;
    Ok(app_data_dir.join(INTERNAL_STATE_DIR_NAME))
}

fn ensure_internal_state_root_exists(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = get_internal_state_root_path(app)?;
    fs::create_dir_all(&path)
        .map_err(|err| format!("failed to create internal state dir {:?}: {err}", path))?;
    Ok(path)
}

fn get_user_account_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(ensure_internal_state_root_exists(app)?.join(USER_ACCOUNT_STORE_FILE))
}

fn get_quick_app_html_snapshot_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(ensure_internal_state_root_exists(app)?.join(QUICK_APP_HTML_SNAPSHOT_STORE_FILE))
}

fn read_user_account_store(app: &tauri::AppHandle) -> Result<UserAccountStore, String> {
    let path = get_user_account_store_path(app)?;
    if !path.exists() {
        return Ok(UserAccountStore::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|err| format!("failed to read user account store {:?}: {err}", path))?;
    if raw.trim().is_empty() {
        return Ok(UserAccountStore::default());
    }

    let mut store: UserAccountStore = serde_json::from_str(&raw)
        .map_err(|err| format!("failed to decode user account store {:?}: {err}", path))?;
    if store.version == 0 {
        store.version = USER_ACCOUNT_STORE_VERSION;
    }
    Ok(store)
}

fn write_user_account_store(app: &tauri::AppHandle, store: &UserAccountStore) -> Result<(), String> {
    let path = get_user_account_store_path(app)?;
    let payload = serde_json::to_string_pretty(store)
        .map_err(|err| format!("failed to encode user account store: {err}"))?;
    fs::write(&path, payload)
        .map_err(|err| format!("failed to write user account store {:?}: {err}", path))
}

fn read_quick_app_html_snapshot_store(
    app: &tauri::AppHandle,
) -> Result<QuickAppHtmlSnapshotStore, String> {
    let path = get_quick_app_html_snapshot_store_path(app)?;
    if !path.exists() {
        return Ok(QuickAppHtmlSnapshotStore {
            version: QUICK_APP_HTML_SNAPSHOT_STORE_VERSION,
            records: Vec::new(),
        });
    }

    let raw = fs::read_to_string(&path)
        .map_err(|err| format!("failed to read quick app snapshot store {:?}: {err}", path))?;
    if raw.trim().is_empty() {
        return Ok(QuickAppHtmlSnapshotStore {
            version: QUICK_APP_HTML_SNAPSHOT_STORE_VERSION,
            records: Vec::new(),
        });
    }

    let mut store: QuickAppHtmlSnapshotStore = serde_json::from_str(&raw)
        .map_err(|err| format!("failed to decode quick app snapshot store {:?}: {err}", path))?;
    if store.version == 0 {
        store.version = QUICK_APP_HTML_SNAPSHOT_STORE_VERSION;
    }
    Ok(store)
}

fn write_quick_app_html_snapshot_store(
    app: &tauri::AppHandle,
    store: &QuickAppHtmlSnapshotStore,
) -> Result<(), String> {
    let path = get_quick_app_html_snapshot_store_path(app)?;
    let payload = serde_json::to_string_pretty(store)
        .map_err(|err| format!("failed to encode quick app snapshot store: {err}"))?;
    fs::write(&path, payload)
        .map_err(|err| format!("failed to write quick app snapshot store {:?}: {err}", path))
}

fn sanitize_quick_app_snapshot_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn normalize_quick_app_snapshot_entries(
    entries: BTreeMap<String, String>,
) -> BTreeMap<String, String> {
    let mut normalized = BTreeMap::new();
    for (key, value) in entries {
        let trimmed_key = key.trim();
        if trimmed_key.is_empty() {
            continue;
        }
        normalized.insert(trimmed_key.to_string(), value);
    }
    normalized
}

fn sanitize_quick_app_snapshot_document_text(value: Option<String>) -> Option<String> {
    const QUICK_APP_HTML_SNAPSHOT_TEXT_LIMIT: usize = 16_000;
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .map(|entry| {
            let mut truncated = entry;
            if truncated.len() > QUICK_APP_HTML_SNAPSHOT_TEXT_LIMIT {
                truncated.truncate(QUICK_APP_HTML_SNAPSHOT_TEXT_LIMIT);
            }
            truncated
        })
        .filter(|entry| !entry.is_empty())
}

fn sanitize_display_name(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("display name is required".to_string());
    }
    if trimmed.chars().count() > 80 {
        return Err("display name must be 80 characters or fewer".to_string());
    }
    Ok(trimmed.to_string())
}

fn sanitize_username(value: &str) -> Result<String, String> {
    let trimmed = value.trim().to_lowercase();
    if trimmed.len() < 3 {
        return Err("username must be at least 3 characters".to_string());
    }
    if trimmed.len() > 40 {
        return Err("username must be 40 characters or fewer".to_string());
    }
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-')
    {
        return Err("username may only contain letters, numbers, dot, underscore, and dash".to_string());
    }
    Ok(trimmed)
}

fn sanitize_profile_photo_data_url(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if !trimmed.starts_with("data:image/") {
        return Err("profile photo must be an image".to_string());
    }
    if trimmed.len() > 500_000 {
        return Err("profile photo is too large".to_string());
    }
    Ok(Some(trimmed.to_string()))
}

fn sanitize_access_role(value: &str) -> Result<String, String> {
    let trimmed = value.trim().to_uppercase();
    match trimmed.as_str() {
        "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" => Ok(trimmed),
        _ => Err("invalid access role".to_string()),
    }
}

fn sanitize_user_account_license_plan(value: &str) -> Result<String, String> {
    let trimmed = value.trim().to_lowercase();
    match trimmed.as_str() {
        "unlimited" | "daily" | "weekly" | "monthly" | "yearly" => Ok(trimmed),
        _ => Err("invalid license plan".to_string()),
    }
}

fn validate_user_account_password(password: &str) -> Result<(), String> {
    if password.chars().count() < 8 {
        return Err("password must be at least 8 characters".to_string());
    }
    Ok(())
}

fn hash_user_account_password(password: &str) -> Result<String, String> {
    validate_user_account_password(password)?;
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| format!("failed to hash password: {err}"))
}

fn verify_user_account_password(password_hash: &str, password: &str) -> Result<bool, String> {
    let parsed = PasswordHash::new(password_hash)
        .map_err(|err| format!("failed to parse stored password hash: {err}"))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

fn validate_user_account_remember_session_duration_ms(duration_ms: i64) -> Result<i64, String> {
    if duration_ms < USER_ACCOUNT_REMEMBER_SESSION_MIN_MS {
        return Err("remembered sign-in must last at least one hour".to_string());
    }
    if duration_ms > USER_ACCOUNT_REMEMBER_SESSION_MAX_MS {
        return Err("remembered sign-in is too long".to_string());
    }
    Ok(duration_ms)
}

fn resolve_user_account_license_duration_ms(plan: &str) -> Option<i64> {
    match plan {
        "daily" => Some(24 * 60 * 60 * 1000),
        "weekly" => Some(7 * 24 * 60 * 60 * 1000),
        "monthly" => Some(30 * 24 * 60 * 60 * 1000),
        "yearly" => Some(365 * 24 * 60 * 60 * 1000),
        _ => None,
    }
}

fn resolve_user_account_license_expires_at(user: &UserAccountRecord) -> Option<i64> {
    let duration_ms = resolve_user_account_license_duration_ms(&user.license_plan)?;
    let started_at = user.license_started_at?;
    started_at.checked_add(duration_ms)
}

fn resolve_user_account_license_status(user: &UserAccountRecord) -> &'static str {
    if user.license_plan == "unlimited" {
        return "unlimited";
    }
    match resolve_user_account_license_expires_at(user) {
        Some(expires_at) if expires_at < now_ms() => "expired",
        _ => "active",
    }
}

fn is_user_account_license_active(user: &UserAccountRecord) -> bool {
    resolve_user_account_license_status(user) != "expired"
}

fn count_enabled_admin_accounts(users: &[UserAccountRecord], exclude_user_id: Option<&str>) -> usize {
    users.iter()
        .filter(|user| {
            if let Some(excluded) = exclude_user_id {
                if user.user_id == excluded {
                    return false;
                }
            }
            user.is_admin && !user.disabled
        })
        .count()
}

fn sort_user_accounts(users: &mut [UserAccountRecord]) {
    users.sort_by(|left, right| left.username.cmp(&right.username));
}

fn prune_user_account_store(store: &mut UserAccountStore) {
    let now = now_ms();
    let valid_user_ids = store
        .users
        .iter()
        .map(|user| user.user_id.as_str())
        .collect::<HashSet<_>>();
    store.remembered_sessions.retain(|session| {
        session.expires_at > now && valid_user_ids.contains(session.user_id.as_str())
    });
}

fn create_user_account_remembered_session(
    store: &mut UserAccountStore,
    user_id: &str,
    duration_ms: i64,
) -> Result<RememberedUserAccountSessionRecord, String> {
    let duration_ms = validate_user_account_remember_session_duration_ms(duration_ms)?;
    let now = now_ms();
    let expires_at = now
        .checked_add(duration_ms)
        .ok_or_else(|| "remembered sign-in duration is invalid".to_string())?;
    store.remembered_sessions.retain(|session| session.user_id != user_id);
    let session = RememberedUserAccountSessionRecord {
        session_id: uuid::Uuid::new_v4().to_string(),
        user_id: user_id.to_string(),
        token: uuid::Uuid::new_v4().to_string(),
        created_at: now,
        expires_at,
    };
    store.remembered_sessions.push(session.clone());
    Ok(session)
}

fn clear_user_account_remembered_sessions_for_user(store: &mut UserAccountStore, user_id: &str) {
    store.remembered_sessions.retain(|session| session.user_id != user_id);
}

fn build_user_account_auth_result(
    user: &UserAccountRecord,
    remembered_session: Option<&RememberedUserAccountSessionRecord>,
) -> UserAccountAuthResult {
    UserAccountAuthResult {
        user: UserAccountSummary::from(user),
        remembered_session_token: remembered_session.map(|session| session.token.clone()),
        remembered_session_expires_at: remembered_session.map(|session| session.expires_at),
    }
}

fn find_user_account_index_by_id(users: &[UserAccountRecord], user_id: &str) -> Option<usize> {
    users.iter().position(|user| user.user_id == user_id)
}

fn ensure_username_available(
    users: &[UserAccountRecord],
    username: &str,
    exclude_user_id: Option<&str>,
) -> Result<(), String> {
    if users.iter().any(|user| {
        if let Some(excluded) = exclude_user_id {
            if user.user_id == excluded {
                return false;
            }
        }
        user.username.eq_ignore_ascii_case(username)
    }) {
        return Err(format!("username already exists: {username}"));
    }
    Ok(())
}

fn build_user_account_state(store: &UserAccountStore) -> UserAccountState {
    let mut users = store
        .users
        .iter()
        .map(UserAccountSummary::from)
        .collect::<Vec<_>>();
    users.sort_by(|left, right| left.username.cmp(&right.username));
    UserAccountState {
        has_users: !users.is_empty(),
        users,
    }
}

fn ensure_node_files_dir(app: &tauri::AppHandle, node_key: &str) -> Result<PathBuf, String> {
    let root = ensure_internal_state_root_exists(app)?;
    let path = root.join(MIRROR_NODE_FILES_DIR_NAME).join(node_key);
    fs::create_dir_all(&path)
        .map_err(|err| format!("failed to create node files dir {:?}: {err}", path))?;
    Ok(path)
}

fn ensure_powerpoint_preview_dir(
    app: &tauri::AppHandle,
    preview_key: &str,
) -> Result<PathBuf, String> {
    let root = ensure_internal_state_root_exists(app)?;
    let path = root.join(POWERPOINT_PREVIEW_DIR_NAME).join(preview_key);
    fs::create_dir_all(&path)
        .map_err(|err| format!("failed to create PowerPoint preview dir {:?}: {err}", path))?;
    Ok(path)
}

fn ensure_file_extension(path: PathBuf, ext: &str) -> PathBuf {
    let expected = ext.trim_start_matches('.');
    let matches_ext = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case(expected))
        .unwrap_or(false);
    if matches_ext {
        return path;
    }
    path.with_extension(expected)
}

fn build_powerpoint_preview_key(file_path: &Path) -> Result<String, String> {
    let normalized_path = normalize_windows_extended_path(file_path.to_path_buf());
    let metadata = fs::metadata(&normalized_path).map_err(|err| {
        format!(
            "failed to read PowerPoint file metadata {:?}: {err}",
            normalized_path
        )
    })?;
    let modified_stamp = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs())
        .unwrap_or(0);
    let mut hasher = DefaultHasher::new();
    normalized_path
        .to_string_lossy()
        .to_lowercase()
        .hash(&mut hasher);
    metadata.len().hash(&mut hasher);
    modified_stamp.hash(&mut hasher);
    Ok(format!("{:016x}", hasher.finish()))
}

fn extract_first_number(value: &str) -> Option<u32> {
    let digits: String = value
        .chars()
        .skip_while(|ch| !ch.is_ascii_digit())
        .take_while(|ch| ch.is_ascii_digit())
        .collect();
    digits.parse::<u32>().ok()
}

fn collect_powerpoint_slide_paths(preview_dir: &Path) -> Result<Vec<String>, String> {
    if !preview_dir.exists() || !preview_dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut entries = fs::read_dir(preview_dir)
        .map_err(|err| {
            format!(
                "failed to read PowerPoint preview dir {:?}: {err}",
                preview_dir
            )
        })?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .and_then(|value| value.to_str())
                    .map(|value| value.eq_ignore_ascii_case("png"))
                    .unwrap_or(false)
        })
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| {
        let left_name = left
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        let right_name = right
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        match (
            extract_first_number(left_name),
            extract_first_number(right_name),
        ) {
            (Some(left_num), Some(right_num)) if left_num != right_num => left_num.cmp(&right_num),
            _ => left_name.cmp(right_name),
        }
    });

    Ok(entries
        .into_iter()
        .map(normalize_windows_extended_path)
        .map(|path| path.to_string_lossy().to_string())
        .collect())
}

fn export_powerpoint_slides_internal(
    app: &tauri::AppHandle,
    file_path: &Path,
) -> Result<Vec<String>, String> {
    let normalized_path = normalize_windows_extended_path(file_path.to_path_buf());
    if !normalized_path.exists() || !normalized_path.is_file() {
        return Err(format!(
            "PowerPoint preview source file does not exist: {:?}",
            normalized_path
        ));
    }

    let preview_key = build_powerpoint_preview_key(&normalized_path)?;
    let preview_dir = ensure_powerpoint_preview_dir(app, &preview_key)?;
    let existing = collect_powerpoint_slide_paths(&preview_dir)?;
    if !existing.is_empty() {
        return Ok(existing);
    }

    if preview_dir.exists() {
        fs::remove_dir_all(&preview_dir).map_err(|err| {
            format!(
                "failed to reset PowerPoint preview dir {:?}: {err}",
                preview_dir
            )
        })?;
    }
    fs::create_dir_all(&preview_dir).map_err(|err| {
        format!(
            "failed to create PowerPoint preview dir {:?}: {err}",
            preview_dir
        )
    })?;

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$sourcePath = $env:ODE_PPT_SOURCE
$outputDir = $env:ODE_PPT_OUTPUT
if ([string]::IsNullOrWhiteSpace($sourcePath)) {
  throw 'Missing PowerPoint source path.'
}
if ([string]::IsNullOrWhiteSpace($outputDir)) {
  throw 'Missing PowerPoint output directory.'
}
$powerPoint = $null
$presentation = $null
try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerPoint.Presentations.Open($sourcePath, $true, $false, $false)
  $presentation.Export($outputDir, 'PNG', 1600, 900)
} finally {
  if ($presentation -ne $null) {
    $presentation.Close() | Out-Null
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
  }
  if ($powerPoint -ne $null) {
    $powerPoint.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
"#;

        let output = windows_powershell_command()
            .arg("-NoProfile")
            .arg("-STA")
            .arg("-Command")
            .arg(script)
            .env(
                "ODE_PPT_SOURCE",
                normalized_path.to_string_lossy().to_string(),
            )
            .env("ODE_PPT_OUTPUT", preview_dir.to_string_lossy().to_string())
            .output()
            .map_err(|err| format!("failed to launch PowerPoint slide export: {err}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                "unknown PowerPoint export error".to_string()
            };
            return Err(format!(
                "failed to export PowerPoint slides. Microsoft PowerPoint may be missing or unavailable. {detail}"
            ));
        }

        let exported = collect_powerpoint_slide_paths(&preview_dir)?;
        if exported.is_empty() {
            return Err(
                "PowerPoint export completed but no slide images were produced for preview."
                    .to_string(),
            );
        }
        return Ok(exported);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("PowerPoint slide preview is only available on Windows desktop.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn launch_windows_snipping_tool_internal() -> Result<(), String> {
    Command::new("cmd")
        .args(["/c", "start", "", "ms-screenclip:"])
        .spawn()
        .map_err(|err| format!("failed to start snipping tool: {err}"))?;
    Ok(())
}

fn read_clipboard_image_payload() -> Result<(u32, u32, Vec<u8>), String> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|err| format!("failed to access clipboard: {err}"))?;
    let image = clipboard.get_image().map_err(|_| {
        "Clipboard has no image. Start snip and copy a screenshot first.".to_string()
    })?;
    let width = image.width as u32;
    let height = image.height as u32;
    Ok((width, height, image.bytes.into_owned()))
}

fn save_png_from_rgba(
    destination: &Path,
    width: u32,
    height: u32,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let rgba = image::RgbaImage::from_raw(width, height, bytes)
        .ok_or_else(|| "Clipboard image format is unsupported.".to_string())?;
    rgba.save_with_format(destination, image::ImageFormat::Png)
        .map_err(|err| format!("failed to save screenshot {:?}: {err}", destination))?;
    Ok(())
}

fn save_clipboard_image_png(destination: &Path) -> Result<(), String> {
    let (width, height, bytes) = read_clipboard_image_payload()?;
    save_png_from_rgba(destination, width, height, bytes)
}

fn encode_png_data_url_from_rgba(
    width: u32,
    height: u32,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let rgba = image::RgbaImage::from_raw(width, height, bytes)
        .ok_or_else(|| "Clipboard image format is unsupported.".to_string())?;
    let mut encoded_png = Vec::new();
    image::codecs::png::PngEncoder::new(&mut encoded_png)
        .write_image(
            rgba.as_raw(),
            width,
            height,
            image::ColorType::Rgba8.into(),
        )
        .map_err(|err| format!("failed to encode clipboard image: {err}"))?;
    let encoded = BASE64_STANDARD.encode(encoded_png);
    Ok(format!("data:image/png;base64,{encoded}"))
}

fn image_mime_type_for_path(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    match extension.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "bmp" => Some("image/bmp"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

fn preview_mime_type_for_path(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    match extension.as_str() {
        "pdf" => Some("application/pdf"),
        _ => image_mime_type_for_path(path),
    }
}

fn split_file_name(name: &str) -> (String, String) {
    let path = Path::new(name);
    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{value}"))
        .unwrap_or_default();
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| name.to_string());
    (stem, ext)
}

fn build_copy_name(base: &str, ext: &str, copy_index: usize) -> String {
    if copy_index == 0 {
        format!("{base}{ext}")
    } else if copy_index == 1 {
        format!("{base} (Copy){ext}")
    } else {
        format!("{base} (Copy {copy_index}){ext}")
    }
}

fn is_reserved_mirror_entry(name: &str) -> bool {
    name.eq_ignore_ascii_case(MIRROR_NODE_FILES_DIR_NAME)
        || name.eq_ignore_ascii_case(MIRROR_SHARE_PACKAGES_DIR_NAME)
        || name.eq_ignore_ascii_case(ODE_CONTEXT_FILE_NAME)
}

fn is_documentation_projection_node(node: &NodeRecord, is_top_level_project_child: bool) -> bool {
    let is_documentation_scope = node
        .properties
        .get("odeWorkspaceScopeKind")
        .and_then(|value| value.as_str())
        .map(|value| value.eq_ignore_ascii_case("documentation_root"))
        .unwrap_or(false);
    if is_documentation_scope {
        return true;
    }

    if !is_top_level_project_child {
        return false;
    }

    let normalized_name = node.name.trim().to_ascii_lowercase();
    normalized_name == "database" || normalized_name == "documentation"
}

fn should_ignore_external_entry_name(name: &str) -> bool {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return true;
    }

    if is_reserved_mirror_entry(trimmed) {
        return true;
    }

    let lower = trimmed.to_lowercase();
    lower == ".ds_store"
        || lower == "thumbs.db"
        || lower == "desktop.ini"
        || lower.starts_with("~$")
        || (lower.starts_with(".~lock.") && lower.ends_with('#'))
}

fn cleanup_ode_context_file(folder_path: &Path) -> Result<(), String> {
    let context_path = folder_path.join(ODE_CONTEXT_FILE_NAME);
    if context_path.exists() && context_path.is_file() {
        fs::remove_file(&context_path).map_err(|err| {
            format!(
                "failed to remove stale ode context file {:?}: {err}",
                context_path
            )
        })?;
    }

    Ok(())
}

fn find_unique_mirror_entry_name(desired_name: &str, taken_names: &HashSet<String>) -> String {
    let safe_name = sanitize_file_name_component(desired_name);
    let (base, ext) = split_file_name(&safe_name);
    for copy_index in 0..5000 {
        let candidate = build_copy_name(&base, &ext, copy_index);
        if !taken_names.contains(&candidate.to_lowercase()) {
            return candidate;
        }
    }
    format!("{safe_name}-{}", now_ms())
}

fn build_mirror_number_label(parent_label: &str, sibling_index: usize) -> String {
    if parent_label.is_empty() {
        format!("{sibling_index}")
    } else {
        format!("{parent_label}.{sibling_index}")
    }
}

fn build_mirror_display_name(number_label: &str, raw_name: &str) -> String {
    let normalized_name = normalize_external_mirror_entry_name(raw_name);
    let clean_name = normalized_name.trim();
    if clean_name.is_empty() {
        format!("[{number_label}] node")
    } else {
        format!("[{number_label}] {clean_name}")
    }
}

fn build_projected_entry_display_name(
    node_type: &str,
    numbering_label: Option<&str>,
    raw_name: &str,
) -> String {
    if node_type.eq_ignore_ascii_case("file") {
        normalize_external_mirror_entry_name(raw_name)
    } else {
        build_mirror_display_name(numbering_label.unwrap_or(""), raw_name)
    }
}

fn find_projected_entry_adoption_candidate(
    destination_dir: &Path,
    expected_entry_name: &str,
    raw_name: &str,
    expects_file: bool,
) -> Option<PathBuf> {
    let normalized_target_name = normalize_external_mirror_entry_name(raw_name).to_lowercase();
    let entries = fs::read_dir(destination_dir).ok()?;
    let mut exact_title_matches: Vec<PathBuf> = Vec::new();
    let mut normalized_matches: Vec<PathBuf> = Vec::new();

    for entry in entries.flatten() {
        let current_name = entry.file_name().to_string_lossy().to_string();
        if should_ignore_external_entry_name(&current_name) {
            continue;
        }
        if current_name.eq_ignore_ascii_case(expected_entry_name) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let type_matches = (expects_file && file_type.is_file()) || (!expects_file && file_type.is_dir());
        if !type_matches {
            continue;
        }

        let normalized_current_name = normalize_external_mirror_entry_name(&current_name).to_lowercase();
        if normalized_current_name != normalized_target_name {
            continue;
        }

        if current_name.eq_ignore_ascii_case(&normalized_target_name) {
            exact_title_matches.push(entry.path());
        } else {
            normalized_matches.push(entry.path());
        }
    }

    if exact_title_matches.len() == 1 {
        return exact_title_matches.pop();
    }
    if exact_title_matches.is_empty() && normalized_matches.len() == 1 {
        return normalized_matches.pop();
    }
    None
}

fn is_numeric_mirror_label(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return false;
    }
    trimmed.split('.').all(|part| {
        let clean = part.trim();
        !clean.is_empty() && clean.len() <= 3 && clean.chars().all(|ch| ch.is_ascii_digit())
    })
}

fn trim_numbering_separators_start(value: &str) -> &str {
    value.trim_start_matches(|ch: char| {
        ch.is_whitespace() || matches!(ch, '-' | '_' | '.' | ':' | ')' | ']' | '(' | '[')
    })
}

fn parse_plain_numbering_prefix_end(value: &str) -> Option<usize> {
    let bytes = value.as_bytes();
    let len = bytes.len();
    if len == 0 {
        return None;
    }

    let mut idx = 0usize;
    let mut first_digits = 0usize;
    while idx < len && bytes[idx].is_ascii_digit() {
        first_digits += 1;
        if first_digits > 3 {
            return None;
        }
        idx += 1;
    }
    if first_digits == 0 {
        return None;
    }

    while idx < len && bytes[idx] == b'.' {
        let dot_pos = idx;
        idx += 1;
        let mut seg_digits = 0usize;
        while idx < len && bytes[idx].is_ascii_digit() {
            seg_digits += 1;
            if seg_digits > 3 {
                return None;
            }
            idx += 1;
        }
        if seg_digits == 0 {
            idx = dot_pos;
            break;
        }
    }

    let mut end = idx;
    if end < len {
        let marker = bytes[end] as char;
        if matches!(marker, ')' | ']' | ':' | '-' | '_') {
            end += 1;
        }
    }

    if end < len {
        let next = bytes[end] as char;
        if !next.is_whitespace() && !matches!(next, '-' | '_' | '.' | ':') {
            return None;
        }
    }

    Some(end)
}

fn normalize_external_mirror_entry_name(raw_name: &str) -> String {
    let mut current = raw_name.trim();
    if current.starts_with('[') {
        if let Some(end_idx) = current.find(']') {
            let inside = &current[1..end_idx];
            if is_numeric_mirror_label(inside) {
                current = trim_numbering_separators_start(&current[end_idx + 1..]);
            }
        }
    }
    if current.starts_with('(') {
        if let Some(end_idx) = current.find(')') {
            let inside = &current[1..end_idx];
            if is_numeric_mirror_label(inside) {
                current = trim_numbering_separators_start(&current[end_idx + 1..]);
            }
        }
    }

    if let Some(end) = parse_plain_numbering_prefix_end(current) {
        current = trim_numbering_separators_start(&current[end..]);
    }

    if current.trim().is_empty() {
        "New Topic".to_string()
    } else {
        current.trim().to_string()
    }
}

fn read_projection_index_from_path(index_path: &Path) -> HashSet<String> {
    if !index_path.exists() {
        return HashSet::new();
    }
    let Ok(raw) = fs::read_to_string(&index_path) else {
        return HashSet::new();
    };
    let Ok(entries) = serde_json::from_str::<Vec<String>>(&raw) else {
        return HashSet::new();
    };
    entries
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect()
}

fn read_projection_index(app: &tauri::AppHandle, mirror_root: &Path) -> HashSet<String> {
    if let Ok(state_root) = ensure_internal_state_root_exists(app) {
        let index_path = state_root.join(MIRROR_PROJECTION_INDEX_FILE);
        let entries = read_projection_index_from_path(&index_path);
        if !entries.is_empty() {
            return entries;
        }
    }
    let legacy_index_path = mirror_root.join(MIRROR_PROJECTION_INDEX_FILE);
    read_projection_index_from_path(&legacy_index_path)
}

fn read_project_projection_index(app: &tauri::AppHandle) -> HashMap<String, Vec<String>> {
    let Ok(state_root) = ensure_internal_state_root_exists(app) else {
        return HashMap::new();
    };
    let index_path = state_root.join(PROJECT_PROJECTION_INDEX_FILE);
    if !index_path.exists() {
        return HashMap::new();
    }

    let Ok(raw) = fs::read_to_string(&index_path) else {
        return HashMap::new();
    };
    let Ok(decoded) = serde_json::from_str::<HashMap<String, Vec<String>>>(&raw) else {
        return HashMap::new();
    };

    decoded
        .into_iter()
        .filter_map(|(path, entries)| {
            let clean_path = path.trim().to_string();
            if clean_path.is_empty() {
                return None;
            }
            let clean_entries: Vec<String> = entries
                .into_iter()
                .map(|entry| entry.trim().to_string())
                .filter(|entry| !entry.is_empty())
                .collect();
            Some((clean_path, clean_entries))
        })
        .collect()
}

fn write_project_projection_index(
    app: &tauri::AppHandle,
    entries_by_path: &HashMap<String, Vec<String>>,
) -> Result<(), String> {
    let state_root = ensure_internal_state_root_exists(app)?;
    let index_path = state_root.join(PROJECT_PROJECTION_INDEX_FILE);
    let mut normalized: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for (path, entries) in entries_by_path {
        let clean_path = path.trim();
        if clean_path.is_empty() {
            continue;
        }
        let mut clean_entries: Vec<String> = entries
            .iter()
            .map(|entry| entry.trim().to_string())
            .filter(|entry| !entry.is_empty())
            .collect();
        clean_entries.sort();
        clean_entries.dedup();
        normalized.insert(clean_path.to_string(), clean_entries);
    }

    let payload = serde_json::to_string_pretty(&normalized)
        .map_err(|err| format!("failed to encode project projection index: {err}"))?;
    fs::write(&index_path, payload).map_err(|err| {
        format!(
            "failed to write project projection index {:?}: {err}",
            index_path
        )
    })
}

fn remove_projected_entry(entry_path: &Path) -> Result<(), String> {
    if !entry_path.exists() {
        return Ok(());
    }
    if entry_path.is_dir() {
        fs::remove_dir_all(entry_path).map_err(|err| {
            format!(
                "failed to remove projected directory {:?}: {err}",
                entry_path
            )
        })
    } else {
        fs::remove_file(entry_path)
            .map_err(|err| format!("failed to remove projected file {:?}: {err}", entry_path))
    }
}

fn sync_project_workspace_projection(
    app: &tauri::AppHandle,
    all_nodes: &[NodeRecord],
    project_paths_by_root_id: &HashMap<String, String>,
) -> Result<(), String> {
    let children_map = build_children_map(all_nodes);
    let mut previous_entries_by_path = read_project_projection_index(app);
    let mut next_entries_by_path: HashMap<String, Vec<String>> = HashMap::new();
    let root_children = children_map
        .get(ROOT_PARENT_ID)
        .cloned()
        .unwrap_or_default();

    for root in root_children {
        if !root.node_type.eq_ignore_ascii_case("folder") {
            continue;
        }
        let project_path = project_paths_by_root_id
            .get(&root.node_id)
            .cloned()
            .or_else(|| extract_project_path_from_node_properties(&root.properties));
        let Some(project_path) = project_path else {
            continue;
        };
        let clean_project_path = project_path.trim();
        if clean_project_path.is_empty() {
            continue;
        }
        if is_internal_workspace_root_path(clean_project_path) {
            continue;
        }

        let target_root = PathBuf::from(clean_project_path);
        fs::create_dir_all(&target_root).map_err(|err| {
            format!(
                "failed to create project workspace root {:?}: {err}",
                target_root
            )
        })?;

        let previous_entries = previous_entries_by_path
            .remove(clean_project_path)
            .unwrap_or_default();

        let created_entries = sync_desktop_projection_recursive(
            &children_map,
            &root.node_id,
            &target_root,
            "",
            false,
        )?;
        let created_keys: HashSet<String> = created_entries
            .iter()
            .map(|entry| entry.to_lowercase())
            .collect();
        for previous_entry in previous_entries {
            if is_reserved_mirror_entry(&previous_entry) {
                continue;
            }
            if created_keys.contains(&previous_entry.to_lowercase()) {
                continue;
            }
            let stale_entry = target_root.join(previous_entry);
            remove_projected_entry(&stale_entry)?;
        }
        next_entries_by_path.insert(clean_project_path.to_string(), created_entries);
    }

    for (stale_path, stale_entries) in previous_entries_by_path {
        let root_path = PathBuf::from(stale_path);
        for entry_name in stale_entries {
            if is_reserved_mirror_entry(&entry_name) {
                continue;
            }
            let entry_path = root_path.join(entry_name);
            if let Err(err) = remove_projected_entry(&entry_path) {
                eprintln!("{err}");
            }
        }
    }

    write_project_projection_index(app, &next_entries_by_path)
}


fn sync_desktop_projection_recursive(
    children_map: &HashMap<String, Vec<NodeRecord>>,
    parent_id: &str,
    destination_dir: &Path,
    numbering_prefix: &str,
    prune_unmanaged_entries: bool,
) -> Result<Vec<String>, String> {
    let Some(children) = children_map.get(parent_id) else {
        return Ok(Vec::new());
    };

    let mut taken_names: HashSet<String> = HashSet::new();
    let mut created_entry_names: Vec<String> = Vec::new();
    let mut folder_index = 0usize;
    for child in children.iter() {
        if is_documentation_projection_node(child, numbering_prefix.is_empty()) {
            continue;
        }
        let expects_file = child.node_type.eq_ignore_ascii_case("file");
        let number_label = if expects_file {
            String::new()
        } else {
            folder_index += 1;
            build_mirror_number_label(numbering_prefix, folder_index)
        };
        let display_name = build_projected_entry_display_name(
            &child.node_type,
            if number_label.is_empty() {
                None
            } else {
                Some(number_label.as_str())
            },
            &child.name,
        );
        let entry_name = find_unique_mirror_entry_name(&display_name, &taken_names);
        taken_names.insert(entry_name.to_lowercase());
        created_entry_names.push(entry_name.clone());
        let entry_path = destination_dir.join(&entry_name);
        if !entry_path.exists() {
            if let Some(existing_path) = find_projected_entry_adoption_candidate(
                destination_dir,
                &entry_name,
                &child.name,
                expects_file,
            ) {
                fs::rename(&existing_path, &entry_path).map_err(|err| {
                    format!(
                        "failed to rename projected entry {:?} to {:?}: {err}",
                        existing_path, entry_path
                    )
                })?;
            }
        }

        if expects_file {
            let source_path = child
                .properties
                .get("mirrorFilePath")
                .and_then(|value| value.as_str())
                .map(PathBuf::from);
            let Some(source_path) = source_path else {
                continue;
            };
            if !source_path.exists() || !source_path.is_file() {
                continue;
            }

            if paths_refer_to_same_location(&source_path, &entry_path)
                || files_appear_in_sync(&source_path, &entry_path)
            {
                continue;
            }

            if entry_path.exists() {
                if entry_path.is_dir() {
                    let _ = fs::remove_dir_all(&entry_path);
                } else {
                    let _ = fs::remove_file(&entry_path);
                }
            }

            if fs::hard_link(&source_path, &entry_path).is_err() {
                fs::copy(&source_path, &entry_path).map_err(|err| {
                    format!(
                        "failed to mirror file {:?} to {:?}: {err}",
                        source_path, entry_path
                    )
                })?;
            }
            continue;
        }

        fs::create_dir_all(&entry_path)
            .map_err(|err| format!("failed to create mirror folder {:?}: {err}", entry_path))?;
        if let Err(err) = cleanup_ode_context_file(&entry_path) {
            eprintln!(
                "failed to remove stale ode context file for {:?}: {err}",
                entry_path
            );
        }
        let _ = sync_desktop_projection_recursive(
            children_map,
            &child.node_id,
            &entry_path,
            &number_label,
            true,
        )?;
    }

    if prune_unmanaged_entries {
        let created_keys: HashSet<String> = created_entry_names
            .iter()
            .map(|entry| entry.to_lowercase())
            .collect();
        let existing_entries = fs::read_dir(destination_dir)
            .map_err(|err| format!("failed to read mirror folder {:?}: {err}", destination_dir))?;
        for entry in existing_entries {
            let entry = match entry {
                Ok(value) => value,
                Err(_) => continue,
            };
            let entry_name = entry.file_name().to_string_lossy().to_string();
            if should_ignore_external_entry_name(&entry_name) {
                continue;
            }
            if created_keys.contains(&entry_name.to_lowercase()) {
                continue;
            }
            let entry_path = entry.path();
            remove_projected_entry(&entry_path)?;
        }
    }

    Ok(created_entry_names)
}

fn expected_projected_entry_keys_for_parent(
    children_map: &HashMap<String, Vec<NodeRecord>>,
    parent_id: &str,
) -> HashSet<String> {
    let mut expected: HashSet<String> = HashSet::new();
    let Some(root_children) = children_map.get(parent_id) else {
        return expected;
    };
    for entry in build_expected_workspace_entries(root_children, "") {
        expected.insert(entry.entry_name.to_lowercase());
    }
    expected
}

fn expected_projected_root_entry_keys(all_nodes: &[NodeRecord]) -> HashSet<String> {
    let children_map = build_children_map(all_nodes);
    expected_projected_entry_keys_for_parent(&children_map, ROOT_PARENT_ID)
}

fn build_project_paths_by_root_id_for_projection(
    all_nodes: &[NodeRecord],
    projects: &[ProjectRecord],
) -> HashMap<String, String> {
    let mut map: HashMap<String, String> = HashMap::new();

    for project in projects {
        let clean_root_id = project.root_node_id.trim();
        let clean_path = project.root_path.trim();
        if clean_root_id.is_empty() || clean_path.is_empty() {
            continue;
        }
        map.entry(clean_root_id.to_string())
            .or_insert_with(|| clean_path.to_string());
    }

    // Fall back to root-node metadata when project records are missing or stale.
    for node in all_nodes {
        if node.parent_id != ROOT_PARENT_ID || !node.node_type.eq_ignore_ascii_case("folder") {
            continue;
        }
        if map.contains_key(&node.node_id) {
            continue;
        }
        let Some(project_path) = extract_project_path_from_node_properties(&node.properties) else {
            continue;
        };
        let clean_path = project_path.trim();
        if clean_path.is_empty() {
            continue;
        }
        map.insert(node.node_id.clone(), clean_path.to_string());
    }

    map
}

async fn sync_desktop_projection_from_db(
    app: &tauri::AppHandle,
    db: &Surreal<Db>,
) -> Result<(), String> {
    let all_nodes = fetch_all_nodes(db).await?;
    let projects = match fetch_all_projects(db).await {
        Ok(rows) => rows,
        Err(err) => {
            eprintln!(
                "sync projection: project index unavailable, using root metadata fallback: {err}"
            );
            Vec::new()
        }
    };
    let project_paths_by_root_id =
        build_project_paths_by_root_id_for_projection(&all_nodes, &projects);
    sync_project_workspace_projection(app, &all_nodes, &project_paths_by_root_id)
}

fn find_unique_import_name(
    desired_name: &str,
    taken_node_names: &HashSet<String>,
    taken_file_names: &HashSet<String>,
) -> String {
    let (base, ext) = split_file_name(desired_name);
    for copy_index in 0..5000 {
        let candidate = build_copy_name(&base, &ext, copy_index);
        let key = candidate.to_lowercase();
        if !taken_node_names.contains(&key) && !taken_file_names.contains(&key) {
            return candidate;
        }
    }
    format!("{}-{}", desired_name, now_ms())
}

fn is_surreal_revision_deserialization_error(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("versioned error")
        && lower.contains("deserialization")
        && lower.contains("invalid revision")
        && lower.contains("value")
}

async fn reset_project_table_if_legacy_value_error(
    db: &Surreal<Db>,
    reason: &str,
) -> Result<bool, String> {
    if !is_surreal_revision_deserialization_error(reason) {
        return Ok(false);
    }

    eprintln!(
        "project table deserialize failed with legacy value revision; resetting workspace records: {reason}"
    );
    db.query("DELETE project;").await.map_err(db_err)?;
    Ok(true)
}

async fn fetch_all_projects(db: &Surreal<Db>) -> Result<Vec<ProjectRecord>, String> {
    let mut response = match db
        .query(
            "SELECT projectId, project_id, name, rootPath, root_path, rootNodeId, root_node_id, createdAt, created_at, updatedAt, updated_at FROM project;",
        )
        .await
    {
        Ok(response) => response,
        Err(err) => {
            let reason = db_err(err);
            if reset_project_table_if_legacy_value_error(db, &reason).await? {
                return Ok(Vec::new());
            }
            return Err(reason);
        }
    };

    match response.take::<Vec<Value>>(0) {
        Ok(rows) => rows
            .into_iter()
            .map(parse_project_record_value)
            .collect::<Result<Vec<_>, _>>(),
        Err(err) => {
            let reason = db_err(err);
            if reset_project_table_if_legacy_value_error(db, &reason).await? {
                return Ok(Vec::new());
            }
            Err(reason)
        }
    }
}

async fn fetch_project_record(
    db: &Surreal<Db>,
    project_id: &str,
) -> Result<Option<ProjectRecord>, String> {
    let projects = fetch_all_projects(db).await?;
    Ok(projects
        .into_iter()
        .find(|project| project.project_id == project_id))
}

fn read_string_value(map: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(Value::String(raw)) = map.get(*key) {
            let trimmed = raw.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn read_i64_value(map: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<i64> {
    for key in keys {
        match map.get(*key) {
            Some(Value::Number(raw)) => {
                if let Some(value) = raw.as_i64() {
                    return Some(value);
                }
            }
            Some(Value::String(raw)) => {
                if let Ok(value) = raw.trim().parse::<i64>() {
                    return Some(value);
                }
            }
            _ => {}
        }
    }
    None
}

fn deserialize_json_row<T>(value: Value) -> Result<T, String>
where
    T: DeserializeOwned,
{
    serde_json::from_value(value).map_err(db_err)
}

fn deserialize_json_rows<T>(rows: Vec<Value>) -> Result<Vec<T>, String>
where
    T: DeserializeOwned,
{
    rows.into_iter().map(deserialize_json_row).collect()
}

fn parse_project_record_value(value: Value) -> Result<ProjectRecord, String> {
    let Value::Object(map) = value else {
        return Err("invalid project record payload".to_string());
    };

    let project_id = read_string_value(&map, &["projectId", "project_id"])
        .ok_or_else(|| "project record missing projectId".to_string())?;
    let name =
        read_string_value(&map, &["name"]).ok_or_else(|| "project record missing name".to_string())?;
    let root_path = read_string_value(&map, &["rootPath", "root_path"])
        .ok_or_else(|| "project record missing rootPath".to_string())?;
    let root_node_id = read_string_value(&map, &["rootNodeId", "root_node_id"])
        .ok_or_else(|| "project record missing rootNodeId".to_string())?;
    let created_at = read_i64_value(&map, &["createdAt", "created_at"]).unwrap_or_default();
    let updated_at = read_i64_value(&map, &["updatedAt", "updated_at"]).unwrap_or(created_at);

    Ok(ProjectRecord {
        project_id,
        name,
        root_path,
        root_node_id,
        created_at,
        updated_at,
    })
}

fn extract_project_path_from_node_properties(properties: &Value) -> Option<String> {
    let Value::Object(map) = properties else {
        return None;
    };
    read_string_value(map, &["projectPath", "project_path"])
}

fn is_workspace_root_properties(properties: &Value) -> bool {
    let Value::Object(map) = properties else {
        return false;
    };

    if read_string_value(
        map,
        &[
            "workspaceKind",
            "workspace_kind",
            "workspacePath",
            "workspace_path",
            "projectPath",
            "project_path",
            "projectPathKey",
            "project_path_key",
        ],
    )
    .is_some()
    {
        return true;
    }

    map.get("workspaceCreatedAt").is_some()
        || map.get("workspace_created_at").is_some()
        || map.get("projectImportedAt").is_some()
        || map.get("project_imported_at").is_some()
}

fn is_workspace_root_node(node: &NodeRecord) -> bool {
    node.parent_id == ROOT_PARENT_ID
        && node.node_type == "folder"
        && is_workspace_root_properties(&node.properties)
}

fn build_internal_workspace_root_path(root_node_id: &str) -> String {
    format!("{INTERNAL_WORKSPACE_ROOT_PREFIX}{root_node_id}")
}

fn is_internal_workspace_root_path(path: &str) -> bool {
    path.trim()
        .to_ascii_lowercase()
        .starts_with(INTERNAL_WORKSPACE_ROOT_PREFIX)
}

async fn ensure_internal_workspace_root_metadata(
    db: &Surreal<Db>,
    node: &NodeRecord,
    project_path: &str,
) -> Result<bool, String> {
    if !is_internal_workspace_root_path(project_path) {
        return Ok(false);
    }

    let mut properties = match &node.properties {
        Value::Object(map) => map.clone(),
        _ => serde_json::Map::new(),
    };
    let mut changed = false;

    if read_string_value(&properties, &["workspaceKind", "workspace_kind"]).is_none() {
        properties.insert(
            "workspaceKind".to_string(),
            Value::String("internal".to_string()),
        );
        changed = true;
    }

    if read_string_value(&properties, &["workspacePath", "workspace_path"]).is_none() {
        properties.insert(
            "workspacePath".to_string(),
            Value::String(project_path.to_string()),
        );
        changed = true;
    }

    if !properties.contains_key("workspaceCreatedAt")
        && !properties.contains_key("workspace_created_at")
    {
        properties.insert(
            "workspaceCreatedAt".to_string(),
            Value::from(node.created_at),
        );
        changed = true;
    }

    if !changed {
        return Ok(false);
    }

    db.query("UPDATE node SET properties = $properties, updatedAt = $updated_at WHERE nodeId = $node_id;")
        .bind(("properties", Value::Object(properties)))
        .bind(("updated_at", now_ms()))
        .bind(("node_id", node.node_id.clone()))
        .await
        .map_err(db_err)?;

    Ok(true)
}

#[derive(Default, Debug, Clone, Copy)]
struct WorkspaceRecordRecoveryStats {
    created: i64,
    updated: i64,
}

async fn ensure_project_records_from_nodes(
    db: &Surreal<Db>,
    all_nodes: &[NodeRecord],
    projects: &mut Vec<ProjectRecord>,
) -> Result<WorkspaceRecordRecoveryStats, String> {
    let mut stats = WorkspaceRecordRecoveryStats::default();
    let mut known_root_ids: HashSet<String> = projects
        .iter()
        .map(|project| project.root_node_id.clone())
        .collect();
    let mut known_path_keys: HashSet<String> = projects
        .iter()
        .map(|project| project_path_key(&project.root_path))
        .collect();
    let mut project_index_by_root_id: HashMap<String, usize> = projects
        .iter()
        .enumerate()
        .map(|(index, project)| (project.root_node_id.clone(), index))
        .collect();

    for node in all_nodes {
        if node.parent_id != ROOT_PARENT_ID || node.node_type != "folder" {
            continue;
        }
        let project_path = extract_project_path_from_node_properties(&node.properties)
            .unwrap_or_else(|| build_internal_workspace_root_path(&node.node_id));
        let path_key = project_path_key(&project_path);
        let existing_index = project_index_by_root_id.get(&node.node_id).copied();
        let is_workspace_root = is_workspace_root_properties(&node.properties);
        if !is_workspace_root {
            if let Some(existing_index) = existing_index {
                let existing = &projects[existing_index];
                // Keep legacy external-path workspaces even if older root metadata is minimal.
                if !is_internal_workspace_root_path(&existing.root_path) {
                    known_root_ids.insert(node.node_id.clone());
                    known_path_keys.insert(project_path_key(&existing.root_path));
                    continue;
                }
                if ensure_internal_workspace_root_metadata(db, node, &existing.root_path).await? {
                    stats.updated += 1;
                }
            }
        }
        if let Some(existing_index) = existing_index {
            let existing = &projects[existing_index];
            let needs_name_update = existing.name != node.name;
            let needs_path_update = project_path_key(&existing.root_path) != path_key;
            if needs_name_update || needs_path_update {
                let updated_at = now_ms();
                db.query(
                    "UPDATE project SET name = $name, rootPath = $root_path, root_path = $root_path, updatedAt = $updated_at, updated_at = $updated_at WHERE projectId = $project_id OR project_id = $project_id;",
                )
                .bind(("name", node.name.clone()))
                .bind(("root_path", project_path.clone()))
                .bind(("updated_at", updated_at))
                .bind(("project_id", existing.project_id.clone()))
                .await
                .map_err(db_err)?;
                projects[existing_index].name = node.name.clone();
                projects[existing_index].root_path = project_path.clone();
                projects[existing_index].updated_at = updated_at;
                stats.updated += 1;
            }
            if !is_workspace_root
                && ensure_internal_workspace_root_metadata(
                    db,
                    node,
                    &projects[existing_index].root_path,
                )
                .await?
            {
                stats.updated += 1;
            }
            known_root_ids.insert(node.node_id.clone());
            known_path_keys.insert(path_key);
            continue;
        }
        if known_root_ids.contains(&node.node_id) || known_path_keys.contains(&path_key) {
            continue;
        }
        let record = ProjectRecord {
            project_id: uuid::Uuid::new_v4().to_string(),
            name: node.name.clone(),
            root_path: project_path,
            root_node_id: node.node_id.clone(),
            created_at: node.created_at,
            updated_at: now_ms(),
        };
        db.query("CREATE project CONTENT $record;")
            .bind(("record", record.clone()))
            .await
            .map_err(db_err)?;
        if !is_workspace_root {
            let _ = ensure_internal_workspace_root_metadata(db, node, &record.root_path).await?;
        }
        known_root_ids.insert(record.root_node_id.clone());
        known_path_keys.insert(path_key);
        project_index_by_root_id.insert(record.root_node_id.clone(), projects.len());
        projects.push(record);
        stats.created += 1;
    }

    Ok(stats)
}

async fn remove_stale_project_records(
    db: &Surreal<Db>,
    projects: &mut Vec<ProjectRecord>,
    root_node_by_id: &HashMap<String, NodeRecord>,
) -> i64 {
    let mut removed_count = 0i64;
    let mut stale_project_ids: Vec<String> = Vec::new();
    projects.retain(|project| {
        let Some(root_node) = root_node_by_id.get(&project.root_node_id) else {
            stale_project_ids.push(project.project_id.clone());
            return false;
        };

        let is_workspace_root = is_workspace_root_node(root_node);
        if is_workspace_root {
            return true;
        }

        // Keep explicit external-path workspaces for legacy compatibility.
        if !is_internal_workspace_root_path(&project.root_path) {
            return true;
        }

        stale_project_ids.push(project.project_id.clone());
        false
    });
    for stale_project_id in stale_project_ids {
        if db
            .query("DELETE project WHERE projectId = $project_id OR project_id = $project_id;")
            .bind(("project_id", stale_project_id))
            .await
            .is_ok()
        {
            removed_count += 1;
        }
    }
    removed_count
}

fn normalize_project_root_path(input: &str) -> Result<PathBuf, String> {
    let trimmed = {
        let candidate = input.trim();
        if candidate.len() >= 2 {
            let first = candidate.as_bytes()[0];
            let last = candidate.as_bytes()[candidate.len() - 1];
            if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
                candidate[1..candidate.len() - 1].trim()
            } else {
                candidate
            }
        } else {
            candidate
        }
    };
    if trimmed.is_empty() {
        return Err("project path is empty".to_string());
    }
    let candidate = PathBuf::from(trimmed);
    if !candidate.exists() {
        return Err(format!("project path does not exist: {trimmed}"));
    }
    if !candidate.is_dir() {
        return Err(format!("project path is not a directory: {trimmed}"));
    }
    let canonical = fs::canonicalize(&candidate)
        .map_err(|err| format!("failed to normalize project path {:?}: {err}", candidate))?;
    Ok(normalize_windows_extended_path(canonical))
}

fn project_path_key(path: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        return path.to_lowercase();
    }
    #[cfg(not(target_os = "windows"))]
    {
        path.to_string()
    }
}

fn build_project_file_properties(path: &Path) -> Value {
    let mut props = serde_json::Map::new();
    let file_path = path.to_string_lossy().to_string();
    let size = fs::metadata(path).map(|meta| meta.len()).unwrap_or(0);
    props.insert(
        "mirrorFilePath".to_string(),
        Value::String(file_path.clone()),
    );
    props.insert("importedFromPath".to_string(), Value::String(file_path));
    props.insert("sizeBytes".to_string(), Value::from(size));
    Value::Object(props)
}

async fn insert_node_record(db: &Surreal<Db>, record: NodeRecord) -> Result<(), String> {
    db.query("CREATE node CONTENT $record;")
        .bind(("record", record))
        .await
        .map_err(db_err)?;
    Ok(())
}

async fn write_node_content(db: &Surreal<Db>, node_id: &str, text: String) -> Result<(), String> {
    db.query(UPDATE_NODE_CONTENT_QUERY)
        .bind(("text", text))
        .bind(("node_id", node_id.to_string()))
        .await
        .map_err(db_err)?;
    Ok(())
}

async fn parse_and_store_node_file_content(
    db: &Surreal<Db>,
    node_id: &str,
    file_path: &Path,
    extension: &str,
) -> Result<Option<String>, String> {
    let normalized_extension = if extension.trim().is_empty() {
        file_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_string()
    } else {
        extension.trim().to_string()
    };

    let Some(extracted_text) = document_parser::parse_file(file_path, &normalized_extension).await
    else {
        return Ok(None);
    };

    write_node_content(db, node_id, extracted_text.clone()).await?;
    Ok(Some(extracted_text))
}

#[derive(Clone, Serialize)]
struct ImportProgressPayload {
    imported_count: usize,
    current_folder: String,
}

async fn import_project_tree_nodes(
    app: &tauri::AppHandle,
    db: &Surreal<Db>,
    root_node_id: &str,
    root_path: &Path,
) -> Result<usize, String> {
    let mut imported_nodes = 0usize;
    let mut stack: Vec<(String, PathBuf)> =
        vec![(root_node_id.to_string(), root_path.to_path_buf())];

    // Batch configuration
    let chunk_size = 500;
    let mut record_chunk: Vec<NodeRecord> = Vec::with_capacity(chunk_size);
    let mut parsing_queue: Vec<(String, PathBuf, String)> = Vec::new(); // (node_id, path, ext)

    while let Some((parent_id, dir_path)) = stack.pop() {
        // Emit progress if we have a valid folder name
        if let Some(folder_name) = dir_path.file_name().and_then(|n| n.to_str()) {
            let _ = app.emit(
                "project-import-progress",
                ImportProgressPayload {
                    imported_count: imported_nodes,
                    current_folder: folder_name.to_string(),
                },
            );
        }

        // Use tokio::fs for async directory reading to prevent blocking the async executor
        let mut entries = match tokio::fs::read_dir(&dir_path).await {
            Ok(stream) => stream,
            Err(err) => {
                eprintln!("failed to read project directory {:?}: {err}", dir_path);
                continue;
            }
        };

        let mut current_dir_entries = Vec::new();
        while let Ok(Some(entry)) = entries.next_entry().await {
            current_dir_entries.push(entry);
        }

        current_dir_entries.sort_by(|left, right| {
            let left_type = std::fs::metadata(left.path()).ok().map(|m| m.file_type());
            let right_type = std::fs::metadata(right.path()).ok().map(|m| m.file_type());

            let left_is_dir = left_type
                .as_ref()
                .map(|kind| kind.is_dir())
                .unwrap_or(false);
            let right_is_dir = right_type
                .as_ref()
                .map(|kind| kind.is_dir())
                .unwrap_or(false);

            right_is_dir.cmp(&left_is_dir).then_with(|| {
                left.file_name()
                    .to_string_lossy()
                    .to_lowercase()
                    .cmp(&right.file_name().to_string_lossy().to_lowercase())
            })
        });

        for (idx, entry) in current_dir_entries.into_iter().enumerate() {
            let path = entry.path();
            let file_type = match tokio::fs::metadata(&path).await {
                Ok(meta) => meta.file_type(),
                Err(err) => {
                    eprintln!("failed to read entry type in {:?}: {err}", path);
                    continue;
                }
            };

            if file_type.is_symlink() {
                continue;
            }

            if imported_nodes >= MAX_PROJECT_IMPORT_NODES {
                return Err(format!(
                    "project import limit reached ({MAX_PROJECT_IMPORT_NODES} nodes). Please import a smaller scope."
                ));
            }

            let path = entry.path();
            let raw_name = entry.file_name().to_string_lossy().to_string();
            if should_ignore_external_entry_name(&raw_name) {
                continue;
            }
            let desired_name = normalize_external_mirror_entry_name(&raw_name);
            let name = sanitize_file_name_component(&desired_name);
            let node_type = if file_type.is_dir() { "folder" } else { "file" }.to_string();
            let now = now_ms();
            let record = NodeRecord {
                node_id: uuid::Uuid::new_v4().to_string(),
                parent_id: parent_id.clone(),
                name,
                node_type: node_type.clone(),
                properties: if node_type == "file" {
                    build_project_file_properties(&path)
                } else {
                    Value::Object(serde_json::Map::new())
                },
                description: None,
                order: ((idx + 1) as i64) * 1000,
                created_at: now,
                updated_at: now,
                content_type: None,
                ai_draft: None,
                content: None,
            };

            record_chunk.push(record.clone());
            imported_nodes += 1;

            if file_type.is_dir() {
                stack.push((record.node_id, path));
            } else {
                parsing_queue.push((
                    record.node_id.clone(),
                    path.clone(),
                    path.extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_string(),
                ));
            }

            // Flush chunk if it reaches capacity
            if record_chunk.len() >= chunk_size {
                db.query("INSERT INTO node $records")
                    .bind(("records", record_chunk.clone()))
                    .await
                    .map_err(db_err)?;

                // Spawn parsing tasks for this batch
                for (nid, p, e) in parsing_queue.drain(..) {
                    let app_h = app.clone();
                    tokio::spawn(async move {
                        if let Ok(db_inner) = get_db(&app_h).await {
                            let _ =
                                parse_and_store_node_file_content(&db_inner, &nid, &p, &e).await;
                        }
                    });
                }

                record_chunk.clear();
            }
        }
    }

    // Flush remaining records
    if !record_chunk.is_empty() {
        db.query("INSERT INTO node $records")
            .bind(("records", record_chunk))
            .await
            .map_err(db_err)?;

        // Spawn remaining
        for (nid, p, e) in parsing_queue {
            let app_h = app.clone();
            tokio::spawn(async move {
                if let Ok(db_inner) = get_db(&app_h).await {
                    let _ = parse_and_store_node_file_content(&db_inner, &nid, &p, &e).await;
                }
            });
        }
    }

    Ok(imported_nodes)
}

fn windows_icon_cache() -> &'static Mutex<HashMap<String, Option<String>>> {
    WINDOWS_ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn normalize_optional_text(input: Option<String>) -> Option<String> {
    input
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_optional_task_string_value(
    value: Value,
    field_name: &str,
) -> Result<Option<String>, String> {
    match value {
        Value::Null => Ok(None),
        Value::String(raw) => {
            let trimmed = raw.trim().to_string();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(trimmed))
            }
        }
        _ => Err(format!("{field_name} must be a string or null")),
    }
}

fn parse_optional_task_i64_value(value: Value, field_name: &str) -> Result<Option<i64>, String> {
    match value {
        Value::Null => Ok(None),
        Value::Number(number) => number
            .as_i64()
            .map(Some)
            .ok_or_else(|| format!("{field_name} must be an integer number")),
        _ => Err(format!("{field_name} must be an integer number or null")),
    }
}

fn parse_task_string_list(value: Value, field_name: &str) -> Result<Vec<String>, String> {
    match value {
        Value::Null => Ok(Vec::new()),
        Value::Array(items) => {
            let mut out = Vec::new();
            for item in items {
                match item {
                    Value::String(raw) => {
                        let trimmed = raw.trim();
                        if !trimmed.is_empty() {
                            out.push(trimmed.to_string());
                        }
                    }
                    _ => {
                        return Err(format!("{field_name} must contain only string values"));
                    }
                }
            }
            Ok(out)
        }
        _ => Err(format!("{field_name} must be an array of strings or null")),
    }
}

fn take_task_patch_value(
    patch: &mut serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<Value> {
    let mut found: Option<Value> = None;
    for key in keys {
        if let Some(value) = patch.remove(*key) {
            if found.is_none() {
                found = Some(value);
            }
        }
    }
    found
}

fn ensure_allowed_task_value(
    field_name: &str,
    value: &str,
    allowed: &[&str],
) -> Result<(), String> {
    if allowed
        .iter()
        .any(|candidate| value.eq_ignore_ascii_case(candidate))
    {
        return Ok(());
    }
    Err(format!(
        "{field_name} must be one of: {}",
        allowed.join(", ")
    ))
}

fn build_task_update_patch(
    mut updates: serde_json::Map<String, Value>,
) -> Result<serde_json::Map<String, Value>, String> {
    updates.remove("id");
    updates.remove("taskId");
    updates.remove("task_id");
    updates.remove("createdAt");
    updates.remove("created_at");
    updates.remove("updatedAt");
    updates.remove("updated_at");

    let mut patch = serde_json::Map::new();

    if let Some(value) = take_task_patch_value(&mut updates, &["title"]) {
        let Some(title) = normalize_optional_task_string_value(value, "title")? else {
            return Err("title cannot be empty".to_string());
        };
        patch.insert("title".to_string(), Value::String(title));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["description"]) {
        match normalize_optional_task_string_value(value, "description")? {
            Some(description) => {
                patch.insert("description".to_string(), Value::String(description));
            }
            None => {
                patch.insert("description".to_string(), Value::Null);
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["status"]) {
        let Some(status) = normalize_optional_task_string_value(value, "status")? else {
            return Err("status cannot be empty".to_string());
        };
        ensure_allowed_task_value(
            "status",
            &status,
            &["todo", "in_progress", "review", "done", "blocked"],
        )?;
        patch.insert("status".to_string(), Value::String(status));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["priority"]) {
        let Some(priority) = normalize_optional_task_string_value(value, "priority")? else {
            return Err("priority cannot be empty".to_string());
        };
        ensure_allowed_task_value("priority", &priority, &["low", "medium", "high", "urgent"])?;
        patch.insert("priority".to_string(), Value::String(priority));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["type", "taskType", "task_type"]) {
        let Some(task_type) = normalize_optional_task_string_value(value, "type")? else {
            return Err("type cannot be empty".to_string());
        };
        ensure_allowed_task_value("type", &task_type, &["task", "milestone", "bug", "story"])?;
        patch.insert("type".to_string(), Value::String(task_type));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["tags"]) {
        patch.insert(
            "tags".to_string(),
            Value::Array(
                parse_task_string_list(value, "tags")?
                    .into_iter()
                    .map(Value::String)
                    .collect(),
            ),
        );
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["assignees"]) {
        patch.insert(
            "assignees".to_string(),
            Value::Array(
                parse_task_string_list(value, "assignees")?
                    .into_iter()
                    .map(Value::String)
                    .collect(),
            ),
        );
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["watchers"]) {
        patch.insert(
            "watchers".to_string(),
            Value::Array(
                parse_task_string_list(value, "watchers")?
                    .into_iter()
                    .map(Value::String)
                    .collect(),
            ),
        );
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["owner"]) {
        let Some(owner) = normalize_optional_task_string_value(value, "owner")? else {
            return Err("owner cannot be empty".to_string());
        };
        patch.insert("owner".to_string(), Value::String(owner));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["startDate", "start_date"]) {
        match parse_optional_task_i64_value(value, "startDate")? {
            Some(start_date) => {
                patch.insert("startDate".to_string(), Value::from(start_date));
            }
            None => {
                patch.insert("startDate".to_string(), Value::Null);
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["dueDate", "due_date"]) {
        match parse_optional_task_i64_value(value, "dueDate")? {
            Some(due_date) => {
                patch.insert("dueDate".to_string(), Value::from(due_date));
            }
            None => {
                patch.insert("dueDate".to_string(), Value::Null);
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["duration"]) {
        match parse_optional_task_i64_value(value, "duration")? {
            Some(duration) => {
                if duration < 0 {
                    return Err("duration must be >= 0".to_string());
                }
                patch.insert("duration".to_string(), Value::from(duration));
            }
            None => {
                patch.insert("duration".to_string(), Value::Null);
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["effortEstimate", "effort_estimate"])
    {
        match parse_optional_task_i64_value(value, "effortEstimate")? {
            Some(effort_estimate) => {
                if effort_estimate < 0 {
                    return Err("effortEstimate must be >= 0".to_string());
                }
                patch.insert("effortEstimate".to_string(), Value::from(effort_estimate));
            }
            None => {
                patch.insert("effortEstimate".to_string(), Value::Null);
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["progress"]) {
        let Some(progress) = parse_optional_task_i64_value(value, "progress")? else {
            return Err("progress cannot be null".to_string());
        };
        patch.insert("progress".to_string(), Value::from(progress.clamp(0, 100)));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["isMilestone", "is_milestone"]) {
        match value {
            Value::Bool(is_milestone) => {
                patch.insert("isMilestone".to_string(), Value::Bool(is_milestone));
            }
            _ => {
                return Err("isMilestone must be a boolean".to_string());
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["companyId", "company_id"]) {
        let Some(company_id) = normalize_optional_task_string_value(value, "companyId")? else {
            return Err("companyId cannot be empty".to_string());
        };
        patch.insert("companyId".to_string(), Value::String(company_id));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["projectId", "project_id"]) {
        let Some(project_id) = normalize_optional_task_string_value(value, "projectId")? else {
            return Err("projectId cannot be empty".to_string());
        };
        patch.insert("projectId".to_string(), Value::String(project_id));
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["customFields", "custom_fields"]) {
        match value {
            Value::Object(obj) => {
                patch.insert("customFields".to_string(), Value::Object(obj));
            }
            Value::Null => {
                patch.insert("customFields".to_string(), Value::Null);
            }
            _ => {
                return Err("customFields must be an object or null".to_string());
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["externalUrl", "external_url"]) {
        match normalize_optional_task_string_value(value, "externalUrl")? {
            Some(external_url) => {
                patch.insert("externalUrl".to_string(), Value::String(external_url));
            }
            None => {
                patch.insert("externalUrl".to_string(), Value::Null);
            }
        }
    }

    if let Some(value) = take_task_patch_value(&mut updates, &["provider"]) {
        match normalize_optional_task_string_value(value, "provider")? {
            Some(provider) => {
                ensure_allowed_task_value(
                    "provider",
                    &provider,
                    &["google", "microsoft", "jira", "monday", "other"],
                )?;
                patch.insert("provider".to_string(), Value::String(provider));
            }
            None => {
                patch.insert("provider".to_string(), Value::Null);
            }
        }
    }

    Ok(patch)
}

fn extension_for_icon(input: &str) -> Option<String> {
    let ext = Path::new(input)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())?;
    Some(ext)
}

fn build_windows_icon_cache_key(
    file_path: Option<&str>,
    file_name: Option<&str>,
    size: u32,
) -> String {
    if let Some(path) = file_path {
        if let Some(ext) = extension_for_icon(path) {
            if ext == "exe" || ext == "lnk" || ext == "url" || ext == "ico" {
                return format!("path:{}:{size}", path.to_lowercase());
            }
            return format!("ext:{ext}:{size}");
        }
        return format!("path:{}:{size}", path.to_lowercase());
    }

    if let Some(name) = file_name {
        if let Some(ext) = extension_for_icon(name) {
            return format!("ext:{ext}:{size}");
        }
        return format!("name:{}:{size}", name.to_lowercase());
    }

    format!("default:{size}")
}

#[cfg(target_os = "windows")]
fn resolve_windows_start_menu_app_id(target: &str) -> Result<Option<String>, String> {
    let script = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$candidate = [string]$env:ODE_START_APP_TARGET
if ($null -eq $candidate) { $candidate = '' }
$candidate = $candidate.Trim().Trim('"')
if (-not $candidate) { exit 0 }

if ($candidate -like 'shell:AppsFolder\*') {
  $candidate = $candidate.Substring('shell:AppsFolder\'.Length)
}

$apps = @(Get-StartApps)
if ($apps.Count -eq 0) { exit 0 }

$resolved = $null
if ($candidate -like '*!*') {
  $resolved = @($apps | Where-Object { $_.AppID -eq $candidate } | Select-Object -First 1)[0]
}

if (-not $resolved) {
  $resolved = @($apps | Where-Object { $_.Name -eq $candidate } | Select-Object -First 1)[0]
}

if (-not $resolved) {
  $resolved = @($apps | Where-Object { $_.Name -like ($candidate + '*') } | Select-Object -First 1)[0]
}

if (-not $resolved) {
  $resolved = @($apps | Where-Object { $_.Name -like ('*' + $candidate + '*') -or $_.AppID -like ('*' + $candidate + '*') } | Select-Object -First 1)[0]
}

if ($resolved -and $resolved.AppID) {
  [Console]::Write($resolved.AppID)
}
"#;

    let output = windows_powershell_command()
        .arg("-NoProfile")
        .arg("-NonInteractive")
        .arg("-Command")
        .arg(script)
        .env("ODE_START_APP_TARGET", target)
        .output()
        .map_err(|err| format!("failed to resolve start menu app: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Ok(None);
        }
        return Err(format!("start menu app resolution failed: {stderr}"));
    }

    let resolved = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if resolved.is_empty() {
        return Ok(None);
    }
    Ok(Some(resolved))
}

#[cfg(not(target_os = "windows"))]
fn resolve_windows_start_menu_app_id(_target: &str) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(target_os = "windows")]
fn extract_windows_file_icon_data_url(
    file_path: Option<&str>,
    file_name: Option<&str>,
    size: u32,
) -> Result<Option<String>, String> {
    let script = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$inputPath = $env:ODE_ICON_INPUT_PATH
$inputName = $env:ODE_ICON_INPUT_NAME
$iconSizeRaw = $env:ODE_ICON_SIZE
$iconSize = 20
if ([int]::TryParse($iconSizeRaw, [ref]$iconSize) -eq $false) { $iconSize = 20 }
if ($iconSize -lt 16) { $iconSize = 16 }
if ($iconSize -gt 128) { $iconSize = 128 }

Add-Type -AssemblyName System.Drawing | Out-Null

function Resolve-StartMenuAppMatch {
  param([string]$Candidate)
  $trimmed = [string]$Candidate
  if ($null -eq $trimmed) { $trimmed = '' }
  $trimmed = $trimmed.Trim().Trim('"')
  if (-not $trimmed) { return $null }

  if ($trimmed -like 'shell:AppsFolder\*') {
    $trimmed = $trimmed.Substring('shell:AppsFolder\'.Length)
  }

  $apps = @(Get-StartApps)
  if ($apps.Count -eq 0) { return $null }

  $resolved = $null
  if ($trimmed -like '*!*') {
    $resolved = @($apps | Where-Object { $_.AppID -eq $trimmed } | Select-Object -First 1)[0]
  }

  if (-not $resolved) {
    $resolved = @($apps | Where-Object { $_.Name -eq $trimmed } | Select-Object -First 1)[0]
  }

  if (-not $resolved) {
    $resolved = @($apps | Where-Object { $_.Name -like ($trimmed + '*') } | Select-Object -First 1)[0]
  }

  if (-not $resolved) {
    $resolved = @($apps | Where-Object { $_.Name -like ('*' + $trimmed + '*') -or $_.AppID -like ('*' + $trimmed + '*') } | Select-Object -First 1)[0]
  }

  return $resolved
}

function Resolve-StoreAppIconCandidatePath {
  param(
    [string]$InstallLocation,
    [string]$RelativePath,
    [int]$IconSize
  )

  if (-not $InstallLocation -or -not $RelativePath) { return $null }
  $normalizedRelative = $RelativePath -replace '/', '\'
  $directPath = Join-Path $InstallLocation $normalizedRelative
  if (Test-Path -LiteralPath $directPath -PathType Leaf) {
    return $directPath
  }

  $searchDir = Split-Path -Parent $directPath
  if (-not $searchDir -or -not (Test-Path -LiteralPath $searchDir -PathType Container)) {
    return $null
  }

  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($normalizedRelative)
  $extension = [System.IO.Path]::GetExtension($normalizedRelative)
  if (-not $baseName -or -not $extension) { return $null }

  $matches = @(Get-ChildItem -LiteralPath $searchDir -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Extension -ieq $extension -and $_.BaseName -like ($baseName + '*')
  } | Sort-Object `
    @{ Expression = {
      if ($_.BaseName -eq $baseName) { 0 }
      elseif ($_.BaseName -like ('*targetsize-' + $IconSize + '*')) { 1 }
      elseif ($_.BaseName -like '*scale-400*') { 2 }
      elseif ($_.BaseName -like '*scale-200*') { 3 }
      elseif ($_.BaseName -like '*scale-150*') { 4 }
      elseif ($_.BaseName -like '*scale-100*') { 5 }
      else { 9 }
    }}, `
    @{ Expression = { $_.Name.Length }})

  if ($matches.Count -gt 0) {
    return $matches[0].FullName
  }

  return $null
}

function Resolve-StoreAppIconDataUrl {
  param(
    [object]$AppEntry,
    [int]$IconSize
  )

  if (-not $AppEntry -or -not $AppEntry.AppID) { return $null }

  $appParts = $AppEntry.AppID -split '!', 2
  $packageFamilyName = if ($appParts.Count -gt 0) { $appParts[0] } else { $null }
  $manifestAppId = if ($appParts.Count -gt 1) { $appParts[1] } else { $null }
  if (-not $packageFamilyName) { return $null }

  $package = @(Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq $packageFamilyName } | Select-Object -First 1)[0]
  if (-not $package -or -not $package.InstallLocation) { return $null }

  $manifestPath = Join-Path $package.InstallLocation 'AppxManifest.xml'
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return $null }

  try {
    [xml]$manifest = Get-Content -LiteralPath $manifestPath
  } catch {
    return $null
  }

  $appNodes = @()
  if ($manifest.Package -and $manifest.Package.Applications) {
    foreach ($child in @($manifest.Package.Applications.ChildNodes)) {
      if ($child -and $child.LocalName -eq 'Application') {
        $appNodes += $child
      }
    }
  }
  if ($appNodes.Count -eq 0) { return $null }

  $appNode = $null
  if ($manifestAppId) {
    $appNode = @($appNodes | Where-Object { $_.Id -eq $manifestAppId } | Select-Object -First 1)[0]
  }
  if (-not $appNode) {
    $appNode = $appNodes[0]
  }
  if (-not $appNode) { return $null }

  $visual = @($appNode.ChildNodes | Where-Object { $_ -and $_.LocalName -eq 'VisualElements' } | Select-Object -First 1)[0]
  $relativeLogoPath = $null
  if ($visual) {
    foreach ($attributeName in @('Square44x44Logo', 'Square150x150Logo', 'Logo')) {
      $attributeValue = $visual.GetAttribute($attributeName)
      if ($attributeValue) {
        $relativeLogoPath = $attributeValue
        break
      }
    }
  }
  if (-not $relativeLogoPath) { return $null }

  $logoPath = Resolve-StoreAppIconCandidatePath -InstallLocation $package.InstallLocation -RelativePath $relativeLogoPath -IconSize $IconSize
  if (-not $logoPath -or -not (Test-Path -LiteralPath $logoPath -PathType Leaf)) { return $null }

  $extension = [System.IO.Path]::GetExtension($logoPath).ToLowerInvariant()
  $mime = switch ($extension) {
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.webp' { 'image/webp' }
    '.gif' { 'image/gif' }
    '.bmp' { 'image/bmp' }
    '.svg' { 'image/svg+xml' }
    default { $null }
  }
  if (-not $mime) { return $null }

  try {
    $bytes = [System.IO.File]::ReadAllBytes($logoPath)
  } catch {
    return $null
  }
  if (-not $bytes -or $bytes.Length -eq 0) { return $null }

  return ('data:' + $mime + ';base64,' + [Convert]::ToBase64String($bytes))
}

function Resolve-ShortcutTargetPath {
  param([string]$ShortcutPath)

  $trimmed = [string]$ShortcutPath
  if ($null -eq $trimmed) { $trimmed = '' }
  $trimmed = $trimmed.Trim().Trim('"')
  if (-not $trimmed) { return $null }
  if (-not (Test-Path -LiteralPath $trimmed -PathType Leaf)) { return $null }
  if ([System.IO.Path]::GetExtension($trimmed).ToLowerInvariant() -ne '.lnk') { return $null }

  try {
    $resolvedShortcutPath = (Resolve-Path -LiteralPath $trimmed -ErrorAction Stop).Path
    $parentDir = Split-Path -Parent $resolvedShortcutPath
    $leafName = Split-Path -Leaf $resolvedShortcutPath
    if (-not $parentDir -or -not $leafName) { return $null }

    $shell = New-Object -ComObject Shell.Application
    $folder = $shell.Namespace($parentDir)
    if (-not $folder) { return $null }
    $item = $folder.ParseName($leafName)
    if (-not $item -or -not $item.IsLink) { return $null }

    $link = $item.GetLink
    if (-not $link) { return $null }

    $candidate = ''
    if ($link.Path) {
      $candidate = ('' + $link.Path).Trim()
    }

    if (-not $candidate) { return $null }
    return $candidate
  } catch {
    return $null
  }
}

$resolvedStartMenuApp = $null
foreach ($candidate in @($inputPath, $inputName)) {
  if (-not $resolvedStartMenuApp) {
    $resolvedStartMenuApp = Resolve-StartMenuAppMatch $candidate
  }
}

if ($resolvedStartMenuApp) {
  $storeAppDataUrl = Resolve-StoreAppIconDataUrl -AppEntry $resolvedStartMenuApp -IconSize $iconSize
  if ($storeAppDataUrl) {
    [Console]::Write($storeAppDataUrl)
    exit 0
  }
}

$sourcePath = $null
$cleanupPath = $null
if ($inputPath -and (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
  $sourcePath = (Resolve-Path -LiteralPath $inputPath).Path
  $resolvedShortcutTarget = Resolve-ShortcutTargetPath $sourcePath
  if ($resolvedShortcutTarget -and (Test-Path -LiteralPath $resolvedShortcutTarget)) {
    $sourcePath = $resolvedShortcutTarget
  }
}

if (-not $sourcePath) {
  $ext = $null
  if ($inputName) { $ext = [System.IO.Path]::GetExtension($inputName) }
  if (-not $ext -and $inputPath) { $ext = [System.IO.Path]::GetExtension($inputPath) }
  if (-not $ext) { $ext = '.txt' }

  $tempBase = [System.IO.Path]::GetRandomFileName()
  if ($tempBase.Contains('.')) { $tempBase = $tempBase.Substring(0, $tempBase.IndexOf('.')) }
  $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ($tempBase + $ext)
  [System.IO.File]::WriteAllBytes($tempFile, (New-Object byte[] 0))
  $sourcePath = $tempFile
  $cleanupPath = $tempFile
}

$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($sourcePath)
if ($null -eq $icon) {
  if ($cleanupPath) {
    Remove-Item -LiteralPath $cleanupPath -Force -ErrorAction SilentlyContinue
  }
  exit 0
}

$bitmap = New-Object System.Drawing.Bitmap $iconSize, $iconSize
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.DrawIcon($icon, (New-Object System.Drawing.Rectangle(0, 0, $iconSize, $iconSize)))

$stream = New-Object System.IO.MemoryStream
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
[Console]::Write([Convert]::ToBase64String($stream.ToArray()))

$stream.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$icon.Dispose()

if ($cleanupPath) {
  Remove-Item -LiteralPath $cleanupPath -Force -ErrorAction SilentlyContinue
}
"#;

    let output = windows_powershell_command()
        .arg("-NoProfile")
        .arg("-NonInteractive")
        .arg("-Command")
        .arg(script)
        .env("ODE_ICON_INPUT_PATH", file_path.unwrap_or_default())
        .env("ODE_ICON_INPUT_NAME", file_name.unwrap_or_default())
        .env("ODE_ICON_SIZE", size.to_string())
        .output()
        .map_err(|err| format!("failed to extract windows file icon: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Ok(None);
        }
        return Err(format!("icon extraction failed: {stderr}"));
    }

    let encoded = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if encoded.is_empty() {
        return Ok(None);
    }
    if encoded.starts_with("data:") {
        return Ok(Some(encoded));
    }
    Ok(Some(format!("data:image/png;base64,{encoded}")))
}

#[cfg(not(target_os = "windows"))]
fn extract_windows_file_icon_data_url(
    _file_path: Option<&str>,
    _file_name: Option<&str>,
    _size: u32,
) -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
async fn get_windows_installed_font_families() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
Add-Type -AssemblyName PresentationCore
[System.Windows.Media.Fonts]::SystemFontFamilies |
  ForEach-Object { $_.Source } |
  Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
  Sort-Object -Unique
"#;

        let output = windows_powershell_command()
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Sta")
            .arg("-Command")
            .arg(script)
            .output()
            .map_err(|err| format!("failed to read installed fonts: {err}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if stderr.is_empty() {
                return Ok(Vec::new());
            }
            return Err(format!("font enumeration failed: {stderr}"));
        }

        let mut families = Vec::new();
        let mut seen = HashSet::new();
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let normalized_key = trimmed.to_ascii_lowercase();
            if seen.insert(normalized_key) {
                families.push(trimmed.to_string());
            }
        }
        return Ok(families);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

fn open_path_with_system_default(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let path_str = path.to_string_lossy().to_string();

        let file_protocol_status = Command::new("rundll32.exe")
            .arg("url.dll,FileProtocolHandler")
            .arg(&path_str)
            .status();
        if let Ok(status) = file_protocol_status {
            if status.success() {
                return Ok(());
            }
        }

        let explorer_status = Command::new("explorer").arg(&path_str).status();
        if let Ok(status) = explorer_status {
            if status.success() {
                return Ok(());
            }
        }

        return Err(format!("system opener failed for {:?}", path));
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .status()
            .map_err(|err| format!("failed to open path {:?}: {err}", path))
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("system opener failed for {:?}", path))
                }
            })?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .status()
            .map_err(|err| format!("failed to open path {:?}: {err}", path))
            .and_then(|status| {
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("system opener failed for {:?}", path))
                }
            })?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("opening files is not supported on this platform".to_string())
}

#[cfg(target_os = "windows")]
fn open_windows_file_location_with_explorer(path: &Path) -> Result<(), String> {
    let normalized = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let normalized_string = normalized.to_string_lossy().into_owned();
    let select_arg = format!(r#"/select,"{}""#, normalized_string);

    let direct_status = Command::new("explorer.exe")
        .raw_arg(&select_arg)
        .status()
        .map_err(|err| format!("failed to launch explorer for {:?}: {err}", normalized))?;
    if direct_status.success() {
        return Ok(());
    }

    let escaped_path = normalized_string.replace('\'', "''");
    let script = format!(
        "$target = '{}'; Start-Process -FilePath explorer.exe -ArgumentList @('/select,', $target)",
        escaped_path
    );
    let status = windows_powershell_command()
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .status()
        .map_err(|err| format!("failed to launch explorer for {:?}: {err}", normalized))?;

    if status.success() {
        return Ok(());
    }

    Err(format!("failed to launch explorer for {:?}", normalized))
}

fn open_file_location(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if normalized.is_dir() {
            return open_path_with_system_default(&normalized);
        }
        if open_windows_file_location_with_explorer(&normalized).is_ok() {
            return Ok(());
        }
        if let Some(parent) = normalized.parent() {
            return open_path_with_system_default(parent);
        }
        return Err(format!("failed to open explorer for {:?}", normalized));
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(parent) = path.parent() {
            return open_path_with_system_default(parent);
        }
        open_path_with_system_default(path)
    }
}

fn open_file_with_dialog(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("rundll32.exe")
            .arg("shell32.dll,OpenAs_RunDLL")
            .arg(path)
            .status()
            .map_err(|err| format!("failed to open 'Open with' dialog for {:?}: {err}", path))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("failed to open 'Open with' dialog for {:?}", path));
    }
    #[cfg(not(target_os = "windows"))]
    {
        open_path_with_system_default(path)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeRecord {
    node_id: String,
    parent_id: String,
    name: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(default)]
    properties: Value,
    description: Option<String>,
    order: i64,
    created_at: i64,
    updated_at: i64,
    content_type: Option<String>,
    ai_draft: Option<Value>,
    content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppNode {
    id: String,
    parent_id: String,
    name: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(default)]
    properties: Value,
    description: Option<String>,
    order: i64,
    created_at: i64,
    updated_at: i64,
    content_type: Option<String>,
    ai_draft: Option<Value>,
    content: Option<String>,
}

impl From<NodeRecord> for AppNode {
    fn from(value: NodeRecord) -> Self {
        Self {
            id: value.node_id,
            parent_id: value.parent_id,
            name: value.name,
            node_type: value.node_type,
            properties: value.properties,
            description: value.description,
            order: value.order,
            created_at: value.created_at,
            updated_at: value.updated_at,
            content_type: value.content_type,
            ai_draft: value.ai_draft,
            content: value.content,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRecord {
    #[serde(alias = "projectId")]
    project_id: String,
    name: String,
    #[serde(alias = "root_path")]
    root_path: String,
    #[serde(alias = "root_node_id")]
    root_node_id: String,
    #[serde(alias = "created_at")]
    created_at: i64,
    #[serde(alias = "updated_at")]
    updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSummary {
    id: String,
    name: String,
    root_path: String,
    root_node_id: String,
    created_at: i64,
    updated_at: i64,
}

impl From<ProjectRecord> for ProjectSummary {
    fn from(value: ProjectRecord) -> Self {
        Self {
            id: value.project_id,
            name: value.name,
            root_path: value.root_path,
            root_node_id: value.root_node_id,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

fn default_user_account_store_version() -> u32 {
    USER_ACCOUNT_STORE_VERSION
}

fn default_user_account_license_plan() -> String {
    "unlimited".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserAccountRecord {
    user_id: String,
    username: String,
    display_name: String,
    #[serde(default)]
    profile_photo_data_url: Option<String>,
    password_hash: String,
    role: String,
    is_admin: bool,
    disabled: bool,
    #[serde(default = "default_user_account_license_plan")]
    license_plan: String,
    #[serde(default)]
    license_started_at: Option<i64>,
    created_at: i64,
    updated_at: i64,
    last_login_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RememberedUserAccountSessionRecord {
    session_id: String,
    user_id: String,
    token: String,
    created_at: i64,
    expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserAccountStore {
    #[serde(default = "default_user_account_store_version")]
    version: u32,
    #[serde(default)]
    users: Vec<UserAccountRecord>,
    #[serde(default)]
    remembered_sessions: Vec<RememberedUserAccountSessionRecord>,
}

impl Default for UserAccountStore {
    fn default() -> Self {
        Self {
            version: USER_ACCOUNT_STORE_VERSION,
            users: Vec::new(),
            remembered_sessions: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserAccountSummary {
    user_id: String,
    username: String,
    display_name: String,
    profile_photo_data_url: Option<String>,
    role: String,
    is_admin: bool,
    disabled: bool,
    license_plan: String,
    license_started_at: Option<i64>,
    license_expires_at: Option<i64>,
    license_status: String,
    created_at: i64,
    updated_at: i64,
    last_login_at: Option<i64>,
}

impl From<&UserAccountRecord> for UserAccountSummary {
    fn from(value: &UserAccountRecord) -> Self {
        let license_expires_at = resolve_user_account_license_expires_at(value);
        Self {
            user_id: value.user_id.clone(),
            username: value.username.clone(),
            display_name: value.display_name.clone(),
            profile_photo_data_url: value.profile_photo_data_url.clone(),
            role: value.role.clone(),
            is_admin: value.is_admin,
            disabled: value.disabled,
            license_plan: value.license_plan.clone(),
            license_started_at: value.license_started_at,
            license_expires_at,
            license_status: resolve_user_account_license_status(value).to_string(),
            created_at: value.created_at,
            updated_at: value.updated_at,
            last_login_at: value.last_login_at,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserAccountAuthResult {
    user: UserAccountSummary,
    remembered_session_token: Option<String>,
    remembered_session_expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserAccountState {
    has_users: bool,
    users: Vec<UserAccountSummary>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapUserAccountInput {
    username: String,
    display_name: String,
    password: String,
    #[serde(default)]
    remember_session: Option<RememberedUserAccountSessionInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignInUserAccountInput {
    username: String,
    password: String,
    #[serde(default)]
    remember_session: Option<RememberedUserAccountSessionInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RememberedUserAccountSessionInput {
    duration_ms: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateUserAccountInput {
    username: String,
    display_name: String,
    password: String,
    role: String,
    is_admin: bool,
    profile_photo_data_url: Option<String>,
    #[serde(default = "default_user_account_license_plan")]
    license_plan: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateUserAccountInput {
    user_id: String,
    username: String,
    display_name: String,
    role: String,
    is_admin: bool,
    disabled: bool,
    profile_photo_data_url: Option<String>,
    next_password: Option<String>,
    #[serde(default = "default_user_account_license_plan")]
    license_plan: String,
    #[serde(default)]
    restart_license_from_now: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskRecord {
    task_id: String,
    title: String,
    description: Option<String>,
    status: String,
    priority: String,
    #[serde(rename = "type")]
    task_type: String,
    tags: Vec<String>,
    assignees: Vec<String>,
    watchers: Vec<String>,
    owner: String,
    start_date: Option<i64>,
    due_date: Option<i64>,
    duration: Option<i64>,
    effort_estimate: Option<i64>,
    progress: i64,
    is_milestone: bool,
    company_id: String,
    project_id: String,
    created_at: i64,
    updated_at: i64,
    custom_fields: Option<Value>,
    external_url: Option<String>,
    provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Task {
    id: String,
    title: String,
    description: Option<String>,
    status: String,
    priority: String,
    #[serde(rename = "type")]
    task_type: String,
    tags: Vec<String>,
    assignees: Vec<String>,
    watchers: Vec<String>,
    owner: String,
    start_date: Option<i64>,
    due_date: Option<i64>,
    duration: Option<i64>,
    effort_estimate: Option<i64>,
    progress: i64,
    is_milestone: bool,
    company_id: String,
    project_id: String,
    created_at: i64,
    updated_at: i64,
    custom_fields: Option<Value>,
    external_url: Option<String>,
    provider: Option<String>,
}

impl From<TaskRecord> for Task {
    fn from(value: TaskRecord) -> Self {
        Self {
            id: value.task_id,
            title: value.title,
            description: value.description,
            status: value.status,
            priority: value.priority,
            task_type: value.task_type,
            tags: value.tags,
            assignees: value.assignees,
            watchers: value.watchers,
            owner: value.owner,
            start_date: value.start_date,
            due_date: value.due_date,
            duration: value.duration,
            effort_estimate: value.effort_estimate,
            progress: value.progress,
            is_milestone: value.is_milestone,
            company_id: value.company_id,
            project_id: value.project_id,
            created_at: value.created_at,
            updated_at: value.updated_at,
            custom_fields: value.custom_fields,
            external_url: value.external_url,
            provider: value.provider,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskLinkRecord {
    link_id: String,
    task_id: String,
    node_id: String,
    is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskMetadata {
    counts: HashMap<String, i64>,
    blocked_node_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTaskInput {
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    #[serde(rename = "type")]
    task_type: Option<String>,
    tags: Option<Vec<String>>,
    assignees: Option<Vec<String>>,
    watchers: Option<Vec<String>>,
    owner: Option<String>,
    start_date: Option<i64>,
    due_date: Option<i64>,
    duration: Option<i64>,
    effort_estimate: Option<i64>,
    progress: Option<i64>,
    is_milestone: Option<bool>,
    company_id: Option<String>,
    project_id: Option<String>,
    custom_fields: Option<Value>,
    external_url: Option<String>,
    provider: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskFilterOptions {
    status: Option<Vec<String>>,
    priority: Option<Vec<String>>,
    assignee: Option<String>,
    node_id: Option<String>,
    include_subnodes: Option<bool>,
    search: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodePackage {
    version: i64,
    exported_at: i64,
    root: NodePackageNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspacePackageMetadata {
    name: String,
    #[serde(default)]
    project_id: Option<String>,
    #[serde(default)]
    root_path: Option<String>,
    #[serde(default)]
    root_node_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspacePackage {
    version: i64,
    exported_at: i64,
    #[serde(default)]
    workspace: Option<WorkspacePackageMetadata>,
    root: NodePackageNode,
}

#[derive(Debug, Clone, Copy)]
enum PackageOutputKind {
    Node,
    Workspace,
}

#[derive(Debug, Clone, Copy)]
enum WorkspaceMaterializeMode {
    Duplicate,
    Import,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodePackageNode {
    #[serde(default)]
    source_id: Option<String>,
    name: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(default)]
    properties: Value,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    content_type: Option<String>,
    #[serde(default)]
    ai_draft: Option<Value>,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    children: Vec<NodePackageNode>,
    #[serde(default)]
    file_rel_path: Option<String>,
}

fn sanitize_file_name_component(input: &str) -> String {
    let sanitized: String = input
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = sanitized.trim().trim_matches('.').trim().to_string();
    if trimmed.is_empty() {
        "node".to_string()
    } else {
        trimmed
    }
}

fn find_unique_node_name(desired_name: &str, taken_node_names: &HashSet<String>) -> String {
    let desired = desired_name.trim();
    let base = if desired.is_empty() {
        "New Topic".to_string()
    } else {
        desired.to_string()
    };
    if !taken_node_names.contains(&base.to_lowercase()) {
        return base;
    }
    for idx in 1..5000 {
        let candidate = if idx == 1 {
            format!("{base} (Copy)")
        } else {
            format!("{base} (Copy {idx})")
        };
        if !taken_node_names.contains(&candidate.to_lowercase()) {
            return candidate;
        }
    }
    format!("{base}-{}", now_ms())
}

fn build_unique_package_output_path(
    base_dir: &Path,
    base_name: &str,
    output_kind: PackageOutputKind,
) -> PathBuf {
    let safe = sanitize_file_name_component(base_name);
    let ts = now_ms();
    let extension = match output_kind {
        PackageOutputKind::Node => "odepkg",
        PackageOutputKind::Workspace => "odewsp",
    };
    let mut candidate = base_dir.join(format!("{safe}_{ts}.{extension}"));
    let mut index = 1usize;
    while candidate.exists() && index < 5000 {
        candidate = base_dir.join(format!("{safe}_{ts}_{index}.{extension}"));
        index += 1;
    }
    candidate
}

fn build_unique_export_output_path(base_dir: &Path, base_name: &str, extension: &str) -> PathBuf {
    let normalized_extension = extension.trim().trim_start_matches('.').to_ascii_lowercase();
    let trimmed_name = base_name.trim();
    let without_extension = if trimmed_name.is_empty() {
        "export".to_string()
    } else if trimmed_name
        .to_ascii_lowercase()
        .ends_with(&format!(".{normalized_extension}"))
    {
        trimmed_name[..trimmed_name.len() - normalized_extension.len() - 1]
            .trim()
            .to_string()
    } else {
        trimmed_name.to_string()
    };
    let safe = sanitize_file_name_component(&without_extension);
    let mut candidate = base_dir.join(format!("{safe}.{normalized_extension}"));
    if !candidate.exists() {
        return candidate;
    }
    let ts = now_ms();
    candidate = base_dir.join(format!("{safe}_{ts}.{normalized_extension}"));
    let mut index = 1usize;
    while candidate.exists() && index < 5000 {
        candidate = base_dir.join(format!("{safe}_{ts}_{index}.{normalized_extension}"));
        index += 1;
    }
    candidate
}

fn strip_file_path_properties(raw: &Value) -> serde_json::Map<String, Value> {
    let mut map = match raw {
        Value::Object(obj) => obj.clone(),
        _ => serde_json::Map::new(),
    };
    map.remove("mirrorFilePath");
    map.remove("importedFromPath");
    map.remove("sizeBytes");
    map
}

fn remap_string_ids(raw: &str, id_map: &HashMap<String, String>) -> String {
    if raw.is_empty() || id_map.is_empty() {
        return raw.to_string();
    }
    if let Some(mapped) = id_map.get(raw) {
        return mapped.clone();
    }
    let mut next = raw.to_string();
    for (source_id, target_id) in id_map {
        if source_id.is_empty() || source_id == target_id {
            continue;
        }
        if next.contains(source_id) {
            next = next.replace(source_id, target_id);
        }
    }
    next
}

fn remap_json_ids(value: &Value, id_map: &HashMap<String, String>) -> Value {
    match value {
        Value::String(raw) => Value::String(remap_string_ids(raw, id_map)),
        Value::Array(items) => {
            Value::Array(items.iter().map(|item| remap_json_ids(item, id_map)).collect())
        }
        Value::Object(map) => {
            let mut next = serde_json::Map::with_capacity(map.len());
            for (key, item) in map {
                next.insert(key.clone(), remap_json_ids(item, id_map));
            }
            Value::Object(next)
        }
        _ => value.clone(),
    }
}

fn collect_package_source_id_map(node: &NodePackageNode, id_map: &mut HashMap<String, String>) {
    if let Some(source_id) = node
        .source_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        id_map
            .entry(source_id.to_string())
            .or_insert_with(|| uuid::Uuid::new_v4().to_string());
    }
    for child in &node.children {
        collect_package_source_id_map(child, id_map);
    }
}

fn zip_directory_windows(source_dir: &Path, destination_file: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$src = $env:ODE_ZIP_SRC
$dst = $env:ODE_ZIP_DST
if (-not $src -or -not $dst) { throw 'missing zip inputs' }
if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst, [System.IO.Compression.CompressionLevel]::Optimal, $false)
"#;
        let output = windows_powershell_command()
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg(script)
            .env("ODE_ZIP_SRC", source_dir.to_string_lossy().to_string())
            .env(
                "ODE_ZIP_DST",
                destination_file.to_string_lossy().to_string(),
            )
            .output()
            .map_err(|err| format!("failed to create package archive: {err}"))?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Err("failed to create package archive".to_string());
        }
        return Err(stderr);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = source_dir;
        let _ = destination_file;
        Err("node package export is currently supported on Windows".to_string())
    }
}

fn unzip_file_windows(archive_file: &Path, destination_dir: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$src = $env:ODE_UNZIP_SRC
$dst = $env:ODE_UNZIP_DST
if (-not $src -or -not $dst) { throw 'missing unzip inputs' }
if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($src, $dst)
"#;
        let output = windows_powershell_command()
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg(script)
            .env("ODE_UNZIP_SRC", archive_file.to_string_lossy().to_string())
            .env(
                "ODE_UNZIP_DST",
                destination_dir.to_string_lossy().to_string(),
            )
            .output()
            .map_err(|err| format!("failed to extract package archive: {err}"))?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Err("failed to extract package archive".to_string());
        }
        return Err(stderr);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = archive_file;
        let _ = destination_dir;
        Err("node package import is currently supported on Windows".to_string())
    }
}

async fn init_db(app: &tauri::AppHandle) -> Result<Arc<Surreal<Db>>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|err| format!("failed to create app data dir {:?}: {err}", app_data_dir))?;

    let db_path = app_data_dir.join("odetool_pro.db");
    let db: Surreal<Db> = Surreal::new::<SurrealKv>(db_path.to_string_lossy().to_string())
        .await
        .map_err(db_err)?;

    db.use_ns("odetool_pro").use_db("main").await.map_err(db_err)?;
    match db.query(SCHEMA_SQL).await {
        Ok(_) => eprintln!("SurrealDB: Schema applied successfully"),
        Err(err) => eprintln!("SurrealDB: Schema application error: {}", err),
    }

    Ok(Arc::new(db))
}

async fn get_db(app: &tauri::AppHandle) -> Result<Arc<Surreal<Db>>, String> {
    DB.get_or_try_init(|| async { init_db(app).await })
        .await
        .map(Arc::clone)
}

async fn fetch_all_nodes(db: &Surreal<Db>) -> Result<Vec<NodeRecord>, String> {
    let mut response = db
        .query(
            "SELECT nodeId, node_id, parentId, parent_id, name, type, properties, description, order, createdAt, created_at, updatedAt, updated_at, contentType, content_type, aiDraft, ai_draft, content FROM node;",
        )
        .await
        .map_err(db_err)?;
    let rows: Vec<Value> = response.take(0).map_err(db_err)?;
    deserialize_json_rows(rows)
}

async fn fetch_root_folder_nodes(db: &Surreal<Db>) -> Result<Vec<NodeRecord>, String> {
    let mut response = db
        .query(
            "SELECT nodeId, node_id, parentId, parent_id, name, type, properties, description, order, createdAt, created_at, updatedAt, updated_at, contentType, content_type, aiDraft, ai_draft, content FROM node WHERE parentId = $parent_id AND type = 'folder';",
        )
        .bind(("parent_id", ROOT_PARENT_ID.to_string()))
        .await
        .map_err(db_err)?;
    let raw_rows: Vec<Value> = response.take(0).map_err(db_err)?;
    let mut rows: Vec<NodeRecord> = deserialize_json_rows(raw_rows)?;
    rows.sort_by_key(|node| node.order);
    Ok(rows)
}

async fn fetch_node_record(db: &Surreal<Db>, node_id: &str) -> Result<Option<NodeRecord>, String> {
    let mut response = db
        .query(
            "SELECT nodeId, node_id, parentId, parent_id, name, type, properties, description, order, createdAt, created_at, updatedAt, updated_at, contentType, content_type, aiDraft, ai_draft, content FROM node WHERE nodeId = $node_id LIMIT 1;",
        )
        .bind(("node_id", node_id.to_string()))
        .await
        .map_err(db_err)?;
    let raw_rows: Vec<Value> = response.take(0).map_err(db_err)?;
    let rows: Vec<NodeRecord> = deserialize_json_rows(raw_rows)?;
    Ok(rows.into_iter().next())
}

async fn fetch_nodes_by_parent(
    db: &Surreal<Db>,
    parent_id: &str,
) -> Result<Vec<NodeRecord>, String> {
    let mut response = db
        .query(
            "SELECT nodeId, node_id, parentId, parent_id, name, type, properties, description, order, createdAt, created_at, updatedAt, updated_at, contentType, content_type, aiDraft, ai_draft, content FROM node WHERE parentId = $parent_id;",
        )
        .bind(("parent_id", parent_id.to_string()))
        .await
        .map_err(db_err)?;
    let raw_rows: Vec<Value> = response.take(0).map_err(db_err)?;
    let mut rows: Vec<NodeRecord> = deserialize_json_rows(raw_rows)?;
    rows.sort_by_key(|node| node.order);
    Ok(rows)
}

async fn fetch_all_tasks(db: &Surreal<Db>) -> Result<Vec<TaskRecord>, String> {
    let mut response = db
        .query(
            "SELECT taskId, task_id, title, description, status, priority, type, startDate, start_date, dueDate, due_date, duration, effortEstimate, effort_estimate, progress, isMilestone, is_milestone, companyId, company_id, projectId, project_id, createdAt, created_at, updatedAt, updated_at, tags, assignees, watchers, owner, customFields, custom_fields, externalUrl, external_url, provider FROM task;",
        )
        .await
        .map_err(db_err)?;
    let rows: Vec<Value> = response.take(0).map_err(db_err)?;
    deserialize_json_rows(rows)
}

async fn fetch_task_record(db: &Surreal<Db>, task_id: &str) -> Result<Option<TaskRecord>, String> {
    let mut response = db
        .query(
            "SELECT taskId, task_id, title, description, status, priority, type, startDate, start_date, dueDate, due_date, duration, effortEstimate, effort_estimate, progress, isMilestone, is_milestone, companyId, company_id, projectId, project_id, createdAt, created_at, updatedAt, updated_at, tags, assignees, watchers, owner, customFields, custom_fields, externalUrl, external_url, provider FROM task WHERE taskId = $task_id LIMIT 1;",
        )
        .bind(("task_id", task_id.to_string()))
        .await
        .map_err(db_err)?;
    let raw_rows: Vec<Value> = response.take(0).map_err(db_err)?;
    let rows: Vec<TaskRecord> = deserialize_json_rows(raw_rows)?;
    Ok(rows.into_iter().next())
}

async fn fetch_all_task_links(db: &Surreal<Db>) -> Result<Vec<TaskLinkRecord>, String> {
    let mut response = db
        .query("SELECT linkId, link_id, taskId, task_id, nodeId, node_id, isPrimary, is_primary FROM taskLink;")
        .await
        .map_err(db_err)?;
    let rows: Vec<Value> = response.take(0).map_err(db_err)?;
    deserialize_json_rows(rows)
}

async fn cleanup_orphan_nodes_impl(db: &Surreal<Db>) -> Result<i64, String> {
    let all_nodes = fetch_all_nodes(db).await?;
    let reachable: HashSet<String> = descendant_ids_from_nodes(&all_nodes, ROOT_PARENT_ID)
        .into_iter()
        .collect();

    let orphan_ids: Vec<String> = all_nodes
        .iter()
        .filter(|node| !reachable.contains(&node.node_id))
        .map(|node| node.node_id.clone())
        .collect();

    for node_id in &orphan_ids {
        db.query("DELETE taskLink WHERE nodeId = $node_id;")
            .bind(("node_id", node_id.clone()))
            .await
            .map_err(db_err)?;
        db.query("DELETE node WHERE nodeId = $node_id;")
            .bind(("node_id", node_id.clone()))
            .await
            .map_err(db_err)?;
    }

    // Also clear dangling task links that reference non-existing nodes.
    let known_node_ids = reachable;
    let links = fetch_all_task_links(db).await?;
    for link in links {
        if !known_node_ids.contains(&link.node_id) {
            db.query("DELETE taskLink WHERE linkId = $link_id;")
                .bind(("link_id", link.link_id))
                .await
                .map_err(db_err)?;
        }
    }

    Ok(orphan_ids.len() as i64)
}

fn descendant_ids_from_nodes(all_nodes: &[NodeRecord], node_id: &str) -> Vec<String> {
    let mut by_parent: HashMap<&str, Vec<&str>> = HashMap::new();
    for node in all_nodes {
        by_parent
            .entry(node.parent_id.as_str())
            .or_default()
            .push(node.node_id.as_str());
    }

    let mut descendants = Vec::new();
    let mut stack = vec![node_id.to_string()];
    while let Some(current) = stack.pop() {
        if let Some(children) = by_parent.get(current.as_str()) {
            for child_id in children {
                descendants.push((*child_id).to_string());
                stack.push((*child_id).to_string());
            }
        }
    }
    descendants
}

fn should_index_search_property_key(key: &str) -> bool {
    !matches!(key, "mirrorFilePath" | "importedFromPath" | "sizeBytes")
}

fn append_json_search_terms(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::Null => {}
        Value::Bool(flag) => output.push(flag.to_string()),
        Value::Number(number) => output.push(number.to_string()),
        Value::String(text) => {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                output.push(trimmed.to_string());
            }
        }
        Value::Array(items) => {
            for item in items {
                append_json_search_terms(item, output);
            }
        }
        Value::Object(map) => {
            for (key, item) in map {
                if !should_index_search_property_key(key) {
                    continue;
                }
                output.push(key.clone());
                append_json_search_terms(item, output);
            }
        }
    }
}

fn build_node_search_properties_text(properties: &Value) -> String {
    let mut terms = Vec::new();
    append_json_search_terms(properties, &mut terms);
    terms.join("\n")
}

fn build_node_search_path(node: &NodeRecord, node_by_id: &HashMap<&str, &NodeRecord>) -> String {
    let mut names = vec![node.name.clone()];
    let mut current_parent_id = node.parent_id.as_str();
    let mut visited: HashSet<&str> = HashSet::new();

    while current_parent_id != ROOT_PARENT_ID && !current_parent_id.is_empty() {
        if !visited.insert(current_parent_id) {
            break;
        }
        let Some(parent) = node_by_id.get(current_parent_id).copied() else {
            break;
        };
        names.push(parent.name.clone());
        current_parent_id = parent.parent_id.as_str();
    }

    names.reverse();
    names.join(" / ")
}

fn score_node_search_match(
    node: &NodeRecord,
    normalized_query: &str,
    query_terms: &[String],
    node_by_id: &HashMap<&str, &NodeRecord>,
) -> Option<i64> {
    if normalized_query.is_empty() || query_terms.is_empty() {
        return None;
    }

    let name = node.name.to_lowercase();
    let path = build_node_search_path(node, node_by_id).to_lowercase();
    let node_type = node.node_type.to_lowercase();
    let content_type = node.content_type.as_deref().unwrap_or("").to_lowercase();
    let description = node.description.as_deref().unwrap_or("").to_lowercase();
    let content = node.content.as_deref().unwrap_or("").to_lowercase();
    let properties_text = build_node_search_properties_text(&node.properties).to_lowercase();
    let searchable_text = format!(
        "{name}\n{path}\n{node_type}\n{content_type}\n{description}\n{content}\n{properties_text}"
    );
    let full_query_match = searchable_text.contains(normalized_query);
    let all_terms_match = query_terms
        .iter()
        .all(|term| searchable_text.contains(term.as_str()));

    if !full_query_match && !all_terms_match {
        return None;
    }

    let mut score = 0_i64;

    if name == normalized_query {
        score += 1000;
    } else if name.starts_with(normalized_query) {
        score += 700;
    } else if name.contains(normalized_query) {
        score += 450;
    }

    if path == normalized_query {
        score += 600;
    } else if path.starts_with(normalized_query) {
        score += 320;
    } else if path.contains(normalized_query) {
        score += 180;
    }

    if node_type == normalized_query {
        score += 140;
    } else if node_type.contains(normalized_query) {
        score += 80;
    }

    if content_type == normalized_query {
        score += 100;
    } else if !content_type.is_empty() && content_type.contains(normalized_query) {
        score += 50;
    }

    if description.contains(normalized_query) {
        score += 160;
    }

    if content.contains(normalized_query) {
        score += 130;
    }

    if properties_text.contains(normalized_query) {
        score += 120;
    }

    for term in query_terms {
        if name.contains(term) {
            score += 90;
        }
        if path.contains(term) {
            score += 55;
        }
        if node_type.contains(term) {
            score += 22;
        }
        if !content_type.is_empty() && content_type.contains(term) {
            score += 18;
        }
        if description.contains(term) {
            score += 28;
        }
        if content.contains(term) {
            score += 24;
        }
        if properties_text.contains(term) {
            score += 20;
        }
    }

    Some(score)
}

async fn get_task_ids_for_node_impl(
    db: &Surreal<Db>,
    node_id: &str,
    include_subnodes: bool,
) -> Result<Vec<String>, String> {
    let links = fetch_all_task_links(db).await?;
    let mut node_set: HashSet<String> = HashSet::new();
    node_set.insert(node_id.to_string());

    if include_subnodes {
        let all_nodes = fetch_all_nodes(db).await?;
        for descendant in descendant_ids_from_nodes(&all_nodes, node_id) {
            node_set.insert(descendant);
        }
    }

    let mut seen = HashSet::new();
    let mut ids = Vec::new();
    for link in links {
        if node_set.contains(&link.node_id) && seen.insert(link.task_id.clone()) {
            ids.push(link.task_id);
        }
    }

    Ok(ids)
}

#[tauri::command]
async fn get_nodes(
    app: tauri::AppHandle,
    parent_id: Option<String>,
) -> Result<Vec<AppNode>, String> {
    let db = get_db(&app).await?;
    let target_parent = parent_id.unwrap_or_else(|| ROOT_PARENT_ID.to_string());
    let rows = fetch_nodes_by_parent(&db, &target_parent).await?;
    Ok(rows.into_iter().map(AppNode::from).collect())
}

#[tauri::command]
async fn get_all_nodes(app: tauri::AppHandle) -> Result<Vec<AppNode>, String> {
    let db = get_db(&app).await?;
    let rows = fetch_all_nodes(&db).await?;
    Ok(rows.into_iter().map(AppNode::from).collect())
}

#[tauri::command]
async fn get_node(app: tauri::AppHandle, id: String) -> Result<Option<AppNode>, String> {
    let db = get_db(&app).await?;
    let node = fetch_node_record(&db, &id).await?;
    Ok(node.map(AppNode::from))
}

const NODE_STRUCTURE_LOCKED_PROPERTY: &str = "odeStructureLocked";

fn node_has_structure_lock(properties: &Value) -> bool {
    properties
        .get(NODE_STRUCTURE_LOCKED_PROPERTY)
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
}

fn find_structure_lock_owner<'a>(
    node_id: &str,
    node_by_id: &'a HashMap<String, &'a NodeRecord>,
) -> Option<&'a NodeRecord> {
    if node_id.is_empty() || node_id == ROOT_PARENT_ID {
        return None;
    }
    let mut current_id = node_id.to_string();
    loop {
        let current = node_by_id.get(&current_id).copied()?;
        if node_has_structure_lock(&current.properties) {
            return Some(current);
        }
        if current.parent_id == ROOT_PARENT_ID {
            return None;
        }
        current_id = current.parent_id.clone();
    }
}

async fn ensure_structure_mutation_allowed(
    db: &Surreal<Db>,
    candidate_ids: &[String],
) -> Result<(), String> {
    let all_nodes = fetch_all_nodes(db).await?;
    let mut node_by_id: HashMap<String, &NodeRecord> = HashMap::new();
    for node in &all_nodes {
        node_by_id.insert(node.node_id.clone(), node);
    }
    for candidate_id in candidate_ids {
        if let Some(owner) = find_structure_lock_owner(candidate_id, &node_by_id) {
            return Err(format!(
                "Structure is locked by \"{}\". Unlock this branch before changing the tree.",
                owner.name
            ));
        }
    }
    Ok(())
}

#[tauri::command]
async fn create_node(
    app: tauri::AppHandle,
    parent_id: Option<String>,
    name: String,
    node_type: Option<String>,
) -> Result<AppNode, String> {
    let db = get_db(&app).await?;
    let target_parent = parent_id.unwrap_or_else(|| ROOT_PARENT_ID.to_string());
    ensure_structure_mutation_allowed(&db, &[target_parent.clone()]).await?;
    let siblings = fetch_nodes_by_parent(&db, &target_parent).await?;
    let max_order = siblings.iter().map(|node| node.order).max().unwrap_or(0);
    let now = now_ms();

    let record = NodeRecord {
        node_id: uuid::Uuid::new_v4().to_string(),
        parent_id: target_parent,
        name,
        node_type: node_type.unwrap_or_else(|| "folder".to_string()),
        properties: Value::Object(serde_json::Map::new()),
        description: None,
        order: max_order + 1000,
        created_at: now,
        updated_at: now,
        content_type: None,
        ai_draft: None,
        content: None,
    };

    db.query("CREATE node CONTENT $record;")
        .bind(("record", record.clone()))
        .await
        .map_err(db_err)?;

    if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
        eprintln!("desktop mirror sync failed after create_node: {err}");
    }

    Ok(AppNode::from(record))
}

#[tauri::command]
async fn update_node_content(
    app: tauri::AppHandle,
    id: String,
    text: String,
) -> Result<(), String> {
    let db = get_db(&app).await?;
    write_node_content(&db, &id, text).await?;
    Ok(())
}

#[tauri::command]
async fn update_node_description(
    app: tauri::AppHandle,
    id: String,
    description: Option<String>,
) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.query(UPDATE_NODE_DESCRIPTION_QUERY)
        .bind(("description", description))
        .bind(("updated_at", now_ms()))
        .bind(("node_id", id))
        .await
        .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
async fn rename_node(app: tauri::AppHandle, id: String, new_name: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    ensure_structure_mutation_allowed(&db, &[id.clone()]).await?;
    let updated_at = now_ms();
    db.query("UPDATE node SET name = $new_name, updatedAt = $updated_at WHERE nodeId = $node_id;")
        .bind(("new_name", new_name.clone()))
        .bind(("updated_at", updated_at))
        .bind(("node_id", id.clone()))
        .await
        .map_err(db_err)?;
    db.query("UPDATE project SET name = $new_name, updatedAt = $updated_at WHERE rootNodeId = $node_id OR root_node_id = $node_id;")
        .bind(("new_name", new_name))
        .bind(("updated_at", updated_at))
        .bind(("node_id", id))
        .await
        .map_err(db_err)?;

    if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
        eprintln!("desktop mirror sync failed after rename_node: {err}");
    }
    Ok(())
}

#[tauri::command]
async fn update_node_properties(
    app: tauri::AppHandle,
    id: String,
    new_properties: Value,
) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.query("UPDATE node SET properties = $properties, updatedAt = $updated_at WHERE nodeId = $node_id;")
        .bind(("properties", new_properties))
        .bind(("updated_at", now_ms()))
        .bind(("node_id", id))
        .await
        .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
async fn delete_node(
    app: tauri::AppHandle,
    id: String,
    sync_projection: Option<bool>,
) -> Result<(), String> {
    let db = get_db(&app).await?;
    ensure_structure_mutation_allowed(&db, &[id.clone()]).await?;
    let all_nodes = fetch_all_nodes(&db).await?;
    let mut targets = descendant_ids_from_nodes(&all_nodes, &id);
    targets.push(id);
    let target_id_set: HashSet<String> = targets.iter().cloned().collect();
    let mut remaining_file_paths: HashSet<String> = HashSet::new();
    for node in &all_nodes {
        if target_id_set.contains(&node.node_id) || !node.node_type.eq_ignore_ascii_case("file") {
            continue;
        }
        let file_path_raw = node
            .properties
            .get("mirrorFilePath")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let Some(file_path_raw) = file_path_raw else {
            continue;
        };
        let file_path = PathBuf::from(file_path_raw);
        remaining_file_paths.insert(path_storage_key(&file_path));
    }
    let managed_files_root = get_internal_state_root_path(&app)
        .ok()
        .map(|path| path.join(MIRROR_NODE_FILES_DIR_NAME));
    if let Some(managed_files_root) = managed_files_root.as_ref() {
        let mut cleaned_file_path_keys: HashSet<String> = HashSet::new();
        for node in &all_nodes {
            if !target_id_set.contains(&node.node_id)
                || !node.node_type.eq_ignore_ascii_case("file")
            {
                continue;
            }
            let file_path_raw = node
                .properties
                .get("mirrorFilePath")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty());
            let Some(file_path_raw) = file_path_raw else {
                continue;
            };
            let file_path = PathBuf::from(file_path_raw);
            if !file_path.exists() || !file_path.is_file() {
                continue;
            }
            if !path_is_within_root(&file_path, managed_files_root) {
                continue;
            }

            let key = path_storage_key(&file_path);
            if cleaned_file_path_keys.contains(&key) || remaining_file_paths.contains(&key) {
                continue;
            }

            if fs::remove_file(&file_path).is_ok() {
                cleaned_file_path_keys.insert(key);
                if let Some(parent_dir) = file_path.parent() {
                    if path_is_within_root(parent_dir, managed_files_root) {
                        let _ = fs::remove_dir(parent_dir);
                    }
                }
            }
        }
    }

    for node_id in targets {
        db.query("DELETE project WHERE rootNodeId = $node_id OR root_node_id = $node_id;")
            .bind(("node_id", node_id.clone()))
            .await
            .map_err(db_err)?;
        db.query("DELETE taskLink WHERE nodeId = $node_id;")
            .bind(("node_id", node_id.clone()))
            .await
            .map_err(db_err)?;
        db.query("DELETE node WHERE nodeId = $node_id;")
            .bind(("node_id", node_id))
            .await
            .map_err(db_err)?;
    }

    if sync_projection.unwrap_or(true) {
        if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
            eprintln!("desktop mirror sync failed after delete_node: {err}");
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_ancestors(app: tauri::AppHandle, node_id: String) -> Result<Vec<AppNode>, String> {
    let db = get_db(&app).await?;
    let mut path: Vec<AppNode> = Vec::new();
    let mut current_id = Some(node_id);

    while let Some(node_id_value) = current_id {
        let node = fetch_node_record(&db, &node_id_value).await?;
        let Some(found) = node else {
            break;
        };
        let parent_id = found.parent_id.clone();
        path.push(AppNode::from(found));
        if parent_id == ROOT_PARENT_ID {
            break;
        }
        current_id = Some(parent_id);
    }

    path.reverse();
    Ok(path)
}

#[tauri::command]
async fn get_all_descendant_ids(
    app: tauri::AppHandle,
    node_id: String,
) -> Result<Vec<String>, String> {
    let db = get_db(&app).await?;
    let all_nodes = fetch_all_nodes(&db).await?;
    Ok(descendant_ids_from_nodes(&all_nodes, &node_id))
}

#[tauri::command]
async fn move_node(
    app: tauri::AppHandle,
    node_id: String,
    new_parent_id: Option<String>,
    after_id: Option<String>,
    sync_projection: Option<bool>,
) -> Result<(), String> {
    let db = get_db(&app).await?;
    let mut guard_candidates = vec![node_id.clone()];
    if let Some(target) = &new_parent_id {
        guard_candidates.push(target.clone());
    }
    ensure_structure_mutation_allowed(&db, &guard_candidates).await?;
    let moving = fetch_node_record(&db, &node_id)
        .await?
        .ok_or_else(|| format!("Node not found: {node_id}"))?;

    let all_nodes = fetch_all_nodes(&db).await?;
    if let Some(target) = &new_parent_id {
        if target == &node_id {
            return Err("cannot move a node into itself".to_string());
        }
        if target != ROOT_PARENT_ID && !all_nodes.iter().any(|node| node.node_id == *target) {
            return Err(format!("Target parent not found: {target}"));
        }
        let descendants = descendant_ids_from_nodes(&all_nodes, &node_id);
        if descendants.contains(target) {
            return Err("cannot move a node into its own descendant".to_string());
        }
    }
    if let Some(after) = &after_id {
        if after == &node_id {
            return Err("cannot place a node after itself".to_string());
        }
    }

    let target_parent = new_parent_id.unwrap_or_else(|| ROOT_PARENT_ID.to_string());
    preserve_cross_workspace_file_sources_before_move(
        &app,
        &db,
        &all_nodes,
        &node_id,
        &target_parent,
    )
    .await?;
    let mut siblings = fetch_nodes_by_parent(&db, &target_parent).await?;
    siblings.retain(|node| node.node_id != node_id);

    let insert_index = match after_id {
        None => 0,
        Some(after) => siblings
            .iter()
            .position(|node| node.node_id == after)
            .map(|idx| idx + 1)
            .unwrap_or(siblings.len()),
    };

    let mut moving_record = moving;
    moving_record.parent_id = target_parent.clone();
    siblings.insert(insert_index, moving_record);

    for (idx, sibling) in siblings.into_iter().enumerate() {
        db.query("UPDATE node SET parentId = $parent_id, `order` = $order, updatedAt = $updated_at WHERE nodeId = $node_id;")
            .bind(("parent_id", sibling.parent_id))
            .bind(("order", ((idx + 1) as i64) * 1000))
            .bind(("updated_at", now_ms()))
            .bind(("node_id", sibling.node_id))
            .await
            .map_err(db_err)?;
    }

    if sync_projection.unwrap_or(true) {
        if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
            eprintln!("desktop mirror sync failed after move_node: {err}");
        }
    }

    Ok(())
}

fn resolve_workspace_root_id_for_node(
    node_id: &str,
    node_by_id: &HashMap<String, &NodeRecord>,
) -> Option<String> {
    let mut current_id = node_id.to_string();
    loop {
        let current = node_by_id.get(&current_id)?;
        if current.parent_id == ROOT_PARENT_ID {
            return Some(current.node_id.clone());
        }
        current_id = current.parent_id.clone();
    }
}

async fn preserve_cross_workspace_file_sources_before_move(
    app: &tauri::AppHandle,
    db: &Surreal<Db>,
    all_nodes: &[NodeRecord],
    moving_node_id: &str,
    target_parent_id: &str,
) -> Result<(), String> {
    let mut node_by_id: HashMap<String, &NodeRecord> = HashMap::new();
    for node in all_nodes {
        node_by_id.insert(node.node_id.clone(), node);
    }

    let Some(source_root_id) = resolve_workspace_root_id_for_node(moving_node_id, &node_by_id)
    else {
        return Ok(());
    };
    let target_root_id = if target_parent_id == ROOT_PARENT_ID {
        None
    } else {
        resolve_workspace_root_id_for_node(target_parent_id, &node_by_id)
    };
    if target_root_id.as_deref() == Some(source_root_id.as_str()) {
        return Ok(());
    }

    let projects = match fetch_all_projects(db).await {
        Ok(rows) => rows,
        Err(err) => {
            eprintln!("move_node: project index unavailable for file-source safeguard: {err}");
            Vec::new()
        }
    };
    let project_paths_by_root_id =
        build_project_paths_by_root_id_for_projection(all_nodes, &projects);

    let source_root_path = project_paths_by_root_id
        .get(&source_root_id)
        .cloned()
        .or_else(|| {
            node_by_id
                .get(&source_root_id)
                .and_then(|node| extract_project_path_from_node_properties(&node.properties))
        })
        .unwrap_or_default();
    let clean_source_root_path = source_root_path.trim();
    if clean_source_root_path.is_empty() || is_internal_workspace_root_path(clean_source_root_path)
    {
        return Ok(());
    }

    let source_root_dir = PathBuf::from(clean_source_root_path);
    let mut moved_subtree_ids: HashSet<String> =
        descendant_ids_from_nodes(all_nodes, moving_node_id)
            .into_iter()
            .collect();
    moved_subtree_ids.insert(moving_node_id.to_string());

    for node in all_nodes {
        if !moved_subtree_ids.contains(&node.node_id)
            || !node.node_type.eq_ignore_ascii_case("file")
        {
            continue;
        }

        let source_file_path_raw = node
            .properties
            .get("mirrorFilePath")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let Some(source_file_path_raw) = source_file_path_raw else {
            continue;
        };
        let source_file_path = PathBuf::from(source_file_path_raw);
        if !source_file_path.exists() || !source_file_path.is_file() {
            continue;
        }
        if !path_is_within_root(&source_file_path, &source_root_dir) {
            continue;
        }

        let target_dir = ensure_node_files_dir(app, &node.node_id)?;
        let mut taken_file_names: HashSet<String> = HashSet::new();
        if let Ok(entries) = fs::read_dir(&target_dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    taken_file_names.insert(name.to_lowercase());
                }
            }
        }

        let desired_name_seed = source_file_path
            .file_name()
            .and_then(|value| value.to_str())
            .map(sanitize_file_name_component)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| sanitize_file_name_component(&node.name));
        let empty_taken_nodes: HashSet<String> = HashSet::new();
        let final_name =
            find_unique_import_name(&desired_name_seed, &empty_taken_nodes, &taken_file_names);
        let destination = target_dir.join(final_name);

        if !paths_refer_to_same_location(&source_file_path, &destination) {
            fs::copy(&source_file_path, &destination).map_err(|err| {
                format!(
                    "failed to preserve file source before cross-workspace move {:?} -> {:?}: {err}",
                    source_file_path, destination
                )
            })?;
        }

        let size = fs::metadata(&destination)
            .map(|meta| meta.len())
            .unwrap_or(0);
        let mut next_properties = strip_file_path_properties(&node.properties);
        next_properties.insert(
            "mirrorFilePath".to_string(),
            Value::String(destination.to_string_lossy().to_string()),
        );
        next_properties.insert(
            "importedFromPath".to_string(),
            Value::String(source_file_path.to_string_lossy().to_string()),
        );
        next_properties.insert("sizeBytes".to_string(), Value::from(size));

        db.query("UPDATE node SET properties = $properties, updatedAt = $updated_at WHERE nodeId = $node_id;")
            .bind(("properties", Value::Object(next_properties)))
            .bind(("updated_at", now_ms()))
            .bind(("node_id", node.node_id.clone()))
            .await
            .map_err(db_err)?;
    }

    Ok(())
}

#[tauri::command]
async fn search_nodes(app: tauri::AppHandle, query: String) -> Result<Vec<AppNode>, String> {
    let db = get_db(&app).await?;
    let all_nodes = fetch_all_nodes(&db).await?;
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let query_terms: Vec<String> = q
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(|term| term.to_string())
        .collect();
    if query_terms.is_empty() {
        return Ok(Vec::new());
    }

    // Only search nodes that are reachable from the logical root.
    // This prevents stale/orphan records from appearing in search results.
    let reachable: HashSet<String> = descendant_ids_from_nodes(&all_nodes, ROOT_PARENT_ID)
        .into_iter()
        .collect();
    let node_by_id: HashMap<&str, &NodeRecord> = all_nodes
        .iter()
        .map(|node| (node.node_id.as_str(), node))
        .collect();

    let mut filtered: Vec<(i64, NodeRecord)> = all_nodes
        .iter()
        .filter(|node| reachable.contains(&node.node_id))
        .filter_map(|node| {
            score_node_search_match(node, &q, &query_terms, &node_by_id)
                .map(|score| (score, node.clone()))
        })
        .collect();

    filtered.sort_by(|(left_score, left_node), (right_score, right_node)| {
        right_score
            .cmp(left_score)
            .then_with(|| right_node.updated_at.cmp(&left_node.updated_at))
            .then_with(|| left_node.order.cmp(&right_node.order))
            .then_with(|| left_node.name.cmp(&right_node.name))
    });

    Ok(filtered
        .into_iter()
        .map(|(_, node)| AppNode::from(node))
        .collect())
}

#[tauri::command]
async fn cleanup_orphan_nodes(app: tauri::AppHandle) -> Result<i64, String> {
    let db = get_db(&app).await?;
    cleanup_orphan_nodes_impl(&db).await
}

#[tauri::command]
async fn create_task(app: tauri::AppHandle, task_data: CreateTaskInput) -> Result<Task, String> {
    let db = get_db(&app).await?;
    let now = now_ms();
    let record = TaskRecord {
        task_id: uuid::Uuid::new_v4().to_string(),
        title: task_data.title.trim().to_string(),
        description: task_data.description,
        status: task_data.status.unwrap_or_else(|| "todo".to_string()),
        priority: task_data.priority.unwrap_or_else(|| "medium".to_string()),
        task_type: task_data.task_type.unwrap_or_else(|| "task".to_string()),
        tags: task_data.tags.unwrap_or_default(),
        assignees: task_data.assignees.unwrap_or_default(),
        watchers: task_data.watchers.unwrap_or_default(),
        owner: task_data.owner.unwrap_or_else(|| "system".to_string()),
        start_date: task_data.start_date,
        due_date: task_data.due_date,
        duration: task_data.duration,
        effort_estimate: task_data.effort_estimate,
        progress: task_data.progress.unwrap_or(0),
        is_milestone: task_data.is_milestone.unwrap_or(false),
        company_id: task_data
            .company_id
            .unwrap_or_else(|| "default".to_string()),
        project_id: task_data
            .project_id
            .unwrap_or_else(|| "default".to_string()),
        created_at: now,
        updated_at: now,
        custom_fields: task_data.custom_fields,
        external_url: task_data.external_url,
        provider: task_data.provider,
    };

    db.query("CREATE task CONTENT $record;")
        .bind(("record", record.clone()))
        .await
        .map_err(db_err)?;

    Ok(Task::from(record))
}

#[tauri::command]
async fn get_task(app: tauri::AppHandle, id: String) -> Result<Option<Task>, String> {
    let db = get_db(&app).await?;
    let task = fetch_task_record(&db, &id).await?;
    Ok(task.map(Task::from))
}

#[tauri::command]
async fn update_task(app: tauri::AppHandle, id: String, updates: Value) -> Result<(), String> {
    let db = get_db(&app).await?;
    let map = match updates {
        Value::Object(map) => map,
        _ => return Err("updates must be a JSON object".to_string()),
    };
    let mut patch = build_task_update_patch(map)?;
    if patch.is_empty() {
        return Ok(());
    }
    patch.insert("updatedAt".to_string(), Value::from(now_ms()));

    db.query("UPDATE task MERGE $patch WHERE taskId = $task_id;")
        .bind(("patch", Value::Object(patch)))
        .bind(("task_id", id))
        .await
        .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
async fn delete_task(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.query("DELETE task WHERE taskId = $task_id;")
        .bind(("task_id", id.clone()))
        .await
        .map_err(db_err)?;
    db.query("DELETE taskLink WHERE taskId = $task_id;")
        .bind(("task_id", id))
        .await
        .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
async fn search_tasks(
    app: tauri::AppHandle,
    options: TaskFilterOptions,
) -> Result<Vec<Task>, String> {
    let db = get_db(&app).await?;
    let mut tasks: Vec<TaskRecord> = fetch_all_tasks(&db).await?;

    if let Some(statuses) = options.status {
        let set: HashSet<String> = statuses.into_iter().collect();
        tasks.retain(|task| set.contains(&task.status));
    }

    if let Some(priorities) = options.priority {
        let set: HashSet<String> = priorities.into_iter().collect();
        tasks.retain(|task| set.contains(&task.priority));
    }

    if let Some(assignee) = options.assignee {
        tasks.retain(|task| task.assignees.iter().any(|a| a == &assignee));
    }

    if let Some(search) = options.search {
        let q = search.trim().to_lowercase();
        if !q.is_empty() {
            tasks.retain(|task| {
                task.title.to_lowercase().contains(&q)
                    || task
                        .description
                        .as_ref()
                        .map(|text| text.to_lowercase().contains(&q))
                        .unwrap_or(false)
            });
        }
    }

    if let Some(node_id) = options.node_id {
        let include = options.include_subnodes.unwrap_or(true);
        let task_ids: HashSet<String> = get_task_ids_for_node_impl(&db, &node_id, include)
            .await?
            .into_iter()
            .collect();
        tasks.retain(|task| task_ids.contains(&task.task_id));
    }

    tasks.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(tasks.into_iter().map(Task::from).collect())
}

#[tauri::command]
async fn link_task_to_node(
    app: tauri::AppHandle,
    task_id: String,
    node_id: String,
    is_primary: bool,
) -> Result<(), String> {
    let db = get_db(&app).await?;

    if is_primary {
        db.query(
            "UPDATE taskLink SET isPrimary = false WHERE taskId = $task_id AND isPrimary = true;",
        )
        .bind(("task_id", task_id.clone()))
        .await
        .map_err(db_err)?;
    }

    let links = fetch_all_task_links(&db).await?;
    if let Some(existing) = links
        .into_iter()
        .find(|link| link.task_id == task_id && link.node_id == node_id)
    {
        if is_primary && !existing.is_primary {
            db.query("UPDATE taskLink SET isPrimary = true WHERE linkId = $link_id;")
                .bind(("link_id", existing.link_id))
                .await
                .map_err(db_err)?;
        }
        return Ok(());
    }

    let link = TaskLinkRecord {
        link_id: uuid::Uuid::new_v4().to_string(),
        task_id,
        node_id,
        is_primary,
    };
    db.query("CREATE taskLink CONTENT $link;")
        .bind(("link", link))
        .await
        .map_err(db_err)?;

    Ok(())
}

#[tauri::command]
async fn unlink_task_from_node(
    app: tauri::AppHandle,
    task_id: String,
    node_id: String,
) -> Result<(), String> {
    let db = get_db(&app).await?;
    db.query("DELETE taskLink WHERE taskId = $task_id AND nodeId = $node_id;")
        .bind(("task_id", task_id))
        .bind(("node_id", node_id))
        .await
        .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
async fn get_task_ids_for_node(
    app: tauri::AppHandle,
    node_id: String,
    include_subnodes: Option<bool>,
) -> Result<Vec<String>, String> {
    let db = get_db(&app).await?;
    get_task_ids_for_node_impl(&db, &node_id, include_subnodes.unwrap_or(false)).await
}

#[tauri::command]
async fn get_task_metadata(app: tauri::AppHandle) -> Result<TaskMetadata, String> {
    let db = get_db(&app).await?;
    let links = fetch_all_task_links(&db).await?;
    let mut counts: HashMap<String, i64> = HashMap::new();
    for link in links {
        *counts.entry(link.node_id).or_insert(0) += 1;
    }
    Ok(TaskMetadata {
        counts,
        blocked_node_ids: Vec::new(),
    })
}

#[tauri::command]
async fn import_files_to_node(
    app: tauri::AppHandle,
    parent_node_id: Option<String>,
    source_paths: Vec<String>,
) -> Result<Vec<AppNode>, String> {
    if source_paths.is_empty() {
        return Ok(Vec::new());
    }

    let db = get_db(&app).await?;
    let target_parent = parent_node_id.unwrap_or_else(|| ROOT_PARENT_ID.to_string());
    ensure_structure_mutation_allowed(&db, &[target_parent.clone()]).await?;

    if target_parent != ROOT_PARENT_ID {
        let exists = fetch_node_record(&db, &target_parent).await?.is_some();
        if !exists {
            return Err(format!("parent node not found: {target_parent}"));
        }
    }

    let target_dir = ensure_node_files_dir(&app, &target_parent)?;
    let siblings = fetch_nodes_by_parent(&db, &target_parent).await?;
    let mut taken_node_names: HashSet<String> = siblings
        .iter()
        .map(|node| node.name.to_lowercase())
        .collect();

    let mut taken_file_names: HashSet<String> = HashSet::new();
    if let Ok(entries) = fs::read_dir(&target_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                taken_file_names.insert(name.to_lowercase());
            }
        }
    }
    let mut tracked_source_keys = collect_sibling_file_source_keys(&siblings);

    let mut next_order = siblings.iter().map(|node| node.order).max().unwrap_or(0) + 1000;
    let mut created_nodes: Vec<AppNode> = Vec::new();

    for raw_source in source_paths {
        let source = PathBuf::from(raw_source.trim_matches('"'));
        if !source.exists() || !source.is_file() {
            continue;
        }
        let source_key = path_compare_key(&source);
        if tracked_source_keys.contains(&source_key) {
            continue;
        }

        let original_name = source
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "Imported file".to_string());
        if should_ignore_external_entry_name(&original_name) {
            continue;
        }

        let final_name =
            find_unique_import_name(&original_name, &taken_node_names, &taken_file_names);
        let lower = final_name.to_lowercase();
        taken_node_names.insert(lower.clone());
        taken_file_names.insert(lower);

        let destination = target_dir.join(&final_name);
        fs::copy(&source, &destination).map_err(|err| {
            format!(
                "failed to copy file {:?} to {:?}: {err}",
                source, destination
            )
        })?;
        tracked_source_keys.insert(source_key);
        tracked_source_keys.insert(path_compare_key(&destination));
        let size = fs::metadata(&destination)
            .map(|meta| meta.len())
            .unwrap_or(0);

        let now = now_ms();
        let record = NodeRecord {
            node_id: uuid::Uuid::new_v4().to_string(),
            parent_id: target_parent.clone(),
            name: final_name,
            node_type: "file".to_string(),
            properties: serde_json::json!({
                "mirrorFilePath": destination.to_string_lossy().to_string(),
                "importedFromPath": source.to_string_lossy().to_string(),
                "sizeBytes": size
            }),
            description: None,
            order: next_order,
            created_at: now,
            updated_at: now,
            content_type: None,
            ai_draft: None,
            content: None,
        };
        next_order += 1000;

        db.query("CREATE node CONTENT $record;")
            .bind(("record", record.clone()))
            .await
            .map_err(db_err)?;

        // Trigger background parsing for the file
        let app_handle = app.clone();
        let node_id = record.node_id.clone();
        let file_path = destination.clone();
        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();

        tokio::spawn(async move {
            if let Ok(db) = get_db(&app_handle).await {
                let _ = parse_and_store_node_file_content(&db, &node_id, &file_path, &ext).await;
            }
        });

        created_nodes.push(AppNode::from(record));
    }

    if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
        eprintln!("desktop mirror sync failed after import_files_to_node: {err}");
    }

    Ok(created_nodes)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportFilePayload {
    name: String,
    bytes_base64: String,
}

#[tauri::command]
async fn import_file_payloads_to_node(
    app: tauri::AppHandle,
    parent_node_id: Option<String>,
    file_payloads: Vec<ImportFilePayload>,
) -> Result<Vec<AppNode>, String> {
    if file_payloads.is_empty() {
        return Ok(Vec::new());
    }

    let db = get_db(&app).await?;
    let target_parent = parent_node_id.unwrap_or_else(|| ROOT_PARENT_ID.to_string());
    ensure_structure_mutation_allowed(&db, &[target_parent.clone()]).await?;

    if target_parent != ROOT_PARENT_ID {
        let exists = fetch_node_record(&db, &target_parent).await?.is_some();
        if !exists {
            return Err(format!("parent node not found: {target_parent}"));
        }
    }

    let target_dir = ensure_node_files_dir(&app, &target_parent)?;
    let siblings = fetch_nodes_by_parent(&db, &target_parent).await?;
    let mut taken_node_names: HashSet<String> = siblings
        .iter()
        .map(|node| node.name.to_lowercase())
        .collect();

    let mut taken_file_names: HashSet<String> = HashSet::new();
    if let Ok(entries) = fs::read_dir(&target_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                taken_file_names.insert(name.to_lowercase());
            }
        }
    }

    let mut next_order = siblings.iter().map(|node| node.order).max().unwrap_or(0) + 1000;
    let mut created_nodes: Vec<AppNode> = Vec::new();

    for payload in file_payloads {
        let original_name = payload.name.trim();
        if original_name.is_empty() || should_ignore_external_entry_name(original_name) {
            continue;
        }

        let bytes = BASE64_STANDARD
            .decode(payload.bytes_base64.as_bytes())
            .map_err(|err| format!("failed to decode uploaded file payload for {original_name}: {err}"))?;

        let final_name = find_unique_import_name(original_name, &taken_node_names, &taken_file_names);
        let lower = final_name.to_lowercase();
        taken_node_names.insert(lower.clone());
        taken_file_names.insert(lower);

        let destination = target_dir.join(&final_name);
        fs::write(&destination, &bytes).map_err(|err| {
            format!(
                "failed to write uploaded file {:?} to {:?}: {err}",
                final_name, destination
            )
        })?;

        let now = now_ms();
        let record = NodeRecord {
            node_id: uuid::Uuid::new_v4().to_string(),
            parent_id: target_parent.clone(),
            name: final_name.clone(),
            node_type: "file".to_string(),
            properties: serde_json::json!({
                "mirrorFilePath": destination.to_string_lossy().to_string(),
                "sizeBytes": bytes.len() as u64
            }),
            description: None,
            order: next_order,
            created_at: now,
            updated_at: now,
            content_type: None,
            ai_draft: None,
            content: None,
        };
        next_order += 1000;

        db.query("CREATE node CONTENT $record;")
            .bind(("record", record.clone()))
            .await
            .map_err(db_err)?;

        let app_handle = app.clone();
        let node_id = record.node_id.clone();
        let file_path = destination.clone();
        let ext = Path::new(&final_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();

        tokio::spawn(async move {
            if let Ok(db) = get_db(&app_handle).await {
                let _ = parse_and_store_node_file_content(&db, &node_id, &file_path, &ext).await;
            }
        });

        created_nodes.push(AppNode::from(record));
    }

    if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
        eprintln!("desktop mirror sync failed after import_file_payloads_to_node: {err}");
    }

    Ok(created_nodes)
}

async fn import_external_entries_from_source(
    app: &tauri::AppHandle,
    db: &Surreal<Db>,
    target_parent: &str,
    source_root: &Path,
    managed_root_entries: &HashSet<String>,
    remove_imported_root_entries: bool,
) -> Result<i64, String> {
    let mut imported_top_level_paths: Vec<PathBuf> = Vec::new();
    let mut imported_count: i64 = 0;
    let mut stack: Vec<(String, PathBuf, bool)> =
        vec![(target_parent.to_string(), source_root.to_path_buf(), true)];

    while let Some((parent_node_id, source_dir, filter_root_entries)) = stack.pop() {
        let mut entries: Vec<_> = fs::read_dir(&source_dir)
            .map_err(|err| format!("failed to read source directory {:?}: {err}", source_dir))?
            .filter_map(Result::ok)
            .collect();

        entries.sort_by(|left, right| {
            let left_type = left.file_type().ok();
            let right_type = right.file_type().ok();
            let left_is_dir = left_type
                .as_ref()
                .map(|kind| kind.is_dir())
                .unwrap_or(false);
            let right_is_dir = right_type
                .as_ref()
                .map(|kind| kind.is_dir())
                .unwrap_or(false);
            right_is_dir.cmp(&left_is_dir).then_with(|| {
                left.file_name()
                    .to_string_lossy()
                    .to_lowercase()
                    .cmp(&right.file_name().to_string_lossy().to_lowercase())
            })
        });

        let siblings = fetch_nodes_by_parent(db, &parent_node_id).await?;
        let mut taken_node_names: HashSet<String> = siblings
            .iter()
            .map(|node| node.name.to_lowercase())
            .collect();
        let mut next_order = siblings.iter().map(|node| node.order).max().unwrap_or(0) + 1000;
        let target_dir = ensure_node_files_dir(app, &parent_node_id)?;

        let mut taken_file_names: HashSet<String> = HashSet::new();
        if let Ok(existing_target_files) = fs::read_dir(&target_dir) {
            for entry in existing_target_files.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    taken_file_names.insert(name.to_lowercase());
                }
            }
        }

        for entry in entries {
            let raw_name = entry.file_name().to_string_lossy().to_string();
            if should_ignore_external_entry_name(&raw_name) {
                continue;
            }

            if filter_root_entries {
                if managed_root_entries.contains(&raw_name.to_lowercase()) {
                    continue;
                }
            }

            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(kind) => kind,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                let desired_name = normalize_external_mirror_entry_name(&raw_name);
                let final_name = find_unique_node_name(
                    &sanitize_file_name_component(&desired_name),
                    &taken_node_names,
                );
                taken_node_names.insert(final_name.to_lowercase());

                let now = now_ms();
                let folder_record = NodeRecord {
                    node_id: uuid::Uuid::new_v4().to_string(),
                    parent_id: parent_node_id.clone(),
                    name: final_name,
                    node_type: "folder".to_string(),
                    properties: Value::Object(serde_json::Map::new()),
                    description: None,
                    order: next_order,
                    created_at: now,
                    updated_at: now,
                    content_type: None,
                    ai_draft: None,
                    content: None,
                };
                next_order += 1000;
                insert_node_record(db, folder_record.clone()).await?;
                imported_count += 1;

                if remove_imported_root_entries && filter_root_entries {
                    imported_top_level_paths.push(path.clone());
                }

                stack.push((folder_record.node_id, path, false));
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            let desired_name = normalize_external_mirror_entry_name(&raw_name);
            let final_name =
                find_unique_import_name(&desired_name, &taken_node_names, &taken_file_names);
            let lower_name = final_name.to_lowercase();
            taken_node_names.insert(lower_name.clone());
            taken_file_names.insert(lower_name);

            let destination = target_dir.join(&final_name);
            fs::copy(&path, &destination).map_err(|err| {
                format!(
                    "failed to import file {:?} to {:?}: {err}",
                    path, destination
                )
            })?;
            let size = fs::metadata(&destination)
                .map(|meta| meta.len())
                .unwrap_or(0);

            let now = now_ms();
            let file_record = NodeRecord {
                node_id: uuid::Uuid::new_v4().to_string(),
                parent_id: parent_node_id.clone(),
                name: final_name,
                node_type: "file".to_string(),
                properties: serde_json::json!({
                    "mirrorFilePath": destination.to_string_lossy().to_string(),
                    "importedFromPath": path.to_string_lossy().to_string(),
                    "sizeBytes": size
                }),
                description: None,
                order: next_order,
                created_at: now,
                updated_at: now,
                content_type: None,
                ai_draft: None,
                content: None,
            };
            next_order += 1000;
            insert_node_record(db, file_record.clone()).await?;
            imported_count += 1;

            let app_handle = app.clone();
            let node_id = file_record.node_id.clone();
            let file_path = destination.clone();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_string();
            tokio::spawn(async move {
                if let Ok(db) = get_db(&app_handle).await {
                    let _ =
                        parse_and_store_node_file_content(&db, &node_id, &file_path, &ext).await;
                }
            });

            if remove_imported_root_entries && filter_root_entries {
                imported_top_level_paths.push(path.clone());
            }
        }
    }

    if remove_imported_root_entries && imported_count > 0 {
        for imported_path in imported_top_level_paths {
            if imported_path.is_dir() {
                if let Err(err) = fs::remove_dir_all(&imported_path) {
                    eprintln!(
                        "failed to remove imported source directory {:?}: {err}",
                        imported_path
                    );
                }
            } else if imported_path.is_file() {
                if let Err(err) = fs::remove_file(&imported_path) {
                    eprintln!(
                        "failed to remove imported source file {:?}: {err}",
                        imported_path
                    );
                }
            }
        }
    }

    Ok(imported_count)
}

#[derive(Debug, Clone)]
struct ExpectedWorkspaceEntry {
    node: NodeRecord,
    entry_name: String,
    number_label: String,
}

fn build_expected_workspace_entries(
    children: &[NodeRecord],
    numbering_prefix: &str,
) -> Vec<ExpectedWorkspaceEntry> {
    let mut taken_names: HashSet<String> = HashSet::new();
    let mut entries = Vec::with_capacity(children.len());
    let mut folder_index = 0usize;
    for child in children.iter() {
        let number_label = if child.node_type.eq_ignore_ascii_case("file") {
            String::new()
        } else {
            folder_index += 1;
            build_mirror_number_label(numbering_prefix, folder_index)
        };
        let display_name = build_projected_entry_display_name(
            &child.node_type,
            if number_label.is_empty() {
                None
            } else {
                Some(number_label.as_str())
            },
            &child.name,
        );
        let entry_name = find_unique_mirror_entry_name(&display_name, &taken_names);
        taken_names.insert(entry_name.to_lowercase());
        entries.push(ExpectedWorkspaceEntry {
            node: child.clone(),
            entry_name,
            number_label,
        });
    }
    entries
}

fn collect_missing_workspace_node_ids(
    children_map: &HashMap<String, Vec<NodeRecord>>,
    parent_id: &str,
    source_dir: &Path,
    numbering_prefix: &str,
) -> Result<Vec<String>, String> {
    let Some(children) = children_map.get(parent_id) else {
        return Ok(Vec::new());
    };

    let expected_entries = build_expected_workspace_entries(children, numbering_prefix);
    let mut stale_node_ids: Vec<String> = Vec::new();
    for expected in expected_entries {
        let entry_path = source_dir.join(&expected.entry_name);
        let expects_file = expected.node.node_type.eq_ignore_ascii_case("file");
        let exists_with_expected_type = if expects_file {
            entry_path.is_file()
        } else {
            entry_path.is_dir()
        };
        if !exists_with_expected_type {
            stale_node_ids.push(expected.node.node_id.clone());
            continue;
        }
        if expects_file {
            continue;
        }
        stale_node_ids.extend(collect_missing_workspace_node_ids(
            children_map,
            &expected.node.node_id,
            &entry_path,
            &expected.number_label,
        )?);
    }

    Ok(stale_node_ids)
}

fn count_workspace_external_changes_recursive(
    children_map: &HashMap<String, Vec<NodeRecord>>,
    parent_id: &str,
    source_dir: &Path,
    numbering_prefix: &str,
) -> Result<i64, String> {
    let mut count = 0i64;
    let children = children_map.get(parent_id).cloned().unwrap_or_default();
    let expected_entries = build_expected_workspace_entries(&children, numbering_prefix);
    let mut expected_by_key: HashMap<String, ExpectedWorkspaceEntry> = expected_entries
        .into_iter()
        .map(|entry| (entry.entry_name.to_lowercase(), entry))
        .collect();

    let source_entries = fs::read_dir(source_dir)
        .map_err(|err| format!("failed to read source directory {:?}: {err}", source_dir))?;

    for source_entry in source_entries.flatten() {
        let raw_name = source_entry.file_name().to_string_lossy().to_string();
        if should_ignore_external_entry_name(&raw_name) {
            continue;
        }
        let lower_name = raw_name.to_lowercase();
        let source_path = source_entry.path();
        let Ok(file_type) = source_entry.file_type() else {
            count += 1;
            continue;
        };

        let Some(expected) = expected_by_key.remove(&lower_name) else {
            count += 1;
            continue;
        };

        let expects_file = expected.node.node_type.eq_ignore_ascii_case("file");
        let type_matches =
            (expects_file && file_type.is_file()) || (!expects_file && file_type.is_dir());
        if !type_matches {
            count += 1;
            continue;
        }
        if expects_file {
            continue;
        }

        count += count_workspace_external_changes_recursive(
            children_map,
            &expected.node.node_id,
            &source_path,
            &expected.number_label,
        )?;
    }

    count += expected_by_key.len() as i64;
    Ok(count)
}

async fn import_missing_workspace_entries_from_source(
    app: &tauri::AppHandle,
    db: &Surreal<Db>,
    parent_node_id: &str,
    source_dir: &Path,
    numbering_prefix: &str,
) -> Result<i64, String> {
    let mut imported_count = 0i64;
    let mut stack: Vec<(String, PathBuf, String)> = vec![(
        parent_node_id.to_string(),
        source_dir.to_path_buf(),
        numbering_prefix.to_string(),
    )];

    while let Some((current_parent_id, current_source_dir, current_numbering_prefix)) = stack.pop()
    {
        let siblings = fetch_nodes_by_parent(db, &current_parent_id).await?;
        let expected_entries =
            build_expected_workspace_entries(&siblings, &current_numbering_prefix);
        let mut expected_by_key: HashMap<String, ExpectedWorkspaceEntry> = expected_entries
            .into_iter()
            .map(|entry| (entry.entry_name.to_lowercase(), entry))
            .collect();

        let mut entries: Vec<_> = fs::read_dir(&current_source_dir)
            .map_err(|err| {
                format!(
                    "failed to read source directory {:?}: {err}",
                    current_source_dir
                )
            })?
            .filter_map(Result::ok)
            .collect();
        entries.sort_by(|left, right| {
            let left_type = left.file_type().ok();
            let right_type = right.file_type().ok();
            let left_is_dir = left_type
                .as_ref()
                .map(|kind| kind.is_dir())
                .unwrap_or(false);
            let right_is_dir = right_type
                .as_ref()
                .map(|kind| kind.is_dir())
                .unwrap_or(false);
            right_is_dir.cmp(&left_is_dir).then_with(|| {
                left.file_name()
                    .to_string_lossy()
                    .to_lowercase()
                    .cmp(&right.file_name().to_string_lossy().to_lowercase())
            })
        });

        let mut taken_node_names: HashSet<String> = siblings
            .iter()
            .map(|node| node.name.to_lowercase())
            .collect();
        let mut next_order = siblings.iter().map(|node| node.order).max().unwrap_or(0) + 1000;
        let target_dir = ensure_node_files_dir(app, &current_parent_id)?;
        let mut taken_file_names: HashSet<String> = HashSet::new();
        if let Ok(existing_target_files) = fs::read_dir(&target_dir) {
            for entry in existing_target_files.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    taken_file_names.insert(name.to_lowercase());
                }
            }
        }

        for entry in entries {
            let raw_name = entry.file_name().to_string_lossy().to_string();
            if should_ignore_external_entry_name(&raw_name) {
                continue;
            }

            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(kind) => kind,
                Err(_) => continue,
            };

            if let Some(existing) = expected_by_key.remove(&raw_name.to_lowercase()) {
                let expects_file = existing.node.node_type.eq_ignore_ascii_case("file");
                if !expects_file && file_type.is_dir() {
                    stack.push((
                        existing.node.node_id.clone(),
                        path,
                        existing.number_label.clone(),
                    ));
                }
                continue;
            }

            if file_type.is_dir() {
                let desired_name = normalize_external_mirror_entry_name(&raw_name);
                let final_name = find_unique_node_name(
                    &sanitize_file_name_component(&desired_name),
                    &taken_node_names,
                );
                taken_node_names.insert(final_name.to_lowercase());

                let now = now_ms();
                let folder_record = NodeRecord {
                    node_id: uuid::Uuid::new_v4().to_string(),
                    parent_id: current_parent_id.clone(),
                    name: final_name,
                    node_type: "folder".to_string(),
                    properties: Value::Object(serde_json::Map::new()),
                    description: None,
                    order: next_order,
                    created_at: now,
                    updated_at: now,
                    content_type: None,
                    ai_draft: None,
                    content: None,
                };
                next_order += 1000;
                insert_node_record(db, folder_record.clone()).await?;
                imported_count += 1;
                stack.push((folder_record.node_id.clone(), path, String::new()));
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            let desired_name = normalize_external_mirror_entry_name(&raw_name);
            let final_name =
                find_unique_import_name(&desired_name, &taken_node_names, &taken_file_names);
            let lower_name = final_name.to_lowercase();
            taken_node_names.insert(lower_name.clone());
            taken_file_names.insert(lower_name);

            let destination = target_dir.join(&final_name);
            fs::copy(&path, &destination).map_err(|err| {
                format!(
                    "failed to import file {:?} to {:?}: {err}",
                    path, destination
                )
            })?;
            let size = fs::metadata(&destination)
                .map(|meta| meta.len())
                .unwrap_or(0);

            let now = now_ms();
            let file_record = NodeRecord {
                node_id: uuid::Uuid::new_v4().to_string(),
                parent_id: current_parent_id.clone(),
                name: final_name,
                node_type: "file".to_string(),
                properties: serde_json::json!({
                    "mirrorFilePath": destination.to_string_lossy().to_string(),
                    "importedFromPath": path.to_string_lossy().to_string(),
                    "sizeBytes": size
                }),
                description: None,
                order: next_order,
                created_at: now,
                updated_at: now,
                content_type: None,
                ai_draft: None,
                content: None,
            };
            next_order += 1000;
            insert_node_record(db, file_record.clone()).await?;
            imported_count += 1;

            let app_handle = app.clone();
            let node_id = file_record.node_id.clone();
            let file_path = destination.clone();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_string();
            tokio::spawn(async move {
                if let Ok(db) = get_db(&app_handle).await {
                    let _ =
                        parse_and_store_node_file_content(&db, &node_id, &file_path, &ext).await;
                }
            });
        }
    }

    Ok(imported_count)
}

#[tauri::command]
async fn sync_external_mirror_entries(
    app: tauri::AppHandle,
    target_parent_id: Option<String>,
) -> Result<i64, String> {
    let db = get_db(&app).await?;
    let mirror_root = ensure_mirror_root_exists(&app)?;

    let target_parent = target_parent_id.unwrap_or_else(|| ROOT_PARENT_ID.to_string());
    if target_parent != ROOT_PARENT_ID {
        let exists = fetch_node_record(&db, &target_parent).await?.is_some();
        if !exists {
            return Err(format!("target parent node not found: {target_parent}"));
        }
    }

    let all_nodes = fetch_all_nodes(&db).await?;
    let mut managed_root_entries: HashSet<String> = read_projection_index(&app, &mirror_root)
        .into_iter()
        .map(|entry| entry.to_lowercase())
        .collect();
    managed_root_entries.extend(expected_projected_root_entry_keys(&all_nodes));

    let imported_count = import_external_entries_from_source(
        &app,
        &db,
        &target_parent,
        &mirror_root,
        &managed_root_entries,
        true,
    )
    .await?;

    if imported_count > 0 {
        if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
            eprintln!("desktop mirror sync failed after sync_external_mirror_entries: {err}");
        }
    }

    Ok(imported_count)
}

#[tauri::command]
async fn detect_project_workspace_external_changes(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<i64, String> {
    let db = get_db(&app).await?;
    let project = fetch_project_record(&db, &project_id)
        .await?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;
    if is_internal_workspace_root_path(&project.root_path) {
        return Ok(0);
    }

    if fetch_node_record(&db, &project.root_node_id)
        .await?
        .is_none()
    {
        return Err(format!(
            "Project root node not found for workspace {}",
            project.root_node_id
        ));
    }

    let normalized_project_root = normalize_project_root_path(&project.root_path)?;
    let all_nodes = fetch_all_nodes(&db).await?;
    let children_map = build_children_map(&all_nodes);
    count_workspace_external_changes_recursive(
        &children_map,
        &project.root_node_id,
        &normalized_project_root,
        "",
    )
}

#[tauri::command]
async fn re_sync_project_workspace(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<i64, String> {
    let db = get_db(&app).await?;
    let project = fetch_project_record(&db, &project_id)
        .await?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;
    if is_internal_workspace_root_path(&project.root_path) {
        return Err("Workspace has no linked folder path to re-sync.".to_string());
    }

    if fetch_node_record(&db, &project.root_node_id)
        .await?
        .is_none()
    {
        return Err(format!(
            "Project root node not found for workspace {}",
            project.root_node_id
        ));
    }

    let normalized_project_root = normalize_project_root_path(&project.root_path)?;
    let all_nodes = fetch_all_nodes(&db).await?;
    let children_map = build_children_map(&all_nodes);
    let stale_node_ids = collect_missing_workspace_node_ids(
        &children_map,
        &project.root_node_id,
        &normalized_project_root,
        "",
    )?;

    let mut removed_count = 0i64;
    for stale_node_id in stale_node_ids {
        delete_node(app.clone(), stale_node_id, Some(false)).await?;
        removed_count += 1;
    }

    let imported_count = import_missing_workspace_entries_from_source(
        &app,
        &db,
        &project.root_node_id,
        &normalized_project_root,
        "",
    )
    .await?;

    sync_desktop_projection_from_db(&app, &db).await?;
    Ok(imported_count + removed_count)
}

fn split_relative_package_path(input: &str) -> PathBuf {
    let mut out = PathBuf::new();
    for part in input.split('/') {
        let trimmed = part.trim();
        if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
            continue;
        }
        out.push(trimmed);
    }
    out
}

fn build_children_map(nodes: &[NodeRecord]) -> HashMap<String, Vec<NodeRecord>> {
    let mut map: HashMap<String, Vec<NodeRecord>> = HashMap::new();
    for node in nodes {
        map.entry(node.parent_id.clone())
            .or_default()
            .push(node.clone());
    }
    for children in map.values_mut() {
        children.sort_by(|a, b| {
            let by_order = a.order.cmp(&b.order);
            if by_order != std::cmp::Ordering::Equal {
                return by_order;
            }
            a.node_id.cmp(&b.node_id)
        });
    }
    map
}

fn build_package_node_recursive(
    node: &NodeRecord,
    children_map: &HashMap<String, Vec<NodeRecord>>,
    stage_files_dir: &Path,
    file_index: &mut usize,
) -> Result<NodePackageNode, String> {
    let mut package_node = NodePackageNode {
        source_id: Some(node.node_id.clone()),
        name: node.name.clone(),
        node_type: node.node_type.clone(),
        properties: Value::Object(strip_file_path_properties(&node.properties)),
        description: node.description.clone(),
        content_type: node.content_type.clone(),
        ai_draft: node.ai_draft.clone(),
        content: node.content.clone(),
        children: Vec::new(),
        file_rel_path: None,
    };

    if node.node_type == "file" {
        let file_path = node
            .properties
            .get("mirrorFilePath")
            .and_then(|value| value.as_str())
            .map(PathBuf::from);
        if let Some(path) = file_path {
            if path.exists() && path.is_file() {
                *file_index += 1;
                let original_name = path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("file.bin");
                let safe_name = sanitize_file_name_component(original_name);
                let relative = format!("files/{:04}_{}", *file_index, safe_name);
                let destination = stage_files_dir.join(format!("{:04}_{}", *file_index, safe_name));
                fs::copy(&path, &destination).map_err(|err| {
                    format!(
                        "failed to copy node file {:?} to package staging {:?}: {err}",
                        path, destination
                    )
                })?;
                package_node.file_rel_path = Some(relative);
            }
        }
    }

    if let Some(children) = children_map.get(&node.node_id) {
        let mut packaged_children = Vec::with_capacity(children.len());
        for child in children {
            packaged_children.push(build_package_node_recursive(
                child,
                children_map,
                stage_files_dir,
                file_index,
            )?);
        }
        package_node.children = packaged_children;
    }

    Ok(package_node)
}

async fn create_node_from_package(
    app: &tauri::AppHandle,
    db: &Surreal<Db>,
    parent_id: &str,
    package_node: &NodePackageNode,
    extracted_root: &Path,
    id_map: &HashMap<String, String>,
    name_override: Option<String>,
    properties_override: Option<serde_json::Map<String, Value>>,
) -> Result<NodeRecord, String> {
    let siblings = fetch_nodes_by_parent(db, parent_id).await?;
    let mut taken_node_names: HashSet<String> = siblings
        .iter()
        .map(|node| node.name.to_lowercase())
        .collect();
    let next_order = siblings.iter().map(|node| node.order).max().unwrap_or(0) + 1000;
    let now = now_ms();

    let is_file = package_node.node_type.trim().eq_ignore_ascii_case("file");
    let node_type = if is_file {
        "file".to_string()
    } else if package_node.node_type.trim().is_empty() {
        "folder".to_string()
    } else {
        package_node.node_type.trim().to_string()
    };
    let source_id = package_node
        .source_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let node_id = source_id
        .and_then(|id| id_map.get(id))
        .cloned()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let desired_node_name = name_override
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(package_node.name.trim());
    let remapped_package_properties = remap_json_ids(&package_node.properties, id_map);
    let remapped_description = package_node
        .description
        .as_deref()
        .map(|value| remap_string_ids(value, id_map));
    let remapped_content_type = package_node
        .content_type
        .as_deref()
        .map(|value| remap_string_ids(value, id_map));
    let remapped_ai_draft = package_node
        .ai_draft
        .as_ref()
        .map(|value| remap_json_ids(value, id_map));
    let remapped_content = package_node
        .content
        .as_deref()
        .map(|value| remap_string_ids(value, id_map));

    if is_file {
        let target_dir = ensure_node_files_dir(app, parent_id)?;
        let mut taken_file_names: HashSet<String> = HashSet::new();
        if let Ok(entries) = fs::read_dir(&target_dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    taken_file_names.insert(name.to_lowercase());
                }
            }
        }

        let desired_name = sanitize_file_name_component(desired_node_name);
        let final_name =
            find_unique_import_name(&desired_name, &taken_node_names, &taken_file_names);
        taken_node_names.insert(final_name.to_lowercase());
        let destination = target_dir.join(&final_name);

        let mut properties_map = strip_file_path_properties(&remapped_package_properties);
        if let Some(rel) = package_node.file_rel_path.as_deref() {
            let source = extracted_root.join(split_relative_package_path(rel));
            if source.exists() && source.is_file() {
                fs::copy(&source, &destination).map_err(|err| {
                    format!(
                        "failed to copy package file {:?} to {:?}: {err}",
                        source, destination
                    )
                })?;
                let size = fs::metadata(&destination)
                    .map(|meta| meta.len())
                    .unwrap_or(0);
                properties_map.insert(
                    "mirrorFilePath".to_string(),
                    Value::String(destination.to_string_lossy().to_string()),
                );
                properties_map.insert(
                    "importedFromPath".to_string(),
                    Value::String(source.to_string_lossy().to_string()),
                );
                properties_map.insert("sizeBytes".to_string(), Value::from(size));
            }
        }
        if let Some(override_map) = properties_override {
            properties_map.extend(override_map);
        }

        let record = NodeRecord {
            node_id,
            parent_id: parent_id.to_string(),
            name: final_name,
            node_type,
            properties: Value::Object(properties_map),
            description: remapped_description,
            order: next_order,
            created_at: now,
            updated_at: now,
            content_type: remapped_content_type,
            ai_draft: remapped_ai_draft,
            content: remapped_content,
        };

        db.query("CREATE node CONTENT $record;")
            .bind(("record", record.clone()))
            .await
            .map_err(db_err)?;
        return Ok(record);
    }

    let final_name = find_unique_node_name(desired_node_name, &taken_node_names);
    let mut properties_map = match remapped_package_properties {
        Value::Object(obj) => obj,
        _ => serde_json::Map::new(),
    };
    if let Some(override_map) = properties_override {
        properties_map.extend(override_map);
    }
    let record = NodeRecord {
        node_id,
        parent_id: parent_id.to_string(),
        name: final_name,
        node_type,
        properties: Value::Object(properties_map),
        description: remapped_description,
        order: next_order,
        created_at: now,
        updated_at: now,
        content_type: remapped_content_type,
        ai_draft: remapped_ai_draft,
        content: remapped_content,
    };

    db.query("CREATE node CONTENT $record;")
        .bind(("record", record.clone()))
        .await
        .map_err(db_err)?;
    Ok(record)
}

#[tauri::command]
async fn export_node_package(app: tauri::AppHandle, node_id: String) -> Result<String, String> {
    let db = get_db(&app).await?;
    let all_nodes = fetch_all_nodes(&db).await?;
    let root = all_nodes
        .iter()
        .find(|node| node.node_id == node_id)
        .ok_or_else(|| format!("node not found: {node_id}"))?
        .clone();
    let children_map = build_children_map(&all_nodes);

    let state_root = ensure_internal_state_root_exists(&app)?;
    let package_root = state_root.join(MIRROR_SHARE_PACKAGES_DIR_NAME);
    fs::create_dir_all(&package_root).map_err(|err| {
        format!(
            "failed to create package directory {:?}: {err}",
            package_root
        )
    })?;

    let stage_dir = package_root
        .join(".stage")
        .join(format!("pkg_{}", uuid::Uuid::new_v4().simple()));
    let stage_files_dir = stage_dir.join("files");
    fs::create_dir_all(&stage_files_dir).map_err(|err| {
        format!(
            "failed to create package staging directory {:?}: {err}",
            stage_files_dir
        )
    })?;

    let result = (|| -> Result<String, String> {
        let mut file_index = 0usize;
        let package_root_node =
            build_package_node_recursive(&root, &children_map, &stage_files_dir, &mut file_index)?;
        let package = NodePackage {
            version: 1,
            exported_at: now_ms(),
            root: package_root_node,
        };

        let manifest_path = stage_dir.join("manifest.json");
        let manifest_json = serde_json::to_string_pretty(&package)
            .map_err(|err| format!("failed to encode package manifest: {err}"))?;
        fs::write(&manifest_path, manifest_json).map_err(|err| {
            format!(
                "failed to write package manifest {:?}: {err}",
                manifest_path
            )
        })?;

        let output_path =
            build_unique_package_output_path(&package_root, &root.name, PackageOutputKind::Node);
        zip_directory_windows(&stage_dir, &output_path)?;
        Ok(output_path.to_string_lossy().to_string())
    })();

    let _ = fs::remove_dir_all(&stage_dir);
    result
}

async fn rollback_created_subtree(
    app: &tauri::AppHandle,
    root_node_id: &str,
    context: &str,
) -> Result<(), String> {
    delete_node(app.clone(), root_node_id.to_string(), Some(true))
        .await
        .map_err(|err| format!("rollback failed after {context}: {err}"))
}

#[tauri::command]
async fn import_node_package(
    app: tauri::AppHandle,
    parent_node_id: Option<String>,
    package_path: String,
) -> Result<AppNode, String> {
    let db = get_db(&app).await?;
    let target_parent = parent_node_id.unwrap_or_else(|| ROOT_PARENT_ID.to_string());
    ensure_structure_mutation_allowed(&db, &[target_parent.clone()]).await?;
    if target_parent != ROOT_PARENT_ID {
        let exists = fetch_node_record(&db, &target_parent).await?.is_some();
        if !exists {
            return Err(format!("parent node not found: {target_parent}"));
        }
    }

    let package_file = PathBuf::from(package_path.trim());
    if !package_file.exists() || !package_file.is_file() {
        return Err(format!("package file not found: {:?}", package_file));
    }

    let state_root = ensure_internal_state_root_exists(&app)?;
    let stage_dir = state_root
        .join(MIRROR_SHARE_PACKAGES_DIR_NAME)
        .join(".import_stage")
        .join(format!("pkg_{}", uuid::Uuid::new_v4().simple()));
    fs::create_dir_all(&stage_dir).map_err(|err| {
        format!(
            "failed to create import staging directory {:?}: {err}",
            stage_dir
        )
    })?;

    let mut created_root_id: Option<String> = None;
    let result = async {
        unzip_file_windows(&package_file, &stage_dir)?;
        let manifest_path = stage_dir.join("manifest.json");
        if !manifest_path.exists() {
            return Err("package manifest.json is missing".to_string());
        }
        let manifest_raw = fs::read_to_string(&manifest_path)
            .map_err(|err| format!("failed to read package manifest {:?}: {err}", manifest_path))?;
        let package: NodePackage = serde_json::from_str(&manifest_raw)
            .map_err(|err| format!("invalid package manifest: {err}"))?;

        let mut id_map = HashMap::new();
        collect_package_source_id_map(&package.root, &mut id_map);
        let mut stack: Vec<(NodePackageNode, String)> = vec![(package.root, target_parent.clone())];
        let mut created_root: Option<NodeRecord> = None;
        while let Some((current, parent_id)) = stack.pop() {
            let created = create_node_from_package(
                &app,
                &db,
                &parent_id,
                &current,
                &stage_dir,
                &id_map,
                None,
                None,
            )
            .await?;
            if created_root.is_none() {
                created_root = Some(created.clone());
                created_root_id = Some(created.node_id.clone());
            }
            for child in current.children.iter().rev() {
                stack.push((child.clone(), created.node_id.clone()));
            }
        }

        created_root
            .map(AppNode::from)
            .ok_or_else(|| "package import did not create any nodes".to_string())
    }
    .await;

    if result.is_err() {
        if let Some(root_node_id) = created_root_id.as_deref() {
            if let Err(cleanup_err) =
                rollback_created_subtree(&app, root_node_id, "node package import").await
            {
                eprintln!("{cleanup_err}");
            }
        }
    }

    let _ = fs::remove_dir_all(&stage_dir);
    if result.is_ok() {
        if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
            eprintln!("desktop mirror sync failed after import_node_package: {err}");
        }
    }
    result
}

fn normalize_optional_workspace_name(name: Option<String>) -> Option<String> {
    name.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(sanitize_file_name_component(trimmed))
        }
    })
}

fn resolve_workspace_package_name(
    package: &WorkspacePackage,
    name_override: Option<String>,
) -> String {
    normalize_optional_workspace_name(name_override)
        .or_else(|| {
            package
                .workspace
                .as_ref()
                .map(|metadata| sanitize_file_name_component(&metadata.name))
        })
        .or_else(|| Some(sanitize_file_name_component(&package.root.name)))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Workspace".to_string())
}

async fn materialize_workspace_package(
    app: &tauri::AppHandle,
    db: &Surreal<Db>,
    mut package: WorkspacePackage,
    extracted_root: &Path,
    name_override: Option<String>,
    mode: WorkspaceMaterializeMode,
) -> Result<ProjectSummary, String> {
    if package.root.source_id.as_deref().unwrap_or("").trim().is_empty() {
        package.root.source_id = Some(format!("workspace-root-{}", uuid::Uuid::new_v4()));
    }

    let mut id_map = HashMap::new();
    collect_package_source_id_map(&package.root, &mut id_map);
    let root_source_id = package
        .root
        .source_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "workspace package root is missing an identity".to_string())?
        .to_string();
    let root_node_id = id_map
        .get(&root_source_id)
        .cloned()
        .ok_or_else(|| "workspace package root identity could not be remapped".to_string())?;
    let workspace_name = resolve_workspace_package_name(&package, name_override);
    let now = now_ms();
    let root_path = build_internal_workspace_root_path(&root_node_id);
    let mut root_properties = serde_json::Map::new();
    root_properties.insert(
        "workspaceKind".to_string(),
        Value::String("internal".to_string()),
    );
    root_properties.insert(
        "workspacePath".to_string(),
        Value::String(root_path.clone()),
    );
    root_properties.insert("workspaceCreatedAt".to_string(), Value::from(now));
    root_properties.insert("workspacePackageImportedAt".to_string(), Value::from(now));
    if matches!(mode, WorkspaceMaterializeMode::Duplicate) {
        root_properties.insert("workspacePackageDuplicatedAt".to_string(), Value::from(now));
    }
    if let Some(metadata) = &package.workspace {
        if let Some(source_project_id) = metadata.project_id.as_deref() {
            root_properties.insert(
                "workspacePackageSourceProjectId".to_string(),
                Value::String(source_project_id.to_string()),
            );
        }
        if let Some(source_root_node_id) = metadata.root_node_id.as_deref() {
            root_properties.insert(
                "workspacePackageSourceRootNodeId".to_string(),
                Value::String(source_root_node_id.to_string()),
            );
        }
        if let Some(source_root_path) = metadata.root_path.as_deref() {
            root_properties.insert(
                "workspacePackageSourceRootPath".to_string(),
                Value::String(source_root_path.to_string()),
            );
        }
    }

    let mut created_root_id: Option<String> = None;
    let result: Result<ProjectSummary, String> = async {
        let mut stack: Vec<(NodePackageNode, String)> =
            vec![(package.root.clone(), ROOT_PARENT_ID.to_string())];
        let mut created_root: Option<NodeRecord> = None;

        while let Some((current, parent_id)) = stack.pop() {
            let is_root = created_root.is_none();
            let created = create_node_from_package(
                app,
                db,
                &parent_id,
                &current,
                extracted_root,
                &id_map,
                if is_root {
                    Some(workspace_name.clone())
                } else {
                    None
                },
                if is_root {
                    Some(root_properties.clone())
                } else {
                    None
                },
            )
            .await?;

            if is_root {
                created_root_id = Some(created.node_id.clone());
                created_root = Some(created.clone());
            }
            for child in current.children.iter().rev() {
                stack.push((child.clone(), created.node_id.clone()));
            }
        }

        let root_record =
            created_root.ok_or_else(|| "workspace package did not create a root node".to_string())?;
        let project_record = ProjectRecord {
            project_id: uuid::Uuid::new_v4().to_string(),
            name: root_record.name.clone(),
            root_path: build_internal_workspace_root_path(&root_record.node_id),
            root_node_id: root_record.node_id,
            created_at: now,
            updated_at: now,
        };
        db.query("CREATE project CONTENT $record;")
            .bind(("record", project_record.clone()))
            .await
            .map_err(db_err)?;
        Ok(ProjectSummary::from(project_record))
    }
    .await;

    if result.is_err() {
        if let Some(root_id) = created_root_id.as_deref() {
            if let Err(cleanup_err) =
                rollback_created_subtree(app, root_id, "workspace package import").await
            {
                eprintln!("{cleanup_err}");
            }
        }
    } else if let Err(err) = sync_desktop_projection_from_db(app, db).await {
        eprintln!("desktop mirror sync failed after workspace package import: {err}");
    }

    result
}

fn create_workspace_package_for_project(
    project: &ProjectRecord,
    package_root_node: NodePackageNode,
) -> WorkspacePackage {
    WorkspacePackage {
        version: 1,
        exported_at: now_ms(),
        workspace: Some(WorkspacePackageMetadata {
            name: project.name.clone(),
            project_id: Some(project.project_id.clone()),
            root_path: Some(project.root_path.clone()),
            root_node_id: Some(project.root_node_id.clone()),
        }),
        root: package_root_node,
    }
}

#[tauri::command]
async fn duplicate_workspace(
    app: tauri::AppHandle,
    project_id: String,
    name: Option<String>,
) -> Result<ProjectSummary, String> {
    let db = get_db(&app).await?;
    let project = fetch_project_record(&db, &project_id)
        .await?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;
    let all_nodes = fetch_all_nodes(&db).await?;
    let root = all_nodes
        .iter()
        .find(|node| node.node_id == project.root_node_id)
        .ok_or_else(|| format!("workspace root not found: {}", project.root_node_id))?
        .clone();
    let children_map = build_children_map(&all_nodes);

    let state_root = ensure_internal_state_root_exists(&app)?;
    let stage_dir = state_root
        .join(MIRROR_SHARE_PACKAGES_DIR_NAME)
        .join(".duplicate_stage")
        .join(format!("pkg_{}", uuid::Uuid::new_v4().simple()));
    let stage_files_dir = stage_dir.join("files");
    fs::create_dir_all(&stage_files_dir).map_err(|err| {
        format!(
            "failed to create workspace duplicate staging directory {:?}: {err}",
            stage_files_dir
        )
    })?;

    let result = async {
        let mut file_index = 0usize;
        let package_root_node =
            build_package_node_recursive(&root, &children_map, &stage_files_dir, &mut file_index)?;
        let package = create_workspace_package_for_project(&project, package_root_node);
        materialize_workspace_package(&app, &db, package, &stage_dir, name, WorkspaceMaterializeMode::Duplicate)
            .await
    }
    .await;
    let _ = fs::remove_dir_all(&stage_dir);
    result
}

#[tauri::command]
async fn export_workspace_package(app: tauri::AppHandle, project_id: String) -> Result<String, String> {
    let db = get_db(&app).await?;
    let project = fetch_project_record(&db, &project_id)
        .await?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;
    let all_nodes = fetch_all_nodes(&db).await?;
    let root = all_nodes
        .iter()
        .find(|node| node.node_id == project.root_node_id)
        .ok_or_else(|| format!("workspace root not found: {}", project.root_node_id))?
        .clone();
    let children_map = build_children_map(&all_nodes);

    let state_root = ensure_internal_state_root_exists(&app)?;
    let package_root = state_root.join(MIRROR_SHARE_PACKAGES_DIR_NAME);
    fs::create_dir_all(&package_root).map_err(|err| {
        format!(
            "failed to create package directory {:?}: {err}",
            package_root
        )
    })?;

    let stage_dir = package_root
        .join(".stage")
        .join(format!("wsp_{}", uuid::Uuid::new_v4().simple()));
    let stage_files_dir = stage_dir.join("files");
    fs::create_dir_all(&stage_files_dir).map_err(|err| {
        format!(
            "failed to create workspace package staging directory {:?}: {err}",
            stage_files_dir
        )
    })?;

    let result = (|| -> Result<String, String> {
        let mut file_index = 0usize;
        let package_root_node =
            build_package_node_recursive(&root, &children_map, &stage_files_dir, &mut file_index)?;
        let package = create_workspace_package_for_project(&project, package_root_node);
        let manifest_path = stage_dir.join("manifest.json");
        let manifest_json = serde_json::to_string_pretty(&package)
            .map_err(|err| format!("failed to encode workspace package manifest: {err}"))?;
        fs::write(&manifest_path, manifest_json).map_err(|err| {
            format!(
                "failed to write workspace package manifest {:?}: {err}",
                manifest_path
            )
        })?;

        let output_path = build_unique_package_output_path(
            &package_root,
            &project.name,
            PackageOutputKind::Workspace,
        );
        zip_directory_windows(&stage_dir, &output_path)?;
        Ok(output_path.to_string_lossy().to_string())
    })();

    let _ = fs::remove_dir_all(&stage_dir);
    result
}

#[tauri::command]
async fn import_workspace_package(
    app: tauri::AppHandle,
    package_path: String,
    name: Option<String>,
) -> Result<ProjectSummary, String> {
    let db = get_db(&app).await?;
    let package_file = PathBuf::from(package_path.trim());
    if !package_file.exists() || !package_file.is_file() {
        return Err(format!("workspace package file not found: {:?}", package_file));
    }

    let state_root = ensure_internal_state_root_exists(&app)?;
    let stage_dir = state_root
        .join(MIRROR_SHARE_PACKAGES_DIR_NAME)
        .join(".workspace_import_stage")
        .join(format!("wsp_{}", uuid::Uuid::new_v4().simple()));
    fs::create_dir_all(&stage_dir).map_err(|err| {
        format!(
            "failed to create workspace import staging directory {:?}: {err}",
            stage_dir
        )
    })?;

    let result = async {
        unzip_file_windows(&package_file, &stage_dir)?;
        let manifest_path = stage_dir.join("manifest.json");
        if !manifest_path.exists() {
            return Err("workspace package manifest.json is missing".to_string());
        }
        let manifest_raw = fs::read_to_string(&manifest_path)
            .map_err(|err| format!("failed to read workspace package manifest {:?}: {err}", manifest_path))?;
        let package: WorkspacePackage = serde_json::from_str(&manifest_raw)
            .map_err(|err| format!("invalid workspace package manifest: {err}"))?;
        materialize_workspace_package(&app, &db, package, &stage_dir, name, WorkspaceMaterializeMode::Import)
            .await
    }
    .await;

    let _ = fs::remove_dir_all(&stage_dir);
    result
}

#[tauri::command]
async fn open_node_file(app: tauri::AppHandle, node_id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    let file_path = resolve_node_file_path(&db, &node_id).await?;

    if file_path.exists() {
        if open_path_with_system_default(&file_path).is_ok() {
            return Ok(());
        }
        return open_file_location(&file_path);
    }

    if let Some(parent) = file_path.parent() {
        return open_path_with_system_default(parent);
    }

    let mirror_root = ensure_mirror_root_exists(&app)?;
    open_path_with_system_default(&mirror_root)
}

fn trim_preview_text(value: &str, limit: usize) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return None;
    }
    let mut chars = normalized.chars();
    let truncated = chars.by_ref().take(limit).collect::<String>();
    if chars.next().is_none() {
        return Some(truncated);
    }
    Some(format!("{}...", truncated.trim_end()))
}

fn extract_html_attribute_value(tag_source: &str, attribute_name: &str) -> Option<String> {
    let tag_lower = tag_source.to_ascii_lowercase();
    let pattern = format!("{attribute_name}=");
    let attr_start = tag_lower.find(&pattern)?;
    let value_start = attr_start + pattern.len();
    let bytes = tag_source.as_bytes();
    if value_start >= bytes.len() {
        return None;
    }

    let delimiter = bytes[value_start];
    let value = if delimiter == b'"' || delimiter == b'\'' {
        let mut cursor = value_start + 1;
        while cursor < bytes.len() && bytes[cursor] != delimiter {
            cursor += 1;
        }
        if cursor <= value_start + 1 || cursor > bytes.len() {
            return None;
        }
        &tag_source[(value_start + 1)..cursor]
    } else {
        let mut cursor = value_start;
        while cursor < bytes.len()
            && !bytes[cursor].is_ascii_whitespace()
            && bytes[cursor] != b'>'
        {
            cursor += 1;
        }
        if cursor <= value_start {
            return None;
        }
        &tag_source[value_start..cursor]
    };

    trim_preview_text(value, 320)
}

fn extract_html_tag_text(raw: &str, tag_name: &str) -> Option<String> {
    let lower = raw.to_ascii_lowercase();
    let open_pattern = format!("<{tag_name}");
    let open_start = lower.find(&open_pattern)?;
    let open_end = lower[open_start..].find('>')? + open_start;
    let close_pattern = format!("</{tag_name}>");
    let close_start = lower[(open_end + 1)..].find(&close_pattern)? + open_end + 1;
    trim_preview_text(&document_parser::strip_html_to_text(&raw[(open_end + 1)..close_start]), 220)
}

fn extract_html_meta_description(raw: &str) -> Option<String> {
    let lower = raw.to_ascii_lowercase();
    let mut search_start = 0usize;

    while let Some(relative_start) = lower[search_start..].find("<meta") {
        let tag_start = search_start + relative_start;
        let relative_end = lower[tag_start..].find('>')?;
        let tag_end = tag_start + relative_end + 1;
        let tag_source = &raw[tag_start..tag_end];
        let name_value = extract_html_attribute_value(tag_source, "name")
            .or_else(|| extract_html_attribute_value(tag_source, "property"))
            .unwrap_or_default()
            .to_ascii_lowercase();

        if name_value == "description"
            || name_value == "og:description"
            || name_value == "twitter:description"
        {
            if let Some(content) = extract_html_attribute_value(tag_source, "content") {
                return Some(content);
            }
        }

        search_start = tag_end;
    }

    None
}

fn derive_url_preview_title(url: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(url).ok()?;
    let host = parsed.host_str()?.trim();
    let path_leaf = parsed
        .path_segments()
        .and_then(|segments| segments.filter(|segment| !segment.trim().is_empty()).last())
        .unwrap_or("");
    let label = if path_leaf.is_empty() {
        host.to_string()
    } else {
        format!("{host} / {path_leaf}")
    };
    trim_preview_text(&label, 160)
}

fn is_previewable_content_type(content_type: Option<&str>) -> bool {
    let Some(value) = content_type else {
        return true;
    };
    let normalized = value.to_ascii_lowercase();
    normalized.starts_with("text/")
        || normalized.contains("html")
        || normalized.contains("xml")
        || normalized.contains("json")
        || normalized.contains("javascript")
}

#[tauri::command]
async fn extract_document_text(
    app: tauri::AppHandle,
    file_path: String,
    extension: Option<String>,
    node_id: Option<String>,
) -> Result<Option<String>, String> {
    let trimmed_path = file_path.trim().trim_matches('"');
    if trimmed_path.is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(trimmed_path);
    if !path.exists() || !path.is_file() {
        return Ok(None);
    }

    let normalized_extension = extension
        .unwrap_or_else(|| {
            path.extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string()
        })
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();

    let extracted = document_parser::parse_file(&path, &normalized_extension).await;
    if let (Some(text), Some(node_id_value)) = (extracted.as_ref(), node_id.as_deref()) {
        let db = get_db(&app).await?;
        write_node_content(&db, node_id_value, text.clone()).await?;
    }

    Ok(extracted)
}

#[tauri::command]
async fn sync_quick_app_html_storage_snapshot(
    app: tauri::AppHandle,
    payload: SyncQuickAppHtmlSnapshotInput,
) -> Result<(), String> {
    let namespace = payload.namespace.trim().to_string();
    let scope = payload.scope.trim().to_string();
    let quick_app_id = payload.quick_app_id.trim().to_string();
    if namespace.is_empty() || scope.is_empty() || quick_app_id.is_empty() {
        return Ok(());
    }

    let owner_id = sanitize_quick_app_snapshot_optional_text(payload.owner_id);
    let owner_label = sanitize_quick_app_snapshot_optional_text(payload.owner_label);
    let title = sanitize_quick_app_snapshot_optional_text(payload.title);
    let current_url = sanitize_quick_app_snapshot_optional_text(payload.current_url);
    let entries = normalize_quick_app_snapshot_entries(payload.entries);
    let field_entries = normalize_quick_app_snapshot_entries(payload.field_entries);
    let document_text = sanitize_quick_app_snapshot_document_text(payload.document_text);

    let mut store = read_quick_app_html_snapshot_store(&app)?;
    store.version = QUICK_APP_HTML_SNAPSHOT_STORE_VERSION;
    store.records.retain(|record| record.namespace != namespace);

    if !entries.is_empty() || !field_entries.is_empty() || document_text.is_some() {
        store.records.push(QuickAppHtmlSnapshotRecord {
            namespace,
            scope,
            owner_id,
            owner_label,
            quick_app_id,
            title,
            current_url,
            entries,
            field_entries,
            document_text,
            updated_at: now_ms(),
        });
    }

    write_quick_app_html_snapshot_store(&app, &store)
}

#[tauri::command]
async fn get_quick_app_html_storage_snapshot(
    app: tauri::AppHandle,
    namespace: String,
) -> Result<Option<QuickAppHtmlSnapshotRecord>, String> {
    let normalized_namespace = namespace.trim();
    if normalized_namespace.is_empty() {
        return Ok(None);
    }

    let store = read_quick_app_html_snapshot_store(&app)?;
    Ok(store
        .records
        .into_iter()
        .find(|record| record.namespace == normalized_namespace))
}

#[tauri::command]
async fn fetch_quick_app_url_preview(url: String) -> Result<Option<QuickAppUrlPreview>, String> {
    let trimmed_url = url.trim();
    if trimmed_url.is_empty() {
        return Ok(None);
    }

    let parsed_url =
        reqwest::Url::parse(trimmed_url).map_err(|err| format!("invalid url {trimmed_url}: {err}"))?;
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Ok(None);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|err| format!("failed to create HTTP client: {err}"))?;

    let response = client
        .get(parsed_url.clone())
        .header(
            reqwest::header::USER_AGENT,
            "ODETool Pro AI Quick App Preview/1.0",
        )
        .send()
        .await
        .map_err(|err| format!("quick app preview request failed: {err}"))?;

    let final_url = response.url().to_string();
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or("").trim().to_string())
        .filter(|value| !value.is_empty());

    if !status.is_success() {
        return Ok(Some(QuickAppUrlPreview {
            url: trimmed_url.to_string(),
            final_url,
            title: derive_url_preview_title(trimmed_url),
            description: Some(format!("HTTP {}", status.as_u16())),
            excerpt: None,
            content_type,
            reachable: false,
        }));
    }

    if !is_previewable_content_type(content_type.as_deref()) {
        return Ok(Some(QuickAppUrlPreview {
            url: trimmed_url.to_string(),
            final_url,
            title: derive_url_preview_title(trimmed_url),
            description: None,
            excerpt: None,
            content_type,
            reachable: true,
        }));
    }

    let body = response
        .text()
        .await
        .map_err(|err| format!("failed to read quick app preview body: {err}"))?;
    let limited_body = body.chars().take(200_000).collect::<String>();
    let is_html = content_type
        .as_deref()
        .map(|value| value.to_ascii_lowercase().contains("html"))
        .unwrap_or_else(|| {
            final_url.to_ascii_lowercase().ends_with(".html")
                || final_url.to_ascii_lowercase().ends_with(".htm")
        });

    let title = if is_html {
        extract_html_tag_text(&limited_body, "title").or_else(|| derive_url_preview_title(&final_url))
    } else {
        derive_url_preview_title(&final_url)
    };
    let description = if is_html {
        extract_html_meta_description(&limited_body)
    } else {
        None
    };
    let excerpt_source = if is_html {
        document_parser::strip_html_to_text(&limited_body)
    } else {
        limited_body
    };
    let excerpt = trim_preview_text(&excerpt_source, 3000);

    Ok(Some(QuickAppUrlPreview {
        url: trimmed_url.to_string(),
        final_url,
        title,
        description,
        excerpt,
        content_type,
        reachable: true,
    }))
}

#[tauri::command]
async fn reparse_node_document_content(
    app: tauri::AppHandle,
    node_id: String,
) -> Result<Option<AppNode>, String> {
    let db = get_db(&app).await?;
    let file_path = resolve_node_file_path(&db, &node_id).await?;
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string();

    parse_and_store_node_file_content(&db, &node_id, &file_path, &extension).await?;

    let updated = fetch_node_record(&db, &node_id).await?;
    Ok(updated.map(AppNode::from))
}

async fn resolve_node_file_path(db: &Surreal<Db>, node_id: &str) -> Result<PathBuf, String> {
    let node = fetch_node_record(db, node_id)
        .await?
        .ok_or_else(|| format!("node not found: {node_id}"))?;

    if node.node_type != "file" {
        return Err("node is not a file".to_string());
    }

    let raw_path = node
        .properties
        .get("mirrorFilePath")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "file path is missing for this node".to_string())?;

    Ok(PathBuf::from(raw_path))
}

async fn resolve_node_file_location_path(
    db: &Surreal<Db>,
    node_id: &str,
) -> Result<PathBuf, String> {
    let node = fetch_node_record(db, node_id)
        .await?
        .ok_or_else(|| format!("node not found: {node_id}"))?;

    if node.node_type != "file" {
        return Err("node is not a file".to_string());
    }

    let mirror_path = node
        .properties
        .get("mirrorFilePath")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);

    let imported_path = node
        .properties
        .get("importedFromPath")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.contains("://"))
        .map(PathBuf::from);

    if let Some(path) = mirror_path.as_ref() {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    if let Some(path) = imported_path.as_ref() {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    if let Some(path) = mirror_path {
        return Ok(path);
    }

    if let Some(path) = imported_path {
        return Ok(path);
    }

    Err("file path is unavailable".to_string())
}

#[tauri::command]
async fn open_node_file_location(app: tauri::AppHandle, node_id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    let file_path = resolve_node_file_location_path(&db, &node_id).await?;

    if file_path.exists() {
        return open_file_location(&file_path);
    }

    if let Some(parent) = file_path.parent() {
        return open_path_with_system_default(parent);
    }

    let mirror_root = ensure_mirror_root_exists(&app)?;
    open_path_with_system_default(&mirror_root)
}

#[tauri::command]
async fn open_node_file_with(app: tauri::AppHandle, node_id: String) -> Result<(), String> {
    let db = get_db(&app).await?;
    let file_path = resolve_node_file_path(&db, &node_id).await?;

    if file_path.exists() {
        if open_file_with_dialog(&file_path).is_ok() {
            return Ok(());
        }
        return open_file_location(&file_path);
    }

    if let Some(parent) = file_path.parent() {
        return open_path_with_system_default(parent);
    }

    let mirror_root = ensure_mirror_root_exists(&app)?;
    open_path_with_system_default(&mirror_root)
}

#[tauri::command]
async fn get_windows_file_icon(
    file_path: Option<String>,
    file_name: Option<String>,
    size: Option<u32>,
) -> Result<Option<String>, String> {
    let normalized_path = normalize_optional_text(file_path);
    let normalized_name = normalize_optional_text(file_name);
    let icon_size = size.unwrap_or(20).clamp(16, 128);
    let cache_key = build_windows_icon_cache_key(
        normalized_path.as_deref(),
        normalized_name.as_deref(),
        icon_size,
    );

    if let Ok(cache) = windows_icon_cache().lock() {
        if let Some(cached) = cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }

    let icon_data = extract_windows_file_icon_data_url(
        normalized_path.as_deref(),
        normalized_name.as_deref(),
        icon_size,
    )?;

    if let Ok(mut cache) = windows_icon_cache().lock() {
        cache.insert(cache_key, icon_data.clone());
    }

    Ok(icon_data)
}

#[tauri::command]
fn get_windows_primary_window_layout_state(
    app: tauri::AppHandle,
) -> Result<WindowsWindowLayoutState, String> {
    #[cfg(target_os = "windows")]
    {
        let window = get_primary_webview_window(&app)?;
        let hwnd = window
            .hwnd()
            .map_err(|err| format!("failed to resolve the primary window handle: {err}"))?;
        return build_windows_window_layout_state(hwnd);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Primary window layout inspection is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn set_windows_primary_window_bounds(
    app: tauri::AppHandle,
    bounds: WindowsWindowBounds,
) -> Result<WindowsWindowLayoutState, String> {
    #[cfg(target_os = "windows")]
    {
        let window = get_primary_webview_window(&app)?;
        let hwnd = window
            .hwnd()
            .map_err(|err| format!("failed to resolve the primary window handle: {err}"))?;
        return apply_windows_window_bounds(hwnd, &bounds);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = bounds;
        Err("Primary window resizing is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn fit_windows_primary_window_to_work_area(
    app: tauri::AppHandle,
    options: Option<WindowsPrimaryWindowFitOptions>,
) -> Result<WindowsWindowLayoutState, String> {
    #[cfg(target_os = "windows")]
    {
        let window = get_primary_webview_window(&app)?;
        let hwnd = window
            .hwnd()
            .map_err(|err| format!("failed to resolve the primary window handle: {err}"))?;
        return fit_windows_window_to_work_area(hwnd, options.as_ref());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = options;
        Err("Primary window work-area fitting is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn is_windows_primary_window_fullscreen(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let window = get_primary_webview_window(&app)?;
        return window
            .is_fullscreen()
            .map_err(|err| format!("failed to read primary window fullscreen state: {err}"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Primary window fullscreen inspection is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn set_windows_primary_window_fullscreen(
    app: tauri::AppHandle,
    fullscreen: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let window = get_primary_webview_window(&app)?;
        return window
            .set_fullscreen(fullscreen)
            .map_err(|err| format!("failed to set primary window fullscreen state: {err}"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = fullscreen;
        Err("Primary window fullscreen control is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn minimize_windows_primary_window(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let window = get_primary_webview_window(&app)?;
        let hwnd = window
            .hwnd()
            .map_err(|err| format!("failed to resolve the primary window handle: {err}"))?;
        minimize_windows_window(hwnd);
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Primary window minimization is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn close_windows_primary_window(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let window = get_primary_webview_window(&app)?;
        let hwnd = window
            .hwnd()
            .map_err(|err| format!("failed to resolve the primary window handle: {err}"))?;
        return request_close_windows_window(hwnd);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Primary window close requests are only supported on Windows.".to_string())
    }
}

#[tauri::command]
async fn get_windows_clipboard_file_paths() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$items = Get-Clipboard -Format FileDropList -ErrorAction SilentlyContinue
if ($null -eq $items -or @($items).Count -eq 0) {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
            $dropList = [System.Windows.Forms.Clipboard]::GetFileDropList()
            if ($dropList -and $dropList.Count -gt 0) {
                $items = $dropList
            }
        }
    } catch {
        # Keep the clipboard read best-effort; fall through to empty result.
    }
}
if ($null -eq $items -or @($items).Count -eq 0) { exit 0 }
$items | ForEach-Object { $_ }"#;
        let output = windows_powershell_command()
            .arg("-Sta")
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg(script)
            .output()
            .map_err(|err| format!("failed to read clipboard file list: {err}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if stderr.is_empty() {
                return Ok(Vec::new());
            }
            return Err(format!("clipboard file list command failed: {stderr}"));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let paths = stdout
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(|line| line.to_string())
            .collect();
        return Ok(paths);
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
async fn set_windows_clipboard_file_paths(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let cleaned: Vec<String> = paths
            .into_iter()
            .map(|path| path.trim().to_string())
            .filter(|path| !path.is_empty())
            .collect();

        if cleaned.is_empty() {
            return Ok(());
        }

        let serialized = serde_json::to_string(&cleaned)
            .map_err(|err| format!("failed to encode clipboard paths: {err}"))?;
        let script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$json = $env:ODE_CLIPBOARD_PATHS_JSON
if (-not $json) { exit 0 }
$paths = ConvertFrom-Json -InputObject $json
if ($null -eq $paths) { exit 0 }
if (-not ($paths -is [System.Array])) { $paths = @($paths) }
$normalized = @()
foreach ($p in $paths) {
  if ($null -eq $p) { continue }
  $trimmed = "$p".Trim()
  if ($trimmed.Length -gt 0) { $normalized += $trimmed }
}
if ($normalized.Count -eq 0) { exit 0 }
Set-Clipboard -Path $normalized
"#;

        let output = windows_powershell_command()
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg(script)
            .env("ODE_CLIPBOARD_PATHS_JSON", serialized)
            .output()
            .map_err(|err| format!("failed to set clipboard file list: {err}"))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Err("failed to set clipboard file list".to_string());
        }
        return Err(format!("clipboard file list command failed: {stderr}"));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = paths;
        Ok(())
    }
}

#[tauri::command]
async fn pick_windows_files_for_import() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms | Out-Null
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Multiselect = $true
$dialog.CheckFileExists = $true
$dialog.CheckPathExists = $true
$dialog.Filter = 'All files (*.*)|*.*'
$dialog.Title = 'Select files to import'
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  $dialog.FileNames | ForEach-Object { $_ }
}
"#;

        let output = windows_powershell_command()
            .arg("-NoProfile")
            .arg("-STA")
            .arg("-Command")
            .arg(script)
            .output()
            .map_err(|err| format!("failed to open file picker: {err}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if stderr.is_empty() {
                return Ok(Vec::new());
            }
            return Err(format!("file picker command failed: {stderr}"));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let paths = stdout
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(|line| line.to_string())
            .collect();
        return Ok(paths);
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
async fn pick_qa_evidence_files() -> Result<Vec<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Select QA evidence files")
            .pick_files()
            .unwrap_or_default()
            .into_iter()
            .map(normalize_windows_extended_path)
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>()
    })
    .await
    .map_err(|err| format!("failed to open QA evidence picker: {err}"))?;
    Ok(picked)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreeSpreadsheetMetaPayload {
    title: Option<String>,
    goal: Option<String>,
    document_name: Option<String>,
    output_language: Option<String>,
    notes: Option<String>,
    source_labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreeSpreadsheetDeliverableTasksPayload {
    deliverable: String,
    tasks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreeSpreadsheetRowPayload {
    number: Option<String>,
    level: Option<i64>,
    title: String,
    description: Option<String>,
    deliverables: Vec<String>,
    deliverable_tasks: Vec<TreeSpreadsheetDeliverableTasksPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreeSpreadsheetPayload {
    meta: Option<TreeSpreadsheetMetaPayload>,
    rows: Vec<TreeSpreadsheetRowPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcedureTableSpreadsheetMetaEntryPayload {
    label: String,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcedureTableSpreadsheetSheetPayload {
    name: String,
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcedureTableSpreadsheetPayload {
    table_name: String,
    meta: Vec<ProcedureTableSpreadsheetMetaEntryPayload>,
    sheets: Vec<ProcedureTableSpreadsheetSheetPayload>,
}

fn normalize_spreadsheet_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_spreadsheet_header(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace('_', " ")
        .replace('-', " ")
}

fn normalize_spreadsheet_deliverables(value: &str) -> Vec<String> {
    value
        .split(|ch| ch == '\n' || ch == '|' || ch == ';')
        .filter_map(normalize_spreadsheet_text)
        .collect()
}

fn normalize_spreadsheet_task_mappings(value: &str) -> Vec<TreeSpreadsheetDeliverableTasksPayload> {
    let mut mappings = Vec::new();
    for raw_line in value.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        let separator = line
            .find("=>")
            .map(|index| (index, 2usize))
            .or_else(|| line.find("::").map(|index| (index, 2usize)))
            .or_else(|| line.find(':').map(|index| (index, 1usize)));
        let Some((separator_index, separator_width)) = separator else {
            continue;
        };
        let deliverable = normalize_spreadsheet_text(&line[..separator_index]).unwrap_or_default();
        if deliverable.is_empty() {
            continue;
        }
        let task_part = &line[separator_index + separator_width..];
        let tasks = task_part
            .split(|ch| ch == '|' || ch == ';')
            .filter_map(normalize_spreadsheet_text)
            .collect::<Vec<_>>();
        mappings.push(TreeSpreadsheetDeliverableTasksPayload { deliverable, tasks });
    }
    mappings
}

fn format_spreadsheet_task_mappings(values: &[TreeSpreadsheetDeliverableTasksPayload]) -> String {
    values
        .iter()
        .filter_map(|entry| {
            let deliverable = normalize_spreadsheet_text(entry.deliverable.as_str())?;
            let tasks = entry
                .tasks
                .iter()
                .filter_map(|task| normalize_spreadsheet_text(task))
                .collect::<Vec<_>>();
            if tasks.is_empty() {
                return None;
            }
            Some(format!("{deliverable} => {}", tasks.join(" | ")))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn tree_spreadsheet_cell_text<T: ToString>(row: &[T], index: usize) -> String {
    row.get(index)
        .map(|cell| cell.to_string())
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn trim_spreadsheet_row(mut values: Vec<String>) -> Vec<String> {
    while values.last().map(|value| value.trim().is_empty()).unwrap_or(false) {
        values.pop();
    }
    values
}

fn spreadsheet_row_has_content(row: &[String]) -> bool {
    row.iter().any(|value| !value.trim().is_empty())
}

fn spreadsheet_row_to_strings<T: ToString>(row: &[T]) -> Vec<String> {
    trim_spreadsheet_row(
        row.iter()
            .map(|cell| cell.to_string().trim().to_string())
            .collect(),
    )
}

fn sanitize_workbook_sheet_name(value: &str, fallback: &str) -> String {
    let cleaned = value
        .trim()
        .chars()
        .map(|ch| match ch {
            '[' | ']' | ':' | '*' | '?' | '/' | '\\' => ' ',
            _ => ch,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let normalized = if cleaned.is_empty() {
        fallback.trim().to_string()
    } else {
        cleaned
    };
    let mut limited = normalized.chars().take(31).collect::<String>();
    if limited.trim().is_empty() {
        limited = fallback.chars().take(31).collect::<String>();
    }
    limited
}

fn dedupe_workbook_sheet_name(base: &str, used_names: &mut HashSet<String>) -> String {
    let normalized_base = sanitize_workbook_sheet_name(base, "Sheet");
    let normalized_key = normalized_base.to_lowercase();
    if !used_names.contains(&normalized_key) {
        used_names.insert(normalized_key);
        return normalized_base;
    }

    for index in 2..=999 {
        let suffix = format!(" {index}");
        let max_base_length = 31usize.saturating_sub(suffix.len());
        let truncated = normalized_base.chars().take(max_base_length).collect::<String>();
        let candidate = format!("{truncated}{suffix}");
        let candidate_key = candidate.to_lowercase();
        if !used_names.contains(&candidate_key) {
            used_names.insert(candidate_key);
            return candidate;
        }
    }

    let fallback = format!("Sheet {}", used_names.len() + 1);
    let candidate = sanitize_workbook_sheet_name(&fallback, "Sheet");
    used_names.insert(candidate.to_lowercase());
    candidate
}

fn write_generic_spreadsheet_sheet(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    headers: &[String],
    rows: &[Vec<String>],
) -> Result<(), String> {
    for (column_index, header) in headers.iter().enumerate() {
        worksheet
            .write_string(0, column_index as u16, header)
            .map_err(|err| format!("failed to write worksheet header {header}: {err}"))?;
    }

    for (row_index, row) in rows.iter().enumerate() {
        let sheet_row = (row_index + 1) as u32;
        for (column_index, value) in row.iter().enumerate() {
            if value.trim().is_empty() {
                continue;
            }
            worksheet
                .write_string(sheet_row, column_index as u16, value)
                .map_err(|err| format!("failed to write worksheet cell ({sheet_row}, {column_index}): {err}"))?;
        }
    }

    worksheet
        .set_freeze_panes(1, 0)
        .map_err(|err| format!("failed to freeze worksheet panes: {err}"))?;
    Ok(())
}

fn write_procedure_table_spreadsheet_workbook(
    file_path: &Path,
    payload: &ProcedureTableSpreadsheetPayload,
) -> Result<(), String> {
    let mut workbook = Workbook::new();
    let mut used_sheet_names = HashSet::<String>::new();

    for sheet_payload in &payload.sheets {
        let sheet_name = dedupe_workbook_sheet_name(&sheet_payload.name, &mut used_sheet_names);
        let worksheet = workbook.add_worksheet();
        worksheet
            .set_name(&sheet_name)
            .map_err(|err| format!("failed to name worksheet {sheet_name}: {err}"))?;
        write_generic_spreadsheet_sheet(worksheet, &sheet_payload.headers, &sheet_payload.rows)?;
    }

    if !payload.meta.is_empty() {
        let meta_sheet_name = dedupe_workbook_sheet_name("Meta", &mut used_sheet_names);
        let meta_sheet = workbook.add_worksheet();
        meta_sheet
            .set_name(&meta_sheet_name)
            .map_err(|err| format!("failed to name worksheet {meta_sheet_name}: {err}"))?;
        meta_sheet
            .write_string(0, 0, "Label")
            .map_err(|err| format!("failed to write meta header label: {err}"))?;
        meta_sheet
            .write_string(0, 1, "Value")
            .map_err(|err| format!("failed to write meta header value: {err}"))?;

        for (row_index, entry) in payload.meta.iter().enumerate() {
            let sheet_row = (row_index + 1) as u32;
            if let Some(label) = normalize_spreadsheet_text(&entry.label) {
                meta_sheet
                    .write_string(sheet_row, 0, &label)
                    .map_err(|err| format!("failed to write meta label: {err}"))?;
            }
            if let Some(value) = normalize_spreadsheet_text(&entry.value) {
                meta_sheet
                    .write_string(sheet_row, 1, &value)
                    .map_err(|err| format!("failed to write meta value: {err}"))?;
            }
        }

        meta_sheet
            .set_freeze_panes(1, 0)
            .map_err(|err| format!("failed to freeze meta worksheet panes: {err}"))?;
    }

    workbook
        .save(file_path)
        .map_err(|err| format!("failed to save workbook {:?}: {err}", file_path))
}

fn write_tree_spreadsheet_workbook(
    file_path: &Path,
    payload: &TreeSpreadsheetPayload,
) -> Result<(), String> {
    let mut workbook = Workbook::new();
    let tree_sheet = workbook.add_worksheet();
    tree_sheet
        .set_name(TREE_SPREADSHEET_TREE_SHEET_NAME)
        .map_err(|err| format!("failed to name tree worksheet: {err}"))?;

    for (column_index, header) in TREE_SPREADSHEET_HEADERS.iter().enumerate() {
        tree_sheet
            .write_string(0, column_index as u16, *header)
            .map_err(|err| format!("failed to write tree header {header}: {err}"))?;
    }

    for (row_index, row) in payload.rows.iter().enumerate() {
        let sheet_row = (row_index + 1) as u32;
        if let Some(number) = normalize_spreadsheet_text(row.number.as_deref().unwrap_or_default()) {
            tree_sheet
                .write_string(sheet_row, 0, &number)
                .map_err(|err| format!("failed to write tree row number: {err}"))?;
        }
        tree_sheet
            .write_string(sheet_row, 1, &row.title)
            .map_err(|err| format!("failed to write tree row title: {err}"))?;
        if let Some(description) =
            normalize_spreadsheet_text(row.description.as_deref().unwrap_or_default())
        {
            tree_sheet
                .write_string(sheet_row, 2, &description)
                .map_err(|err| format!("failed to write tree row description: {err}"))?;
        }
        let deliverables = row
            .deliverables
            .iter()
            .filter_map(|item| normalize_spreadsheet_text(item.as_str()))
            .collect::<Vec<_>>()
            .join("\n");
        if !deliverables.is_empty() {
            tree_sheet
                .write_string(sheet_row, 3, &deliverables)
                .map_err(|err| format!("failed to write tree row deliverables: {err}"))?;
        }
        let task_mappings = format_spreadsheet_task_mappings(&row.deliverable_tasks);
        if !task_mappings.trim().is_empty() {
            tree_sheet
                .write_string(sheet_row, 4, &task_mappings)
                .map_err(|err| format!("failed to write tree row tasks: {err}"))?;
        }
    }

    tree_sheet
        .set_freeze_panes(1, 0)
        .map_err(|err| format!("failed to freeze tree worksheet panes: {err}"))?;

    workbook
        .save(file_path)
        .map_err(|err| format!("failed to save workbook {:?}: {err}", file_path))
}

fn read_tree_spreadsheet_payload_from_path(file_path: &Path) -> Result<TreeSpreadsheetPayload, String> {
    use calamine::{open_workbook_auto, Reader};

    let mut workbook = open_workbook_auto(file_path)
        .map_err(|err| format!("failed to open workbook {:?}: {err}", file_path))?;

    let tree_range = match workbook.worksheet_range(TREE_SPREADSHEET_TREE_SHEET_NAME) {
        Some(Ok(range)) => range,
        Some(Err(err)) => return Err(format!("failed to read tree worksheet: {err}")),
        None => return Err("tree workbook is missing the Tree worksheet".to_string()),
    };

    let mut header_index: HashMap<String, usize> = HashMap::new();
    if let Some(header_row) = tree_range.rows().next() {
        for (index, cell) in header_row.iter().enumerate() {
            let header = normalize_spreadsheet_header(&cell.to_string());
            if !header.is_empty() {
                header_index.insert(header, index);
            }
        }
    }

    let find_index = |candidates: &[&str]| -> Option<usize> {
        candidates
            .iter()
            .find_map(|candidate| header_index.get(&normalize_spreadsheet_header(candidate)).copied())
    };

    let title_index =
        find_index(&["Title", "Node", "Name"]).ok_or_else(|| "tree workbook is missing a Title column".to_string())?;

    let number_index = find_index(&["Number"]);
    let level_index = find_index(&["Level"]);
    let description_index = find_index(&["Description"]);
    let deliverables_index = find_index(&["Deliverables"]);
    let tasks_index = find_index(&["Tasks", "Deliverable Tasks", "Task Of Deliverables", "Task of deliverables"]);

    let mut rows: Vec<TreeSpreadsheetRowPayload> = Vec::new();
    for row in tree_range.rows().skip(1) {
        let title = tree_spreadsheet_cell_text(row, title_index);
        if title.is_empty() {
            continue;
        }
        let number = number_index
            .map(|index| tree_spreadsheet_cell_text(row, index))
            .and_then(|value| normalize_spreadsheet_text(&value));
        let level = level_index
            .map(|index| tree_spreadsheet_cell_text(row, index))
            .and_then(|value| value.parse::<i64>().ok())
            .or_else(|| {
                number.as_ref().map(|label| {
                    label
                        .split('.')
                        .map(|segment| segment.trim())
                        .filter(|segment| !segment.is_empty())
                        .count() as i64
                })
            })
            .or(Some(1));
        let description = description_index
            .map(|index| tree_spreadsheet_cell_text(row, index))
            .and_then(|value| normalize_spreadsheet_text(&value));
        let deliverables = deliverables_index
            .map(|index| tree_spreadsheet_cell_text(row, index))
            .map(|value| normalize_spreadsheet_deliverables(&value))
            .unwrap_or_default();
        let deliverable_tasks = tasks_index
            .map(|index| tree_spreadsheet_cell_text(row, index))
            .map(|value| normalize_spreadsheet_task_mappings(&value))
            .unwrap_or_default();

        rows.push(TreeSpreadsheetRowPayload {
            number,
            level,
            title,
            description,
            deliverables,
            deliverable_tasks,
        });
    }

    let meta = match workbook.worksheet_range(TREE_SPREADSHEET_META_SHEET_NAME) {
        Some(Ok(meta_range)) => {
            let mut values = HashMap::<String, String>::new();
            for row in meta_range.rows().skip(1) {
                let key = tree_spreadsheet_cell_text(row, 0);
                if key.is_empty() {
                    continue;
                }
                values.insert(key, tree_spreadsheet_cell_text(row, 1));
            }
            Some(TreeSpreadsheetMetaPayload {
                title: normalize_spreadsheet_text(
                    values
                        .get(TREE_SPREADSHEET_META_TITLE_KEY)
                        .map(|value| value.as_str())
                        .unwrap_or_default(),
                ),
                goal: normalize_spreadsheet_text(
                    values
                        .get(TREE_SPREADSHEET_META_GOAL_KEY)
                        .map(|value| value.as_str())
                        .unwrap_or_default(),
                ),
                document_name: normalize_spreadsheet_text(
                    values
                        .get(TREE_SPREADSHEET_META_DOCUMENT_NAME_KEY)
                        .map(|value| value.as_str())
                        .unwrap_or_default(),
                ),
                output_language: normalize_spreadsheet_text(
                    values
                        .get(TREE_SPREADSHEET_META_OUTPUT_LANGUAGE_KEY)
                        .map(|value| value.as_str())
                        .unwrap_or_default(),
                ),
                notes: normalize_spreadsheet_text(
                    values
                        .get(TREE_SPREADSHEET_META_NOTES_KEY)
                        .map(|value| value.as_str())
                        .unwrap_or_default(),
                ),
                source_labels: values
                    .get(TREE_SPREADSHEET_META_SOURCE_LABELS_KEY)
                    .map(|value| normalize_spreadsheet_deliverables(value))
                    .unwrap_or_default(),
            })
        }
        Some(Err(_)) | None => None,
    };

    Ok(TreeSpreadsheetPayload { meta, rows })
}

fn read_procedure_table_spreadsheet_payload_from_path(
    file_path: &Path,
) -> Result<ProcedureTableSpreadsheetPayload, String> {
    use calamine::{open_workbook_auto, Reader};

    let mut workbook = open_workbook_auto(file_path)
        .map_err(|err| format!("failed to open workbook {:?}: {err}", file_path))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let mut meta = Vec::<ProcedureTableSpreadsheetMetaEntryPayload>::new();
    let mut sheets = Vec::<ProcedureTableSpreadsheetSheetPayload>::new();

    for sheet_name in sheet_names {
        let range = match workbook.worksheet_range(&sheet_name) {
            Some(Ok(range)) => range,
            Some(Err(err)) => {
                return Err(format!(
                    "failed to read worksheet {:?} from {:?}: {err}",
                    sheet_name, file_path
                ))
            }
            None => continue,
        };

        let rows = range
            .rows()
            .map(spreadsheet_row_to_strings)
            .collect::<Vec<_>>();
        if rows.iter().all(|row| !spreadsheet_row_has_content(row)) {
            continue;
        }

        if normalize_spreadsheet_header(&sheet_name) == "meta" {
            for (index, row) in rows.iter().enumerate() {
                if !spreadsheet_row_has_content(row) {
                    continue;
                }
                let label = row.get(0).cloned().unwrap_or_default();
                let value = row.get(1).cloned().unwrap_or_default();
                if index == 0
                    && normalize_spreadsheet_header(&label) == "label"
                    && normalize_spreadsheet_header(&value) == "value"
                {
                    continue;
                }
                let Some(normalized_label) = normalize_spreadsheet_text(&label) else {
                    continue;
                };
                meta.push(ProcedureTableSpreadsheetMetaEntryPayload {
                    label: normalized_label,
                    value: value.trim().to_string(),
                });
            }
            continue;
        }

        let Some(header_row_index) = rows.iter().position(|row| spreadsheet_row_has_content(row)) else {
            continue;
        };
        let headers = rows
            .get(header_row_index)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|value| value.trim().to_string())
            .collect::<Vec<_>>();
        if headers.is_empty() {
            continue;
        }

        let body_rows = rows
            .into_iter()
            .skip(header_row_index + 1)
            .filter(|row| spreadsheet_row_has_content(row))
            .map(|mut row| {
                row.resize(headers.len(), String::new());
                row.truncate(headers.len());
                row
            })
            .collect::<Vec<_>>();

        sheets.push(ProcedureTableSpreadsheetSheetPayload {
            name: sheet_name,
            headers,
            rows: body_rows,
        });
    }

    if sheets.is_empty() {
        return Err("procedure table workbook has no readable sheets".to_string());
    }

    let table_name = meta
        .iter()
        .find(|entry| normalize_spreadsheet_header(&entry.label) == "table")
        .and_then(|entry| normalize_spreadsheet_text(&entry.value))
        .or_else(|| {
            file_path
                .file_stem()
                .and_then(|value| value.to_str())
                .and_then(normalize_spreadsheet_text)
        })
        .unwrap_or_else(|| "Imported Table".to_string());

    Ok(ProcedureTableSpreadsheetPayload {
        table_name,
        meta,
        sheets,
    })
}

#[tauri::command]
async fn export_tree_structure_excel(
    dialog_title: String,
    default_file_name: String,
    payload: TreeSpreadsheetPayload,
) -> Result<Option<String>, String> {
    let _ = dialog_title;
    tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
        let fallback_dir = dirs::desktop_dir()
            .or_else(dirs::download_dir)
            .or_else(|| std::env::current_dir().ok())
            .ok_or_else(|| "failed to resolve export directory".to_string())?;
        let file_path = build_unique_export_output_path(&fallback_dir, &default_file_name, "xlsx");
        write_tree_spreadsheet_workbook(&file_path, &payload)?;
        Ok(Some(file_path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|err| format!("failed to export tree spreadsheet: {err}"))?
}

#[tauri::command]
async fn export_procedure_table_excel(
    dialog_title: String,
    default_file_name: String,
    payload: ProcedureTableSpreadsheetPayload,
) -> Result<Option<String>, String> {
    let default_dir = dirs::download_dir().or_else(dirs::desktop_dir);
    let saved_path =
        tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
            let normalized_title = if dialog_title.trim().is_empty() {
                format!("Export {}", payload.table_name.trim())
            } else {
                dialog_title.trim().to_string()
            };

            let mut dialog = rfd::FileDialog::new()
                .set_title(&normalized_title)
                .add_filter("Excel Workbook", &["xlsx"])
                .set_file_name(&default_file_name);
            if let Some(dir) = default_dir {
                dialog = dialog.set_directory(dir);
            }
            let Some(selected) = dialog.save_file() else {
                return Ok(None);
            };
            let file_path = ensure_file_extension(normalize_windows_extended_path(selected), "xlsx");
            write_procedure_table_spreadsheet_workbook(&file_path, &payload)?;
            Ok(Some(file_path.to_string_lossy().to_string()))
        })
        .await
        .map_err(|err| format!("failed to open procedure table export dialog: {err}"))??;
    Ok(saved_path)
}

#[tauri::command]
async fn pick_windows_tree_spreadsheet_file() -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Select tree structure workbook")
            .add_filter("Excel Workbook", &["xlsx", "xls"])
            .pick_file()
            .map(normalize_windows_extended_path)
            .map(|path| path.to_string_lossy().to_string())
    })
    .await
    .map_err(|err| format!("failed to open tree spreadsheet picker: {err}"))?;
    Ok(picked)
}

#[tauri::command]
async fn pick_windows_procedure_table_spreadsheet_file() -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Select procedure table workbook")
            .add_filter("Excel Workbook", &["xlsx", "xls"])
            .pick_file()
            .map(normalize_windows_extended_path)
            .map(|path| path.to_string_lossy().to_string())
    })
    .await
    .map_err(|err| format!("failed to open procedure table spreadsheet picker: {err}"))?;
    Ok(picked)
}

#[tauri::command]
async fn read_tree_structure_excel(file_path: String) -> Result<TreeSpreadsheetPayload, String> {
    let trimmed = file_path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("tree structure workbook path is empty".to_string());
    }
    let normalized_path = PathBuf::from(trimmed);
    if !normalized_path.exists() || !normalized_path.is_file() {
        return Err(format!("tree structure workbook not found: {:?}", normalized_path));
    }
    tauri::async_runtime::spawn_blocking(move || {
        read_tree_spreadsheet_payload_from_path(&normalized_path)
    })
    .await
    .map_err(|err| format!("failed to read tree spreadsheet: {err}"))?
}

#[tauri::command]
async fn read_procedure_table_excel(
    file_path: String,
) -> Result<ProcedureTableSpreadsheetPayload, String> {
    let trimmed = file_path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("procedure table workbook path is empty".to_string());
    }
    let normalized_path = PathBuf::from(trimmed);
    if !normalized_path.exists() || !normalized_path.is_file() {
        return Err(format!("procedure table workbook not found: {:?}", normalized_path));
    }
    tauri::async_runtime::spawn_blocking(move || {
        read_procedure_table_spreadsheet_payload_from_path(&normalized_path)
    })
    .await
    .map_err(|err| format!("failed to read procedure table spreadsheet: {err}"))?
}

#[tauri::command]
async fn save_export_file(
    dialog_title: String,
    default_file_name: String,
    filter_label: String,
    extension: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, String> {
    let default_dir = dirs::download_dir().or_else(dirs::desktop_dir);
    let saved_path =
        tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
            let normalized_extension = extension
                .trim()
                .trim_start_matches('.')
                .to_ascii_lowercase();
            if normalized_extension.is_empty() {
                return Err("missing export file extension".to_string());
            }

            let normalized_title = if dialog_title.trim().is_empty() {
                "Save export".to_string()
            } else {
                dialog_title.trim().to_string()
            };
            let normalized_filter = if filter_label.trim().is_empty() {
                normalized_extension.to_ascii_uppercase()
            } else {
                filter_label.trim().to_string()
            };

            let extension_refs = [normalized_extension.as_str()];
            let mut dialog = rfd::FileDialog::new()
                .set_title(&normalized_title)
                .add_filter(&normalized_filter, &extension_refs)
                .set_file_name(&default_file_name);
            if let Some(dir) = default_dir {
                dialog = dialog.set_directory(dir);
            }
            let Some(selected) = dialog.save_file() else {
                return Ok(None);
            };
            let file_path = ensure_file_extension(
                normalize_windows_extended_path(selected),
                &normalized_extension,
            );
            fs::write(&file_path, &bytes)
                .map_err(|err| format!("failed to save export {:?}: {err}", file_path))?;
            Ok(Some(file_path.to_string_lossy().to_string()))
        })
        .await
        .map_err(|err| format!("failed to open export save dialog: {err}"))??;
    Ok(saved_path)
}

#[tauri::command]
async fn pick_windows_node_package_file() -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Select node package")
            .add_filter("ODE package", &["odepkg"])
            .pick_file()
            .map(normalize_windows_extended_path)
            .map(|path| path.to_string_lossy().to_string())
    })
    .await
        .map_err(|err| format!("failed to open package file picker: {err}"))?;
    Ok(picked)
}

#[tauri::command]
async fn pick_windows_workspace_package_file() -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Select workspace package")
            .add_filter("ODE workspace package", &["odewsp"])
            .add_filter("ODE package", &["odepkg"])
            .pick_file()
            .map(normalize_windows_extended_path)
            .map(|path| path.to_string_lossy().to_string())
    })
    .await
    .map_err(|err| format!("failed to open workspace package picker: {err}"))?;
    Ok(picked)
}

#[tauri::command]
async fn pick_windows_project_folder() -> Result<Option<String>, String> {
    let desktop_dir = dirs::desktop_dir();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new().set_title("Select project folder");
        if let Some(desktop) = desktop_dir {
            dialog = dialog.set_directory(desktop);
        }
        dialog
            .pick_folder()
            .map(normalize_windows_extended_path)
            .map(|path| path.to_string_lossy().to_string())
    })
    .await
    .map_err(|err| format!("failed to open project folder picker: {err}"))?;
    Ok(picked)
}

#[tauri::command]
async fn get_mirror_root(app: tauri::AppHandle) -> Result<String, String> {
    let path = ensure_mirror_root_exists(&app)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_projects(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, String> {
    let db = get_db(&app).await?;
    let mut projects = fetch_all_projects(&db).await?;
    let root_nodes = match fetch_root_folder_nodes(&db).await {
        Ok(rows) => Some(rows),
        Err(err) => {
            if is_surreal_revision_deserialization_error(&err) {
                eprintln!(
                    "get_projects: skipping workspace root scan due legacy node value revision: {err}"
                );
                None
            } else {
                return Err(err);
            }
        }
    };
    if let Some(root_nodes) = root_nodes {
        ensure_project_records_from_nodes(&db, &root_nodes, &mut projects)
            .await
            .map_err(|err| format!("workspace index recovery failed: {err}"))?;
        let root_node_by_id: HashMap<String, NodeRecord> = root_nodes
            .into_iter()
            .map(|node| (node.node_id.clone(), node))
            .collect();
        let _ = remove_stale_project_records(&db, &mut projects, &root_node_by_id).await;
    }
    eprintln!(
        "get_projects: found {} total project records",
        projects.len()
    );
    projects.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.created_at.cmp(&left.created_at))
    });

    Ok(projects.into_iter().map(ProjectSummary::from).collect())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRepairSummary {
    recovered_count: i64,
    updated_count: i64,
    removed_stale_count: i64,
    total_workspaces: i64,
    warning: Option<String>,
}

#[tauri::command]
async fn repair_workspace_index(app: tauri::AppHandle) -> Result<WorkspaceRepairSummary, String> {
    let db = get_db(&app).await?;
    let mut projects = fetch_all_projects(&db).await?;
    let mut warning: Option<String> = None;
    let mut recovery = WorkspaceRecordRecoveryStats::default();
    let mut removed_stale_count = 0i64;

    match fetch_root_folder_nodes(&db).await {
        Ok(root_nodes) => {
            recovery = ensure_project_records_from_nodes(&db, &root_nodes, &mut projects)
                .await
                .map_err(|err| format!("workspace index repair failed: {err}"))?;
            let root_node_by_id: HashMap<String, NodeRecord> = root_nodes
                .into_iter()
                .map(|node| (node.node_id.clone(), node))
                .collect();
            removed_stale_count =
                remove_stale_project_records(&db, &mut projects, &root_node_by_id).await;
        }
        Err(err) => {
            if is_surreal_revision_deserialization_error(&err) {
                warning = Some(format!(
                    "workspace root-scan skipped due legacy node value revision: {err}"
                ));
            } else {
                return Err(err);
            }
        }
    }

    let sync_warning = match sync_desktop_projection_from_db(&app, &db).await {
        Ok(_) => None,
        Err(err) => {
            let sync_warn = format!("workspace repair completed but mirror sync failed: {err}");
            eprintln!("{sync_warn}");
            Some(sync_warn)
        }
    };
    let final_warning = match (warning, sync_warning) {
        (Some(left), Some(right)) => Some(format!("{left} | {right}")),
        (Some(left), None) => Some(left),
        (None, Some(right)) => Some(right),
        (None, None) => None,
    };

    Ok(WorkspaceRepairSummary {
        recovered_count: recovery.created,
        updated_count: recovery.updated,
        removed_stale_count,
        total_workspaces: projects.len() as i64,
        warning: final_warning,
    })
}

#[tauri::command]
async fn create_project_from_path(
    app: tauri::AppHandle,
    path: String,
) -> Result<ProjectSummary, String> {
    let db = get_db(&app).await?;
    let normalized_path = normalize_project_root_path(&path)?;
    let normalized_display = normalized_path.to_string_lossy().to_string();
    let normalized_key = project_path_key(&normalized_display);

    let existing_projects = fetch_all_projects(&db).await?;
    if let Some(existing) = existing_projects
        .into_iter()
        .find(|project| project_path_key(&project.root_path) == normalized_key)
    {
        if fetch_node_record(&db, &existing.root_node_id)
            .await?
            .is_some()
        {
            return Ok(ProjectSummary::from(existing));
        }
    }

    let roots = fetch_nodes_by_parent(&db, ROOT_PARENT_ID).await?;
    let root_name_seed = normalized_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(normalize_external_mirror_entry_name)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Project".to_string());
    let taken_names: HashSet<String> = roots.iter().map(|node| node.name.to_lowercase()).collect();
    let project_root_name =
        find_unique_node_name(&sanitize_file_name_component(&root_name_seed), &taken_names);
    let root_order = roots.iter().map(|node| node.order).max().unwrap_or(0) + 1000;

    let now = now_ms();
    let mut root_props = serde_json::Map::new();
    root_props.insert(
        "projectPath".to_string(),
        Value::String(normalized_display.clone()),
    );
    root_props.insert(
        "projectPathKey".to_string(),
        Value::String(normalized_key.clone()),
    );
    root_props.insert("projectImportedAt".to_string(), Value::from(now));
    let root_record = NodeRecord {
        node_id: uuid::Uuid::new_v4().to_string(),
        parent_id: ROOT_PARENT_ID.to_string(),
        name: project_root_name.clone(),
        node_type: "folder".to_string(),
        properties: Value::Object(root_props),
        description: None,
        order: root_order,
        created_at: now,
        updated_at: now,
        content_type: None,
        ai_draft: None,
        content: None,
    };
    insert_node_record(&db, root_record.clone()).await?;
    let root_node_id = root_record.node_id.clone();

    let imported_count =
        match import_project_tree_nodes(&app, &db, &root_node_id, &normalized_path).await {
            Ok(count) => count,
            Err(err) => {
                if let Err(cleanup_err) =
                    rollback_created_subtree(&app, &root_node_id, "project tree import").await
                {
                    eprintln!("{cleanup_err}");
                }
                return Err(err);
            }
        };

    if let Err(err) = db
        .query("UPDATE node SET properties.projectImportedChildren = $count, updatedAt = $updated_at WHERE nodeId = $node_id;")
        .bind(("count", imported_count as i64))
        .bind(("updated_at", now_ms()))
        .bind(("node_id", root_node_id.clone()))
        .await
    {
        if let Err(cleanup_err) =
            rollback_created_subtree(&app, &root_node_id, "project root metadata update").await
        {
            eprintln!("{cleanup_err}");
        }
        return Err(db_err(err));
    }

    let project_record = ProjectRecord {
        project_id: uuid::Uuid::new_v4().to_string(),
        name: project_root_name,
        root_path: normalized_display,
        root_node_id: root_node_id.clone(),
        created_at: now,
        updated_at: now,
    };
    if let Err(err) = db
        .query("CREATE project CONTENT $record;")
        .bind(("record", project_record.clone()))
        .await
    {
        if let Err(cleanup_err) =
            rollback_created_subtree(&app, &root_node_id, "project record create").await
        {
            eprintln!("{cleanup_err}");
        }
        return Err(db_err(err));
    }

    if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
        eprintln!("desktop mirror sync failed after create_project_from_path: {err}");
    }

    Ok(ProjectSummary::from(project_record))
}

#[tauri::command]
async fn set_project_workspace_path(
    app: tauri::AppHandle,
    project_id: String,
    path: String,
) -> Result<ProjectSummary, String> {
    let db = get_db(&app).await?;
    let project = fetch_project_record(&db, &project_id)
        .await?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;

    let raw_path = {
        let candidate = path.trim();
        if candidate.len() >= 2 {
            let first = candidate.as_bytes()[0];
            let last = candidate.as_bytes()[candidate.len() - 1];
            if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
                candidate[1..candidate.len() - 1].trim().to_string()
            } else {
                candidate.to_string()
            }
        } else {
            candidate.to_string()
        }
    };
    if raw_path.is_empty() {
        return Err("project path is empty".to_string());
    }
    let candidate_path = PathBuf::from(&raw_path);
    if candidate_path.exists() {
        if !candidate_path.is_dir() {
            return Err(format!("project path is not a directory: {raw_path}"));
        }
    } else {
        fs::create_dir_all(&candidate_path)
            .map_err(|err| format!("failed to create project path {:?}: {err}", candidate_path))?;
    }

    let normalized_path = normalize_project_root_path(&raw_path)?;
    let normalized_display = normalized_path.to_string_lossy().to_string();
    let normalized_key = project_path_key(&normalized_display);

    let existing_projects = fetch_all_projects(&db).await?;
    if let Some(conflict) = existing_projects.into_iter().find(|candidate| {
        candidate.project_id != project.project_id
            && project_path_key(&candidate.root_path) == normalized_key
    }) {
        return Err(format!(
            "folder is already linked to workspace \"{}\"",
            conflict.name
        ));
    }

    let updated_at = now_ms();
    db.query(
        "UPDATE project SET rootPath = $root_path, root_path = $root_path, updatedAt = $updated_at, updated_at = $updated_at WHERE projectId = $project_id OR project_id = $project_id;",
    )
    .bind(("root_path", normalized_display.clone()))
    .bind(("updated_at", updated_at))
    .bind(("project_id", project.project_id.clone()))
    .await
    .map_err(db_err)?;

    let root_node = fetch_node_record(&db, &project.root_node_id)
        .await?
        .ok_or_else(|| format!("Project root node not found: {}", project.root_node_id))?;
    let mut root_properties = match root_node.properties {
        Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    root_properties.insert(
        "projectPath".to_string(),
        Value::String(normalized_display.clone()),
    );
    root_properties.insert(
        "projectPathKey".to_string(),
        Value::String(normalized_key.clone()),
    );
    root_properties.insert(
        "workspacePath".to_string(),
        Value::String(normalized_display.clone()),
    );
    root_properties.insert(
        "workspaceKind".to_string(),
        Value::String("linked".to_string()),
    );
    db.query("UPDATE node SET properties = $properties, updatedAt = $updated_at WHERE nodeId = $node_id;")
        .bind(("properties", Value::Object(root_properties)))
        .bind(("updated_at", updated_at))
        .bind(("node_id", project.root_node_id.clone()))
        .await
        .map_err(db_err)?;

    sync_desktop_projection_from_db(&app, &db).await?;
    let updated_project = fetch_project_record(&db, &project.project_id)
        .await?
        .ok_or_else(|| format!("Project not found after update: {}", project.project_id))?;
    Ok(ProjectSummary::from(updated_project))
}

#[tauri::command]
async fn create_workspace(app: tauri::AppHandle, name: String) -> Result<ProjectSummary, String> {
    let db = get_db(&app).await?;
    let workspace_name_seed = sanitize_file_name_component(name.trim());
    let roots = fetch_nodes_by_parent(&db, ROOT_PARENT_ID).await?;
    let taken_names: HashSet<String> = roots.iter().map(|node| node.name.to_lowercase()).collect();
    let workspace_name = find_unique_node_name(&workspace_name_seed, &taken_names);
    let root_order = roots.iter().map(|node| node.order).max().unwrap_or(0) + 1000;
    let now = now_ms();
    let root_node_id = uuid::Uuid::new_v4().to_string();
    let root_path = build_internal_workspace_root_path(&root_node_id);

    let mut root_props = serde_json::Map::new();
    root_props.insert(
        "workspaceKind".to_string(),
        Value::String("internal".to_string()),
    );
    root_props.insert(
        "workspacePath".to_string(),
        Value::String(root_path.clone()),
    );
    root_props.insert("workspaceCreatedAt".to_string(), Value::from(now));
    let root_record = NodeRecord {
        node_id: root_node_id.clone(),
        parent_id: ROOT_PARENT_ID.to_string(),
        name: workspace_name.clone(),
        node_type: "folder".to_string(),
        properties: Value::Object(root_props),
        description: None,
        order: root_order,
        created_at: now,
        updated_at: now,
        content_type: None,
        ai_draft: None,
        content: None,
    };
    insert_node_record(&db, root_record).await?;

    let project_record = ProjectRecord {
        project_id: uuid::Uuid::new_v4().to_string(),
        name: workspace_name,
        root_path,
        root_node_id,
        created_at: now,
        updated_at: now,
    };
    db.query("CREATE project CONTENT $record;")
        .bind(("record", project_record.clone()))
        .await
        .map_err(db_err)?;

    if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
        eprintln!("desktop mirror sync failed after create_workspace: {err}");
    }

    Ok(ProjectSummary::from(project_record))
}

#[tauri::command]
async fn delete_project_workspace(
    app: tauri::AppHandle,
    project_id: String,
    sync_projection: Option<bool>,
) -> Result<(), String> {
    let db = get_db(&app).await?;
    let project = fetch_project_record(&db, &project_id)
        .await?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;
    let should_sync_projection = sync_projection.unwrap_or(true);

    if fetch_node_record(&db, &project.root_node_id)
        .await?
        .is_some()
    {
        delete_node(app.clone(), project.root_node_id.clone(), Some(false)).await?;
    }

    db.query("DELETE project WHERE projectId = $project_id OR project_id = $project_id;")
        .bind(("project_id", project_id))
        .await
        .map_err(db_err)?;

    if should_sync_projection {
        if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
            eprintln!("desktop mirror sync failed after delete_project_workspace: {err}");
        }
    }

    Ok(())
}

#[tauri::command]
fn get_user_account_state(app: tauri::AppHandle) -> Result<UserAccountState, String> {
    let mut store = read_user_account_store(&app)?;
    prune_user_account_store(&mut store);
    write_user_account_store(&app, &store)?;
    Ok(build_user_account_state(&store))
}

#[tauri::command]
fn bootstrap_user_account(
    app: tauri::AppHandle,
    input: BootstrapUserAccountInput,
) -> Result<UserAccountAuthResult, String> {
    let mut store = read_user_account_store(&app)?;
    if !store.users.is_empty() {
        return Err("user accounts already exist".to_string());
    }

    let now = now_ms();
    let username = sanitize_username(&input.username)?;
    let display_name = sanitize_display_name(&input.display_name)?;
    let password_hash = hash_user_account_password(&input.password)?;
    let user_id = uuid::Uuid::new_v4().to_string();
    let user = UserAccountRecord {
        user_id: user_id.clone(),
        username,
        display_name,
        profile_photo_data_url: None,
        password_hash,
        role: "R6".to_string(),
        is_admin: true,
        disabled: false,
        license_plan: "unlimited".to_string(),
        license_started_at: None,
        created_at: now,
        updated_at: now,
        last_login_at: Some(now),
    };
    store.version = USER_ACCOUNT_STORE_VERSION;
    store.users.push(user);
    sort_user_accounts(&mut store.users);
    let remembered_session = match input.remember_session {
        Some(remember_session) => Some(create_user_account_remembered_session(
            &mut store,
            &user_id,
            remember_session.duration_ms,
        )?),
        None => None,
    };
    let created = store
        .users
        .iter()
        .find(|candidate| candidate.user_id == user_id)
        .ok_or_else(|| "failed to create bootstrap user".to_string())?;
    write_user_account_store(&app, &store)?;
    Ok(build_user_account_auth_result(created, remembered_session.as_ref()))
}

#[tauri::command]
fn sign_in_user_account(
    app: tauri::AppHandle,
    input: SignInUserAccountInput,
) -> Result<UserAccountAuthResult, String> {
    let mut store = read_user_account_store(&app)?;
    prune_user_account_store(&mut store);
    let username = sanitize_username(&input.username)?;
    let Some(user_index) = store
        .users
        .iter()
        .position(|entry| entry.username.eq_ignore_ascii_case(&username))
    else {
        return Err("invalid username or password".to_string());
    };
    let user_id = {
        let user = store
            .users
            .get_mut(user_index)
            .ok_or_else(|| "invalid username or password".to_string())?;

        if user.disabled {
            return Err("this account is disabled".to_string());
        }
        if !is_user_account_license_active(user) {
            return Err("this licence has expired".to_string());
        }

        if !verify_user_account_password(&user.password_hash, &input.password)? {
            return Err("invalid username or password".to_string());
        }

        let now = now_ms();
        user.last_login_at = Some(now);
        user.updated_at = now;
        user.user_id.clone()
    };
    let remembered_session = match input.remember_session {
        Some(remember_session) => Some(create_user_account_remembered_session(
            &mut store,
            &user_id,
            remember_session.duration_ms,
        )?),
        None => None,
    };
    let user = store
        .users
        .get(user_index)
        .ok_or_else(|| "invalid username or password".to_string())?;
    let summary = build_user_account_auth_result(user, remembered_session.as_ref());
    write_user_account_store(&app, &store)?;
    Ok(summary)
}

#[tauri::command]
fn resume_user_account_session(
    app: tauri::AppHandle,
    session_token: String,
) -> Result<UserAccountAuthResult, String> {
    let mut store = read_user_account_store(&app)?;
    prune_user_account_store(&mut store);
    let trimmed_token = session_token.trim();
    if trimmed_token.is_empty() {
        write_user_account_store(&app, &store)?;
        return Err("remembered sign-in is invalid".to_string());
    }

    let Some(session_index) = store
        .remembered_sessions
        .iter()
        .position(|session| session.token == trimmed_token)
    else {
        write_user_account_store(&app, &store)?;
        return Err("remembered sign-in expired".to_string());
    };

    let session = store
        .remembered_sessions
        .get(session_index)
        .cloned()
        .ok_or_else(|| "remembered sign-in expired".to_string())?;
    let Some(user_index) = store
        .users
        .iter()
        .position(|entry| entry.user_id == session.user_id)
    else {
        store.remembered_sessions.remove(session_index);
        write_user_account_store(&app, &store)?;
        return Err("remembered sign-in expired".to_string());
    };

    let user_id = store.users[user_index].user_id.clone();
    if store.users[user_index].disabled {
        clear_user_account_remembered_sessions_for_user(&mut store, &user_id);
        write_user_account_store(&app, &store)?;
        return Err("this account is disabled".to_string());
    }
    if !is_user_account_license_active(&store.users[user_index]) {
        clear_user_account_remembered_sessions_for_user(&mut store, &user_id);
        write_user_account_store(&app, &store)?;
        return Err("this licence has expired".to_string());
    }

    let now = now_ms();
    if let Some(user) = store.users.get_mut(user_index) {
        user.last_login_at = Some(now);
        user.updated_at = now;
    }
    let result = build_user_account_auth_result(&store.users[user_index], Some(&session));
    write_user_account_store(&app, &store)?;
    Ok(result)
}

#[tauri::command]
fn create_user_account(
    app: tauri::AppHandle,
    input: CreateUserAccountInput,
) -> Result<UserAccountSummary, String> {
    let mut store = read_user_account_store(&app)?;
    prune_user_account_store(&mut store);
    let username = sanitize_username(&input.username)?;
    ensure_username_available(&store.users, &username, None)?;
    let display_name = sanitize_display_name(&input.display_name)?;
    let role = sanitize_access_role(&input.role)?;
    let license_plan = sanitize_user_account_license_plan(&input.license_plan)?;
    let profile_photo_data_url = sanitize_profile_photo_data_url(input.profile_photo_data_url.as_deref())?;
    let password_hash = hash_user_account_password(&input.password)?;
    let now = now_ms();

    let user = UserAccountRecord {
        user_id: uuid::Uuid::new_v4().to_string(),
        username,
        display_name,
        profile_photo_data_url,
        password_hash,
        role,
        is_admin: input.is_admin,
        disabled: false,
        license_plan: license_plan.clone(),
        license_started_at: if license_plan == "unlimited" { None } else { Some(now) },
        created_at: now,
        updated_at: now,
        last_login_at: None,
    };
    let summary = UserAccountSummary::from(&user);
    store.version = USER_ACCOUNT_STORE_VERSION;
    store.users.push(user);
    sort_user_accounts(&mut store.users);
    write_user_account_store(&app, &store)?;
    Ok(summary)
}

#[tauri::command]
fn update_user_account(
    app: tauri::AppHandle,
    input: UpdateUserAccountInput,
) -> Result<UserAccountSummary, String> {
    let mut store = read_user_account_store(&app)?;
    prune_user_account_store(&mut store);
    let user_index = find_user_account_index_by_id(&store.users, &input.user_id)
        .ok_or_else(|| format!("user account not found: {}", input.user_id))?;

    let username = sanitize_username(&input.username)?;
    ensure_username_available(&store.users, &username, Some(&input.user_id))?;
    let display_name = sanitize_display_name(&input.display_name)?;
    let role = sanitize_access_role(&input.role)?;
    let license_plan = sanitize_user_account_license_plan(&input.license_plan)?;
    let profile_photo_data_url = sanitize_profile_photo_data_url(input.profile_photo_data_url.as_deref())?;
    let next_password = input
        .next_password
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    if (store.users[user_index].is_admin && (!input.is_admin || input.disabled))
        && count_enabled_admin_accounts(&store.users, Some(&input.user_id)) == 0
    {
        return Err("at least one enabled admin account is required".to_string());
    }

    let now = now_ms();
    let existing_license_plan = store.users[user_index].license_plan.clone();
    let should_restart_license =
        input.restart_license_from_now || existing_license_plan != license_plan;
    let clear_sessions =
        input.disabled || next_password.is_some() || should_restart_license || store.users[user_index].disabled != input.disabled;
    {
        let user = store
            .users
            .get_mut(user_index)
            .ok_or_else(|| format!("user account not found: {}", input.user_id))?;
        user.username = username;
        user.display_name = display_name;
        user.profile_photo_data_url = profile_photo_data_url;
        user.role = role;
        user.is_admin = input.is_admin;
        user.disabled = input.disabled;
        user.license_plan = license_plan.clone();
        if license_plan == "unlimited" {
            user.license_started_at = None;
        } else if should_restart_license || user.license_started_at.is_none() {
            user.license_started_at = Some(now);
        }
        user.updated_at = now;
        if let Some(password) = next_password.as_deref() {
            user.password_hash = hash_user_account_password(password)?;
        }
    }

    if clear_sessions {
        clear_user_account_remembered_sessions_for_user(&mut store, &input.user_id);
    }
    let summary = UserAccountSummary::from(
        store
            .users
            .get(user_index)
            .ok_or_else(|| format!("user account not found: {}", input.user_id))?,
    );
    sort_user_accounts(&mut store.users);
    write_user_account_store(&app, &store)?;
    Ok(summary)
}

#[tauri::command]
fn revoke_user_account_session(app: tauri::AppHandle, session_token: String) -> Result<(), String> {
    let mut store = read_user_account_store(&app)?;
    prune_user_account_store(&mut store);
    let trimmed_token = session_token.trim();
    if !trimmed_token.is_empty() {
        store
            .remembered_sessions
            .retain(|session| session.token != trimmed_token);
    }
    write_user_account_store(&app, &store)?;
    Ok(())
}

#[tauri::command]
fn delete_user_account(app: tauri::AppHandle, user_id: String) -> Result<(), String> {
    let mut store = read_user_account_store(&app)?;
    prune_user_account_store(&mut store);
    let user_index = find_user_account_index_by_id(&store.users, &user_id)
        .ok_or_else(|| format!("user account not found: {user_id}"))?;
    let user = store
        .users
        .get(user_index)
        .cloned()
        .ok_or_else(|| format!("user account not found: {user_id}"))?;
    if user.is_admin && !user.disabled && count_enabled_admin_accounts(&store.users, Some(&user_id)) == 0 {
        return Err("at least one enabled admin account is required".to_string());
    }

    store.users.remove(user_index);
    clear_user_account_remembered_sessions_for_user(&mut store, &user_id);
    write_user_account_store(&app, &store)?;
    Ok(())
}

#[tauri::command]
fn get_ai_rebuild_status() -> AiRebuildStatusPayload {
    AiRebuildStatusPayload {
        phase: "foundation".to_string(),
        legacy_surface_enabled: false,
        legacy_backend_enabled: true,
        available_workflows: vec![
            "approval_queue_preview".to_string(),
            "action_plan_preview".to_string(),
            "workspace_overview".to_string(),
            "knowledge_snapshot".to_string(),
            "document_ingestion_preview".to_string(),
            "document_record_store".to_string(),
            "execution_packet_preview".to_string(),
            "final_ai_solution".to_string(),
            "workspace_knowledge_summary".to_string(),
            "knowledge_retrieval_preview".to_string(),
        ],
        message:
            "Foundation ready. Prompt-based legacy AI is available for WBS and document planning while ticket-specific legacy flows remain disabled."
                .to_string(),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DetectedAiProviderSource {
    provider_id: String,
    display_name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CloudAiProvider {
    Anthropic,
    DeepSeek,
    Gemini,
    Groq,
    Mistral,
    OpenAi,
    XAi,
    ZAi,
}

const CLOUD_AI_PROVIDER_DETECTION_ORDER: [CloudAiProvider; 8] = [
    CloudAiProvider::Anthropic,
    CloudAiProvider::Gemini,
    CloudAiProvider::Groq,
    CloudAiProvider::XAi,
    CloudAiProvider::Mistral,
    CloudAiProvider::DeepSeek,
    CloudAiProvider::OpenAi,
    CloudAiProvider::ZAi,
];

impl CloudAiProvider {
    fn id(self) -> &'static str {
        match self {
            Self::Anthropic => "anthropic",
            Self::DeepSeek => "deepseek",
            Self::Gemini => "gemini",
            Self::Groq => "groq",
            Self::Mistral => "mistral",
            Self::OpenAi => "openai",
            Self::XAi => "xai",
            Self::ZAi => "zai",
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            Self::Anthropic => "Anthropic Claude",
            Self::DeepSeek => "DeepSeek",
            Self::Gemini => "Google Gemini",
            Self::Groq => "Groq",
            Self::Mistral => "Mistral",
            Self::OpenAi => "OpenAI",
            Self::XAi => "xAI Grok",
            Self::ZAi => "Z.AI",
        }
    }

    fn default_model(self) -> &'static str {
        match self {
            Self::Anthropic => "claude-sonnet-4-6",
            Self::DeepSeek => "deepseek-chat",
            Self::Gemini => "gemini-2.5-flash",
            Self::Groq => "llama-3.3-70b-versatile",
            Self::Mistral => "mistral-small-latest",
            Self::OpenAi => "gpt-4o-mini",
            Self::XAi => "grok-4.20",
            Self::ZAi => "glm-4.7-flash",
        }
    }
}

fn parse_cloud_ai_provider(value: &str) -> Option<CloudAiProvider> {
    match value.trim().to_lowercase().as_str() {
        "anthropic" | "claude" => Some(CloudAiProvider::Anthropic),
        "deepseek" => Some(CloudAiProvider::DeepSeek),
        "gemini" | "google" => Some(CloudAiProvider::Gemini),
        "groq" => Some(CloudAiProvider::Groq),
        "mistral" => Some(CloudAiProvider::Mistral),
        "openai" => Some(CloudAiProvider::OpenAi),
        "xai" | "grok" => Some(CloudAiProvider::XAi),
        "zai" | "z.ai" | "z-ai" | "zhipu" => Some(CloudAiProvider::ZAi),
        _ => None,
    }
}

fn detect_cloud_ai_provider_hint(api_key: &str) -> Option<CloudAiProvider> {
    let trimmed = api_key.trim();
    if trimmed.starts_with("AIza") {
        return Some(CloudAiProvider::Gemini);
    }
    if trimmed.starts_with("sk-ant-") {
        return Some(CloudAiProvider::Anthropic);
    }
    if trimmed.starts_with("gsk_") {
        return Some(CloudAiProvider::Groq);
    }
    if trimmed.starts_with("xai-") {
        return Some(CloudAiProvider::XAi);
    }
    None
}

fn has_nonempty_user_prompt_content(parts: &[AiPromptUserContentPart]) -> bool {
    parts.iter().any(|part| match part.part_type.as_str() {
        "text" => part
            .text
            .as_deref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
        "image_url" => part
            .image_url
            .as_deref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
        _ => false,
    })
}

fn decode_data_url_parts(value: &str) -> Option<(String, String)> {
    let trimmed = value.trim();
    if !trimmed.starts_with("data:") {
        return None;
    }
    let payload = &trimmed[5..];
    let (meta, data) = payload.split_once(',')?;
    let media_type = meta.strip_suffix(";base64")?.trim();
    if media_type.is_empty() || data.trim().is_empty() {
        return None;
    }
    Some((media_type.to_string(), data.trim().to_string()))
}

fn build_text_only_user_prompt(
    trimmed_user_prompt: &str,
    normalized_user_content: &[AiPromptUserContentPart],
) -> String {
    let mut lines = Vec::new();
    if !trimmed_user_prompt.is_empty() {
        lines.push(trimmed_user_prompt.to_string());
    }
    for part in normalized_user_content {
        match part.part_type.as_str() {
            "text" => {
                if let Some(text) = part.text.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
                    lines.push(text.to_string());
                }
            }
            "image_url" => {
                if let Some(image_url) = part
                    .image_url
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                {
                    lines.push(format!("Image attachment: {image_url}"));
                }
            }
            _ => {}
        }
    }
    lines.join("\n\n")
}

fn extract_error_message(raw_text: &str) -> String {
    serde_json::from_str::<Value>(raw_text)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| {
                    error
                        .get("message")
                        .and_then(|msg| msg.as_str())
                        .or_else(|| error.get("msg").and_then(|msg| msg.as_str()))
                        .or_else(|| error.as_str())
                })
                .map(|message| message.to_string())
                .or_else(|| value.get("message").and_then(|message| message.as_str()).map(str::to_string))
        })
        .unwrap_or_else(|| {
            let snippet: String = raw_text.chars().take(300).collect();
            if snippet.is_empty() {
                "unknown error".to_string()
            } else {
                snippet
            }
        })
}

fn extract_openai_compatible_message_text(parsed: &Value) -> Option<String> {
    let message_content = parsed
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"));

    if let Some(text) = message_content.and_then(|content| content.as_str()) {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    if let Some(items) = message_content.and_then(|content| content.as_array()) {
        let combined = items
            .iter()
            .filter_map(|item| item.get("text").and_then(|text| text.as_str()))
            .collect::<Vec<_>>()
            .join("");
        let trimmed = combined.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    None
}

fn extract_anthropic_message_text(parsed: &Value) -> Option<String> {
    let content = parsed.get("content")?.as_array()?;
    let combined = content
        .iter()
        .filter_map(|item| {
            if item.get("type").and_then(|value| value.as_str()) == Some("text") {
                item.get("text").and_then(|value| value.as_str())
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("");
    let trimmed = combined.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn extract_gemini_message_text(parsed: &Value) -> Option<String> {
    let parts = parsed
        .get("candidates")
        .and_then(|candidates| candidates.get(0))
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.as_array())?;
    let combined = parts
        .iter()
        .filter_map(|item| item.get("text").and_then(|text| text.as_str()))
        .collect::<Vec<_>>()
        .join("");
    let trimmed = combined.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn build_openai_compatible_messages(
    provider: CloudAiProvider,
    system_prompt: &str,
    trimmed_user_prompt: &str,
    normalized_user_content: &[AiPromptUserContentPart],
) -> Vec<Value> {
    let mut messages = Vec::new();
    if !system_prompt.trim().is_empty() {
        messages.push(serde_json::json!({
            "role": "system",
            "content": system_prompt.trim()
        }));
    }

    let supports_images = matches!(
        provider,
        CloudAiProvider::Mistral | CloudAiProvider::OpenAi | CloudAiProvider::XAi | CloudAiProvider::ZAi
    );

    let user_content = if supports_images {
        let mut content_items = Vec::new();
        if !trimmed_user_prompt.is_empty() {
            content_items.push(serde_json::json!({
                "type": "text",
                "text": trimmed_user_prompt
            }));
        }
        for part in normalized_user_content {
            match part.part_type.as_str() {
                "text" => {
                    if let Some(text) = part.text.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
                        content_items.push(serde_json::json!({
                            "type": "text",
                            "text": text
                        }));
                    }
                }
                "image_url" => {
                    if let Some(image_url) = part
                        .image_url
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                    {
                        content_items.push(serde_json::json!({
                            "type": "image_url",
                            "image_url": { "url": image_url }
                        }));
                    }
                }
                _ => {}
            }
        }
        if content_items.is_empty() {
            Value::String(trimmed_user_prompt.to_string())
        } else {
            Value::Array(content_items)
        }
    } else {
        Value::String(build_text_only_user_prompt(
            trimmed_user_prompt,
            normalized_user_content,
        ))
    };

    messages.push(serde_json::json!({
        "role": "user",
        "content": user_content
    }));

    messages
}

fn build_anthropic_messages(
    trimmed_user_prompt: &str,
    normalized_user_content: &[AiPromptUserContentPart],
) -> Vec<Value> {
    let mut content_items = Vec::new();
    if !trimmed_user_prompt.is_empty() {
        content_items.push(serde_json::json!({
            "type": "text",
            "text": trimmed_user_prompt
        }));
    }
    for part in normalized_user_content {
        match part.part_type.as_str() {
            "text" => {
                if let Some(text) = part.text.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
                    content_items.push(serde_json::json!({
                        "type": "text",
                        "text": text
                    }));
                }
            }
            "image_url" => {
                if let Some(image_url) = part
                    .image_url
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                {
                    if let Some((media_type, data)) = decode_data_url_parts(image_url) {
                        content_items.push(serde_json::json!({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": data
                            }
                        }));
                    } else {
                        content_items.push(serde_json::json!({
                            "type": "text",
                            "text": format!("Image attachment: {image_url}")
                        }));
                    }
                }
            }
            _ => {}
        }
    }
    if content_items.is_empty() {
        content_items.push(serde_json::json!({
            "type": "text",
            "text": trimmed_user_prompt
        }));
    }
    vec![serde_json::json!({
        "role": "user",
        "content": content_items
    })]
}

fn build_gemini_contents(
    trimmed_user_prompt: &str,
    normalized_user_content: &[AiPromptUserContentPart],
) -> Vec<Value> {
    let mut parts = Vec::new();
    if !trimmed_user_prompt.is_empty() {
        parts.push(serde_json::json!({
            "text": trimmed_user_prompt
        }));
    }
    for part in normalized_user_content {
        match part.part_type.as_str() {
            "text" => {
                if let Some(text) = part.text.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
                    parts.push(serde_json::json!({
                        "text": text
                    }));
                }
            }
            "image_url" => {
                if let Some(image_url) = part
                    .image_url
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                {
                    if let Some((mime_type, data)) = decode_data_url_parts(image_url) {
                        parts.push(serde_json::json!({
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": data
                            }
                        }));
                    } else {
                        parts.push(serde_json::json!({
                            "text": format!("Image attachment: {image_url}")
                        }));
                    }
                }
            }
            _ => {}
        }
    }
    if parts.is_empty() {
        parts.push(serde_json::json!({
            "text": trimmed_user_prompt
        }));
    }
    vec![serde_json::json!({
        "role": "user",
        "parts": parts
    })]
}

async fn probe_cloud_ai_provider(
    client: &reqwest::Client,
    provider: CloudAiProvider,
    api_key: &str,
) -> bool {
    let result = match provider {
        CloudAiProvider::Anthropic => client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&serde_json::json!({
                "model": provider.default_model(),
                "max_tokens": 1,
                "messages": [{ "role": "user", "content": "Ping" }]
            }))
            .send()
            .await,
        CloudAiProvider::Gemini => client
            .post(format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                provider.default_model()
            ))
            .header("x-goog-api-key", api_key)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "contents": [{
                    "parts": [{ "text": "Ping" }]
                }],
                "generationConfig": {
                    "maxOutputTokens": 1
                }
            }))
            .send()
            .await,
        CloudAiProvider::Groq => client
            .get("https://api.groq.com/openai/v1/models")
            .bearer_auth(api_key)
            .send()
            .await,
        CloudAiProvider::Mistral => client
            .get("https://api.mistral.ai/v1/models")
            .bearer_auth(api_key)
            .send()
            .await,
        CloudAiProvider::OpenAi => client
            .get("https://api.openai.com/v1/models")
            .bearer_auth(api_key)
            .send()
            .await,
        CloudAiProvider::XAi => client
            .get("https://api.x.ai/v1/models")
            .bearer_auth(api_key)
            .send()
            .await,
        CloudAiProvider::DeepSeek => client
            .post("https://api.deepseek.com/chat/completions")
            .bearer_auth(api_key)
            .json(&serde_json::json!({
                "model": provider.default_model(),
                "messages": [{ "role": "user", "content": "Ping" }],
                "max_tokens": 1,
                "stream": false
            }))
            .send()
            .await,
        CloudAiProvider::ZAi => client
            .post("https://api.z.ai/api/paas/v4/chat/completions")
            .bearer_auth(api_key)
            .header("Accept-Language", "en-US,en")
            .json(&serde_json::json!({
                "model": provider.default_model(),
                "messages": [{ "role": "user", "content": "Ping" }],
                "max_tokens": 1,
                "stream": false
            }))
            .send()
            .await,
    };

    match result {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

async fn detect_cloud_ai_provider(
    client: &reqwest::Client,
    api_key: &str,
) -> Result<CloudAiProvider, String> {
    if let Some(provider) = detect_cloud_ai_provider_hint(api_key) {
        return Ok(provider);
    }
    for provider in CLOUD_AI_PROVIDER_DETECTION_ORDER {
        if probe_cloud_ai_provider(client, provider, api_key).await {
            return Ok(provider);
        }
    }
    Err("Could not identify the API provider from this key.".to_string())
}

async fn send_cloud_ai_prompt(
    client: &reqwest::Client,
    provider: CloudAiProvider,
    api_key: &str,
    system_prompt: &str,
    trimmed_user_prompt: &str,
    normalized_user_content: &[AiPromptUserContentPart],
) -> Result<String, String> {
    let response = match provider {
        CloudAiProvider::Anthropic => {
            client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&serde_json::json!({
                    "model": provider.default_model(),
                    "max_tokens": 1400,
                    "temperature": 0.2,
                    "system": system_prompt.trim(),
                    "messages": build_anthropic_messages(trimmed_user_prompt, normalized_user_content)
                }))
                .send()
                .await
        }
        CloudAiProvider::Gemini => {
            let mut payload = serde_json::json!({
                "contents": build_gemini_contents(trimmed_user_prompt, normalized_user_content),
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 1400
                }
            });
            if !system_prompt.trim().is_empty() {
                payload["system_instruction"] = serde_json::json!({
                    "parts": [{ "text": system_prompt.trim() }]
                });
            }
            client
                .post(format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                    provider.default_model()
                ))
                .header("x-goog-api-key", api_key)
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
        }
        CloudAiProvider::Groq => {
            client
                .post("https://api.groq.com/openai/v1/chat/completions")
                .bearer_auth(api_key)
                .json(&serde_json::json!({
                    "model": provider.default_model(),
                    "temperature": 0.2,
                    "max_tokens": 1400,
                    "messages": build_openai_compatible_messages(
                        provider,
                        system_prompt,
                        trimmed_user_prompt,
                        normalized_user_content,
                    )
                }))
                .send()
                .await
        }
        CloudAiProvider::Mistral => {
            client
                .post("https://api.mistral.ai/v1/chat/completions")
                .bearer_auth(api_key)
                .json(&serde_json::json!({
                    "model": provider.default_model(),
                    "temperature": 0.2,
                    "max_tokens": 1400,
                    "messages": build_openai_compatible_messages(
                        provider,
                        system_prompt,
                        trimmed_user_prompt,
                        normalized_user_content,
                    )
                }))
                .send()
                .await
        }
        CloudAiProvider::OpenAi => {
            client
                .post("https://api.openai.com/v1/chat/completions")
                .bearer_auth(api_key)
                .json(&serde_json::json!({
                    "model": provider.default_model(),
                    "temperature": 0.2,
                    "max_tokens": 1400,
                    "messages": build_openai_compatible_messages(
                        provider,
                        system_prompt,
                        trimmed_user_prompt,
                        normalized_user_content,
                    )
                }))
                .send()
                .await
        }
        CloudAiProvider::XAi => {
            client
                .post("https://api.x.ai/v1/chat/completions")
                .bearer_auth(api_key)
                .json(&serde_json::json!({
                    "model": provider.default_model(),
                    "temperature": 0.2,
                    "max_tokens": 1400,
                    "messages": build_openai_compatible_messages(
                        provider,
                        system_prompt,
                        trimmed_user_prompt,
                        normalized_user_content,
                    )
                }))
                .send()
                .await
        }
        CloudAiProvider::DeepSeek => {
            client
                .post("https://api.deepseek.com/chat/completions")
                .bearer_auth(api_key)
                .json(&serde_json::json!({
                    "model": provider.default_model(),
                    "temperature": 0.2,
                    "max_tokens": 1400,
                    "messages": build_openai_compatible_messages(
                        provider,
                        system_prompt,
                        trimmed_user_prompt,
                        normalized_user_content,
                    )
                }))
                .send()
                .await
        }
        CloudAiProvider::ZAi => {
            client
                .post("https://api.z.ai/api/paas/v4/chat/completions")
                .bearer_auth(api_key)
                .header("Accept-Language", "en-US,en")
                .json(&serde_json::json!({
                    "model": provider.default_model(),
                    "temperature": 0.2,
                    "max_tokens": 1400,
                    "messages": build_openai_compatible_messages(
                        provider,
                        system_prompt,
                        trimmed_user_prompt,
                        normalized_user_content,
                    )
                }))
                .send()
                .await
        }
    }
    .map_err(|err| format!("request failed: {err}"))?;

    let status = response.status();
    let raw_text = response
        .text()
        .await
        .map_err(|err| format!("failed to read response body: {err}"))?;

    if !status.is_success() {
        return Err(format!(
            "{} API returned {}: {}",
            provider.display_name(),
            status.as_u16(),
            extract_error_message(&raw_text)
        ));
    }

    let parsed: Value = serde_json::from_str(&raw_text)
        .map_err(|err| format!("invalid JSON from {}: {err}", provider.display_name()))?;

    let extracted = match provider {
        CloudAiProvider::Anthropic => extract_anthropic_message_text(&parsed),
        CloudAiProvider::Gemini => extract_gemini_message_text(&parsed),
        CloudAiProvider::DeepSeek
        | CloudAiProvider::Groq
        | CloudAiProvider::Mistral
        | CloudAiProvider::OpenAi
        | CloudAiProvider::XAi
        | CloudAiProvider::ZAi => extract_openai_compatible_message_text(&parsed),
    };

    extracted.ok_or_else(|| {
        format!(
            "{} response did not include message content.",
            provider.display_name()
        )
    })
}

#[tauri::command]
async fn detect_ai_api_source(api_key: String) -> Result<DetectedAiProviderSource, String> {
    let trimmed_key = api_key.trim();
    if trimmed_key.is_empty() {
        return Err("API key is empty.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|err| format!("failed to create HTTP client: {err}"))?;

    let provider = detect_cloud_ai_provider(&client, trimmed_key).await?;
    Ok(DetectedAiProviderSource {
        provider_id: provider.id().to_string(),
        display_name: provider.display_name().to_string(),
    })
}

#[tauri::command]
async fn run_ai_tree_analysis(
    api_key: String,
    provider_id: Option<String>,
    system_prompt: String,
    user_prompt: String,
    user_content: Option<Vec<AiPromptUserContentPart>>,
    ai_engine: String,
) -> Result<String, String> {
    let trimmed_key = api_key.trim();
    if ai_engine == "cloud" && trimmed_key.is_empty() {
        return Err("AI API key is empty.".to_string());
    }
    let trimmed_user_prompt = user_prompt.trim();
    let normalized_user_content = user_content.unwrap_or_default();
    if trimmed_user_prompt.is_empty() && !has_nonempty_user_prompt_content(&normalized_user_content) {
        return Err("Prompt is empty.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|err| format!("failed to create HTTP client: {err}"))?;

    if ai_engine == "local" {
        let payload = serde_json::json!({
            "model": "mistral-7b-v0.3.Q4_K_M.gguf",
            "temperature": 0.2,
            "max_tokens": 1400,
            "messages": [{
                "role": "user",
                "content": build_text_only_user_prompt(trimmed_user_prompt, &normalized_user_content)
            }]
        });

        let response = client
            .post("http://127.0.0.1:11434/v1/chat/completions")
            .json(&payload)
            .send()
            .await
            .map_err(|err| format!("request failed: {err}"))?;
        let status = response.status();
        let raw_text = response
            .text()
            .await
            .map_err(|err| format!("failed to read response body: {err}"))?;
        if !status.is_success() {
            return Err(format!(
                "Local AI returned {}: {}",
                status.as_u16(),
                extract_error_message(&raw_text)
            ));
        }
        let parsed: Value = serde_json::from_str(&raw_text)
            .map_err(|err| format!("invalid JSON from local AI: {err}"))?;
        return extract_openai_compatible_message_text(&parsed)
            .ok_or_else(|| "Local AI response did not include message content.".to_string());
    }

    let provider = if let Some(provider_value) = provider_id.as_deref() {
        parse_cloud_ai_provider(provider_value).ok_or_else(|| format!("Unsupported AI provider: {provider_value}"))?
    } else {
        detect_cloud_ai_provider(&client, trimmed_key).await?
    };

    send_cloud_ai_prompt(
        &client,
        provider,
        trimmed_key,
        &system_prompt,
        trimmed_user_prompt,
        &normalized_user_content,
    )
    .await
}

#[tauri::command]
async fn analyze_ticket(
    app: tauri::AppHandle,
    api_key: String,
    ai_engine: String,
    node_id: String,
) -> Result<String, String> {
    let _ = (app, api_key, ai_engine, node_id);
    Err(AI_REBUILD_DISABLED_MESSAGE.to_string())
}

#[tauri::command]
async fn generate_ticket_reply(
    app: tauri::AppHandle,
    api_key: String,
    ai_engine: String,
    node_id: String,
    instructions: String,
) -> Result<String, String> {
    let _ = (app, api_key, ai_engine, node_id, instructions);
    Err(AI_REBUILD_DISABLED_MESSAGE.to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let target = url.trim();
    if target.is_empty() {
        return Err("empty url/path".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let lowered = target.to_ascii_lowercase();
        if lowered.starts_with("http://")
            || lowered.starts_with("https://")
            || lowered.starts_with("mailto:")
        {
            Command::new("rundll32.exe")
                .arg("url.dll,FileProtocolHandler")
                .arg(target)
                .spawn()
                .map_err(|err| format!("failed to open url: {err}"))?;
            return Ok(());
        }

        Command::new("explorer")
            .arg(target)
            .spawn()
            .map_err(|err| format!("failed to open folder/path: {err}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(target)
            .spawn()
            .map_err(|err| format!("failed to open url/path: {err}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|err| format!("failed to open url/path: {err}"))?;
        return Ok(());
    }

#[allow(unreachable_code)]
    Err("opening urls/paths is not supported on this platform".to_string())
}

#[cfg(target_os = "windows")]
fn decode_windows_utf16_string(buffer: &[u16]) -> Option<String> {
    let end = buffer.iter().position(|value| *value == 0).unwrap_or(buffer.len());
    if end == 0 {
        return None;
    }
    let value = String::from_utf16_lossy(&buffer[..end]).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[cfg(target_os = "windows")]
fn decode_windows_utf16_multi_string(buffer: &[u16]) -> Vec<String> {
    let mut values = Vec::new();
    let mut seen = HashSet::new();
    let mut start = 0usize;

    for (index, value) in buffer.iter().enumerate() {
        if *value != 0 {
            continue;
        }
        if index == start {
            break;
        }
        let entry = String::from_utf16_lossy(&buffer[start..index]).trim().to_string();
        if !entry.is_empty() {
            let key = entry.to_lowercase();
            if seen.insert(key) {
                values.push(entry);
            }
        }
        start = index + 1;
    }

    values
}

#[cfg(target_os = "windows")]
fn locale_name_from_windows_lcid(lcid: u32) -> Option<String> {
    if lcid == 0 {
        return None;
    }
    let mut buffer = [0u16; 85];
    let written = unsafe { LCIDToLocaleName(lcid, Some(&mut buffer), 0) };
    if written <= 0 {
        return None;
    }
    decode_windows_utf16_string(&buffer)
}

#[cfg(target_os = "windows")]
fn get_windows_user_locale_name() -> Option<String> {
    let mut buffer = [0u16; 85];
    let written = unsafe { GetUserDefaultLocaleName(&mut buffer) };
    if written <= 0 {
        return None;
    }
    decode_windows_utf16_string(&buffer)
}

#[cfg(target_os = "windows")]
fn get_windows_preferred_ui_languages() -> Vec<String> {
    let mut language_count = 0u32;
    let mut buffer_len = 0u32;
    if unsafe {
        GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &mut language_count, None, &mut buffer_len)
    }
    .is_err()
        || buffer_len == 0
    {
        return Vec::new();
    }

    let mut buffer = vec![0u16; buffer_len as usize];
    if unsafe {
        GetUserPreferredUILanguages(
            MUI_LANGUAGE_NAME,
            &mut language_count,
            Some(core::mem::transmute(buffer.as_mut_ptr())),
            &mut buffer_len,
        )
    }
    .is_err()
    {
        return Vec::new();
    }

    decode_windows_utf16_multi_string(&buffer)
}

#[cfg(target_os = "windows")]
fn get_windows_input_locale_for_thread(thread_id: u32) -> Option<String> {
    let keyboard_layout = unsafe { GetKeyboardLayout(thread_id) };
    let lang_id = (keyboard_layout.0 as usize & 0xffff) as u16;
    locale_name_from_windows_lcid(u32::from(lang_id))
}

#[cfg(target_os = "windows")]
fn get_windows_current_input_method_language_tag() -> Option<String> {
    Language::CurrentInputMethodLanguageTag().ok().and_then(|value| {
        let locale = value.to_string().trim().to_string();
        if locale.is_empty() {
            None
        } else {
            Some(locale)
        }
    })
}

#[tauri::command]
fn get_windows_language_snapshot(app: tauri::AppHandle) -> Result<WindowsLanguageSnapshot, String> {
    #[cfg(target_os = "windows")]
    {
        let input_locale = get_windows_current_input_method_language_tag()
            .or_else(|| {
                get_primary_webview_window(&app)
                    .ok()
                    .and_then(|window| window.hwnd().ok())
                    .and_then(|hwnd| {
                        let thread_id = unsafe { GetWindowThreadProcessId(hwnd, None) };
                        if thread_id == 0 {
                            get_windows_input_locale_for_thread(0)
                        } else {
                            get_windows_input_locale_for_thread(thread_id)
                        }
                    })
            })
            .or_else(|| get_windows_input_locale_for_thread(0));

        let ui_locale = locale_name_from_windows_lcid(u32::from(unsafe { GetUserDefaultUILanguage() }));
        let culture_locale = get_windows_user_locale_name();
        let preferred_locales = get_windows_preferred_ui_languages();

        return Ok(WindowsLanguageSnapshot {
            input_locale,
            ui_locale,
            culture_locale,
            preferred_locales,
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(WindowsLanguageSnapshot {
            input_locale: None,
            ui_locale: None,
            culture_locale: None,
            preferred_locales: Vec::new(),
        })
    }
}

#[tauri::command]
fn open_local_path(path: String) -> Result<(), String> {
    let trimmed = path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("empty path".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let lowered = trimmed.to_ascii_lowercase();
        if lowered.starts_with("shell:") {
            let mut command = Command::new("explorer");
            command.arg(trimmed);
            command
                .spawn()
                .map_err(|err| format!("failed to open shell path: {err}"))?;
            return Ok(());
        }
    }

    let target = PathBuf::from(trimmed);
    if !target.exists() {
        #[cfg(target_os = "windows")]
        {
            if let Some(app_id) = resolve_windows_start_menu_app_id(trimmed)? {
                let shell_target = format!("shell:AppsFolder\\{app_id}");
                let mut command = Command::new("explorer");
                command.arg(&shell_target);
                command
                    .spawn()
                    .map_err(|err| format!("failed to open start menu app {shell_target}: {err}"))?;
                return Ok(());
            }
        }
        return Err(format!("path does not exist: {:?}", target));
    }

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$target = [string]$env:ODE_OPEN_TARGET
if ($null -eq $target) { $target = '' }
$target = $target.Trim()
if (-not $target) {
  throw 'empty target'
}
Start-Process -FilePath $target | Out-Null
"#;

        let output = windows_powershell_command()
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg(script)
            .env("ODE_OPEN_TARGET", trimmed)
            .output();
        if let Ok(output) = output {
            if output.status.success() {
                return Ok(());
            }
        }

        let mut command = Command::new("cmd");
        command.arg("/C").arg("start").arg("").arg(trimmed);
        command.creation_flags(CREATE_NO_WINDOW);
        if let Ok(status) = command.status() {
            if status.success() {
                return Ok(());
            }
        }
    }

    open_path_with_system_default(&target)
}

fn escape_html_attribute(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn sanitize_quick_app_instance_file_name(file_name: &str, fallback_ext: &str) -> String {
    let raw = Path::new(file_name.trim())
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("quick-app");
    let sanitized: String = raw
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect();
    let trimmed = sanitized.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        return format!("quick-app.{fallback_ext}");
    }

    let parsed_path = Path::new(trimmed);
    let ext = parsed_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if ext == "html" || ext == "htm" {
        trimmed.to_string()
    } else {
        format!("{trimmed}.{fallback_ext}")
    }
}

fn sanitize_quick_app_instance_dir_name(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("quick-app");
    let sanitized: String = stem
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect();
    let collapsed = sanitized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "quick-app".to_string()
    } else {
        collapsed
    }
}

fn inject_quick_app_html_base_href(raw: &str, template_base_href: Option<&str>) -> String {
    let Some(base_href) = template_base_href.map(str::trim).filter(|value| !value.is_empty()) else {
        return raw.to_string();
    };

    let lowered = raw.to_ascii_lowercase();
    if lowered.contains("<base ") || lowered.contains("<base>") {
        return raw.to_string();
    }

    let injection = format!(r#"<base href="{}" />"#, escape_html_attribute(base_href));
    if let Some(index) = lowered.find("</head>") {
        let mut output = String::with_capacity(raw.len() + injection.len() + 1);
        output.push_str(&raw[..index]);
        output.push_str(&injection);
        output.push('\n');
        output.push_str(&raw[index..]);
        return output;
    }

    if let Some(index) = lowered.find("<body") {
        let mut output = String::with_capacity(raw.len() + injection.len() + 16);
        output.push_str(&raw[..index]);
        output.push_str("<head>\n");
        output.push_str(&injection);
        output.push_str("\n</head>\n");
        output.push_str(&raw[index..]);
        return output;
    }

    format!("<head>\n{injection}\n</head>\n{raw}")
}

fn inject_quick_app_html_scoped_storage(
    raw: &str,
    storage_namespace: Option<&str>,
    snapshot_seed: Option<&QuickAppHtmlSnapshotSeed>,
) -> String {
    let Some(namespace) = storage_namespace.map(str::trim).filter(|value| !value.is_empty()) else {
        return raw.to_string();
    };
    let Ok(namespace_json) = serde_json::to_string(namespace) else {
        return raw.to_string();
    };
    let seeded_scope = snapshot_seed
        .map(|seed| seed.scope.trim().to_string())
        .filter(|value| !value.is_empty());
    let seeded_owner_id = snapshot_seed.and_then(|seed| sanitize_quick_app_snapshot_optional_text(seed.owner_id.clone()));
    let seeded_owner_label =
        snapshot_seed.and_then(|seed| sanitize_quick_app_snapshot_optional_text(seed.owner_label.clone()));
    let seeded_quick_app_id = snapshot_seed
        .map(|seed| seed.quick_app_id.trim().to_string())
        .filter(|value| !value.is_empty());
    let Ok(seeded_scope_json) = serde_json::to_string(&seeded_scope) else {
        return raw.to_string();
    };
    let Ok(seeded_owner_id_json) = serde_json::to_string(&seeded_owner_id) else {
        return raw.to_string();
    };
    let Ok(seeded_owner_label_json) = serde_json::to_string(&seeded_owner_label) else {
        return raw.to_string();
    };
    let Ok(seeded_quick_app_id_json) = serde_json::to_string(&seeded_quick_app_id) else {
        return raw.to_string();
    };
    let Ok(bundled_js_pdf_source_json) =
        serde_json::to_string(include_str!("../../node_modules/jspdf/dist/jspdf.umd.min.js"))
    else {
        return raw.to_string();
    };
    let Ok(bundled_html2canvas_source_json) =
        serde_json::to_string(include_str!("../../node_modules/html2canvas/dist/html2canvas.min.js"))
    else {
        return raw.to_string();
    };

    let injection = format!(
        r#"<script>
(function() {{
  const namespace = {namespace_json};
  if (!namespace) return;
  const prefix = namespace + "::";
  const seededScope = {seeded_scope_json};
  const seededOwnerId = {seeded_owner_id_json};
  const seededOwnerLabel = {seeded_owner_label_json};
  const seededQuickAppId = {seeded_quick_app_id_json};
  const bundledJsPdfSource = {bundled_js_pdf_source_json};
  const bundledHtml2CanvasSource = {bundled_html2canvas_source_json};
  let storageRef = null;
  try {{
    storageRef = window.localStorage;
  }} catch (_error) {{
    storageRef = null;
  }}
  const storageProto = storageRef ? Object.getPrototypeOf(storageRef) : null;
  if (window.__ODE_QUICK_APP_SCOPED_STORAGE__ === namespace) return;
  window.__ODE_QUICK_APP_SCOPED_STORAGE__ = namespace;
  const params = new URLSearchParams(window.location.search || "");
  const scope = String(seededScope || params.get("ode_scope") || "").trim();
  const ownerId = String(seededOwnerId || params.get("ode_owner_id") || "").trim();
  const ownerLabel = String(
    seededOwnerLabel ||
      params.get("ode_owner_label") ||
      params.get("ode_scope_label") ||
      params.get("chantier") ||
      ""
  ).trim();
  const quickAppId = String(seededQuickAppId || params.get("ode_quick_app_id") || "").trim();
  const normalizeSnapshotText = (value) => {{
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }};
  const truncateSnapshotText = (value, limit = 16000) => {{
    const normalized = normalizeSnapshotText(value);
    return normalized.length > limit ? normalized.slice(0, limit).trim() : normalized;
  }};

  const invokeTauri = (command, args) => {{
    try {{
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === "function") {{
        return window.__TAURI__.core.invoke(command, args);
      }}
    }} catch (_error) {{
      // Fall through to raw internals.
    }}
    try {{
      if (window.__TAURI__ && typeof window.__TAURI__.invoke === "function") {{
        return window.__TAURI__.invoke(command, args);
      }}
    }} catch (_error) {{
      // Fall through to raw internals.
    }}
    try {{
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === "function") {{
        return window.__TAURI_INTERNALS__.invoke(command, args);
      }}
    }} catch (_error) {{
      // Fall through to rejected promise below.
    }}
    return Promise.reject(new Error("Tauri invoke unavailable."));
  }};
  const MIME_EXTENSION_MAP = {{
    "application/json": "json",
    "application/msword": "doc",
    "application/pdf": "pdf",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "text/csv": "csv",
    "text/html": "html",
    "text/markdown": "md",
    "text/plain": "txt"
  }};
  const normalizeDownloadName = (value) => {{
    return String(value || "")
      .trim()
      .replace(/[\\\\/:*?"<>|]+/g, "_");
  }};
  const inferExtensionFromName = (fileName) => {{
    const normalized = normalizeDownloadName(fileName);
    const lastDot = normalized.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === normalized.length - 1) return "";
    return normalized.slice(lastDot + 1).toLowerCase();
  }};
  const inferExtensionFromMimeType = (mimeType) => {{
    const normalizedMime = typeof mimeType === "string" ? mimeType.split(";")[0].trim().toLowerCase() : "";
    return MIME_EXTENSION_MAP[normalizedMime] || "";
  }};
  const inferFilterLabel = (extension, mimeType) => {{
    const normalizedExtension = String(extension || "").trim().toLowerCase();
    if (normalizedExtension === "csv") return "CSV";
    if (normalizedExtension === "doc" || normalizedExtension === "docx") return "Word";
    if (normalizedExtension === "htm" || normalizedExtension === "html") return "HTML";
    if (normalizedExtension === "jpg" || normalizedExtension === "jpeg") return "JPEG";
    if (normalizedExtension === "json") return "JSON";
    if (normalizedExtension === "md") return "Markdown";
    if (normalizedExtension === "pdf") return "PDF";
    if (normalizedExtension === "png") return "PNG";
    if (normalizedExtension === "svg") return "SVG";
    if (normalizedExtension === "txt") return "Text";
    if (normalizedExtension === "xls" || normalizedExtension === "xlsx") return "Excel";
    const normalizedMime = typeof mimeType === "string" ? mimeType.split(";")[0].trim().toLowerCase() : "";
    return MIME_EXTENSION_MAP[normalizedMime]
      ? MIME_EXTENSION_MAP[normalizedMime].toUpperCase()
      : (normalizedExtension || "FILE").toUpperCase();
  }};
  const toByteArray = (bufferLike) => {{
    return Array.from(new Uint8Array(bufferLike));
  }};
  const readBlobAsArrayBuffer = (blob) => {{
    if (blob && typeof blob.arrayBuffer === "function") {{
      return blob.arrayBuffer();
    }}
    return new Promise((resolve, reject) => {{
      try {{
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("Failed to read blob."));
        reader.readAsArrayBuffer(blob);
      }} catch (error) {{
        reject(error);
      }}
    }});
  }};
  const decodeDataUrl = (href) => {{
    const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(String(href || ""));
    if (!match) return null;
    const mimeType = String(match[1] || "").trim().toLowerCase() || "application/octet-stream";
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || "";
    try {{
      if (isBase64) {{
        const binary = window.atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {{
          bytes[index] = binary.charCodeAt(index);
        }}
        return {{
          mimeType,
          bytes: Array.from(bytes)
        }};
      }}
      const decoded = decodeURIComponent(payload);
      const bytes = new TextEncoder().encode(decoded);
      return {{
        mimeType,
        bytes: Array.from(bytes)
      }};
    }} catch (_error) {{
      return null;
    }}
  }};
  const inferFileNameFromUrl = (href) => {{
    try {{
      const parsed = new URL(String(href || ""), window.location.href);
      const lastSegment = parsed.pathname.split("/").pop() || "";
      return normalizeDownloadName(lastSegment);
    }} catch (_error) {{
      return "";
    }}
  }};
  const showExportStatus = (message, tone = "success") => {{
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage || !document.body) return;
    try {{
      const toast = document.createElement("div");
      toast.textContent = normalizedMessage;
      toast.style.position = "fixed";
      toast.style.right = "18px";
      toast.style.bottom = "18px";
      toast.style.zIndex = "2147483647";
      toast.style.maxWidth = "min(560px, calc(100vw - 36px))";
      toast.style.padding = "12px 14px";
      toast.style.borderRadius = "14px";
      toast.style.background = tone === "error" ? "rgba(82, 20, 28, 0.94)" : "rgba(3, 30, 48, 0.94)";
      toast.style.color = "rgb(220, 238, 255)";
      toast.style.boxShadow = "0 18px 42px rgba(0, 0, 0, 0.28)";
      toast.style.font = "600 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      toast.style.whiteSpace = "pre-wrap";
      document.body.appendChild(toast);
      window.setTimeout(() => toast.remove(), 5200);
    }} catch (_error) {{
      // The export has already completed; the toast is only a user-facing confirmation.
    }}
  }};
  const saveBytesToNativeFile = async (bytes, fileName, mimeType) => {{
    const normalizedMime = typeof mimeType === "string" ? mimeType.split(";")[0].trim().toLowerCase() : "";
    let normalizedName = normalizeDownloadName(fileName);
    let extension = inferExtensionFromName(normalizedName);
    if (!extension) {{
      extension = inferExtensionFromMimeType(normalizedMime) || "bin";
      normalizedName = normalizedName ? `${{normalizedName}}.${{extension}}` : `export.${{extension}}`;
    }}
    const savedPath = await invokeTauri("save_export_file", {{
      dialogTitle: `Save ${{extension.toUpperCase()}} export`,
      defaultFileName: normalizedName || `export.${{extension}}`,
      filterLabel: inferFilterLabel(extension, normalizedMime),
      extension,
      bytes
    }});
    if (savedPath) {{
      showExportStatus(`Saved to ${{savedPath}}`);
    }}
    return savedPath;
  }};
  const saveBlobToNativeFile = async (blob, fileName) => {{
    const arrayBuffer = await readBlobAsArrayBuffer(blob);
    return saveBytesToNativeFile(toByteArray(arrayBuffer), fileName, blob?.type || "");
  }};
  const saveUrlToNativeFile = async (href, fileName) => {{
    const normalizedHref = String(href || "").trim();
    if (!normalizedHref) {{
      throw new Error("Missing export URL.");
    }}
    if (/^data:/i.test(normalizedHref)) {{
      const decoded = decodeDataUrl(normalizedHref);
      if (!decoded) {{
        throw new Error("Unsupported data export URL.");
      }}
      return saveBytesToNativeFile(decoded.bytes, fileName, decoded.mimeType);
    }}
    const response = await fetch(normalizedHref);
    if (!response.ok) {{
      throw new Error(`Export download failed with status ${{response.status}}.`);
    }}
    const arrayBuffer = await response.arrayBuffer();
    const responseMime = response.headers.get("content-type") || "";
    const fallbackName = normalizeDownloadName(fileName) || inferFileNameFromUrl(normalizedHref);
    return saveBytesToNativeFile(toByteArray(arrayBuffer), fallbackName, responseMime);
  }};
  const savePayloadToNativeFile = async (payload, fileName) => {{
    if (!payload) {{
      throw new Error("Missing export payload.");
    }}
    if (typeof payload === "string") {{
      return saveUrlToNativeFile(payload, fileName);
    }}
    if (typeof Blob !== "undefined" && payload instanceof Blob) {{
      return saveBlobToNativeFile(payload, fileName);
    }}
    if (payload && typeof payload === "object" && typeof payload.href === "string") {{
      return saveUrlToNativeFile(payload.href, fileName);
    }}
    throw new Error("Unsupported export payload.");
  }};
  const extractDownloadFileName = (anchor) => {{
    if (!anchor || typeof anchor !== "object") return "export";
    const preferred = normalizeDownloadName(anchor.getAttribute("download") || anchor.download || "");
    if (preferred) return preferred;
    const inferred = inferFileNameFromUrl(anchor.href || "");
    return inferred || "export";
  }};
  const interceptDownloadAnchor = (anchor) => {{
    if (!anchor || !anchor.href || !anchor.hasAttribute("download")) return false;
    void savePayloadToNativeFile(anchor.href, extractDownloadFileName(anchor)).catch(() => {{
      // Let page code continue to manage errors when native save fails.
    }});
    return true;
  }};
  const anchorProto =
    typeof window.HTMLAnchorElement !== "undefined" ? window.HTMLAnchorElement.prototype : null;
  if (anchorProto && typeof anchorProto.click === "function" && !anchorProto.__ODEQuickAppDownloadPatched) {{
    const originalAnchorClick = anchorProto.click;
    anchorProto.click = function() {{
      if (interceptDownloadAnchor(this)) return;
      return originalAnchorClick.call(this);
    }};
    Object.defineProperty(anchorProto, "__ODEQuickAppDownloadPatched", {{
      configurable: true,
      enumerable: false,
      value: true
    }});
  }}
  document.addEventListener(
    "click",
    (event) => {{
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[download]");
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
      if (!interceptDownloadAnchor(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
    }},
    true
  );
  if (typeof window.saveAs === "function" && !window.__ODEQuickAppSaveAsPatched) {{
    const originalSaveAs = window.saveAs.bind(window);
    window.saveAs = function(payload, name, options) {{
      return savePayloadToNativeFile(payload, name).catch(() => originalSaveAs(payload, name, options));
    }};
    Object.defineProperty(window, "__ODEQuickAppSaveAsPatched", {{
      configurable: true,
      enumerable: false,
      value: true
    }});
  }}
  const injectBundledLibrary = (source, readyCheck) => {{
    if (typeof readyCheck === "function" && readyCheck()) return true;
    if (typeof source !== "string" || !source.trim()) return false;
    try {{
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.text = source;
      (document.head || document.documentElement || document.body).appendChild(script);
      script.remove();
    }} catch (_error) {{
      try {{
        window.eval(source);
      }} catch (_evalError) {{
        return false;
      }}
    }}
    return typeof readyCheck === "function" ? readyCheck() : true;
  }};
  const ensurePdfDependencies = () => {{
    const html2CanvasReady =
      typeof window.html2canvas === "function" ||
      injectBundledLibrary(bundledHtml2CanvasSource, () => typeof window.html2canvas === "function");
    const jsPdfReady =
      Boolean(window.jspdf && window.jspdf.jsPDF) ||
      injectBundledLibrary(bundledJsPdfSource, () => Boolean(window.jspdf && window.jspdf.jsPDF));
    return html2CanvasReady && jsPdfReady;
  }};
  ensurePdfDependencies();
  const patchJsPdfInstance = (instance) => {{
    if (!instance || typeof instance.save !== "function" || instance.__ODEQuickAppPdfSavePatched) return instance;
    const originalJsPdfSave = instance.save;
    Object.defineProperty(instance, "save", {{
      configurable: true,
      enumerable: false,
      value: function(fileName, options) {{
        try {{
          const buffer = this.output("arraybuffer");
          return saveBytesToNativeFile(
            toByteArray(buffer),
            normalizeDownloadName(fileName) || `${{normalizeDownloadName(document.title) || "export"}}.pdf`,
            "application/pdf"
          ).catch((error) => {{
            showExportStatus(error && error.message ? `PDF export failed: ${{error.message}}` : "PDF export failed.", "error");
            return null;
          }});
        }} catch (error) {{
          showExportStatus(error && error.message ? `PDF export failed: ${{error.message}}` : "PDF export failed.", "error");
          return originalJsPdfSave.call(this, fileName, options);
        }}
      }}
    }});
    Object.defineProperty(instance, "__ODEQuickAppPdfSavePatched", {{
      configurable: true,
      enumerable: false,
      value: true
    }});
    return instance;
  }};
  const patchJsPdfSave = () => {{
    if (!window.jspdf || !window.jspdf.jsPDF) return false;
    const jsPdfCtor = window.jspdf.jsPDF;
    if (jsPdfCtor.__ODEQuickAppCtorPatched) {{
      return true;
    }}
    const apiSaveTarget =
      jsPdfCtor.API && typeof jsPdfCtor.API.save === "function"
        ? jsPdfCtor.API
        : jsPdfCtor.prototype && typeof jsPdfCtor.prototype.save === "function"
          ? jsPdfCtor.prototype
          : null;
    if (apiSaveTarget && !apiSaveTarget.__ODEQuickAppPdfSavePatched) {{
      const originalApiSave = apiSaveTarget.save;
      apiSaveTarget.save = function(fileName, options) {{
        return patchJsPdfInstance(this).save(fileName, options);
      }};
      Object.defineProperty(apiSaveTarget, "__ODEQuickAppPdfSavePatched", {{
        configurable: true,
        enumerable: false,
        value: true
      }});
    }}
    const OdeQuickAppJsPdf = function(...args) {{
      const instance = new jsPdfCtor(...args);
      return patchJsPdfInstance(instance);
    }};
    try {{
      Reflect.ownKeys(jsPdfCtor).forEach((key) => {{
        if (key === "length" || key === "name" || key === "prototype") return;
        const descriptor = Object.getOwnPropertyDescriptor(jsPdfCtor, key);
        if (descriptor) {{
          Object.defineProperty(OdeQuickAppJsPdf, key, descriptor);
        }}
      }});
      Object.setPrototypeOf(OdeQuickAppJsPdf, jsPdfCtor);
    }} catch (_error) {{
      OdeQuickAppJsPdf.API = jsPdfCtor.API;
    }}
    OdeQuickAppJsPdf.prototype = jsPdfCtor.prototype;
    Object.defineProperty(OdeQuickAppJsPdf, "__ODEQuickAppCtorPatched", {{
      configurable: true,
      enumerable: false,
      value: true
    }});
    Object.defineProperty(OdeQuickAppJsPdf, "__ODEQuickAppOriginalCtor", {{
      configurable: true,
      enumerable: false,
      value: jsPdfCtor
    }});
    window.jspdf.jsPDF = OdeQuickAppJsPdf;
    return true;
  }};
  patchJsPdfSave();
  if (!window.__ODEQuickAppPdfPatchWatcher) {{
    const watchForJsPdf = () => {{
      ensurePdfDependencies();
      patchJsPdfSave();
    }};
    window.__ODEQuickAppPdfPatchWatcher = window.setInterval(watchForJsPdf, 250);
    window.setTimeout(() => {{
      if (window.__ODEQuickAppPdfPatchWatcher) {{
        window.clearInterval(window.__ODEQuickAppPdfPatchWatcher);
        window.__ODEQuickAppPdfPatchWatcher = null;
      }}
    }}, 30000);
    window.addEventListener("load", watchForJsPdf, {{ once: true }});
  }}
  window.__ODE_QUICK_APP_EXPORT__ = {{
    saveBytes(bytes, fileName, mimeType) {{
      return saveBytesToNativeFile(Array.isArray(bytes) ? bytes : [], fileName, mimeType);
    }},
    savePayload(payload, fileName) {{
      return savePayloadToNativeFile(payload, fileName);
    }}
  }};

  const originalGetItem = storageProto && typeof storageProto.getItem === "function" ? storageProto.getItem : null;
  const originalSetItem = storageProto && typeof storageProto.setItem === "function" ? storageProto.setItem : null;
  const originalRemoveItem = storageProto && typeof storageProto.removeItem === "function" ? storageProto.removeItem : null;
  const originalClear = storageProto && typeof storageProto.clear === "function" ? storageProto.clear : null;
  const originalKey = storageProto && typeof storageProto.key === "function" ? storageProto.key : null;
  const originalLengthDescriptor = storageProto ? Object.getOwnPropertyDescriptor(storageProto, "length") : null;
  const mapKey = (key) => prefix + String(key ?? "");
  const isLocalStorage = (target) => Boolean(storageRef) && target === storageRef;
  const readRawStorageValue = (rawKey) => {{
    if (!storageRef) return null;
    try {{
      if (typeof originalGetItem === "function") {{
        return originalGetItem.call(storageRef, rawKey);
      }}
      const directValue = storageRef[rawKey];
      return typeof directValue === "string" ? directValue : null;
    }} catch (_error) {{
      return null;
    }}
  }};
  const collectScopedKeys = () => {{
    if (!storageRef) return [];
    if (originalLengthDescriptor && typeof originalLengthDescriptor.get === "function" && typeof originalKey === "function") {{
      const totalLength = Number(originalLengthDescriptor.get.call(storageRef)) || 0;
      const keys = [];
      for (let index = 0; index < totalLength; index += 1) {{
        const rawKey = originalKey.call(storageRef, index);
        if (typeof rawKey === "string" && rawKey.startsWith(prefix)) {{
          keys.push(rawKey);
        }}
      }}
      return keys;
    }}
    const keys = [];
    Object.keys(storageRef).forEach((rawKey) => {{
      if (typeof rawKey === "string" && rawKey.startsWith(prefix)) {{
        keys.push(rawKey);
      }}
    }});
    return keys;
  }};
  const collectScopedEntries = () => {{
    const entries = {{}};
    collectScopedKeys().forEach((rawKey) => {{
      const scopedKey = rawKey.slice(prefix.length);
      const value = readRawStorageValue(rawKey);
      if (typeof scopedKey === "string" && scopedKey && typeof value === "string") {{
        entries[scopedKey] = value;
      }}
    }});
    return entries;
  }};
  const resolveFieldLabel = (element) => {{
    if (!element || typeof element !== "object") return "";
    const directLabel = typeof element.getAttribute === "function"
      ? normalizeSnapshotText(
          element.getAttribute("aria-label") ||
          element.getAttribute("data-label") ||
          element.getAttribute("placeholder")
        )
      : "";
    if (directLabel) return directLabel;
    const labels = Array.from(element.labels || [])
      .map((label) => normalizeSnapshotText(label.textContent || ""))
      .filter(Boolean);
    if (labels.length > 0) return labels.join(" / ");
    const identifier = normalizeSnapshotText(element.name || element.id || "");
    if (identifier) return identifier;
    const wrappedLabel = normalizeSnapshotText(element.closest && element.closest("label") ? element.closest("label").textContent || "" : "");
    if (wrappedLabel) return wrappedLabel;
    return normalizeSnapshotText(element.tagName || "field");
  }};
  const readFieldValue = (element) => {{
    if (!element || typeof element !== "object") return "";
    const tagName = String(element.tagName || "").toLowerCase();
    const type = String(element.type || "").toLowerCase();
    if (type === "password" || type === "hidden") return "";
    if (type === "checkbox") {{
      return element.checked ? normalizeSnapshotText(element.value || "checked") : "";
    }}
    if (type === "radio") {{
      return element.checked ? normalizeSnapshotText(element.value || "selected") : "";
    }}
    if (tagName === "select" && element.multiple) {{
      return Array.from(element.selectedOptions || [])
        .map((option) => normalizeSnapshotText(option.textContent || option.value || ""))
        .filter(Boolean)
        .join(", ");
    }}
    if (typeof element.value === "string") {{
      return normalizeSnapshotText(element.value);
    }}
    if (element.isContentEditable) {{
      return normalizeSnapshotText(element.innerText || element.textContent || "");
    }}
    return "";
  }};
  const collectFieldEntries = () => {{
    const fields = {{}};
    const elements = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));
    elements.forEach((element, index) => {{
      const label = resolveFieldLabel(element);
      const value = readFieldValue(element);
      if (!label || !value) return;
      const baseKey = label;
      let key = baseKey;
      let suffix = 2;
      while (Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== value) {{
        key = `${{baseKey}} (${{suffix}})`;
        suffix += 1;
      }}
      fields[key] = value;
    }});
    return fields;
  }};
  const collectDocumentText = () => {{
    return truncateSnapshotText(
      (document.body && (document.body.innerText || document.body.textContent)) || document.documentElement?.innerText || ""
    );
  }};
  let syncTimer = null;
  let retryTimer = null;
  let lastSuccessfulSyncSignature = "";
  let syncInFlight = null;
  const scheduleRetry = (delayMs = 650) => {{
    if (retryTimer !== null) {{
      window.clearTimeout(retryTimer);
    }}
    retryTimer = window.setTimeout(() => {{
      retryTimer = null;
      scheduleSync();
    }}, delayMs);
  }};
  const syncSnapshot = () => {{
    if (!namespace || !scope || !quickAppId) return Promise.resolve();
    const payload = {{
      namespace,
      scope,
      ownerId: ownerId || null,
      ownerLabel: ownerLabel || null,
      quickAppId,
      title: document.title || null,
      currentUrl: window.location.href || null,
      entries: collectScopedEntries(),
      fieldEntries: collectFieldEntries(),
      documentText: collectDocumentText() || null
    }};
    const signature = JSON.stringify(payload);
    if (signature === lastSuccessfulSyncSignature) return Promise.resolve();
    if (syncInFlight) return syncInFlight;
    const attempt = invokeTauri("sync_quick_app_html_storage_snapshot", {{
      payload
    }})
      .then(() => {{
        lastSuccessfulSyncSignature = signature;
        return null;
      }})
      .catch(() => {{
        scheduleRetry();
        return null;
      }})
      .finally(() => {{
        if (syncInFlight === attempt) {{
          syncInFlight = null;
        }}
      }});
    syncInFlight = attempt;
    return attempt;
  }};
  const scheduleSync = () => {{
    if (syncTimer !== null) {{
      window.clearTimeout(syncTimer);
    }}
    syncTimer = window.setTimeout(() => {{
      syncTimer = null;
      void syncSnapshot();
    }}, 180);
  }};

  if (storageProto && storageRef && typeof originalGetItem === "function") {{
    storageProto.getItem = function(key) {{
      if (!isLocalStorage(this)) return originalGetItem.call(this, key);
      return originalGetItem.call(this, mapKey(key));
    }};
  }}
  if (storageProto && storageRef && typeof originalSetItem === "function") {{
    storageProto.setItem = function(key, value) {{
      if (!isLocalStorage(this)) return originalSetItem.call(this, key, value);
      const result = originalSetItem.call(this, mapKey(key), value);
      scheduleSync();
      return result;
    }};
  }}
  if (storageProto && storageRef && typeof originalRemoveItem === "function") {{
    storageProto.removeItem = function(key) {{
      if (!isLocalStorage(this)) return originalRemoveItem.call(this, key);
      const result = originalRemoveItem.call(this, mapKey(key));
      scheduleSync();
      return result;
    }};
  }}
  if (storageProto && storageRef && typeof originalClear === "function" && typeof originalRemoveItem === "function") {{
    storageProto.clear = function() {{
      if (!isLocalStorage(this)) return originalClear.call(this);
      collectScopedKeys().forEach((key) => originalRemoveItem.call(storageRef, key));
      scheduleSync();
    }};
  }}
  if (storageProto && storageRef && typeof originalKey === "function") {{
    storageProto.key = function(index) {{
      if (!isLocalStorage(this)) return originalKey.call(this, index);
      const scopedKeys = collectScopedKeys();
      const scopedKey = scopedKeys[index];
      return typeof scopedKey === "string" ? scopedKey.slice(prefix.length) : null;
    }};
  }}
  if (storageProto && storageRef && originalLengthDescriptor && typeof originalLengthDescriptor.get === "function") {{
    try {{
      Object.defineProperty(storageProto, "length", {{
        configurable: true,
        enumerable: true,
        get() {{
          if (!isLocalStorage(this)) return originalLengthDescriptor.get.call(this);
          return collectScopedKeys().length;
        }}
      }});
    }} catch (_error) {{
      // Ignore environments that disallow overriding Storage.length.
    }}
  }}
  window.addEventListener("pagehide", () => {{
    void syncSnapshot();
  }});
  window.addEventListener("beforeunload", () => {{
    void syncSnapshot();
  }});
  if (document.readyState === "loading") {{
    document.addEventListener("DOMContentLoaded", scheduleSync, {{ once: true }});
  }} else {{
    scheduleSync();
  }}
  document.addEventListener("input", scheduleSync, true);
  document.addEventListener("change", scheduleSync, true);
  document.addEventListener("click", scheduleSync, true);
  if (window.MutationObserver && document.documentElement) {{
    const observer = new MutationObserver(() => {{
      scheduleSync();
    }});
    observer.observe(document.documentElement, {{
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    }});
  }}
  window.setTimeout(scheduleSync, 0);
}})();
</script>"#
    );

    let lowered = raw.to_ascii_lowercase();
    if let Some(index) = lowered.find("</head>") {
        let mut output = String::with_capacity(raw.len() + injection.len() + 1);
        output.push_str(&raw[..index]);
        output.push_str(&injection);
        output.push('\n');
        output.push_str(&raw[index..]);
        return output;
    }

    if let Some(index) = lowered.find("<body") {
        let mut output = String::with_capacity(raw.len() + injection.len() + 16);
        output.push_str(&raw[..index]);
        output.push_str("<head>\n");
        output.push_str(&injection);
        output.push_str("\n</head>\n");
        output.push_str(&raw[index..]);
        return output;
    }

    format!("<head>\n{injection}\n</head>\n{raw}")
}

#[tauri::command]
fn prepare_quick_app_html_instance(
    app: tauri::AppHandle,
    template_path: String,
    instance_file_name: String,
    template_base_href: Option<String>,
    storage_namespace: Option<String>,
    snapshot_seed: Option<QuickAppHtmlSnapshotSeed>,
) -> Result<String, String> {
    let trimmed = template_path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("empty template path".to_string());
    }

    let template = PathBuf::from(trimmed);
    if !template.exists() || !template.is_file() {
        return Err(format!("html template does not exist: {:?}", template));
    }

    let template_ext = template
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if template_ext != "html" && template_ext != "htm" {
        return Err(format!("html template is not an .html/.htm file: {:?}", template));
    }

    let fallback_ext = if template_ext == "htm" { "htm" } else { "html" };
    let sanitized_file_name = sanitize_quick_app_instance_file_name(&instance_file_name, fallback_ext);
    let parent_dir = template
        .parent()
        .ok_or_else(|| format!("html template has no parent folder: {:?}", template))?;

    let raw_html =
        fs::read_to_string(&template).map_err(|err| format!("failed to read html template {:?}: {err}", template))?;
    let with_base_href = inject_quick_app_html_base_href(&raw_html, template_base_href.as_deref());
    let materialized_html =
        inject_quick_app_html_scoped_storage(&with_base_href, storage_namespace.as_deref(), snapshot_seed.as_ref());
    let sibling_instance = parent_dir.join(&sanitized_file_name);

    if sibling_instance != template {
        if fs::write(&sibling_instance, &materialized_html).is_ok() {
            return Ok(sibling_instance.to_string_lossy().to_string());
        }
    }

    let fallback_root = ensure_internal_state_root_exists(&app)?.join(QUICK_APP_HTML_INSTANCES_DIR_NAME);
    fs::create_dir_all(&fallback_root)
        .map_err(|err| format!("failed to create quick app html dir {:?}: {err}", fallback_root))?;
    let instance_dir = fallback_root.join(sanitize_quick_app_instance_dir_name(&sanitized_file_name));
    fs::create_dir_all(&instance_dir)
        .map_err(|err| format!("failed to create quick app html instance dir {:?}: {err}", instance_dir))?;
    let fallback_instance = instance_dir.join(&sanitized_file_name);
    fs::write(&fallback_instance, materialized_html).map_err(|err| {
        format!(
            "failed to write quick app html instance {:?}: {err}",
            fallback_instance
        )
    })?;
    Ok(fallback_instance.to_string_lossy().to_string())
}

#[tauri::command]
fn read_local_image_data_url(path: String) -> Result<Option<String>, String> {
    let trimmed = path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Ok(None);
    }
    let file_path = PathBuf::from(trimmed);
    if !file_path.exists() || !file_path.is_file() {
        return Ok(None);
    }
    let Some(mime) = image_mime_type_for_path(&file_path) else {
        return Ok(None);
    };
    let bytes = fs::read(&file_path)
        .map_err(|err| format!("failed to read local image {:?}: {err}", file_path))?;
    let encoded = BASE64_STANDARD.encode(bytes);
    Ok(Some(format!("data:{mime};base64,{encoded}")))
}

#[tauri::command]
fn read_local_file_data_url(path: String) -> Result<Option<String>, String> {
    let trimmed = path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Ok(None);
    }
    let file_path = PathBuf::from(trimmed);
    if !file_path.exists() || !file_path.is_file() {
        return Ok(None);
    }
    let Some(mime) = preview_mime_type_for_path(&file_path) else {
        return Ok(None);
    };
    let bytes = fs::read(&file_path)
        .map_err(|err| format!("failed to read local file {:?}: {err}", file_path))?;
    let encoded = BASE64_STANDARD.encode(bytes);
    Ok(Some(format!("data:{mime};base64,{encoded}")))
}

async fn extract_document_text_from_bytes(
    file_name: &str,
    bytes_base64: &str,
) -> Result<Option<String>, String> {
    let trimmed_name = file_name.trim();
    let trimmed_base64 = bytes_base64.trim();
    if trimmed_name.is_empty() || trimmed_base64.is_empty() {
        return Ok(None);
    }

    let extension = Path::new(trimmed_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().trim_start_matches('.').to_ascii_lowercase())
        .unwrap_or_default();
    if extension.is_empty() {
        return Ok(None);
    }

    let bytes = BASE64_STANDARD
        .decode(trimmed_base64)
        .map_err(|err| format!("failed to decode attachment bytes: {err}"))?;
    let temp_dir = std::env::temp_dir().join(format!("odetool_ai_attach_{}", uuid::Uuid::new_v4().simple()));
    fs::create_dir_all(&temp_dir)
        .map_err(|err| format!("failed to create temp attachment dir {:?}: {err}", temp_dir))?;
    let temp_path = temp_dir.join(trimmed_name);
    fs::write(&temp_path, bytes)
        .map_err(|err| format!("failed to materialize temp attachment {:?}: {err}", temp_path))?;

    let parsed = document_parser::parse_file(&temp_path, &extension).await;
    let _ = fs::remove_file(&temp_path);
    let _ = fs::remove_dir_all(&temp_dir);
    Ok(parsed)
}

#[tauri::command]
fn read_clipboard_image_data_url() -> Result<Option<String>, String> {
    match read_clipboard_image_payload() {
        Ok((width, height, bytes)) => encode_png_data_url_from_rgba(width, height, bytes).map(Some),
        Err(message) if message.contains("Clipboard has no image") => Ok(None),
        Err(message) => Err(message),
    }
}

#[tauri::command]
async fn extract_document_text_from_payload(
    file_name: String,
    bytes_base64: String,
) -> Result<Option<String>, String> {
    extract_document_text_from_bytes(&file_name, &bytes_base64).await
}

#[tauri::command]
async fn export_powerpoint_slides(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<Vec<String>, String> {
    let trimmed = file_path.trim().trim_matches('"').to_string();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    tauri::async_runtime::spawn_blocking(move || {
        export_powerpoint_slides_internal(&app, &PathBuf::from(trimmed))
    })
    .await
    .map_err(|err| format!("failed to run PowerPoint preview export: {err}"))?
}

#[tauri::command]
fn start_windows_snipping_tool() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        launch_windows_snipping_tool_internal()?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Snipping tool is only available on Windows.".to_string())
    }
}

#[tauri::command]
async fn probe_single_instance_relaunch(
    single_instance_probe: tauri::State<'_, SingleInstanceProbeState>,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let before = single_instance_probe.current_count();
        let current_exe = std::env::current_exe()
            .map_err(|err| format!("failed to resolve current executable: {err}"))?;

        tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
            windows_powershell_command()
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    &format!(
                        "Start-Process -FilePath '{}'",
                        current_exe.to_string_lossy().replace('\'', "''")
                    ),
                ])
                .spawn()
                .map_err(|err| format!("failed to start second-instance probe: {err}"))?;
            Ok(())
        })
        .await
        .map_err(|err| format!("failed to dispatch second-instance probe: {err}"))??;

        for _ in 0..20 {
            tokio::time::sleep(Duration::from_millis(150)).await;
            if single_instance_probe.current_count() > before {
                return Ok(true);
            }
        }
        return Ok(false);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = single_instance_probe;
        Err("Single-instance relaunch probe is only available on Windows.".to_string())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QualityGateResult {
    success: bool,
    exit_code: i32,
    output: String,
}

fn truncate_command_output(output: &str, max_chars: usize) -> String {
    let total_chars = output.chars().count();
    if total_chars <= max_chars {
        return output.to_string();
    }
    let kept: String = output.chars().take(max_chars).collect();
    format!(
        "{kept}\n\n... output truncated ({} chars omitted) ...",
        total_chars.saturating_sub(max_chars)
    )
}

#[tauri::command]
async fn run_quality_gate_command() -> Result<QualityGateResult, String> {
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "failed to resolve project root from manifest dir".to_string())?;

    let output = tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            let mut command = windows_powershell_command();
            command
                .current_dir(&project_root)
                .args([
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    "npm run quality:run",
                ])
                .output()
                .map_err(|err| format!("failed to run quality gate: {err}"))
        }
        #[cfg(not(target_os = "windows"))]
        {
            Command::new("sh")
                .current_dir(&project_root)
                .args(["-lc", "npm run quality:run"])
                .output()
                .map_err(|err| format!("failed to run quality gate: {err}"))
        }
    })
    .await
    .map_err(|err| format!("failed to wait for quality gate command: {err}"))??;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let mut combined = String::new();
    if !stdout.is_empty() {
        combined.push_str(&stdout);
    }
    if !stderr.is_empty() {
        if !combined.is_empty() {
            combined.push_str("\n\n");
        }
        combined.push_str("stderr:\n");
        combined.push_str(&stderr);
    }
    if combined.trim().is_empty() {
        combined = "Quality gate completed with no output.".to_string();
    }

    Ok(QualityGateResult {
        success: output.status.success(),
        exit_code: output.status.code().unwrap_or(-1),
        output: truncate_command_output(&combined, 12_000),
    })
}

#[tauri::command]
async fn attach_clipboard_image_to_ticket(
    app: tauri::AppHandle,
    ticket_node_id: String,
) -> Result<AppNode, String> {
    let db = get_db(&app).await?;
    let ticket = fetch_node_record(&db, &ticket_node_id)
        .await?
        .ok_or_else(|| format!("ticket node not found: {ticket_node_id}"))?;
    if !ticket.node_type.eq_ignore_ascii_case("ticket") {
        return Err("Selected node is not a ticket.".to_string());
    }

    let target_dir = ensure_node_files_dir(&app, &ticket_node_id)?;
    let mut taken_file_names: HashSet<String> = HashSet::new();
    if let Ok(entries) = fs::read_dir(&target_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                taken_file_names.insert(name.to_lowercase());
            }
        }
    }

    let siblings = fetch_nodes_by_parent(&db, &ticket_node_id).await?;
    let mut taken_node_names: HashSet<String> = siblings
        .iter()
        .map(|node| node.name.to_lowercase())
        .collect();

    let desired_name = format!("Screenshot-{}.png", now_ms());
    let final_name = find_unique_import_name(&desired_name, &taken_node_names, &taken_file_names);
    let final_name_key = final_name.to_lowercase();
    taken_node_names.insert(final_name_key.clone());
    taken_file_names.insert(final_name_key);
    let destination = target_dir.join(&final_name);

    save_clipboard_image_png(&destination)?;
    let size = fs::metadata(&destination)
        .map(|meta| meta.len())
        .unwrap_or(0);

    let max_order = siblings.iter().map(|node| node.order).max().unwrap_or(0);
    let now = now_ms();
    let record = NodeRecord {
        node_id: uuid::Uuid::new_v4().to_string(),
        parent_id: ticket_node_id,
        name: final_name,
        node_type: "file".to_string(),
        properties: serde_json::json!({
            "mirrorFilePath": destination.to_string_lossy().to_string(),
            "importedFromPath": "clipboard://screenshot",
            "sizeBytes": size
        }),
        description: None,
        order: max_order + 1000,
        created_at: now,
        updated_at: now,
        content_type: None,
        ai_draft: None,
        content: None,
    };

    db.query("CREATE node CONTENT $record;")
        .bind(("record", record.clone()))
        .await
        .map_err(db_err)?;

    if let Err(err) = sync_desktop_projection_from_db(&app, &db).await {
        eprintln!("desktop mirror sync failed after attach_clipboard_image_to_ticket: {err}");
    }

    Ok(AppNode::from(record))
}

pub fn run() {
    tauri::Builder::default()
        .manage(SingleInstanceProbeState::new())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let state = app.state::<SingleInstanceProbeState>();
            state.mark_activation();
            focus_primary_window(app);
        }))
        .invoke_handler(tauri::generate_handler![
            get_nodes,
            get_all_nodes,
            get_node,
            create_node,
            rename_node,
            update_node_content,
            update_node_description,
            update_node_properties,
            delete_node,
            get_ancestors,
            get_all_descendant_ids,
            move_node,
            search_nodes,
            cleanup_orphan_nodes,
            create_task,
            get_task,
            update_task,
            delete_task,
            search_tasks,
            link_task_to_node,
            unlink_task_from_node,
            get_task_ids_for_node,
            get_task_metadata,
            import_files_to_node,
            import_file_payloads_to_node,
            export_node_package,
            import_node_package,
            duplicate_workspace,
            export_workspace_package,
            import_workspace_package,
            open_node_file,
            extract_document_text,
            sync_quick_app_html_storage_snapshot,
            get_quick_app_html_storage_snapshot,
            fetch_quick_app_url_preview,
            reparse_node_document_content,
            open_node_file_with,
            open_node_file_location,
            get_windows_file_icon,
            get_windows_installed_font_families,
            get_windows_primary_window_layout_state,
            set_windows_primary_window_bounds,
            fit_windows_primary_window_to_work_area,
            is_windows_primary_window_fullscreen,
            set_windows_primary_window_fullscreen,
            minimize_windows_primary_window,
            close_windows_primary_window,
            get_windows_clipboard_file_paths,
            set_windows_clipboard_file_paths,
            pick_windows_files_for_import,
            pick_qa_evidence_files,
            get_windows_language_snapshot,
            open_local_path,
            prepare_quick_app_html_instance,
            export_tree_structure_excel,
            export_procedure_table_excel,
            pick_windows_tree_spreadsheet_file,
            pick_windows_procedure_table_spreadsheet_file,
            read_tree_structure_excel,
            read_procedure_table_excel,
            save_export_file,
            read_local_image_data_url,
            read_local_file_data_url,
            read_clipboard_image_data_url,
            extract_document_text_from_payload,
            export_powerpoint_slides,
            pick_windows_node_package_file,
            pick_windows_workspace_package_file,
            pick_windows_project_folder,
            get_mirror_root,
            sync_external_mirror_entries,
            detect_project_workspace_external_changes,
            re_sync_project_workspace,
            get_projects,
            repair_workspace_index,
            create_project_from_path,
            create_workspace,
            set_project_workspace_path,
            delete_project_workspace,
            get_user_account_state,
            bootstrap_user_account,
            sign_in_user_account,
            resume_user_account_session,
            create_user_account,
            update_user_account,
            revoke_user_account_session,
            delete_user_account,
            get_ai_rebuild_status,
            detect_ai_api_source,
            run_ai_tree_analysis,
            analyze_ticket,
            generate_ticket_reply,
            open_external_url,
            start_windows_snipping_tool,
            probe_single_instance_relaunch,
            attach_clipboard_image_to_ticket,
            run_quality_gate_command,
            ai_server::start_local_ai_server,
            ai_server::stop_local_ai_server,
            ai_server::check_local_ai_status
        ])
        .manage(ai_server::LocalAiState::new())
        .setup(|app| {
            app_updater::start_auto_update(app.handle().clone());
            if let Err(err) = ensure_mirror_root_exists(&app.handle()) {
                eprintln!("failed to ensure mirror root path: {err}");
            }
            apply_primary_window_icon(&app.handle());
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let db = match get_db(&app_handle).await {
                    Ok(db) => db,
                    Err(err) => {
                        eprintln!("failed to initialize surrealdb: {err}");
                        return;
                    }
                };

                match cleanup_orphan_nodes_impl(&db).await {
                    Ok(removed) => {
                        if removed > 0 {
                            eprintln!("startup cleanup removed {removed} orphan node(s)");
                        }
                    }
                    Err(err) => {
                        eprintln!("failed to cleanup orphan nodes: {err}");
                    }
                }

                if let Err(err) = sync_desktop_projection_from_db(&app_handle, &db).await {
                    eprintln!("startup desktop mirror sync failed: {err}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::HashSet;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_node(node_id: &str, parent_id: &str) -> NodeRecord {
        NodeRecord {
            node_id: node_id.to_string(),
            parent_id: parent_id.to_string(),
            name: node_id.to_string(),
            node_type: "folder".to_string(),
            properties: Value::Object(serde_json::Map::new()),
            description: None,
            order: 0,
            created_at: 0,
            updated_at: 0,
            content_type: None,
            ai_draft: None,
            content: None,
        }
    }

    fn test_temp_path(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("odetool_{label}_{}_{}", std::process::id(), stamp))
    }

    #[test]
    fn task_patch_clamps_progress_and_trims_title() {
        let mut updates = serde_json::Map::new();
        updates.insert("progress".to_string(), Value::from(150));
        updates.insert("title".to_string(), Value::String("  Launch  ".to_string()));

        let patch = build_task_update_patch(updates).expect("patch should build");
        assert_eq!(patch.get("progress"), Some(&Value::from(100)));
        assert_eq!(
            patch.get("title"),
            Some(&Value::String("Launch".to_string()))
        );
    }

    #[test]
    fn task_patch_allows_clearing_nullable_fields() {
        let mut updates = serde_json::Map::new();
        updates.insert("description".to_string(), Value::String("   ".to_string()));
        updates.insert("externalUrl".to_string(), Value::Null);

        let patch = build_task_update_patch(updates).expect("patch should build");
        assert_eq!(patch.get("description"), Some(&Value::Null));
        assert_eq!(patch.get("externalUrl"), Some(&Value::Null));
    }

    #[test]
    fn task_patch_rejects_empty_required_title() {
        let mut updates = serde_json::Map::new();
        updates.insert("title".to_string(), Value::String("   ".to_string()));

        let result = build_task_update_patch(updates);
        assert!(result.is_err());
    }

    #[test]
    fn task_patch_rejects_non_string_tags() {
        let mut updates = serde_json::Map::new();
        updates.insert(
            "tags".to_string(),
            Value::Array(vec![Value::String("ok".to_string()), Value::from(42)]),
        );

        let result = build_task_update_patch(updates);
        assert!(result.is_err());
    }

    #[test]
    fn mirror_name_normalization_strips_common_numbering_prefixes() {
        assert_eq!(normalize_external_mirror_entry_name("[2] Test"), "Test");
        assert_eq!(normalize_external_mirror_entry_name("(3) Test"), "Test");
        assert_eq!(normalize_external_mirror_entry_name("4.1 Test"), "Test");
        assert_eq!(
            normalize_external_mirror_entry_name("Project 2026"),
            "Project 2026"
        );
    }

    #[test]
    fn office_lock_and_system_temp_entries_are_ignored() {
        assert!(should_ignore_external_entry_name(".~lock.Construire son étude de marché et sa stratégie commerciale.pdf#"));
        assert!(should_ignore_external_entry_name("~$Quarterly Report.docx"));
        assert!(should_ignore_external_entry_name("Thumbs.db"));
        assert!(!should_ignore_external_entry_name("Quarterly Report.docx"));
        assert!(!should_ignore_external_entry_name("[1] Pilotage"));
    }

    #[test]
    fn mirror_display_name_always_uses_bracketed_numbering() {
        assert_eq!(build_mirror_display_name("1.2", "[7] Test"), "[1.2] Test");
        assert_eq!(build_mirror_display_name("3", "(2) Plan"), "[3] Plan");
    }

    #[test]
    fn expected_workspace_entries_number_only_folders() {
        let mut folder_a = test_node("folder_a", ROOT_PARENT_ID);
        folder_a.name = "Folder A".to_string();

        let mut file = test_node("file_a", ROOT_PARENT_ID);
        file.name = "Spec.docx".to_string();
        file.node_type = "file".to_string();

        let mut folder_b = test_node("folder_b", ROOT_PARENT_ID);
        folder_b.name = "Folder B".to_string();
        folder_b.order = 2000;

        let entries = build_expected_workspace_entries(&[folder_a, file, folder_b], "");
        let entry_names: Vec<String> = entries.into_iter().map(|entry| entry.entry_name).collect();
        assert_eq!(
            entry_names,
            vec![
                "[1] Folder A".to_string(),
                "Spec.docx".to_string(),
                "[2] Folder B".to_string()
            ]
        );
    }

    #[test]
    fn split_file_name_covers_common_examples() {
        assert_eq!(
            split_file_name("report.final.docx"),
            ("report.final".to_string(), ".docx".to_string())
        );
        assert_eq!(
            split_file_name("README"),
            ("README".to_string(), "".to_string())
        );
        assert_eq!(
            split_file_name(".gitignore"),
            (".gitignore".to_string(), "".to_string())
        );
    }

    #[test]
    fn copy_name_generation_handles_existing_variants() {
        let taken_names = HashSet::from([
            "report.txt".to_string(),
            "report (copy).txt".to_string(),
            "report (copy 2).txt".to_string(),
        ]);
        let candidate = find_unique_mirror_entry_name("Report.txt", &taken_names);
        assert_eq!(candidate, "Report (Copy 3).txt");
    }

    #[test]
    fn find_unique_node_name_generates_expected_copy_sequence() {
        let taken = HashSet::from([
            "new topic".to_string(),
            "new topic (copy)".to_string(),
            "new topic (copy 2)".to_string(),
        ]);
        assert_eq!(find_unique_node_name("", &taken), "New Topic (Copy 3)");
        assert_eq!(find_unique_node_name("Roadmap", &taken), "Roadmap");
    }

    #[test]
    fn sibling_file_source_keys_include_original_and_mirror_paths() {
        let base = test_temp_path("import_source_keys");
        let source_dir = base.join("source");
        let mirror_dir = base.join("mirror");
        fs::create_dir_all(&source_dir).expect("create source dir");
        fs::create_dir_all(&mirror_dir).expect("create mirror dir");

        let source_path = source_dir.join("Spec.docx");
        fs::write(&source_path, b"spec").expect("write source file");
        let mirror_path = mirror_dir.join("Spec.docx");
        fs::copy(&source_path, &mirror_path).expect("copy mirror file");

        let mut node = test_node("spec", ROOT_PARENT_ID);
        node.name = "Spec.docx".to_string();
        node.node_type = "file".to_string();
        node.properties = json!({
            "mirrorFilePath": mirror_path.to_string_lossy().to_string(),
            "importedFromPath": source_path.to_string_lossy().to_string()
        });

        let keys = collect_sibling_file_source_keys(&[node]);
        assert!(keys.contains(&path_compare_key(&source_path)));
        assert!(keys.contains(&path_compare_key(&mirror_path)));

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn sanitize_file_name_component_strips_invalid_values() {
        assert_eq!(sanitize_file_name_component("A<B>:C?.txt"), "A_B__C_.txt");
        assert_eq!(sanitize_file_name_component("   ...   "), "node");
    }

    #[test]
    fn strip_file_path_properties_keeps_only_non_path_fields() {
        let raw = json!({
            "mirrorFilePath": "c:\\tmp\\file.txt",
            "importedFromPath": "d:\\input",
            "sizeBytes": 42,
            "status": "ready",
            "owner": "qa"
        });
        let stripped = strip_file_path_properties(&raw);
        assert!(!stripped.contains_key("mirrorFilePath"));
        assert!(!stripped.contains_key("importedFromPath"));
        assert!(!stripped.contains_key("sizeBytes"));
        assert_eq!(
            stripped.get("status"),
            Some(&Value::String("ready".to_string()))
        );
        assert_eq!(
            stripped.get("owner"),
            Some(&Value::String("qa".to_string()))
        );
    }

    #[test]
    fn descendant_lookup_covers_nested_tree_examples() {
        let nodes = vec![
            test_node("root", ROOT_PARENT_ID),
            test_node("a", "root"),
            test_node("b", "a"),
            test_node("c", "b"),
            test_node("d", "a"),
            test_node("x", ROOT_PARENT_ID),
        ];
        let ids = descendant_ids_from_nodes(&nodes, "a");
        let id_set: HashSet<String> = ids.into_iter().collect();
        let expected = HashSet::from(["b".to_string(), "c".to_string(), "d".to_string()]);
        assert_eq!(id_set, expected);
    }

    #[test]
    fn search_scoring_matches_operational_properties() {
        let root = test_node("root", ROOT_PARENT_ID);
        let mut node = test_node("ops", "root");
        node.name = "Weekly Review".to_string();
        node.properties = json!({
            "owner": "Sofia",
            "status": "blocked",
            "riskLevel": "high"
        });

        let node_by_id = HashMap::from([
            (root.node_id.as_str(), &root),
            (node.node_id.as_str(), &node),
        ]);
        let query_terms = vec!["sofia".to_string()];
        let score = score_node_search_match(&node, "sofia", &query_terms, &node_by_id);

        assert!(score.is_some());
    }

    #[test]
    fn search_scoring_prioritizes_name_over_properties() {
        let root = test_node("root", ROOT_PARENT_ID);

        let mut name_match = test_node("blocked", "root");
        name_match.name = "Blocked".to_string();

        let mut property_match = test_node("review", "root");
        property_match.name = "Weekly Review".to_string();
        property_match.properties = json!({
            "status": "blocked"
        });

        let node_by_id = HashMap::from([
            (root.node_id.as_str(), &root),
            (name_match.node_id.as_str(), &name_match),
            (property_match.node_id.as_str(), &property_match),
        ]);
        let query_terms = vec!["blocked".to_string()];
        let name_score =
            score_node_search_match(&name_match, "blocked", &query_terms, &node_by_id).unwrap_or(0);
        let property_score =
            score_node_search_match(&property_match, "blocked", &query_terms, &node_by_id)
                .unwrap_or(0);

        assert!(name_score > property_score);
    }

    #[test]
    fn search_scoring_skips_file_path_noise_in_properties() {
        let root = test_node("root", ROOT_PARENT_ID);
        let mut node = test_node("file-node", "root");
        node.name = "Quarterly Report".to_string();
        node.properties = json!({
            "mirrorFilePath": "C:\\Users\\burea\\Desktop\\Quarterly Report.docx",
            "importedFromPath": "C:\\Inbox\\Quarterly Report.docx",
            "owner": "Finance"
        });

        let node_by_id = HashMap::from([
            (root.node_id.as_str(), &root),
            (node.node_id.as_str(), &node),
        ]);
        let query_terms = vec!["desktop".to_string()];
        let score = score_node_search_match(&node, "desktop", &query_terms, &node_by_id);

        assert!(score.is_none());
    }

    #[test]
    fn remove_projected_entry_deletes_files_and_directories() {
        let base = test_temp_path("remove_projected_entry");
        fs::create_dir_all(&base).expect("create base temp directory");

        let file_path = base.join("node.txt");
        fs::write(&file_path, b"node content").expect("create test file");

        let folder_path = base.join("folder");
        fs::create_dir_all(&folder_path).expect("create test folder");
        fs::write(folder_path.join("nested.txt"), b"nested").expect("create nested file");

        remove_projected_entry(&file_path).expect("remove file");
        remove_projected_entry(&folder_path).expect("remove directory");

        assert!(!file_path.exists());
        assert!(!folder_path.exists());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn cleanup_ode_context_file_removes_existing_context_payload() {
        let base = test_temp_path("cleanup_ode_context_file");
        fs::create_dir_all(&base).expect("create ode context test folder");

        let context_path = base.join(ODE_CONTEXT_FILE_NAME);
        fs::write(
            &context_path,
            "{\n  \"persona\": \"Program Manager\",\n  \"goal\": \"Launch project\"\n}\n",
        )
        .expect("write stale ode context");
        assert!(context_path.exists());

        cleanup_ode_context_file(&base).expect("remove stale ode context");
        assert!(!context_path.exists());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn recursive_projection_removes_legacy_ode_context_files_for_folder_nodes() {
        let base = test_temp_path("projection_ode_context");
        fs::create_dir_all(&base).expect("create projection base");

        let root = NodeRecord {
            node_id: "root".to_string(),
            parent_id: ROOT_PARENT_ID.to_string(),
            name: "WBS - Launch".to_string(),
            node_type: "folder".to_string(),
            properties: json!({
                "odeContext": {
                    "persona": "Program Manager",
                    "goal": "Launch",
                    "mode": "wbs",
                    "node_key": "root"
                }
            }),
            description: None,
            order: 0,
            created_at: 0,
            updated_at: 0,
            content_type: None,
            ai_draft: None,
            content: None,
        };
        let child = NodeRecord {
            node_id: "child".to_string(),
            parent_id: "root".to_string(),
            name: "Discovery".to_string(),
            node_type: "folder".to_string(),
            properties: json!({
                "odeContext": {
                    "persona": "Business Analyst",
                    "goal": "Discovery for Launch",
                    "mode": "wbs",
                    "node_key": "1"
                }
            }),
            description: None,
            order: 0,
            created_at: 0,
            updated_at: 0,
            content_type: None,
            ai_draft: None,
            content: None,
        };
        let nodes = vec![root, child];
        let children_map = build_children_map(&nodes);

        let created =
            sync_desktop_projection_recursive(&children_map, ROOT_PARENT_ID, &base, "", true)
                .expect("sync projection without ode context");
        assert_eq!(created.len(), 1);

        let root_folder = base.join(&created[0]);
        let root_context = root_folder.join(ODE_CONTEXT_FILE_NAME);
        let child_entries: Vec<PathBuf> = fs::read_dir(&root_folder)
            .expect("read root folder")
            .filter_map(|entry| entry.ok().map(|value| value.path()))
            .filter(|path| path.is_dir())
            .collect();
        assert_eq!(child_entries.len(), 1);

        let child_context = child_entries[0].join(ODE_CONTEXT_FILE_NAME);
        fs::write(&root_context, "{\"mode\":\"wbs\"}\n").expect("write stale root ode context");
        fs::write(&child_context, "{\"persona\":\"Business Analyst\"}\n")
            .expect("write stale child ode context");

        sync_desktop_projection_recursive(&children_map, ROOT_PARENT_ID, &base, "", true)
            .expect("sync projection cleanup");

        assert!(
            !root_context.exists(),
            "root folder should no longer include .ode-context"
        );
        assert!(
            !child_context.exists(),
            "child folder should no longer include .ode-context"
        );

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn recursive_projection_adopts_existing_plain_folder_name() {
        let base = test_temp_path("projection_adopt_plain_folder");
        fs::create_dir_all(base.join("Test C")).expect("create plain external folder");

        let mut folder = test_node("folder", ROOT_PARENT_ID);
        folder.name = "Test C".to_string();

        let nodes = vec![folder];
        let children_map = build_children_map(&nodes);
        let created = sync_desktop_projection_recursive(&children_map, ROOT_PARENT_ID, &base, "", true)
            .expect("sync projection should adopt plain folder");

        assert_eq!(created, vec!["[1] Test C".to_string()]);
        assert!(base.join("[1] Test C").is_dir());
        assert!(!base.join("Test C").exists());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn recursive_projection_keeps_file_names_plain() {
        let base = test_temp_path("projection_plain_file");
        let source_dir = test_temp_path("projection_plain_file_source");
        fs::create_dir_all(&base).expect("create projection base");
        fs::create_dir_all(&source_dir).expect("create source dir");

        let source_path = source_dir.join("Spec.docx");
        fs::write(&source_path, b"spec").expect("write source file");

        let mut file = test_node("file", ROOT_PARENT_ID);
        file.name = "Spec.docx".to_string();
        file.node_type = "file".to_string();
        file.properties = json!({
            "mirrorFilePath": source_path.to_string_lossy().to_string()
        });

        let nodes = vec![file];
        let children_map = build_children_map(&nodes);
        let created = sync_desktop_projection_recursive(&children_map, ROOT_PARENT_ID, &base, "", true)
            .expect("sync projection should keep plain file name");

        assert_eq!(created, vec!["Spec.docx".to_string()]);
        assert!(base.join("Spec.docx").is_file());
        assert!(!base.join("[1] Spec.docx").exists());

        let _ = fs::remove_dir_all(&base);
        let _ = fs::remove_dir_all(&source_dir);
    }

    #[test]
    fn task_patch_accepts_aliases_and_clamps_negative_progress() {
        let mut updates = serde_json::Map::new();
        updates.insert("task_type".to_string(), Value::String("bug".to_string()));
        updates.insert(
            "status".to_string(),
            Value::String("in_progress".to_string()),
        );
        updates.insert("progress".to_string(), Value::from(-25));
        updates.insert(
            "tags".to_string(),
            Value::Array(vec![
                Value::String(" alpha ".to_string()),
                Value::String("".to_string()),
                Value::String("beta".to_string()),
            ]),
        );
        updates.insert(
            "id".to_string(),
            Value::String("should-not-be-updated".to_string()),
        );

        let patch = build_task_update_patch(updates).expect("patch should build");
        assert_eq!(patch.get("type"), Some(&Value::String("bug".to_string())));
        assert_eq!(
            patch.get("status"),
            Some(&Value::String("in_progress".to_string()))
        );
        assert_eq!(patch.get("progress"), Some(&Value::from(0)));
        assert_eq!(
            patch.get("tags"),
            Some(&Value::Array(vec![
                Value::String("alpha".to_string()),
                Value::String("beta".to_string())
            ]))
        );
        assert!(!patch.contains_key("id"));
    }

    #[test]
    fn task_patch_rejects_invalid_status_examples() {
        let mut updates = serde_json::Map::new();
        updates.insert("status".to_string(), Value::String("queued".to_string()));
        let result = build_task_update_patch(updates);
        assert!(result.is_err());
    }

    #[test]
    fn normalize_project_root_path_accepts_wrapped_quotes() {
        let base = test_temp_path("normalize_project_root_path_quotes");
        fs::create_dir_all(&base).expect("create quoted path test folder");

        let quoted = format!("  \"{}\"  ", base.to_string_lossy());
        let normalized = normalize_project_root_path(&quoted)
            .expect("quoted project root path should normalize");
        let expected = normalize_windows_extended_path(
            fs::canonicalize(&base).expect("canonicalize test folder"),
        );
        assert_eq!(normalized, expected);

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn surreal_revision_error_detection_matches_legacy_value_message() {
        let legacy =
            "Versioned error: A deserialization error occured: Invalid revision `0` for type `Value`";
        assert!(is_surreal_revision_deserialization_error(legacy));
        assert!(!is_surreal_revision_deserialization_error(
            "deserialization failed for unexpected token"
        ));
    }

    #[test]
    fn projection_path_map_prefers_project_records_and_uses_root_fallback() {
        let mut root_from_props = test_node("root-from-props", ROOT_PARENT_ID);
        root_from_props.properties = json!({
            "projectPath": "C:\\Projects\\FromProps"
        });

        let mut root_from_record = test_node("root-from-record", ROOT_PARENT_ID);
        root_from_record.properties = json!({
            "projectPath": "C:\\Projects\\LegacyIgnored"
        });

        let nodes = vec![root_from_props, root_from_record];
        let projects = vec![ProjectRecord {
            project_id: "p1".to_string(),
            name: "Workspace".to_string(),
            root_path: "C:\\Projects\\FromRecord".to_string(),
            root_node_id: "root-from-record".to_string(),
            created_at: 0,
            updated_at: 0,
        }];

        let map = build_project_paths_by_root_id_for_projection(&nodes, &projects);
        assert_eq!(
            map.get("root-from-record"),
            Some(&"C:\\Projects\\FromRecord".to_string())
        );
        assert_eq!(
            map.get("root-from-props"),
            Some(&"C:\\Projects\\FromProps".to_string())
        );
    }

    #[test]
    fn path_is_within_root_handles_nested_paths() {
        let base = test_temp_path("path_is_within_root");
        let nested = base.join("alpha").join("beta");
        let outside = test_temp_path("path_is_within_root_outside");

        fs::create_dir_all(&nested).expect("create nested path");
        fs::create_dir_all(&outside).expect("create outside path");

        assert!(path_is_within_root(&nested, &base));
        assert!(!path_is_within_root(&outside, &base));

        let _ = fs::remove_dir_all(&base);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn resolve_workspace_root_id_finds_top_level_folder() {
        let root = test_node("root", ROOT_PARENT_ID);
        let child = test_node("child", "root");
        let leaf = test_node("leaf", "child");
        let all = vec![root, child, leaf];
        let mut node_by_id: HashMap<String, &NodeRecord> = HashMap::new();
        for node in &all {
            node_by_id.insert(node.node_id.clone(), node);
        }

        assert_eq!(
            resolve_workspace_root_id_for_node("leaf", &node_by_id),
            Some("root".to_string())
        );
        assert_eq!(
            resolve_workspace_root_id_for_node("child", &node_by_id),
            Some("root".to_string())
        );
        assert_eq!(
            resolve_workspace_root_id_for_node("root", &node_by_id),
            Some("root".to_string())
        );
        assert_eq!(
            resolve_workspace_root_id_for_node("missing", &node_by_id),
            None
        );
    }

    #[test]
    fn node_content_update_query_supports_both_node_id_field_names() {
        assert!(UPDATE_NODE_CONTENT_QUERY.contains("nodeId = $node_id"));
        assert!(UPDATE_NODE_CONTENT_QUERY.contains("node_id = $node_id"));
    }
}
