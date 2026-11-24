// ────────────────────────────────────────────────────────────────────
// frontend_copy.rs
//
// La copia del frontend a `dist/` y el hash de lo que se copia.
//
// Vive en su propio fichero (y no dentro de `build.rs`) por dos
// razones:
//
//   1. `build.rs` lo usa como módulo (`mod frontend_copy;`), así que el
//      código que se compila para la app es **exactamente** el mismo
//      que ejecutan las pruebas.
//   2. Las pruebas unitarias (`tests/unit/build-frontend.test.mjs`)
//      lo compilan **solos** con `rustc` para comprobar, contra un
//      repositorio de mentira, que el hash cambia cuando cambia el
//      contenido del frontend. Si el código estuviera dentro de
//      `build.rs`, no se podría ejecutar sin arrastrar también a
//      `tauri_build::build()`, que exige el entorno completo de
//      `cargo tauri`.
//
// Este módulo solo necesita `sha2` y la biblioteca estándar: no
// depende de Tauri ni de nada del crate.
// ────────────────────────────────────────────────────────────────────

use std::path::{Path, PathBuf};

/// Variable de entorno que cambia el ORIGEN de la copia del frontend.
///
/// Por defecto, el frontend se copia de la raíz del repositorio (la
/// carpeta padre de `src-tauri/`). Esta variable la usa la comprobación
/// de `tools/test.sh` para copiar el frontend desde una COPIA (en un
/// directorio temporal): así la comprobación puede tocar un `.js` y
/// comprobar que el binario lleva el frontend nuevo sin modificar
/// ningún fichero del repo.
const ORIGEN_FRONTEND: &str = "PLANNER_FRONTEND_ORIGEN";

/// Hash del frontend copiado.
///
/// Se calcula sobre los **bytes copiados** (no sobre los de origen):
/// lo que se incrusta en el binario es lo que hay en `dist/`, así que
/// es eso lo que tiene que cambiar el hash.
pub struct Hash {
    interior: sha2::Sha256,
}

impl Hash {
    pub fn new() -> Self {
        use sha2::Digest;
        Self {
            interior: sha2::Sha256::new(),
        }
    }

    /// Añade un fichero al hash: su ruta (para que dos ficheros con el
    /// mismo contenido en sitios distintos den hashes distintos) y su
    /// contenido.
    pub fn añadir(&mut self, ruta: &Path, contenido: &[u8]) {
        use sha2::Digest;
        self.interior.update(ruta.to_string_lossy().as_bytes());
        self.interior.update([0]);
        self.interior.update(contenido);
        self.interior.update([0]);
    }

    /// El hash en hexadecimal.
    pub fn finalizar(self) -> String {
        use sha2::Digest;
        let bytes = self.interior.finalize();
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }
}

/// Copia el frontend a `dist/` y deja constancia de **qué** se copió.
///
/// Devuelve el hash SHA-256 del contenido copiado y la lista de assets
/// (sus rutas relativas a `dist/`, en el mismo orden en que se
/// hashearon).
///
/// El ORIGEN de la copia (de dónde se copia) se puede cambiar con
/// `PLANNER_FRONTEND_ORIGEN`; ver `origen_del_frontend`.
///
/// El problema que resuelve esto (T-040): Tauri 2 incrusta el frontend
/// como *blobs* dentro del binario, en tiempo de compilación (lo hace
/// la macro `tauri::generate_context!`, al expandirse en `rustc`). Si
/// el contenido de `dist/` cambia pero cargo no recompila el crate, el
/// binario se publica con el frontend anterior.
///
/// Lo que fuerza la recompilación es el `cargo:rerun-if-changed` que se
/// emite **por cada fichero** copiado: al tocar un `.js` dentro de
/// `ui/`, cargo vuelve a ejecutar el build script, y como el crate
/// incluye el fichero generado (`OUT_DIR/frontend_version.rs`), cargo
/// vuelve a compilarlo y `generate_context!` vuelve a incrustar los
/// assets.
///
/// El hash se emite además como `cargo:rustc-env=FRONTEND_HASH`, y el
/// crate lo lee con `env!("FRONTEND_HASH")`. Ojo: el valor de esa
/// directiva **no** va en el fingerprint del build script (cargo solo
/// guarda las rutas de `rerun-if-changed`), así que por sí sola no
/// obliga a recompilar. Lo que obliga es lo de arriba: la ruta
/// vigilada y el `include!` del fichero generado. El hash sirve para
/// **saber** qué frontend lleva una build (va en `AppInfo`, se ve en
/// «Acerca de»), no para forzar la recompilación.
pub fn copy_web_assets(web_assets: &[&str]) -> (String, Vec<String>) {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let root = origen_del_frontend(&manifest_dir);
    // La carpeta de salida es siempre la del repo (`dist/`): es el
    // `frontendDist` de Tauri y la tiene que leer la macro
    // `generate_context!` al compilar el crate.
    let dist = manifest_dir.join("..").join("dist");

    // El origen se puede cambiar: cargo tiene que volver a ejecutar
    // este script cuando cambie (si no, se copiaría el frontend
    // viejo).
    println!("cargo:rerun-if-env-changed={ORIGEN_FRONTEND}");

    // Si `dist/` no se puede borrar, el error se dice: si se ignora, los
    // ficheros viejos se quedan ahí y Tauri los incrusta igual, así que
    // el binario llevaría un frontend que ya no existe en el repo.
    match std::fs::remove_dir_all(&dist) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => panic!(
            "no se pudo borrar {}: {e}\n\
             Sin esto, los ficheros viejos se quedan en dist/ y Tauri los \
             incrusta en el binario: se publicaría con un frontend que ya \
             no existe en el repo.",
            dist.display()
        ),
    }

    let mut hash = Hash::new();
    // Las rutas de los assets copiados (en el mismo orden en que se
    // hashean), para poder recalcular el hash desde `dist/`.
    let mut assets = Vec::new();
    for asset in web_assets {
        let src = root.join(asset);
        // Se vigila el origen. Además, dentro de `copy_recursive` se
        // vigila **cada fichero**: tocar un `.js` de `ui/` tiene que
        // cambiar el fingerprint y hacer que cargo vuelva a ejecutar
        // este script (y a recompilar el crate).
        println!("cargo:rerun-if-changed={}", src.display());
        copy_recursive(&src, &dist.join(asset), Path::new(asset), &mut hash, &mut assets)
            .unwrap_or_else(|e| panic!("no se pudo copiar {asset} a dist/: {e}"));
    }

    // El hash del contenido copiado. Se emite como `cargo:rustc-env`
    // para que el crate lo pueda leer con `env!("FRONTEND_HASH")` y
    // exponerlo en «Acerca de» (así se sabe qué frontend lleva esta
    // build). No es lo que obliga a recompilar: eso lo hacen el
    // `rerun-if-changed` por fichero y el `include!` del fichero
    // generado.
    let hash = hash.finalizar();
    println!("cargo:rustc-env=FRONTEND_HASH={hash}");
    (hash, assets)
}

/// De dónde se copia el frontend.
///
/// Por defecto, la raíz del repositorio (la carpeta padre de
/// `src-tauri/`). La variable `PLANNER_FRONTEND_ORIGEN` la cambia: la
/// usa la comprobación de `tools/test.sh` para trabajar sobre una
/// COPIA del frontend y no tocar los ficheros del repo.
fn origen_del_frontend(manifest_dir: &Path) -> PathBuf {
    match std::env::var(ORIGEN_FRONTEND) {
        Ok(origen) if !origen.trim().is_empty() => PathBuf::from(origen),
        _ => manifest_dir.join(".."),
    }
}

/// Copia `src` a `dst` y va sumando los ficheros copiados al hash.
///
/// `relativa` es la ruta del fichero dentro de `dist/` (y, por tanto,
/// dentro del binario): se lleva en la recursion para hashear cada
/// fichero con el nombre con el que se verá en la app.
///
/// `assets` recibe la ruta (relativa a `dist/`) de cada fichero
/// copiado, en el mismo orden en que se hashea: con esa lista y el
/// contenido de `dist/` se puede volver a calcular el hash y
/// comprobar que el binario lleva el frontend que se copió.
///
/// Se copia primero y se hashea **después**: si la copia falla, el
/// build para aquí y el hash no cuenta ningún fichero a medias.
fn copy_recursive(
    src: &Path,
    dst: &Path,
    relativa: &Path,
    hash: &mut Hash,
    assets: &mut Vec<String>,
) -> std::io::Result<()> {
    if src.is_dir() {
        std::fs::create_dir_all(dst)?;
        // Orden estable: el hash no puede depender del orden en que
        // el sistema de ficheros devuelva las entradas.
        let mut entradas: Vec<std::path::PathBuf> = std::fs::read_dir(src)?
            .map(|e| e.map(|e| e.path()))
            .collect::<std::io::Result<Vec<_>>>()?;
        entradas.sort();
        for entrada in entradas {
            let Some(nombre) = entrada.file_name() else {
                continue;
            };
            copy_recursive(
                &entrada,
                &dst.join(nombre),
                &relativa.join(nombre),
                hash,
                assets,
            )?;
        }
    } else {
        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(src, dst)?;
        // Se hashea lo copiado (lo que va al binario), no el origen.
        let contenido = std::fs::read(dst)?;
        hash.añadir(relativa, &contenido);
        assets.push(relativa.to_string_lossy().replace('\\', "/"));
        // Cada fichero se vigila por su nombre: así, tocar un `.js`
        // dentro de `ui/` cambia el fingerprint de cargo y el crate se
        // recompila (y `generate_context!` vuelve a incrustar los
        // assets). Sin esto, el binario se publicaría con el frontend
        // anterior.
        println!("cargo:rerun-if-changed={}", src.display());
    }
    Ok(())
}

/// Escribe el hash del frontend en un fichero que el crate incluye.
///
/// El fichero lleva también la lista de assets copiados: con ella, el
/// hash se puede recalcular a partir del contenido de `dist/` y
/// comparar con el que lleva el binario. Sin esa lista, el hash sería
/// un valor que nadie puede verificar.
///
/// Nota: el hash **no** va aquí, sino en `cargo:rustc-env` (lo lee el
/// crate con `env!("FRONTEND_HASH")`, para exponerlo en «Acerca de»).
pub fn write_frontend_version(assets: &[String]) {
    let out_dir = PathBuf::from(
        std::env::var("OUT_DIR").expect("OUT_DIR no está definido (cargo siempre lo pasa)"),
    );
    let path = out_dir.join("frontend_version.rs");

    let mut texto = String::from(
        "// Generado por src-tauri/build.rs. NO EDITAR.\n\
         // Rutas (relativas a dist/) de los assets copiados al frontend, en el\n\
         // mismo orden en que se calculó el hash del frontend.\n\
         #[allow(dead_code)]\n\
         pub const FRONTEND_ASSETS: &[&str] = &[\n",
    );
    for asset in assets {
        texto.push_str(&format!("    {asset:?},\n"));
    }
    texto.push_str("];\n");

    std::fs::write(&path, texto)
        .unwrap_or_else(|e| panic!("no se pudo escribir {}: {e}", path.display()));
}
