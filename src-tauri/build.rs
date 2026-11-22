use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Variables de anuncios que se incrustan en el binario en tiempo de
/// compilación. Se leen después en `src/ads.rs` desde el fichero que
/// genera este script (`OUT_DIR/ads_env.rs`).
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

/// Subconjunto de `AD_VARS` que identifica a un proveedor de anuncios.
/// Si ninguna de ellas tiene valor, la build no puede monetizar: no es
/// una build publicable sin avisar (ver `check_ads`).
const AD_KEYS: &[&str] = &[
    "GOOGLE_ADSENSE_CLIENT",
    "GOOGLE_ADSENSE_SLOT",
    "GOOGLE_ADMOB_APP_ID",
    "GOOGLE_ADMOB_BANNER_ID",
    "GOOGLE_ADMOB_INTERSTITIAL_ID",
];

/// Variable de entorno que permite compilar **sin** claves de anuncios.
///
/// Sin ella, una build sin claves es un error: no se publica una app
/// sin monetizar y sin ningún aviso (y en Android, sin llevar el App ID
/// de prueba de Google). La ponen las builds internas a propósito: la
/// versión de pago, las pruebas (`tools/test.sh`) y los builds de
/// desarrollo sin anuncios.
const ALLOW_NO_ADS: &str = "ALLOW_NO_ADS";

/// Prefijo del publicizador de prueba de Google (AdMob). Un App ID o
/// una unidad de anuncio que empiece por él es de prueba y no puede ir
/// en un APK publicable.
const ADMOB_TEST_PUBLISHER: &str = "ca-app-pub-3940256099942544";

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

/// Resuelve las claves de anuncios y las deja escritas para el crate.
///
/// Los **valores no se imprimen nunca**: ni en el log de cargo (que con
/// `cargo build -vv` enseña todo lo que escribe el build script) ni en
/// la línea de comandos de rustc. Van en un fichero generado
/// (`OUT_DIR/ads_env.rs`) que `src/ads.rs` incluye.
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
        resolved.insert((*key).to_string(), value.trim().to_string());
    }

    // El permiso para compilar sin anuncios se busca en el entorno y,
    // si no está, en `.env` (así también funciona cuando el build lo
    // hace `tools/build.sh`, que carga `.env` en el entorno).
    println!("cargo:rerun-if-env-changed={ALLOW_NO_ADS}");
    let allow_no_ads = flag_activado(
        &std::env::var(ALLOW_NO_ADS)
            .ok()
            .or_else(|| from_file.get(ALLOW_NO_ADS).cloned())
            .unwrap_or_default(),
    );

    // La comprobación va ANTES de tocar nada: si esta build no puede
    // publicarse, que falle ya y no cuando sea tarde.
    check_ads(&resolved, &env_path, allow_no_ads);

    write_ads_env(&resolved);

    // El log dice el NOMBRE de cada variable y si está definida, nunca
    // su valor.
    for key in AD_VARS {
        let estado = if resolved[*key].is_empty() {
            "vacía"
        } else {
            "definida"
        };
        println!("ads: {key} {estado}");
    }

    resolved
}

/// Escribe las claves resueltas en un fichero que el crate incluye.
///
/// `cargo:rustc-env=CLAVE=valor` no sirve aquí: cargo enseña esa línea
/// en el log con `cargo build -vv` y también muestra la variable en la
/// línea de comandos de rustc. El fichero generado es la única forma
/// de que el valor llegue al crate sin pasar por el log.
fn write_ads_env(resolved: &HashMap<String, String>) {
    let out_dir = PathBuf::from(
        std::env::var("OUT_DIR").expect("OUT_DIR no está definido (cargo siempre lo pasa)"),
    );
    let path = out_dir.join("ads_env.rs");

    let mut texto = String::from(
        "// Generado por src-tauri/build.rs. NO EDITAR.\n\
         // Claves de anuncios incrustadas en el binario.\n",
    );
    for key in AD_VARS {
        let valor = resolved.get(*key).map(String::as_str).unwrap_or("");
        texto.push_str(&format!(
            "#[allow(dead_code)]\npub const {key}: &str = {valor:?};\n"
        ));
    }

    std::fs::write(&path, texto)
        .unwrap_or_else(|e| panic!("no se pudo escribir {}: {e}", path.display()));
}

/// Comprueba que esta build puede publicarse.
///
/// O tiene claves de anuncios, o el permiso explícito `ALLOW_NO_ADS=1`.
/// Sin las dos cosas, la build falla: no sale una app sin monetizar y
/// sin ningún aviso (ni un APK con el App ID de prueba de Google).
fn check_ads(resolved: &HashMap<String, String>, env_path: &Path, allow_no_ads: bool) {
    if allow_no_ads {
        println!(
            "cargo:warning={ALLOW_NO_ADS}=1: esta build se compila SIN claves de \
             anuncios (en Android usará el App ID de prueba de Google)."
        );
        return;
    }

    // El guard se aplica a las builds que se publican: perfil release
    // o Android. En desarrollo (`cargo check`, `cargo build --debug` y
    // el binario de pruebas de los E2E) solo avisa: si no, el flujo de
    // trabajo se rompería en un clon limpio, donde no hay `.env` (y
    // `cargo check` está en la lista de comprobaciones del proyecto).
    let profile = std::env::var("PROFILE").unwrap_or_default();
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    // Sin PROFILE (el build script ejecutado a mano, como hace la
    // comprobacion de tools/test.sh) se asume que es una build de
    // publicacion: es el caso que hay que vigilar.
    let es_publicacion =
        profile.is_empty() || profile == "release" || target_os == "android";
    if !es_publicacion {
        println!(
            "cargo:warning=Build de depuracion (perfil \"{profile}\"): no se exigen \
             claves de anuncios. Las builds de publicacion (perfil release) y las de \
             Android si las exigen: pon las claves o {ALLOW_NO_ADS}=1."
        );
        return;
    }

    let hay_claves = AD_KEYS.iter().any(|key| !resolved[*key].is_empty());
    if !hay_claves {
        panic!("{}", mensaje_sin_claves(env_path));
    }

    if target_os == "android" {
        check_admob_android(resolved);
    } else if resolved["GOOGLE_ADSENSE_CLIENT"].is_empty() {
        // Aviso, no error: se puede publicar sin anuncios a propósito
        // (la versión de pago), pero nunca en silencio.
        println!(
            "cargo:warning=Esta build no lleva GOOGLE_ADSENSE_CLIENT: en escritorio el \
             proveedor de anuncios será \"none\". Si es a propósito, pon \
             {ALLOW_NO_ADS}=1 para que quede explícito."
        );
    }
}

/// En Android el App ID de AdMob no es opcional: sin él el SDK de
/// AdMob cierra la app al arrancar, y por eso el plugin usaba el App ID
/// de prueba de Google. Eso convertía un APK publicable en una build
/// con anuncios de prueba, sin avisar.
fn check_admob_android(resolved: &HashMap<String, String>) {
    let app_id = &resolved["GOOGLE_ADMOB_APP_ID"];
    if app_id.is_empty() {
        panic!("{}", MENSAJE_ANDROID_SIN_APP_ID);
    }
    if app_id.starts_with(ADMOB_TEST_PUBLISHER) {
        panic!("{}", MENSAJE_ANDROID_APP_ID_DE_TEST);
    }

    for key in ["GOOGLE_ADMOB_BANNER_ID", "GOOGLE_ADMOB_INTERSTITIAL_ID"] {
        let valor = &resolved[key];
        if valor.starts_with(ADMOB_TEST_PUBLISHER) {
            panic!(
                "{}",
                MENSAJE_ANDROID_UNIDAD_DE_TEST.replace("{key}", key)
            );
        }
        if valor.is_empty() {
            println!(
                "cargo:warning=GOOGLE_ADMOB_APP_ID está, pero {key} está vacía: en una \
                 build de release no se mostrará ese anuncio."
            );
        }
    }
}

/// ¿La variable está activada? Acepta `1`, `true` y `yes` (sin
/// distinguir mayúsculas), que es lo habitual.
fn flag_activado(valor: &str) -> bool {
    matches!(
        valor.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "si"
    )
}

/// Error: la build no tiene claves de anuncios.
/// `{situacion}` dice si falta el `.env` o si está pero sin claves.
const MENSAJE_SIN_CLAVES: &str = r#"Esta compilación no tiene claves de anuncios y no se ha permitido compilar sin ellas.

{situacion}

Sin claves, la app se publicaría sin monetizar y sin ningún aviso; en Android, además, con el App ID de prueba de Google.

Cómo arreglarlo (elige una):
  1. Copia la plantilla y rellena las claves de tu plataforma:
       cp .env.example .env
     (AdSense es para escritorio; AdMob, para Android).
  2. Si las claves las inyecta el CI o tu shell, expórtalas antes de compilar:
       export GOOGLE_ADSENSE_CLIENT=ca-pub-... GOOGLE_ADSENSE_SLOT=...
       export GOOGLE_ADMOB_APP_ID=ca-app-pub-...~... GOOGLE_ADMOB_BANNER_ID=... GOOGLE_ADMOB_INTERSTITIAL_ID=...
  3. Si de verdad quieres una build SIN anuncios (versión de pago, pruebas o una build interna), pídelo explícitamente:
       ALLOW_NO_ADS=1 cargo tauri build
"#;

/// Mensaje de error: la build no tiene claves de anuncios.
fn mensaje_sin_claves(env_path: &Path) -> String {
    let situacion = if env_path.exists() {
        format!(
            "Hay un `.env` en {}, pero no tiene ninguna clave de anuncios.",
            env_path.display()
        )
    } else {
        format!("No hay ningún `.env` en {}.", env_path.display())
    };

    MENSAJE_SIN_CLAVES.replace("{situacion}", &situacion)
}

/// Error: build para Android sin App ID de AdMob.
const MENSAJE_ANDROID_SIN_APP_ID: &str = r#"Esta compilación para Android no tiene GOOGLE_ADMOB_APP_ID.

Sin un App ID real, el SDK de AdMob cierra la app al arrancar; y si se usa el App ID de prueba de Google (ca-app-pub-3940256099942544~3347511713), el APK publicado lleva anuncios de prueba.

Cómo arreglarlo (elige una):
  1. Pon el App ID real de AdMob en .env (cp .env.example .env) o expórtalo antes de compilar:
       export GOOGLE_ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
  2. Si es una build de pruebas (con anuncios de prueba de Google):
       ALLOW_NO_ADS=1 cargo tauri android build
"#;

/// Error: el App ID de AdMob es el de prueba de Google.
const MENSAJE_ANDROID_APP_ID_DE_TEST: &str = r#"GOOGLE_ADMOB_APP_ID es el App ID de prueba de Google (ca-app-pub-3940256099942544~...).

Un APK publicable no puede llevar anuncios de prueba: sus impresiones no valen y Google penaliza las apps que los muestran en producción.

Cómo arreglarlo (elige una):
  1. Pon el App ID real de AdMob en .env (cp .env.example .env) o expórtalo antes de compilar.
  2. Si es una build de pruebas:
       ALLOW_NO_ADS=1 cargo tauri android build
"#;

/// Error: una unidad de anuncio de AdMob es de prueba.
const MENSAJE_ANDROID_UNIDAD_DE_TEST: &str = r#"{key} es una unidad de anuncio de prueba de Google (ca-app-pub-3940256099942544/...).

Un APK publicable no puede llevar anuncios de prueba: sus impresiones no valen y Google penaliza las apps que los muestran en producción.

Cómo arreglarlo (elige una):
  1. Pon la unidad de anuncio real de AdMob en .env (cp .env.example .env).
  2. Si es una build de pruebas:
       ALLOW_NO_ADS=1 cargo tauri android build
"#;

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
    // por el WebView, así que en Android la CSP va siempre sin anuncios.
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
