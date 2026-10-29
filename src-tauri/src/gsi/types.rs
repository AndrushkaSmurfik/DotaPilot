//! Typed subset of the Dota 2 GSI payload. Every field is optional so that
//! partial payloads (menus, spectating, new Valve fields) never fail to parse.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
pub struct GameState {
    pub provider: Option<Provider>,
    pub map: Option<MapState>,
    pub player: Option<Player>,
    pub hero: Option<Hero>,
    /// Only used for authentication; never forwarded to the UI.
    #[serde(skip_serializing)]
    pub auth: Option<Auth>,
}

impl GameState {
    pub fn token(&self) -> Option<&str> {
        self.auth.as_ref().and_then(|a| a.token.as_deref())
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
pub struct Provider {
    pub name: Option<String>,
    pub appid: Option<i64>,
    pub version: Option<i64>,
    pub timestamp: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
pub struct MapState {
    pub name: Option<String>,
    pub matchid: Option<String>,
    pub game_time: Option<i64>,
    pub clock_time: Option<i64>,
    pub daytime: Option<bool>,
    pub nightstalker_night: Option<bool>,
    pub game_state: Option<String>,
    pub paused: Option<bool>,
    pub win_team: Option<String>,
    pub customgamename: Option<String>,
    pub radiant_score: Option<i64>,
    pub dire_score: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
pub struct Player {
    pub steamid: Option<String>,
    pub accountid: Option<String>,
    pub name: Option<String>,
    pub activity: Option<String>,
    pub kills: Option<i64>,
    pub deaths: Option<i64>,
    pub assists: Option<i64>,
    pub last_hits: Option<i64>,
    pub denies: Option<i64>,
    pub kill_streak: Option<i64>,
    pub team_name: Option<String>,
    pub gold: Option<i64>,
    pub gpm: Option<i64>,
    pub xpm: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
pub struct Hero {
    pub id: Option<i64>,
    pub name: Option<String>,
    pub level: Option<i64>,
    pub alive: Option<bool>,
    pub respawn_seconds: Option<i64>,
    pub buyback_cost: Option<i64>,
    pub buyback_cooldown: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
pub struct Auth {
    pub token: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_payload() {
        let s: GameState =
            serde_json::from_str(r#"{"provider":{"name":"Dota 2","appid":570}}"#).unwrap();
        assert_eq!(s.provider.unwrap().appid, Some(570));
        assert!(s.map.is_none());
    }

    #[test]
    fn ignores_unknown_fields_and_hides_auth() {
        let json = r#"{
            "map": {"clock_time": 113, "game_state": "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS", "brand_new_field": [1,2]},
            "previously": {"map": {"clock_time": 112}},
            "auth": {"token": "secret"}
        }"#;
        let s: GameState = serde_json::from_str(json).unwrap();
        assert_eq!(s.map.as_ref().unwrap().clock_time, Some(113));
        assert_eq!(s.token(), Some("secret"));
        let out = serde_json::to_string(&s).unwrap();
        assert!(!out.contains("secret"));
    }

    #[test]
    fn parses_all_recorded_fixtures() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/gsi");
        let mut count = 0;
        for entry in std::fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            let text = std::fs::read_to_string(&path).unwrap();
            let s: GameState =
                serde_json::from_str(&text).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
            assert!(
                s.map.as_ref().and_then(|m| m.clock_time).is_some(),
                "{}",
                path.display()
            );
            assert_eq!(s.token(), Some("__TOKEN__"));
            count += 1;
        }
        assert!(count >= 5);
    }
}
