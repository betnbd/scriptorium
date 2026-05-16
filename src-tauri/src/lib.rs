mod commands;
mod model;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::agent_cli::check_cli_agent_status,
            commands::agent_cli::send_cli_agent_request,
            commands::agent_cli::start_cli_agent_login,
            commands::lm_studio::send_lm_studio_request,
            commands::settings::load_settings,
            commands::settings::load_project_env,
            commands::settings::save_settings,
            commands::workspace::read_project_tree,
            commands::workspace::read_markdown_file,
            commands::workspace::write_markdown_file,
            commands::workspace::create_file,
            commands::workspace::create_folder,
            commands::workspace::rename_entry,
            commands::workspace::delete_entry,
            commands::workspace::move_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
