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

/// Versión del frontend que lleva incrustado este binario.
///
/// Tauri 2 incrusta el frontend como *blobs* dentro del binario, en
/// tiempo de compilación. Para saber con certeza **qué** frontend lleva
/// una build (y que no sea el anterior), `build.rs` calcula el hash
/// SHA-256 del contenido copiado a `dist/` y lo emite como
/// `cargo:rustc-env=FRONTEND_HASH=<hash>`.
///
/// Ojo con el papel del hash: **no** es lo que incrusta los assets (eso
/// lo hace `generate_context!`) ni lo que obliga a recompilar. Lo que
/// obliga a recompilar son el `cargo:rerun-if-changed` por fichero que
/// emite el build script y el `include!` del fichero generado. El
/// hash sirve para **saber** qué frontend lleva esta build.
///
/// La lista de assets copiados (con su ruta) va en un fichero
/// generado (`OUT_DIR/frontend_version.rs`) que este módulo incluye:
/// con ella, el hash se puede recalcular desde el contenido de
/// `dist/` y comparar con el incrustado.
pub mod frontend_version {
    include!(concat!(env!("OUT_DIR"), "/frontend_version.rs"));
}

/// Hash SHA-256 del frontend incrustado en este binario.
///
/// Se lee con `env!("FRONTEND_HASH")` (no con el `include!` de
/// `frontend_version`) porque el valor tiene que llegar al binario tal
/// cual: `AppInfo` lo expone al frontend (se ve en «Acerca de»), así
/// que el enlazador no lo elimina y se puede leer con `grep -a` para
/// comprobar que una build lleva el frontend que se acaba de tocar,
/// sin tener que descompilarlo.
pub const FRONTEND_HASH: &str = env!("FRONTEND_HASH");

/// El hash con una marca delante y en un solo literal: tools/test.sh lo
/// busca en el binario sin depender de cómo coloque el enlazador cada
/// texto.
///
/// El hash solo (`FRONTEND_HASH`) y el nombre del producto son cadenas
/// sueltas: el enlazador puede colocarlas donde quiera (y separarlas),
/// así que no se puede buscar "el hash pegado al nombre". Con la marca
/// delante, el hash va en un literal único y contiguo, y se puede
/// encontrar en el binario con `grep -a`.
pub const FRONTEND_HASH_MARCADO: &str = concat!("PLANNER_FRONTEND_HASH=", env!("FRONTEND_HASH"));

/// Rutas (relativas a `dist/`) de los assets que se copiaron al
/// frontend incrustado, en el mismo orden en que se calculó el hash.
///
/// Con esta lista y el contenido de `dist/` se puede **recalcular** el
/// hash y compararlo con `FRONTEND_HASH`: eso es lo que hacen las
/// pruebas de este módulo. Sin la lista, el hash sería un valor que
/// nadie puede verificar.
pub const FRONTEND_ASSETS: &[&str] = frontend_version::FRONTEND_ASSETS;

/// Comprueba que el hash del frontend incrustado corresponde **al
/// contenido que hay ahora mismo en `dist/`**.
///
/// Esta es la comprobación de verdad: recalcula el hash con la misma
/// fórmula que usa `build.rs` (SHA-256 de la ruta de cada asset, un
/// byte nulo, su contenido y otro byte nulo, en el orden de
/// `FRONTEND_ASSETS`) y lo compara con el hash incrustado en el binario.
///
/// Si no coinciden, el binario lleva un frontend que ya no es el que se
/// copió: algo se ha quedado viejo y el binario no se puede publicar.
///
/// Lo comprueba `cargo test`, no la app en marcha: la app ya tiene
/// incrustado su frontend, así que no puede "recalcular" nada en
/// runtime. La comprobación de que el binario **recompilado** lleva el
/// frontend nuevo la hace `tools/test.sh` (`check_frontend_embebido`):
/// compila, toca un `.js`, recompila, mira el blob incrustado y
/// comprueba que el hash incrustado ha cambiado.
#[cfg(test)]
mod tests {
    use super::{FRONTEND_ASSETS, FRONTEND_HASH};

    /// Recalcula el hash del frontend a partir de `dist/`.
    ///
    /// La fórmula es la misma que la de `build.rs`: por cada asset, su
    /// ruta (con `/` como separador), un byte nulo, su contenido y otro
    /// byte nulo.
    fn recalcular_hash(dist: &std::path::Path) -> String {
        use sha2::Digest;
        let mut hash = sha2::Sha256::new();
        for asset in FRONTEND_ASSETS {
            let ruta = dist.join(asset);
            let contenido = std::fs::read(&ruta).unwrap_or_else(|e| {
                panic!("no se pudo leer {}: {e}", ruta.display());
            });
            hash.update(asset.as_bytes());
            hash.update([0]);
            hash.update(contenido);
            hash.update([0]);
        }
        hash.finalize().iter().map(|b| format!("{b:02x}")).collect()
    }

    /// La carpeta `dist/`: la copia del frontend que se incrusta.
    fn dist() -> std::path::PathBuf {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir.join("..").join("dist")
    }

    #[test]
    fn el_hash_del_frontend_es_un_sha256_en_hexadecimal() {
        assert_eq!(
            FRONTEND_HASH.len(),
            64,
            "el hash del frontend tiene que ser un SHA-256 en hexadecimal: \
             {FRONTEND_HASH}"
        );
        assert!(
            FRONTEND_HASH.chars().all(|c| c.is_ascii_hexdigit()),
            "el hash del frontend solo puede tener dígitos y letras hexadecimales: \
             {FRONTEND_HASH}"
        );
    }

    #[test]
    fn el_hash_del_frontend_no_es_vacio() {
        assert!(
            !FRONTEND_HASH.is_empty(),
            "el hash del frontend no puede estar vacío: eso significaría que \
             el frontend no se copió a dist/"
        );
    }

    #[test]
    fn hay_assets_del_frontend_que_verificar() {
        // Si la lista de assets fuera vacía, el hash valdría siempre lo
        // mismo y las pruebas de abajo no comprobarían nada.
        assert!(
            !FRONTEND_ASSETS.is_empty(),
            "la lista de assets del frontend no puede estar vacía: el hash \
             se calcularía sobre nada"
        );
    }

    #[test]
    fn el_hash_incrustado_es_el_del_contenido_de_dist() {
        // La comprobación de verdad: el hash que lleva el binario tiene
        // que ser el del contenido que hay ahora en `dist/`. Si el
        // frontend cambiara después de la última compilación, los dos
        // valores no coincidirían y el binario no sería publicable.
        let esperado = recalcular_hash(&dist());
        assert_eq!(
            FRONTEND_HASH, esperado,
            "el hash incrustado ({FRONTEND_HASH}) no es el del contenido de \
             dist/ ({esperado}): el binario lleva un frontend que ya no es \
             el que se copió"
        );
    }
}

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
    /// Hash SHA-256 del frontend incrustado en este binario.
    ///
    /// Va aquí para que el hash **se use** de verdad (y no lo elimine
    /// el enlazador): el frontend lo muestra en «Acerca de» y así se
    /// puede comprobar qué frontend lleva una build (T-040).
    pub frontend_hash: &'static str,
}

/// Devuelve información estática sobre la app (útil para "Acerca de").
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        product_name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
        identifier: env!("CARGO_PKG_NAME"),
        frontend_hash: &FRONTEND_HASH_MARCADO["PLANNER_FRONTEND_HASH=".len()..],
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
                mcp::mcp_token,
                mcp::mcp_token_regenerate,
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
