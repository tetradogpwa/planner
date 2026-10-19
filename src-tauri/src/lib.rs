//! Planificador Semana — capa nativa de Tauri.
//!
//! Esta capa se encarga de:
//!  - Exponer al frontend la configuración de anuncios de la plataforma
//!    actual (ver `ads.rs`; los valores vienen de `.env` en compilación).
//!  - Exponer comandos seguros al frontend (webview) para abrir enlaces,
//!    mostrar información de compilación, etc.
//!  - Definir la app de Tauri 2 (ventanas, plugins, comandos).
//!
//! Por defecto la app **no muestra anuncios**. Para activarlos, define
//! en `.env` (o como variables de entorno del CI) las claves de
//! AdSense (escritorio) y/o AdMob (Android) y recompila. Ver `.env.example`.

mod ads;

use serde::Serialize;
use std::sync::OnceLock;

static ADS_CONFIG: OnceLock<ads::AdsConfig> = OnceLock::new();

// ── Comandos expuestos al frontend ───────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    pub product_name: &'static str,
    pub version: &'static str,
    pub identifier: &'static str,
}

/// Devuelve información estática sobre la app (útil para "Acerca de").
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        product_name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
        identifier: env!("CARGO_PKG_NAME"),
    }
}

/// Devuelve la configuración de anuncios de esta plataforma.
///
/// Si `provider` es `"none"`, el frontend **no muestra anuncios**,
/// independientemente del consentimiento o de `adsRemoved`.
#[tauri::command]
fn get_ads_config() -> &'static ads::AdsConfig {
    ADS_CONFIG.get_or_init(ads::current)
}

/// Cierra la app. Lo usa la pantalla de términos cuando el usuario
/// no los acepta.
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    // En Android `AppHandle::exit` no termina la actividad de forma
    // fiable; matamos el proceso directamente.
    #[cfg(mobile)]
    {
        let _ = app;
        std::process::exit(0);
    }
    #[cfg(desktop)]
    app.exit(0);
}

/// Construye y lanza la aplicación de Tauri.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // En escritorio sus comandos devuelven error; solo actúa en Android.
        .plugin(tauri_plugin_admob::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_ads_config,
            exit_app,
        ])
        .setup(|_app| {
            // En Windows/MSIX, fija el título correctamente en el
            // primer paint. (Tauri ya lo hace, pero dejamos el hook
            // libre para futuras personalizaciones.)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Planificador Semanal");
}
