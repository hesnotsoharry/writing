mod grammar;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Open a file or directory path in the system's default application
/// (Finder/Explorer). Consumed by Lane 21's "Reveal in folder" button.
#[tauri::command]
fn open_path(app: tauri::AppHandle, path: &str) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![greet, grammar::lint_text, open_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
