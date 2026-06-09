mod grammar;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Open a file or directory path in the system's default application
/// (Finder/Explorer). Consumed by Lane 21's "Reveal in folder" button.
#[tauri::command]
fn open_path(_app: tauri::AppHandle, path: &str) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Debug-only: expose the WebView2 DevTools (CDP) endpoint on 127.0.0.1:9222 so a
    // chrome-devtools MCP can attach and drive/inspect the app for UI smoke. Gated on
    // debug_assertions (false in release builds), so the port never ships to users.
    // Set before the builder so it's in place before WebView2 creates its environment.
    #[cfg(debug_assertions)]
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--remote-debugging-port=9222",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            grammar::lint_text,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
