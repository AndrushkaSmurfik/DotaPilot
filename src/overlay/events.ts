// Cross-window events between the main window and the overlay.

export const OVERLAY_SETUP_EVENT = "overlay://setup-mode";
export const OVERLAY_NOTICE_EVENT = "overlay://notice";
/** Emitted by the Rust tray menu (src-tauri/src/tray.rs). */
export const TRAY_TOGGLE_OVERLAY_EVENT = "tray://toggle-overlay";

export interface OverlayNotice {
  text: string;
  /** Seconds to keep it on screen. */
  ttl?: number;
}
