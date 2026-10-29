//! HTTP endpoint for Dota 2 GSI. Bound to 127.0.0.1 only.

use std::sync::{Arc, RwLock};

use axum::{body::Bytes, extract::State, http::StatusCode, routing::post, Router};

use super::{auth::token_matches, types::GameState};

pub type StateSink = Arc<dyn Fn(GameState) + Send + Sync>;

/// Shared so the token can be rotated without rebinding the port.
pub type TokenCell = Arc<RwLock<String>>;

pub struct Shared {
    pub token: TokenCell,
    pub sink: StateSink,
}

pub fn router(token: TokenCell, sink: StateSink) -> Router {
    Router::new()
        .route("/", post(handle))
        .with_state(Arc::new(Shared { token, sink }))
}

async fn handle(State(shared): State<Arc<Shared>>, body: Bytes) -> StatusCode {
    let Ok(state) = serde_json::from_slice::<GameState>(&body) else {
        return StatusCode::BAD_REQUEST;
    };
    let authorized = shared
        .token
        .read()
        .map(|expected| token_matches(state.token(), &expected))
        .unwrap_or(false);
    if !authorized {
        return StatusCode::UNAUTHORIZED;
    }
    (shared.sink)(state);
    StatusCode::OK
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use std::sync::Mutex;
    use tower::ServiceExt;

    fn app() -> (Router, Arc<Mutex<Vec<GameState>>>) {
        let got = Arc::new(Mutex::new(Vec::new()));
        let sink_got = got.clone();
        let sink: StateSink = Arc::new(move |s| sink_got.lock().unwrap().push(s));
        let token = Arc::new(RwLock::new("good-token-0123456789".to_string()));
        (router(token, sink), got)
    }

    fn post_json(body: &str) -> Request<Body> {
        Request::post("/")
            .header("content-type", "application/json")
            .body(Body::from(body.to_owned()))
            .unwrap()
    }

    #[tokio::test]
    async fn accepts_valid_token() {
        let (app, got) = app();
        let res = app
            .oneshot(post_json(
                r#"{"map":{"clock_time":53},"auth":{"token":"good-token-0123456789"}}"#,
            ))
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let got = got.lock().unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].map.as_ref().unwrap().clock_time, Some(53));
    }

    #[tokio::test]
    async fn rejects_wrong_or_missing_token() {
        let (app, got) = app();
        let wrong = app
            .clone()
            .oneshot(post_json(r#"{"auth":{"token":"bad-token-0123456789x"}}"#))
            .await
            .unwrap();
        assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
        let missing = app.oneshot(post_json(r#"{"map":{}}"#)).await.unwrap();
        assert_eq!(missing.status(), StatusCode::UNAUTHORIZED);
        assert!(got.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn rotated_token_takes_effect_immediately() {
        let token = Arc::new(RwLock::new("old-token-0123456789".to_string()));
        let app = router(token.clone(), Arc::new(|_| {}));
        *token.write().unwrap() = "new-token-0123456789".into();
        let old = app
            .clone()
            .oneshot(post_json(r#"{"auth":{"token":"old-token-0123456789"}}"#))
            .await
            .unwrap();
        assert_eq!(old.status(), StatusCode::UNAUTHORIZED);
        let new = app
            .oneshot(post_json(r#"{"auth":{"token":"new-token-0123456789"}}"#))
            .await
            .unwrap();
        assert_eq!(new.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn rejects_garbage() {
        let (app, _) = app();
        let res = app.oneshot(post_json("not json")).await.unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }
}
