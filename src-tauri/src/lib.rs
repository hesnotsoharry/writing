mod byok;
mod byok_engine;
mod byok_local;
mod byok_openai;
mod grammar;
mod license;
pub mod local_endpoint;
mod sync_key;

use tauri::Manager;

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

/// Copy the live SQLite database (the entire app state — every manuscript,
/// scene, snapshot, story-bible entity, goal, and quick note lives in this one
/// file) to a user-chosen destination. The source resolves to the same
/// app-config dir that `tauri-plugin-sql` opens `sqlite:writing.db` from, so it
/// always points at the active library. Backs the Settings ▸ Backup "Back up now"
/// button. Local-only by design — there is no cloud component.
#[tauri::command]
fn finalize_backup(tmp_path: &str, dest_path: &str) -> Result<(), String> {
    // The frontend writes the snapshot to `<dest>.partial` via `VACUUM INTO`
    // (transactionally consistent, WAL-safe — the old raw fs::copy of the live
    // db raced concurrent writes into a torn backup, audit P8.3). This swaps
    // the completed snapshot into place, replacing any prior backup file.
    if std::path::Path::new(dest_path).exists() {
        std::fs::remove_file(dest_path).map_err(|e| e.to_string())?;
    }
    std::fs::rename(tmp_path, dest_path).map_err(|e| e.to_string())
}

/// Write exported manuscript/chapter/scene bytes to a user-chosen path. The
/// bytes are produced by the export formatters (markdown text, or docx/pdf
/// binary). Goes through an explicit Rust command so arbitrary-path writes never
/// require widening the `fs` plugin scope. Backs the Export overlay's save path.
#[tauri::command]
fn write_export_file(path: &str, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(())
}

/// Resolve a Tauri window's raw Win32 HWND. Used by the DWM chrome calls below.
#[cfg(windows)]
fn window_hwnd(window: &tauri::WebviewWindow) -> Option<windows::Win32::Foundation::HWND> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows::Win32::Foundation::HWND;

    let handle = window.window_handle().ok()?;
    let RawWindowHandle::Win32(h) = handle.as_raw() else {
        return None;
    };
    Some(HWND(h.hwnd.get() as *mut core::ffi::c_void))
}

/// Opt the frameless main window into Windows 11's native DWM corner rounding.
/// A `decorations: false` window is NOT auto-rounded by the OS, so we set
/// `DWMWA_WINDOW_CORNER_PREFERENCE = DWMWCP_ROUND` on its HWND at startup. This is
/// compositor-level rounding (no `transparent: true`, so none of WebView2's buggy
/// alpha-blending) — Windows squares the corners automatically while maximized/snapped.
#[cfg(windows)]
fn apply_window_rounding(window: &tauri::WebviewWindow) {
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
    };

    let Some(hwnd) = window_hwnd(window) else {
        return;
    };
    let preference = DWMWCP_ROUND;
    // SAFETY: `hwnd` is the live main-window handle; `preference` outlives the call.
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &preference as *const _ as *const core::ffi::c_void,
            std::mem::size_of_val(&preference) as u32,
        );
    }
}

/// Set the Win11 DWM window border color. `color` is a COLORREF in `0x00BBGGRR`
/// byte order (NOT web `#RRGGBB`). The frontend calls this on mount + theme change
/// so the thin OS border matches the active theme instead of the cold default
/// near-white system line. No-op (compiles, does nothing) off Windows.
#[tauri::command]
fn set_border_color(window: tauri::WebviewWindow, color: u32) {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::COLORREF;
        use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_BORDER_COLOR};

        let Some(hwnd) = window_hwnd(&window) else {
            return;
        };
        let colorref = COLORREF(color);
        // SAFETY: `hwnd` is the live window handle; `colorref` outlives the call.
        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &colorref as *const _ as *const core::ffi::c_void,
                std::mem::size_of_val(&colorref) as u32,
            );
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, color);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Debug-only: expose the WebView2 DevTools (CDP) endpoint on 127.0.0.1:9222 so a
    // chrome-devtools MCP can attach and drive/inspect the app for UI smoke. Gated on
    // debug_assertions (false in release builds), so the port never ships to users.
    // Set before the builder so it's in place before WebView2 creates its environment.
    // WRITING_CDP_PORT overrides the default so two dev instances can run side by side
    // (device-sync gates need a second peer; without it the second instance loses the
    // race for 9222 and comes up with no CDP endpoint at all).
    #[cfg(debug_assertions)]
    {
        let port = std::env::var("WRITING_CDP_PORT").unwrap_or_else(|_| "9222".to_string());
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            format!("--remote-debugging-port={port}"),
        );
    }

    tauri::Builder::default()
        // ONE setup closure only: Builder::setup REPLACES a prior setup, it
        // does not chain — a second call silently dropped window rounding
        // (audit P8.5), and would drop keyring init if reordered.
        .setup(|app| {
            #[cfg(windows)]
            if let Some(win) = app.get_webview_window("main") {
                apply_window_rounding(&win);
            }
            #[cfg(not(windows))]
            let _ = &app;
            // keyring v4 requires use_native_store() before any Entry operations;
            // without it there is no active store and keys won't persist across restarts.
            // Log and continue on failure — the app still runs, BYOK just won't work.
            if let Err(_e) = keyring::use_native_store(false) {
                eprintln!("[byok] keyring native store init failed — BYOK keys will not persist");
            }
            Ok(())
        })
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        // BYOK cancellation map — keyed by stream_id, holds oneshot senders.
        .manage(byok::ByokCancel::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            grammar::lint_text,
            open_path,
            finalize_backup,
            write_export_file,
            set_border_color,
            license::activate_license,
            license::device_name,
            byok::byok_set_key,
            byok::byok_has_key,
            byok::byok_clear_key,
            byok::byok_chat,
            byok::byok_stop,
            local_endpoint::validate_endpoint,
            local_endpoint::discover_models,
            local_endpoint::local_endpoint_set_key,
            local_endpoint::local_endpoint_has_key,
            local_endpoint::local_endpoint_clear_key,
            byok_openai::byok_openai_set_key,
            byok_openai::byok_openai_has_key,
            byok_openai::byok_openai_clear_key,
            byok_openai::byok_openai_chat,
            byok_openai::byok_openai_stop,
            byok_local::byok_local_chat,
            byok_local::byok_local_stop,
            sync_key::sync_set_master_key,
            sync_key::sync_get_master_key,
            sync_key::sync_has_master_key,
            sync_key::sync_clear_master_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
