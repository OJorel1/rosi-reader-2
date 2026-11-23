use tauri::{Emitter, Manager};

// Busca páginas dos dicionários online. Feito no lado Rust para não esbarrar em CORS,
// e restrito a poucos sites conhecidos por segurança.
const ALLOWED: [&str; 7] = [
    "https://pt.wiktionary.org/",
    "https://en.wiktionary.org/",
    "https://es.wiktionary.org/",
    "https://fr.wiktionary.org/",
    "https://de.wiktionary.org/",
    "https://it.wiktionary.org/",
    "https://api.dicionario-aberto.net/",
];

#[tauri::command]
async fn http_get(url: String) -> Result<String, String> {
    if !ALLOWED.iter().any(|p| url.starts_with(*p)) {
        return Err("endereço não permitido".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("RosiReader/0.1 (leitor de livros)")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    res.text().await.map_err(|e| e.to_string())
}

// Arquivos passados na linha de comando (duplo clique num livro no Windows).
#[tauri::command]
fn launch_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|a| std::path::Path::new(a).is_file())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK costuma abrir a janela em branco com alguns drivers (principalmente NVIDIA).
    // Desligar o renderizador DMABUF evita isso; para reativar, defina WEBKIT_DISABLE_DMABUF_RENDERER=0.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    let mut builder = tauri::Builder::default();

    // Se o app já estiver aberto, o novo arquivo é enviado para a janela existente.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let _ = app.emit("open-files", args);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Em gerenciadores de janelas de tiling (Hyprland, sway, i3...) a barra de título do GTK é só ruído.
            #[cfg(target_os = "linux")]
            {
                let tiling = std::env::var("XDG_CURRENT_DESKTOP")
                    .map(|d| {
                        let d = d.to_lowercase();
                        ["hyprland", "sway", "i3", "niri", "river", "bspwm", "awesome", "dwm"]
                            .iter()
                            .any(|w| d.contains(w))
                    })
                    .unwrap_or(false);
                if tiling {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.set_decorations(false);
                    }
                }
            }
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![http_get, launch_files])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Rosi Reader");
}
