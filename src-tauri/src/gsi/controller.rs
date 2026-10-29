//! Owns the running GSI server. Rotating the token never rebinds the port;
//! changing the port binds the new one before dropping the old, so a failed
//! bind leaves the previous server running.

use std::sync::{Arc, RwLock};

use tauri::async_runtime::JoinHandle;
use tokio::{net::TcpListener, sync::Mutex};

use super::server::{router, StateSink, TokenCell};

struct Running {
    port: u16,
    token: TokenCell,
    task: JoinHandle<()>,
}

#[derive(Default)]
pub struct GsiController {
    running: Mutex<Option<Running>>,
}

impl GsiController {
    pub async fn start(&self, port: u16, token: String, sink: StateSink) -> Result<(), String> {
        let mut running = self.running.lock().await;
        if let Some(r) = running.as_ref() {
            if r.port == port {
                *r.token.write().map_err(|e| e.to_string())? = token;
                return Ok(());
            }
        }

        let listener = TcpListener::bind(("127.0.0.1", port))
            .await
            .map_err(|e| format!("Не удалось занять порт {port}: {e}"))?;
        let token: TokenCell = Arc::new(RwLock::new(token));
        let app = router(token.clone(), sink);
        let task = tauri::async_runtime::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        if let Some(old) = running.replace(Running { port, token, task }) {
            old.task.abort();
        }
        Ok(())
    }

    pub async fn port(&self) -> Option<u16> {
        self.running.lock().await.as_ref().map(|r| r.port)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    async fn post_status(port: u16, token: &str) -> String {
        let body = format!(r#"{{"auth":{{"token":"{token}"}}}}"#);
        let req = format!(
            "POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
            .await
            .unwrap();
        stream.write_all(req.as_bytes()).await.unwrap();
        let mut buf = Vec::new();
        stream.read_to_end(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf)
            .lines()
            .next()
            .unwrap_or_default()
            .to_string()
    }

    fn free_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port()
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn rotating_token_keeps_the_same_port_alive() {
        let ctrl = GsiController::default();
        let port = free_port();
        let sink: StateSink = Arc::new(|_| {});
        ctrl.start(port, "first-token-0123456789".into(), sink.clone())
            .await
            .unwrap();
        ctrl.start(port, "second-token-0123456789".into(), sink)
            .await
            .unwrap();

        assert!(post_status(port, "first-token-0123456789")
            .await
            .contains("401"));
        assert!(post_status(port, "second-token-0123456789")
            .await
            .contains("200"));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn failed_port_change_keeps_old_server() {
        let ctrl = GsiController::default();
        let port = free_port();
        let busy = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let busy_port = busy.local_addr().unwrap().port();
        let sink: StateSink = Arc::new(|_| {});
        ctrl.start(port, "token-0123456789abcd".into(), sink.clone())
            .await
            .unwrap();

        assert!(ctrl
            .start(busy_port, "token-0123456789abcd".into(), sink)
            .await
            .is_err());
        assert_eq!(ctrl.port().await, Some(port));
        assert!(post_status(port, "token-0123456789abcd")
            .await
            .contains("200"));
    }
}
