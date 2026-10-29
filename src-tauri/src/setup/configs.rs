//! Library of user autoexec configs. Applying one copies it over
//! `game/dota/cfg/autoexec.cfg`; the user's original file is backed up once.
//! Dota reads the file itself on launch — nothing touches the game process.

use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

use serde::Serialize;

use super::steam::is_dota_dir;

pub const TARGET_FILE: &str = "autoexec.cfg";
pub const BACKUP_NAME: &str = "autoexec (резервная копия).cfg";
const MAX_SIZE: u64 = 256 * 1024;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ConfigEntry {
    pub name: String,
    pub size: u64,
    /// ms since epoch
    pub modified: u64,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct ApplyResult {
    pub target: String,
    /// Set when the original autoexec.cfg was backed up during this call.
    pub backup_created: bool,
}

pub fn target_path(dota_dir: &Path) -> PathBuf {
    dota_dir
        .join("game")
        .join("dota")
        .join("cfg")
        .join(TARGET_FILE)
}

/// Library names are bare file names ending in .cfg — no paths, no traversal.
pub fn validate_name(name: &str) -> Result<(), String> {
    let ok = name.to_ascii_lowercase().ends_with(".cfg")
        && name.len() <= 120
        && !name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|'])
        && !name.starts_with('.')
        && name.trim() == name;
    if ok {
        Ok(())
    } else {
        Err(format!("Недопустимое имя конфига: {name}"))
    }
}

fn entry(path: &Path) -> Option<ConfigEntry> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis() as u64;
    Some(ConfigEntry {
        name: path.file_name()?.to_string_lossy().into_owned(),
        size: meta.len(),
        modified,
    })
}

pub fn list(library: &Path) -> Result<Vec<ConfigEntry>, String> {
    if !library.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<ConfigEntry> = fs::read_dir(library)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.is_file()
                && validate_name(&p.file_name().unwrap_or_default().to_string_lossy()).is_ok()
        })
        .filter_map(|p| entry(&p))
        .collect();
    out.sort_by_key(|e| e.name.to_lowercase());
    Ok(out)
}

fn read_checked(src: &Path) -> Result<String, String> {
    let meta = fs::metadata(src).map_err(|e| format!("{}: {e}", src.display()))?;
    if meta.len() > MAX_SIZE {
        return Err("Файл слишком большой для конфига (больше 256 КБ)".into());
    }
    let bytes = fs::read(src).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|_| "Файл не похож на текстовый конфиг (не UTF-8)".into())
}

/// Picks "name.cfg", "name (2).cfg", … so imports never overwrite each other.
fn unique_name(library: &Path, wanted: &str) -> String {
    if !library.join(wanted).exists() {
        return wanted.to_string();
    }
    let stem = &wanted[..wanted.len() - 4];
    (2..)
        .map(|n| format!("{stem} ({n}).cfg"))
        .find(|n| !library.join(n).exists())
        .expect("unbounded range")
}

pub fn import(library: &Path, src: &Path) -> Result<ConfigEntry, String> {
    let file_name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or("Не выбран файл")?;
    validate_name(&file_name).map_err(|_| "Можно загружать только файлы .cfg".to_string())?;
    let text = read_checked(src)?;
    fs::create_dir_all(library).map_err(|e| e.to_string())?;
    let name = unique_name(library, &file_name);
    let dest = library.join(&name);
    fs::write(&dest, text).map_err(|e| e.to_string())?;
    entry(&dest).ok_or_else(|| "Не удалось сохранить конфиг".into())
}

pub fn read(library: &Path, name: &str) -> Result<String, String> {
    validate_name(name)?;
    read_checked(&library.join(name))
}

pub fn delete(library: &Path, name: &str) -> Result<(), String> {
    validate_name(name)?;
    fs::remove_file(library.join(name)).map_err(|e| e.to_string())
}

pub fn apply(library: &Path, name: &str, dota_dir: &Path) -> Result<ApplyResult, String> {
    validate_name(name)?;
    if !is_dota_dir(dota_dir) {
        return Err("Папка Dota 2 не найдена — пройдите онбординг заново".into());
    }
    let text = read_checked(&library.join(name))?;
    let target = target_path(dota_dir);

    // Keep the user's own autoexec the first time we replace it.
    let mut backup_created = false;
    if target.exists() && !library.join(BACKUP_NAME).exists() {
        let original = fs::read(&target).map_err(|e| e.to_string())?;
        if !list(library)?.iter().any(|e| {
            fs::read(library.join(&e.name))
                .map(|b| b == original)
                .unwrap_or(false)
        }) {
            fs::create_dir_all(library).map_err(|e| e.to_string())?;
            fs::write(library.join(BACKUP_NAME), original).map_err(|e| e.to_string())?;
            backup_created = true;
        }
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Write to a temp file first so a crash never leaves a half-written autoexec.
    let tmp = target.with_extension("cfg.dotapilot-tmp");
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &target).map_err(|e| e.to_string())?;
    Ok(ApplyResult {
        target: target.display().to_string(),
        backup_created,
    })
}

/// Name of the library config whose content equals the current autoexec.cfg.
pub fn active(library: &Path, dota_dir: &Path) -> Option<String> {
    let current = fs::read(target_path(dota_dir)).ok()?;
    list(library)
        .ok()?
        .into_iter()
        .find(|e| {
            fs::read(library.join(&e.name))
                .map(|b| b == current)
                .unwrap_or(false)
        })
        .map(|e| e.name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let library = tmp.path().join("library");
        let dota = tmp.path().join("dota 2 beta");
        fs::create_dir_all(dota.join("game/dota/cfg")).unwrap();
        (tmp, library, dota)
    }

    fn write_src(dir: &Path, name: &str, text: &str) -> PathBuf {
        let p = dir.join(name);
        fs::write(&p, text).unwrap();
        p
    }

    #[test]
    fn validates_names() {
        assert!(validate_name("mid.cfg").is_ok());
        assert!(validate_name("Мой конфиг (2).CFG").is_ok());
        assert!(validate_name("../evil.cfg").is_err());
        assert!(validate_name("C:\\x.cfg").is_err());
        assert!(validate_name("notes.txt").is_err());
        assert!(validate_name(".hidden.cfg").is_err());
    }

    #[test]
    fn imports_with_unique_names_and_rejects_non_cfg() {
        let (tmp, library, _) = setup();
        let a = write_src(tmp.path(), "mid.cfg", "bind f1 \"+attack\"\n");
        assert_eq!(import(&library, &a).unwrap().name, "mid.cfg");
        assert_eq!(import(&library, &a).unwrap().name, "mid (2).cfg");
        let txt = write_src(tmp.path(), "notes.txt", "x");
        assert!(import(&library, &txt).is_err());
        let bin = tmp.path().join("bin.cfg");
        fs::write(&bin, [0xff, 0xfe, 0x00]).unwrap();
        assert!(import(&library, &bin).is_err());
        assert_eq!(list(&library).unwrap().len(), 2);
    }

    #[test]
    fn apply_replaces_autoexec_and_backs_up_original_once() {
        let (tmp, library, dota) = setup();
        fs::write(target_path(&dota), "// my old config\n").unwrap();
        import(
            &library,
            &write_src(tmp.path(), "carry.cfg", "dota_camera_distance 1200\n"),
        )
        .unwrap();
        import(
            &library,
            &write_src(tmp.path(), "support.cfg", "cl_showfps 1\n"),
        )
        .unwrap();

        let first = apply(&library, "carry.cfg", &dota).unwrap();
        assert!(first.backup_created);
        assert_eq!(
            fs::read_to_string(target_path(&dota)).unwrap(),
            "dota_camera_distance 1200\n"
        );
        assert_eq!(
            fs::read_to_string(library.join(BACKUP_NAME)).unwrap(),
            "// my old config\n"
        );
        assert_eq!(active(&library, &dota).as_deref(), Some("carry.cfg"));

        let second = apply(&library, "support.cfg", &dota).unwrap();
        assert!(!second.backup_created);
        assert_eq!(
            fs::read_to_string(target_path(&dota)).unwrap(),
            "cl_showfps 1\n"
        );
        assert_eq!(
            fs::read_to_string(library.join(BACKUP_NAME)).unwrap(),
            "// my old config\n"
        );
        assert_eq!(active(&library, &dota).as_deref(), Some("support.cfg"));

        // Restoring the backup works like any other config.
        apply(&library, BACKUP_NAME, &dota).unwrap();
        assert_eq!(
            fs::read_to_string(target_path(&dota)).unwrap(),
            "// my old config\n"
        );
    }

    #[test]
    fn apply_without_existing_autoexec_creates_it() {
        let (tmp, library, dota) = setup();
        import(&library, &write_src(tmp.path(), "a.cfg", "x\n")).unwrap();
        let r = apply(&library, "a.cfg", &dota).unwrap();
        assert!(!r.backup_created);
        assert!(target_path(&dota).exists());
    }

    #[test]
    fn apply_refuses_bad_dota_dir_and_missing_config() {
        let (tmp, library, dota) = setup();
        import(&library, &write_src(tmp.path(), "a.cfg", "x\n")).unwrap();
        assert!(apply(&library, "a.cfg", tmp.path()).is_err());
        assert!(apply(&library, "missing.cfg", &dota).is_err());
    }

    #[test]
    fn delete_removes_from_library_only() {
        let (tmp, library, dota) = setup();
        import(&library, &write_src(tmp.path(), "a.cfg", "x\n")).unwrap();
        apply(&library, "a.cfg", &dota).unwrap();
        delete(&library, "a.cfg").unwrap();
        assert!(list(&library).unwrap().is_empty());
        assert!(target_path(&dota).exists());
        assert!(delete(&library, "../a.cfg").is_err());
    }
}
