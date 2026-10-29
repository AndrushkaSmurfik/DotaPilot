//! Finds the Dota 2 install via Steam's libraryfolders.vdf.

use std::path::{Path, PathBuf};

use super::vdf;

pub const DOTA_APP_ID: &str = "570";
const DOTA_DIR: &str = "dota 2 beta";

#[derive(Debug, Clone, PartialEq)]
pub struct Library {
    pub path: PathBuf,
    pub has_dota: bool,
}

/// Extracts library folders from libraryfolders.vdf (new and legacy formats).
pub fn parse_libraries(src: &str) -> Result<Vec<Library>, String> {
    let doc = vdf::parse(src)?;
    let root = doc
        .get("libraryfolders")
        .ok_or("libraryfolders root not found")?;
    let mut libs = Vec::new();
    for (key, value) in root.entries() {
        if !key.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        match value {
            // Legacy: "1" "D:\\SteamLibrary"
            vdf::Vdf::Str(path) => libs.push(Library {
                path: PathBuf::from(path),
                has_dota: false,
            }),
            // Current: "0" { "path" "..." "apps" { "570" "..." } }
            obj => {
                if let Some(path) = obj.get("path").and_then(|p| p.as_str()) {
                    let has_dota = obj
                        .get("apps")
                        .map(|apps| apps.entries().iter().any(|(id, _)| id == DOTA_APP_ID))
                        .unwrap_or(false);
                    libs.push(Library {
                        path: PathBuf::from(path),
                        has_dota,
                    });
                }
            }
        }
    }
    Ok(libs)
}

/// A folder is a valid Dota install if it contains `game/dota`.
pub fn is_dota_dir(path: &Path) -> bool {
    path.join("game").join("dota").is_dir()
}

/// Picks the Dota folder from the libraries, preferring ones that list app 570.
pub fn find_dota_in_libraries(libs: &[Library]) -> Option<PathBuf> {
    let mut ordered: Vec<&Library> = libs.iter().filter(|l| l.has_dota).collect();
    ordered.extend(libs.iter().filter(|l| !l.has_dota));
    ordered
        .into_iter()
        .map(|l| l.path.join("steamapps").join("common").join(DOTA_DIR))
        .find(|p| is_dota_dir(p))
}

/// Candidate Steam install roots for this OS.
pub fn steam_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, enums::HKEY_LOCAL_MACHINE, RegKey};
        if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Valve\Steam") {
            if let Ok(p) = key.get_value::<String, _>("SteamPath") {
                roots.push(PathBuf::from(p));
            }
        }
        if let Ok(key) =
            RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam")
        {
            if let Ok(p) = key.get_value::<String, _>("InstallPath") {
                roots.push(PathBuf::from(p));
            }
        }
        roots.push(PathBuf::from(r"C:\Program Files (x86)\Steam"));
    }
    #[cfg(not(windows))]
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        roots.push(home.join(".steam/steam"));
        roots.push(home.join(".local/share/Steam"));
        roots.push(home.join("Library/Application Support/Steam"));
    }
    roots
}

/// Full auto-detection: Steam root → libraryfolders.vdf → Dota folder.
pub fn detect_dota() -> Option<PathBuf> {
    for root in steam_roots() {
        let vdf_path = root.join("steamapps").join("libraryfolders.vdf");
        let mut libs = std::fs::read_to_string(&vdf_path)
            .ok()
            .and_then(|src| parse_libraries(&src).ok())
            .unwrap_or_default();
        // The Steam root itself is always a library.
        libs.push(Library {
            path: root.clone(),
            has_dota: false,
        });
        if let Some(found) = find_dota_in_libraries(&libs) {
            return Some(found);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const MODERN: &str = r#"
"libraryfolders"
{
    "0"
    {
        "path"      "C:\\Program Files (x86)\\Steam"
        "label"     ""
        "apps"
        {
            "228980"    "123"
        }
    }
    "1"
    {
        "path"      "D:\\SteamLibrary"
        "apps"
        {
            "570"       "45000000000"
        }
    }
}"#;

    const LEGACY: &str = r#"
"LibraryFolders"
{
    "TimeNextStatsReport"   "1700000000"
    "ContentStatsID"        "-123"
    "1"     "E:\\Games\\Steam"
}"#;

    #[test]
    fn parses_modern_format() {
        let libs = parse_libraries(MODERN).unwrap();
        assert_eq!(libs.len(), 2);
        assert_eq!(libs[1].path, PathBuf::from(r"D:\SteamLibrary"));
        assert!(libs[1].has_dota);
        assert!(!libs[0].has_dota);
    }

    #[test]
    fn parses_legacy_format() {
        let libs = parse_libraries(LEGACY).unwrap();
        assert_eq!(
            libs,
            vec![Library {
                path: PathBuf::from(r"E:\Games\Steam"),
                has_dota: false
            }]
        );
    }

    #[test]
    fn finds_dota_folder_on_disk() {
        let tmp = tempfile::tempdir().unwrap();
        let lib_a = tmp.path().join("a");
        let lib_b = tmp.path().join("b");
        let dota = lib_b.join("steamapps/common/dota 2 beta");
        std::fs::create_dir_all(dota.join("game/dota")).unwrap();
        std::fs::create_dir_all(&lib_a).unwrap();
        let libs = vec![
            Library {
                path: lib_a,
                has_dota: true,
            },
            Library {
                path: lib_b,
                has_dota: false,
            },
        ];
        assert_eq!(find_dota_in_libraries(&libs), Some(dota));
    }

    #[test]
    fn returns_none_without_dota() {
        let tmp = tempfile::tempdir().unwrap();
        let libs = vec![Library {
            path: tmp.path().into(),
            has_dota: true,
        }];
        assert_eq!(find_dota_in_libraries(&libs), None);
    }
}
