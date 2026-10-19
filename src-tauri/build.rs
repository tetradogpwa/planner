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
    embed_ads_env();
    copy_web_assets();
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

fn embed_ads_env() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let env_path = manifest_dir.join("../.env");
    println!("cargo:rerun-if-changed={}", env_path.display());

    let from_file: HashMap<String, String> = dotenvy::from_path_iter(&env_path)
        .map(|iter| iter.flatten().collect())
        .unwrap_or_default();

    for key in AD_VARS {
        println!("cargo:rerun-if-env-changed={key}");
        let value = std::env::var(key)
            .ok()
            .or_else(|| from_file.get(*key).cloned())
            .unwrap_or_default();
        println!("cargo:rustc-env={key}={}", value.trim());
    }
}
