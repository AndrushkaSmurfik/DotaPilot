//! Valve Game State Integration: a local HTTP endpoint that the Dota 2 client
//! POSTs JSON snapshots to. Read-only by design — nothing here talks back to the game.

pub mod auth;
pub mod controller;
pub mod server;
pub mod types;

pub use controller::GsiController;
pub use types::GameState;

/// Tauri event carrying every accepted `GameState` to all windows.
pub const STATE_EVENT: &str = "gsi://state";
