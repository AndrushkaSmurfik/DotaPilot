//! Writes `game/dota/cfg/gamestate_integration/gamestate_integration_dotapilot.cfg`.

use std::path::{Path, PathBuf};

use crate::gsi::auth::is_valid_token;

use super::steam::is_dota_dir;

pub const CFG_FILE: &str = "gamestate_integration_dotapilot.cfg";

pub fn cfg_path(dota_dir: &Path) -> PathBuf {
    dota_dir
        .join("game")
        .join("dota")
        .join("cfg")
        .join("gamestate_integration")
        .join(CFG_FILE)
}

/// We request only what the overlay needs: map, player, hero. No abilities/items/etc.
pub fn render(port: u16, token: &str) -> String {
    format!(
        r#""DotaPilot"
{{
    "uri"           "http://127.0.0.1:{port}/"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.5"
    "heartbeat"     "30.0"
    "data"
    {{
        "provider"  "1"
        "map"       "1"
        "player"    "1"
        "hero"      "1"
    }}
    "auth"
    {{
        "token"     "{token}"
    }}
}}
"#
    )
}

pub fn install(dota_dir: &Path, port: u16, token: &str) -> Result<PathBuf, String> {
    if !is_dota_dir(dota_dir) {
        return Err(format!(
            "В папке {} нет game/dota — это не папка Dota 2",
            dota_dir.display()
        ));
    }
    if !is_valid_token(token) {
        return Err("Некорректный токен".into());
    }
    if port == 0 {
        return Err("Некорректный порт".into());
    }
    let path = cfg_path(dota_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, render(port, token)).map_err(|e| e.to_string())?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::vdf;

    const TOKEN: &str = "test-token-0123456789abcdef";

    #[test]
    fn rendered_cfg_is_valid_vdf_with_token_and_port() {
        let text = render(3123, TOKEN);
        let doc = vdf::parse(&text).unwrap();
        let root = doc.get("DotaPilot").unwrap();
        assert_eq!(
            root.get("uri").unwrap().as_str(),
            Some("http://127.0.0.1:3123/")
        );
        assert_eq!(
            root.get("auth").unwrap().get("token").unwrap().as_str(),
            Some(TOKEN)
        );
        assert_eq!(
            root.get("data").unwrap().get("map").unwrap().as_str(),
            Some("1")
        );
    }

    #[test]
    fn installs_into_dota_folder() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("game/dota")).unwrap();
        let path = install(tmp.path(), 3000, TOKEN).unwrap();
        assert!(path
            .ends_with("game/dota/cfg/gamestate_integration/gamestate_integration_dotapilot.cfg"));
        assert!(std::fs::read_to_string(path).unwrap().contains(TOKEN));
    }

    #[test]
    fn refuses_non_dota_folder_and_bad_token() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(install(tmp.path(), 3000, TOKEN).is_err());
        std::fs::create_dir_all(tmp.path().join("game/dota")).unwrap();
        assert!(install(tmp.path(), 3000, "bad\"token-0123456789").is_err());
    }
}
