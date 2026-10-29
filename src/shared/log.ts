import { invoke } from "@tauri-apps/api/core";

export function logToTerminal(level: "info" | "error", message: string): void {
  invoke("frontend_log", { level, message }).catch(() => undefined);
}

/** Forwards uncaught errors to the `tauri dev` terminal. */
export function installErrorForwarding(): void {
  window.addEventListener("error", (e) => logToTerminal("error", `${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => logToTerminal("error", `unhandled: ${String(e.reason)}`));
}
