#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use dossier_core::{Inputs, Plan, Summary};
use std::{path::Path, sync::Mutex};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn preview(inputs: Inputs) -> Result<Plan, String> {
    dossier_core::plan(&inputs)
}

#[tauri::command]
async fn choose_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choose where Dossier creates your semester folder")
            .blocking_pick_folder()
            .map(|p| {
                p.into_path()
                    .map(|p| p.display().to_string())
                    .map_err(|e| e.to_string())
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn generate(
    inputs: Inputs,
    output: String,
    state: tauri::State<'_, Mutex<bool>>,
) -> Result<Summary, String> {
    {
        let mut busy = state.lock().map_err(|e| e.to_string())?;
        if *busy {
            return Err("A generation is already running.".into());
        }
        *busy = true;
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        dossier_core::generate(&inputs, Path::new(&output))
    })
    .await
    .map_err(|e| e.to_string());
    *state.lock().map_err(|e| e.to_string())? = false;
    result
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if !args.is_empty() {
        #[cfg(windows)]
        unsafe {
            windows_sys::Win32::System::Console::AttachConsole(
                windows_sys::Win32::System::Console::ATTACH_PARENT_PROCESS,
            );
        }
        std::process::exit(dossier_core::cli(args));
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(false))
        .invoke_handler(tauri::generate_handler![preview, choose_folder, generate])
        .run(tauri::generate_context!())
        .expect("Dossier could not start its desktop window");
}
