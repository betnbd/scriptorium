mod commands;
mod model;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::workspace::read_project_tree,
            commands::workspace::read_markdown_file,
            commands::workspace::write_markdown_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
