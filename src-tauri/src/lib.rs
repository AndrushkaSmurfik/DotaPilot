pub mod commands;
pub mod gsi;
pub mod setup;
pub mod tray;

use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Passed by the autostart entry so the app boots straight into the tray.
pub const MINIMIZED_ARG: &str = "--minimized";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "settings and match history",
            sql: "CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
              );
              CREATE TABLE IF NOT EXISTS matches (
                match_id   TEXT PRIMARY KEY,
                hero_id    INTEGER,
                hero_name  TEXT,
                won        INTEGER NOT NULL,
                ended_at   INTEGER NOT NULL,
                duration   INTEGER NOT NULL DEFAULT 0
              );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "toxic behaviour marks for report reminders",
            sql: "CREATE TABLE IF NOT EXISTS toxic_marks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id   TEXT NOT NULL,
                clock      INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                reported   INTEGER NOT NULL DEFAULT 0
              );
              CREATE INDEX IF NOT EXISTS toxic_marks_match ON toxic_marks(match_id);",
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dotapilot.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .manage(gsi::GsiController::default())
        .invoke_handler(tauri::generate_handler![
            commands::gsi_start,
            commands::gsi_port,
            commands::detect_dota_path,
            commands::validate_dota_path,
            commands::install_gsi_config,
            commands::frontend_log,
            commands::config_list,
            commands::config_import,
            commands::config_read,
            commands::config_delete,
            commands::config_apply,
            commands::config_active,
        ])
        .setup(|app| {
            tray::build(app.handle())?;
            if std::env::args().any(|a| a == MINIMIZED_ARG) {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it to the tray; quit from the tray menu.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running DotaPilot");
}
