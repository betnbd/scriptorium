use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub default_provider: String,
    pub openai_url: String,
    #[serde(default = "default_openai_model")]
    pub openai_model: String,
    #[serde(default = "default_effort")]
    pub openai_effort: String,
    pub anthropic_url: String,
    #[serde(default = "default_anthropic_model")]
    pub anthropic_model: String,
    #[serde(default = "default_effort")]
    pub anthropic_effort: String,
    pub lm_studio_base_url: String,
    pub lm_studio_model: String,
    #[serde(default = "default_theme_id")]
    pub theme_id: String,
    #[serde(default = "default_editor_font")]
    pub editor_font: String,
    pub editor_font_size: u16,
    pub editor_line_width: u16,
    #[serde(default = "default_true")]
    pub ignore_hidden: bool,
    #[serde(default = "default_true")]
    pub ignore_large_files: bool,
    #[serde(default = "default_true")]
    pub ignore_binary_files: bool,
    #[serde(default)]
    pub project_env_enabled: bool,
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<Option<Settings>, String> {
    let path = settings_path(&app)?;

    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|err| format!("Could not parse settings.json: {err}"))
}

#[tauri::command]
pub fn load_project_env(root_path: String) -> Result<Option<String>, String> {
    let root = canonical_root(Path::new(&root_path))?;
    let env_path = root.join(".scriptorium.env");

    if !env_path.exists() {
        return Ok(None);
    }

    let target = env_path.canonicalize().map_err(|err| err.to_string())?;
    if !target.starts_with(&root) {
        return Err(".scriptorium.env path is outside project root".to_string());
    }

    fs::read_to_string(target)
        .map(Some)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let text = serde_json::to_string_pretty(&settings).map_err(|err| err.to_string())?;
    let temp_path = path.with_extension("json.tmp");

    fs::write(&temp_path, text).map_err(|err| err.to_string())?;
    fs::rename(temp_path, path).map_err(|err| err.to_string())
}

fn settings_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(dir.join("settings.json"))
}

fn canonical_root(root: &Path) -> Result<std::path::PathBuf, String> {
    let root = root.canonicalize().map_err(|err| err.to_string())?;
    if root.is_dir() {
        Ok(root)
    } else {
        Err("project root is not a directory".to_string())
    }
}

fn default_true() -> bool {
    true
}

fn default_openai_model() -> String {
    "gpt-5.5".to_string()
}

fn default_anthropic_model() -> String {
    "sonnet".to_string()
}

fn default_effort() -> String {
    "medium".to_string()
}

fn default_theme_id() -> String {
    "paper".to_string()
}

fn default_editor_font() -> String {
    "literary".to_string()
}
