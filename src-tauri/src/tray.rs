//! System tray: keeps DotaPilot running in the background while the main window is hidden.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub const TOGGLE_OVERLAY_EVENT: &str = "tray://toggle-overlay";
pub const OVERLAY_SETUP_EVENT: &str = "overlay://setup-mode";

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Открыть DotaPilot", true, None::<&str>)?;
    let overlay = MenuItem::with_id(
        app,
        "overlay",
        "Показать / скрыть оверлей",
        true,
        None::<&str>,
    )?;
    let setup = MenuItem::with_id(app, "setup", "Переместить оверлей", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &overlay, &setup, &sep, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("DotaPilot")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "overlay" => {
                let _ = app.emit(TOGGLE_OVERLAY_EVENT, ());
            }
            "setup" => {
                let _ = app.emit(OVERLAY_SETUP_EVENT, ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
