use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Variables de anuncios que se incrustan en el binario en tiempo de
/// compilación. Se leen después en `src/ads.rs` con `option_env!`.
///
/// Prioridad: variable de entorno del proceso > `.env` de la raíz.
/// Así el CI puede inyectarlas como secrets sin tener `.env`.
const AD_VARS: &[&str] = &[
    "GOOGLE_ADSENSE_CLIENT",
    "GOOGLE_ADSENSE_SLOT",
    "GOOGLE_ADMOB_APP_ID",
    "GOOGLE_ADMOB_BANNER_ID",
    "GOOGLE_ADMOB_INTERSTITIAL_ID",
    "ADS_TEST_MODE",
    "ADS_REMOVED_DEFAULT",
    "PAID_VERSION_URL_DESKTOP",
    "PAID_VERSION_URL_ANDROID",
];

/// Archivo (junto a este `build.rs`) con las dos variantes de la
/// Content-Security-Policy: con anuncios y sin anuncios.
const CSP_FILE: &str = "csp.json";

/// Archivos y carpetas del frontend (relativos a la raíz del repo) que
/// se copian a `dist/`, que es el `frontendDist` de Tauri.
///
/// Tauri incrusta TODO lo que hay en `frontendDist`; si apuntase a la
/// raíz se colarían `.env`, `.git/` y `src-tauri/target/` en el binario.
/// Si añades un archivo nuevo al frontend en la raíz, añádelo aquí.
const WEB_ASSETS: &[&str] = &[
    "index.html",
    "index.js",
    "index.css",
    "context.js",
    "api.js",
    "mcp-bridge.js",
    "monetization.js",
    "theme-boot.js",
    "manifest.json",
    "sw.js",
    "icon-192x192.png",
    "icon-512x512.png",
    "ads",
    "back",
    "ui",
    "vendor",
    "legal",
];

fn main() {
    let ad_vars = embed_ads_env();
    copy_web_assets();
    inject_csp(&ad_vars);
    tauri_build::build()
}

fn copy_web_assets() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let root = manifest_dir.join("..");
    let dist = root.join("dist");

    let _ = std::fs::remove_dir_all(&dist);
    for asset in WEB_ASSETS {
        let src = root.join(asset);
        println!("cargo:rerun-if-changed={}", src.display());
        copy_recursive(&src, &dist.join(asset))
            .unwrap_or_else(|e| panic!("no se pudo copiar {asset} a dist/: {e}"));
    }
}

fn copy_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        }
    } else {
        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(src, dst)?;
    }
    Ok(())
}

fn embed_ads_env() -> HashMap<String, String> {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let env_path = manifest_dir.join("../.env");
    println!("cargo:rerun-if-changed={}", env_path.display());

    let from_file: HashMap<String, String> = dotenvy::from_path_iter(&env_path)
        .map(|iter| iter.flatten().collect())
        .unwrap_or_default();

    let mut resolved = HashMap::new();
    for key in AD_VARS {
        println!("cargo:rerun-if-env-changed={key}");
        let value = std::env::var(key)
            .ok()
            .or_else(|| from_file.get(*key).cloned())
            .unwrap_or_default();
        let value = value.trim().to_string();
        println!("cargo:rustc-env={key}={value}");
        resolved.insert((*key).to_string(), value);
    }
    resolved
}

// ── CSP condicional ─────────────────────────────────────────────────
//
// La CSP de `tauri.conf.json` es estática, pero Tauri permite
// sobrescribirla en tiempo de compilación con la variable de entorno
// `TAURI_CONFIG` (un JSON que se mezcla sobre la configuración leída).
//
// Aquí se usa para que **los hosts de Google (AdSense) solo estén
// permitidos si la build lleva anuncios**: una build sin claves de
// anuncios degrade a `provider: "none"` (ver `src/ads.rs`) y su WebView
// no necesita ni un solo host remoto; una build con AdSense sí los
// necesita para cargar el script de anuncios.
//
// El valor por defecto de `tauri.conf.json` es SIEMPRE la CSP sin
// anuncios (la segura). Esta función elige la variante y la inyecta.
//
// Detalle técnico: `tauri::generate_context!()` se expande dentro del
// proceso de `rustc`, así que `TAURI_CONFIG` tiene que llegar hasta
// ahí. `cargo:rustc-env` la pasa al entorno de `rustc`; además la
// fijamos en el entorno de este script para que `tauri_build` vea
// exactamente la misma configuración que el runtime.

/// Lee las dos variantes de la CSP de `csp.json`.
fn csp_variants() -> (String, String) {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let path = manifest_dir.join(CSP_FILE);
    println!("cargo:rerun-if-changed={}", path.display());

    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", path.display()));
    let value: serde_json::Value = serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("no se pudo parsear {}: {e}", path.display()));

    let get = |key: &str| -> String {
        value
            .get(key)
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| panic!("falta la clave \"{key}\" en {}", path.display()))
            .to_string()
    };
    (get("con_anuncios"), get("sin_anuncios"))
}

/// Elige la CSP de esta build y la inyecta en la configuración de Tauri.
fn inject_csp(ad_vars: &HashMap<String, String>) {
    let (con_anuncios, sin_anuncios) = csp_variants();

    // Solo los anuncios DENTRO del WebView (AdSense, escritorio) necesitan
    // los hosts de Google. Los de AdMob son nativos (Android) y no pasan
    // por la WebView, así que en Android la CSP va siempre sin anuncios.
    let hay_anuncios_web = !ad_vars
        .get("GOOGLE_ADSENSE_CLIENT")
        .map(|v| v.is_empty())
        .unwrap_or(true);

    let csp = if hay_anuncios_web {
        con_anuncios
    } else {
        sin_anuncios
    };

    let patch = serde_json::json!({ "app": { "security": { "csp": csp } } });
    let json = patch.to_string();

    // La macro `generate_context!()` se expande en el proceso de rustc.
    println!("cargo:rustc-env=TAURI_CONFIG={json}");
    // Y también en el de este script, para que `tauri_build` use la
    // misma configuración que el runtime.
    std::env::set_var("TAURI_CONFIG", &json);
}
