//! Planificador Semana — capa nativa de Tauri.
//!
//! Esta capa se encarga de:
//!  - Exponer al frontend la configuración de anuncios de la plataforma
//!    actual (ver `ads.rs`; los valores vienen de `.env` en compilación).
//!  - Exponer comandos seguros al frontend (webview) para abrir enlaces,
//!    mostrar información de compilación, etc.
//!  - Servir el servidor MCP local (Streamable HTTP) en escritorio
//!    cuando el usuario lo activa. Ver `mcp.rs`.
//!  - Definir la app de Tauri 2 (ventanas, plugins, comandos).
//!
//! Plugins que se registran: `shell` (abrir enlaces externos) y
//! `admob` (anuncios nativos de Android). **No** se registra `fs` ni
//! `dialog`: la app no los usa (la importación y la exportación de
//! tareas van con `Blob`/`FileReader` y el PDF con html2pdf), así que
//! concederlos sería darle acceso al disco del usuario sin necesidad.
//! La prueba `tests/unit/permisos.test.mjs` lo vigila.
//!
//! Por defecto la app **no muestra anuncios**. Para activarlos, define
//! en `.env` (o como variables de entorno del CI) las claves de
//! AdSense (escritorio) y/o AdMob (Android) y recompila. Ver `.env.example`.

mod ads;

// Servidor MCP local: solo se compila en escritorio. En Android/iOS
// el módulo ni se incluye y los comandos `mcp_start` / `mcp_stop` /
// `mcp_reply` no se registran.
#[cfg(desktop)]
mod mcp;

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

// ── Comandos del servidor MCP (solo escritorio) ──────────────────────

/// Arranca el servidor MCP en `127.0.0.1:port` con el token Bearer
/// que el frontend generó. Si ya estaba activo, solo actualiza token
/// y puerto.
#[cfg(desktop)]
#[tauri::command]
async fn mcp_start(
    app: tauri::AppHandle,
    port: u16,
    token: String,
) -> Result<(), String> {
    mcp::start(&app, port, token).await
}

/// Detiene el servidor MCP. Limpia token, puerto y la tarea.
#[cfg(desktop)]
#[tauri::command]
fn mcp_stop(app: tauri::AppHandle) {
    mcp::stop(&app);
}

/// Devuelve el estado actual del servidor: `active` y `port`.
#[cfg(desktop)]
#[tauri::command]
fn mcp_status(app: tauri::AppHandle) -> mcp::McpStatus {
    let (active, port) = mcp::status(&app);
    mcp::McpStatus { active, port }
}

/// Construye y lanza la aplicación de Tauri.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // En escritorio sus comandos devuelven error; solo actúa en Android.
        .plugin(tauri_plugin_admob::init());

    // Solo en escritorio registramos el estado MCP y los comandos del
    // servidor. En Android/iOS el módulo `mcp` no se compila.
    #[cfg(desktop)]
    {
        builder = builder
            .manage(mcp::McpState::default())
            .invoke_handler(tauri::generate_handler![
                get_app_info,
                get_ads_config,
                exit_app,
                mcp_start,
                mcp_stop,
                mcp_status,
                mcp::mcp_reply,
            ]);
    }
    #[cfg(not(desktop))]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            get_app_info,
            get_ads_config,
            exit_app,
        ]);
    }

    builder
        .setup(|_app| {
            // En Windows/MSIX, fija el título correctamente en el
            // primer paint. (Tauri ya lo hace, pero dejamos el hook
            // libre para futuras personalizaciones.)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Planificador Semanal");
}
