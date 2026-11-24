// ────────────────────────────────────────────────────────────────────
// Arnés de pruebas para la copia del frontend (T-040).
//
// Ejecuta **el mismo código** que compila la app: el módulo
// `src-tauri/frontend_copy.rs` (el que usa `src-tauri/build.rs`).
//
// ¿Por qué existe? `build.rs` no se puede ejecutar a mano tal cual:
// al final llama a `tauri_build::build()`, que exige el entorno
// completo de `cargo tauri` (variables `TAURI_ENV_*`, `TARGET`,
// `DEP_TAURI_DEV`, un `tauri.conf.json` válido, los iconos…) y hace
// `panic` si falta cualquiera de ellos. Para poder comprobar el
// mecanismo del hash contra un repositorio de mentira (sin tocar el
// repo real), aquí se ejecuta **solo** la parte que se quiere probar.
//
// Uso:
//
//   frontend-harness <RAÍZ_DEL_REPO> <DIRECTORIO_DE_SALIDA>
//
// `RAÍZ_DEL_REPO` es la raíz del repositorio (donde están `index.js`,
// `ui/`, `back/`…); el harness copia ese frontend a la carpeta de
// salida del frontend (la que usa la app) y escribe en
// `DIRECTORIO_DE_SALIDA`:
//
//   * `frontend_hash.txt`: el hash SHA-256 del contenido copiado.
//   * `frontend_assets.txt`: las rutas (relativas a la carpeta de
//     salida) de los assets copiados, una por línea.
//
// La lista de assets la decide `WEB_ASSETS`, que está en `build.rs`:
//   se leen de ahí para que la prueba use la MISMA lista que la app.
// ────────────────────────────────────────────────────────────────────

use std::path::{Path, PathBuf};

// El código real de la app: este `include!` mete aquí el módulo
// `frontend_copy` tal cual está en `src-tauri/`.
#[path = "../../../../src-tauri/frontend_copy.rs"]
mod frontend_copy;

/// La lista de assets que copia la app.
///
/// Se lee de `src-tauri/build.rs` para que no haya dos listas que se
/// puedan desincronizar: si alguien añade un asset a `WEB_ASSETS`, la
/// prueba lo copia también.
fn web_assets() -> Vec<String> {
    let build_rs = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../src-tauri/build.rs");
    let texto = std::fs::read_to_string(&build_rs)
        .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", build_rs.display()));

    // La constante se declara así en build.rs:
    //
    //     const WEB_ASSETS: &[&str] = &[
    //         "index.html",
    //         ...
    //     ];
    let inicio = texto
        .find("const WEB_ASSETS")
        .unwrap_or_else(|| panic!("no se encontró WEB_ASSETS en {}", build_rs.display()));
    let resto = &texto[inicio..];
    let fin = resto
        .find("];")
        .unwrap_or_else(|| panic!("WEB_ASSETS no termina con '];' en {}", build_rs.display()));
    let bloque = &resto[..fin];

    let assets: Vec<String> = bloque
        .lines()
        .filter_map(|linea| {
            let linea = linea.trim();
            if !linea.starts_with('"') {
                return None;
            }
            Some(linea.trim_matches(|c| c == '"' || c == ',').to_string())
        })
        .collect();

    assert!(
        !assets.is_empty(),
        "WEB_ASSETS está vacía: la prueba no copiaría nada"
    );
    assets
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("uso: frontend-harness <RAÍZ_DEL_REPO> <DIRECTORIO_DE_SALIDA>");
        std::process::exit(2);
    }
    let raiz = PathBuf::from(&args[1]);
    let salida = PathBuf::from(&args[2]);
    std::fs::create_dir_all(&salida)
        .unwrap_or_else(|e| panic!("no se pudo crear {}: {e}", salida.display()));

    // `copy_web_assets` lee `CARGO_MANIFEST_DIR` y busca la raíz en
    // `..`: se le da un `CARGO_MANIFEST_DIR` que apunte a
    // `<RAÍZ>/src-tauri` para que la raíz sea exactamente la que se
    // le pasa.
    std::env::set_var("CARGO_MANIFEST_DIR", raiz.join("src-tauri"));
    std::env::set_var("OUT_DIR", &salida);

    let assets = web_assets();
    let referencias: Vec<&str> = assets.iter().map(String::as_str).collect();

    let (hash, copiados) = frontend_copy::copy_web_assets(&referencias);
    frontend_copy::write_frontend_version(&copiados);

    // Salida: el hash y la lista de assets, para que la prueba los
    // pueda leer sin analizar el log.
    std::fs::write(salida.join("frontend_hash.txt"), format!("{hash}\n"))
        .unwrap_or_else(|e| panic!("no se pudo escribir el hash: {e}"));
    std::fs::write(salida.join("frontend_assets.txt"), format!("{}\n", copiados.join("\n")))
        .unwrap_or_else(|e| panic!("no se pudo escribir la lista de assets: {e}"));

    println!("{hash}");
}

/// Raíz del repositorio, para el log.
#[allow(dead_code)]
fn raiz(_p: &Path) {}
