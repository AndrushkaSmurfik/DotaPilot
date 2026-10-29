//! Tauri commands exposed to the frontend.

use std::{path::PathBuf, sync::Arc};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::{
    gsi::{auth::is_valid_token, GameState, GsiController, STATE_EVENT},
    setup::{configs, gsi_config, steam},
};

#[tauri::command]
pub async fn gsi_start(
    app: AppHandle,
    ctrl: State<'_, GsiController>,
    port: u16,
    token: String,
) -> Result<(), String> {
    if !is_valid_token(&token) {
        return Err("Некорректный токен".into());
    }
    let sink = Arc::new(move |state: GameState| {
        let _ = app.emit(STATE_EVENT, &state);
    });
    ctrl.start(port, token, sink).await
}

#[tauri::command]
pub async fn gsi_port(ctrl: State<'_, GsiController>) -> Result<Option<u16>, String> {
    Ok(ctrl.port().await)
}

#[tauri::command]
pub fn detect_dota_path() -> Option<String> {
    steam::detect_dota().map(|p| p.display().to_string())
}

#[tauri::command]
pub fn validate_dota_path(path: String) -> bool {
    steam::is_dota_dir(&PathBuf::from(path))
}

fn config_library(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("configs"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn config_list(app: AppHandle) -> Result<Vec<configs::ConfigEntry>, String> {
    configs::list(&config_library(&app)?)
}

#[tauri::command]
pub fn config_import(app: AppHandle, path: String) -> Result<configs::ConfigEntry, String> {
    configs::import(&config_library(&app)?, &PathBuf::from(path))
}

#[tauri::command]
pub fn config_read(app: AppHandle, name: String) -> Result<String, String> {
    configs::read(&config_library(&app)?, &name)
}

#[tauri::command]
pub fn config_delete(app: AppHandle, name: String) -> Result<(), String> {
    configs::delete(&config_library(&app)?, &name)
}

#[tauri::command]
pub fn config_apply(
    app: AppHandle,
    name: String,
    dota_path: String,
) -> Result<configs::ApplyResult, String> {
    configs::apply(&config_library(&app)?, &name, &PathBuf::from(dota_path))
}

#[tauri::command]
pub fn config_active(app: AppHandle, dota_path: String) -> Result<Option<String>, String> {
    Ok(configs::active(
        &config_library(&app)?,
        &PathBuf::from(dota_path),
    ))
}

/// Lets the webviews surface errors in the terminal running `tauri dev`.
#[tauri::command]
pub fn frontend_log(window: tauri::Window, level: String, message: String) {
    eprintln!("[{}:{level}] {message}", window.label());
}

#[derive(Serialize)]
pub struct InstallResult {
    pub path: String,
}

#[tauri::command]
pub fn install_gsi_config(
    dota_path: String,
    port: u16,
    token: String,
) -> Result<InstallResult, String> {
    let path = gsi_config::install(&PathBuf::from(dota_path), port, &token)?;
    Ok(InstallResult {
        path: path.display().to_string(),
    })
}
