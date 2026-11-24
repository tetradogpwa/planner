// T-040: el binario no se puede publicar con el frontend anterior.
//
// Tauri 2 incrusta el frontend (el `frontendDist`, que es `dist/`) como
// *blobs* dentro del binario, en tiempo de compilación: lo hace la
// macro `tauri::generate_context!`, al expandirse dentro de `rustc`.
// Si el contenido de `dist/` cambia pero cargo no recompila el crate,
// el binario se publica con el frontend ANTERIOR: el usuario recibe una
// app que no tiene los cambios que el repo dice que tiene.
//
// Aquí se comprueba el mecanismo de verdad, con el **mismo código**
// que compila la app (`src-tauri/frontend_copy.rs`, el módulo que usa
// `src-tauri/build.rs`), ejecutado por el arnés de pruebas
// (`tests/harness/frontend`) contra un repositorio de mentira:
//
//   1. El código emite una directiva cuyo VALOR depende del
//      contenido del frontend copiado (`cargo:rustc-env=FRONTEND_HASH`).
//      El crate lo lee con `env!("FRONTEND_HASH")`, de modo que el
//      valor viaja tal cual al binario.
//   2. Al tocar un `.js` del frontend, ese valor cambia: así se sabe
//      qué frontend lleva cada build.
//   3. `remove_dir_all` no se come su error: si `dist/` no se puede
//      borrar, el build falla (si no, los ficheros viejos se quedan
//      ahí y Tauri los incrusta igual).
//
// Ojo con el papel del hash: el valor de `cargo:rustc-env` **no** va
// en el fingerprint del build script (cargo solo guarda ahí las rutas
// de `rerun-if-changed`), así que por sí solo no obliga a recompilar.
// Lo que obliga a recompilar es el `cargo:rerun-if-changed` que se
// emite **por cada fichero** copiado (al tocar un `.js`, cargo vuelve
// a ejecutar el build script) más el `include!` del fichero generado
// (que hace que cargo recompile el crate, y con él
// `generate_context!` vuelva a incrustar los assets). El hash sirve
// para **saber** qué frontend lleva una build.
//
// Por qué un arnés y no el binario del build script: `build.rs` acaba
// llamando a `tauri_build::build()`, que exige el entorno completo de
// `cargo tauri` (variables `TAURI_ENV_*`, `TARGET`, `DEP_TAURI_DEV`,
// un `tauri.conf.json` válido, los iconos…) y hace `panic` si falta
// cualquiera de ellos. Ejecutarlo a mano contra un repositorio de
// mentira sería frágil; el arnés ejecuta **solo** la parte que se
// quiere probar.
//
// La comprobación de que el binario *resultante* lleva el asset nuevo
// la hace `tools/test.sh` (`check_frontend_embebido`), que compila el
// binario de verdad, toca un `.js`, recompila y mira el blob
// incrustado (comprimido con brotli).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync, chmodSync,
  readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync, spawn, execFileSync } from 'node:child_process';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

const BUILD_RS = leer('src-tauri', 'build.rs');
const FRONTEND_COPY_RS = leer('src-tauri', 'frontend_copy.rs');
const LIB_RS = leer('src-tauri', 'src', 'lib.rs');
const TEST_SH = leer('tools', 'test.sh');
const HARNESS_MAIN_RS = leer('tests', 'harness', 'frontend', 'src', 'main.rs');

/**
 * Compila el arnés de pruebas (si hace falta) y devuelve su ruta.
 *
 * El arnés es un crate de Rust aparte (`tests/harness/frontend/`) que
 * incluye `src-tauri/frontend_copy.rs` y ejecuta **el mismo código**
 * que compila la app.
 *
 * Se compila con su propio `cargo build` (con su `Cargo.lock`, así que
 * no toca el `Cargo.lock` de la app) y se cachea: solo se recompila si
 * su código ha cambiado.
 */
let harnessCache = null;

function harness() {
  if (harnessCache !== null) return harnessCache;

  const dir = join(RAIZ, 'tests', 'harness', 'frontend');
  const bin = join(dir, 'target', 'debug', 'frontend-harness');

  // Solo se recompila si hace falta (el código o el módulo que
  // incluye han cambiado).
  const necesitaCompilar =
    !existsSync(bin) ||
    hayCambiosDesde(bin, [
      join(dir, 'src', 'main.rs'),
      join(dir, 'Cargo.toml'),
      join(RAIZ, 'src-tauri', 'frontend_copy.rs'),
    ]);

  if (necesitaCompilar) {
    const res = spawnSync('cargo', ['build', '--quiet'], {
      cwd: dir,
      encoding: 'utf8',
    });
    if (res.status !== 0) {
      throw new Error(
        `no se pudo compilar el arnés de pruebas:\n${res.stdout ?? ''}${res.stderr ?? ''}`,
      );
    }
  }

  harnessCache = bin;
  return bin;
}

/** ¿Alguno de los ficheros es más nuevo que el binario? */
function hayCambiosDesde(bin, ficheros) {
  const tBin = mtime(bin);
  return ficheros.some(f => existsSync(f) && mtime(f) > tBin);
}

function mtime(fichero) {
  try {
    return statSync(fichero).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * El frontend mínimo que el arnés necesita.
 *
 * `WEB_ASSETS` (en `build.rs`) es una lista fija: si falta alguno de
 * los ficheros, la copia falla. Aquí se crean todos (con contenido
 * trivial) para poder ejecutar el arnés contra el repositorio de
 * mentira.
 *
 * Los directorios (`ads/`, `back/`, `ui/`, `vendor/`, `legal/`) se
 * crean con un `.gitkeep`, porque `copy_recursive` los recorre.
 */
function frontendCompleto(extra = {}) {
  const base = {
    'index.html': '<html></html>\n',
    'index.js': 'export const a = 1;\n',
    'index.css': 'body {}\n',
    'context.js': 'export const b = 2;\n',
    'api.js': 'export const c = 3;\n',
    'mcp-bridge.js': 'export const d = 4;\n',
    'monetization.js': 'export const e = 5;\n',
    'theme-boot.js': 'export const f = 6;\n',
    'manifest.json': '{}\n',
    'sw.js': 'export const g = 7;\n',
    'icon-192x192.png': 'PNG\n',
    'icon-512x512.png': 'PNG\n',
    'ads/.gitkeep': '',
    'back/.gitkeep': '',
    'ui/.gitkeep': '',
    'vendor/.gitkeep': '',
    'legal/.gitkeep': '',
  };
  return { ...base, ...extra };
}

/**
 * Monta un repositorio de mentira con un frontend mínimo y ejecuta
 * el arnés contra él.
 *
 * El arnés usa `CARGO_MANIFEST_DIR` para encontrar la raíz (`../`
 * respecto a `src-tauri/`) y `OUT_DIR` para escribir los ficheros
 * generados, así que con un repositorio de mentira se puede ejecutar
 * de verdad **sin tocar el repo**.
 *
 * `origen` es opcional: si se pasa, se copia ese frontend a una
 * carpeta temporal y se le dice al arnés que copie de ahí
 * (`PLANNER_FRONTEND_ORIGEN`), que es lo que hace la comprobación de
 * `tools/test.sh` para no tocar los ficheros del repo.
 *
 * Devuelve `{ codigo, salida, hash, assets }`.
 */
function ejecutarHarness({ frontend = frontendCompleto(), origen = null } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'planner-t040-'));
  try {
    // La estructura que espera el arnés: `src-tauri/` dentro de una
    // raíz, con el frontend en la raíz.
    const srcTauri = join(raiz, 'src-tauri');
    mkdirSync(srcTauri, { recursive: true });
    for (const [ruta, contenido] of Object.entries(frontend)) {
      const destino = join(raiz, ruta);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, contenido, 'utf8');
    }

    const outDir = join(raiz, 'out');
    mkdirSync(outDir, { recursive: true });

    // El origen alternativo (si lo hay): otra copia del frontend.
    let entorno = process.env;
    if (origen) {
      const dirOrigen = join(raiz, 'origen');
      for (const [ruta, contenido] of Object.entries(origen)) {
        const destino = join(dirOrigen, ruta);
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, contenido, 'utf8');
      }
      entorno = { ...process.env, PLANNER_FRONTEND_ORIGEN: dirOrigen };
    }

    const res = spawnSync(harness(), [raiz, outDir], {
      encoding: 'utf8',
      env: entorno,
    });

    const salida = `${res.stdout ?? ''}${res.stderr ?? ''}`;

    // El hash y la lista de assets, si el arnés llegó a escribirlos.
    let hash = null;
    let assets = null;
    const ficheroHash = join(outDir, 'frontend_hash.txt');
    if (existsSync(ficheroHash)) {
      hash = readFileSync(ficheroHash, 'utf8').trim() || null;
    }
    const ficheroAssets = join(outDir, 'frontend_assets.txt');
    if (existsSync(ficheroAssets)) {
      assets = readFileSync(ficheroAssets, 'utf8').split('\n').filter(Boolean);
    }

    return {
      codigo: res.status,
      salida,
      hash,
      assets,
      raiz,
      outDir,
    };
  } catch (err) {
    rmSync(raiz, { recursive: true, force: true });
    throw err;
  }
}

/** Borra el repositorio de mentira que dejó `ejecutarHarness`. */
function limpiar(resultado) {
  rmSync(resultado.raiz, { recursive: true, force: true });
}

/**
 * El texto de una función de `tools/test.sh`.
 *
 * `inicio` es el principio de la función (normalmente su nombre con
 * los paréntesis) y `fin` es por dónde acaba. Sirve para comprobar
 * una función concreta sin que el resultado dependa de lo que haya
 * alrededor.
 */
function bloqueDe(inicio, fin) {
  const desde = TEST_SH.indexOf(inicio);
  assert.ok(desde !== -1, `no se encontró "${inicio}" en tools/test.sh`);
  const hasta = fin ? TEST_SH.indexOf(fin, desde + inicio.length) : TEST_SH.length;
  return TEST_SH.slice(desde, hasta === -1 ? TEST_SH.length : hasta);
}

// ── 1. La directiva cuyo valor depende del contenido ────────────────

test('build.rs emite una directiva rustc-env cuyo valor es el hash del frontend', () => {
  // El valor tiene que ser el hash del CONTENIDO copiado, no una ruta:
  // así, dos builds con distinto frontend llevan distinto valor (y el
  // hash sirve para saber qué frontend lleva cada build).
  //
  // Ojo: el valor de `cargo:rustc-env` no va en el fingerprint del
  // build script, así que por sí solo no obliga a recompilar (eso lo
  // hacen el `rerun-if-changed` por fichero y el `include!` del
  // fichero generado).
  assert.match(
    FRONTEND_COPY_RS,
    /println!\("cargo:rustc-env=FRONTEND_HASH=\{hash\}"\)/,
    'frontend_copy.rs tiene que emitir cargo:rustc-env=FRONTEND_HASH=<hash>: ' +
    'ese valor es el que cambia cuando cambia el contenido del frontend, ' +
    'y así se sabe qué frontend lleva la build',
  );
});

test('el crate lee el hash con env!, para que el valor llegue al binario', () => {
  // Si el crate leyera el hash del `include!` (del fichero generado),
  // el valor de la directiva no acabaría en el binario tal cual, y no
  // se podría leer con `grep -a` para saber qué frontend lleva la
  // build.
  assert.match(
    LIB_RS,
    /pub const FRONTEND_HASH: &str = env!\("FRONTEND_HASH"\);/,
    'lib.rs tiene que leer el hash con env!("FRONTEND_HASH"): ' +
    'así el valor de la directiva llega tal cual al binario',
  );
});

test('build.rs no ignora el error de remove_dir_all', () => {
  // Si `dist/` no se puede borrar y el error se ignora, los ficheros
  // viejos se quedan ahí y Tauri los incrusta igual: el binario
  // llevaría un frontend que ya no existe en el repo.
  assert.ok(
    !/let\s+_\s*=\s*std::fs::remove_dir_all/.test(BUILD_RS + FRONTEND_COPY_RS),
    'el código no debe ignorar el error de remove_dir_all (let _ = ...): ' +
    'los ficheros viejos se quedarían en dist/ y Tauri los incrustaría ' +
    'en el binario',
  );
  assert.ok(
    /remove_dir_all/.test(FRONTEND_COPY_RS),
    'el código tiene que borrar dist/ antes de copiar el frontend',
  );
  // Y el error tiene que ser un fallo de verdad (un panic), no un
  // aviso.
  assert.match(
    FRONTEND_COPY_RS,
    /remove_dir_all[\s\S]{0,400}?Err\(e\)\s*=>\s*panic!/,
    'el código tiene que fallar (panic) si no puede borrar dist/',
  );
});

test('se vigila cada fichero del frontend, no solo las carpetas', () => {
  // Si solo se vigilara la carpeta, tocar un `.js` dentro de `ui/`
  // podría no cambiar el fingerprint.
  const emisiones = [...FRONTEND_COPY_RS.matchAll(/cargo:rerun-if-changed=/g)].length;
  assert.ok(
    emisiones >= 2,
    `el código tiene que emitir rerun-if-changed por cada fichero copiado ` +
    `(se emiten ${emisiones} veces): si solo se vigilaran las carpetas, ` +
    'tocar un .js dentro de ui/ podría no cambiar el fingerprint',
  );
  // Y tiene que ser dentro de la copia recursiva (una emisión por
  // fichero), no solo una por carpeta.
  const inicio = FRONTEND_COPY_RS.indexOf('fn copy_recursive(');
  assert.ok(inicio !== -1,
    'el código tiene que copiar el frontend recursivamente (fn copy_recursive)');
  const emision = FRONTEND_COPY_RS.indexOf('cargo:rerun-if-changed={}', inicio);
  assert.ok(emision !== -1,
    'la emisión de rerun-if-changed tiene que estar dentro de copy_recursive ' +
    '(una por fichero copiado): si solo se vigilara la carpeta, tocar un ' +
    '.js dentro de ui/ podría no cambiar el fingerprint');
});

// ── 2. El hash cambia cuando cambia el frontend ─────────────────────

test('el origen de la copia se puede cambiar (PLANNER_FRONTEND_ORIGEN)', () => {
  // La comprobación de `tools/test.sh` marca un `.js` de una COPIA del
  // frontend (en un directorio temporal) y compila desde ahí, para no
  // tocar ningún fichero del repo. Eso solo funciona si el build
  // script copia de donde le digan.
  const original = frontendCompleto({ 'index.js': 'export const a = 1;\n' });
  const otro = frontendCompleto({ 'index.js': 'export const a = 2;\n' });

  // Sin origen alterno: se copia el frontend del repo de mentira.
  const normal = ejecutarHarness({ frontend: original });
  // Con origen alterno: se copia el frontend de la otra carpeta.
  const alterno = ejecutarHarness({ frontend: original, origen: otro });
  // El mismo frontend de la otra carpeta, pero como origen normal.
  const referencia = ejecutarHarness({ frontend: otro });

  try {
    assert.equal(normal.codigo, 0, `el arnés tiene que salir con 0:\n${normal.salida}`);
    assert.equal(alterno.codigo, 0, `el arnés tiene que salir con 0:\n${alterno.salida}`);
    assert.equal(referencia.codigo, 0, `el arnés tiene que salir con 0:\n${referencia.salida}`);

    assert.equal(
      alterno.hash, referencia.hash,
      'con PLANNER_FRONTEND_ORIGEN hay que copiar el frontend de esa ' +
      'carpeta: si se copiase el del repo, el hash sería el del repo',
    );
    assert.notEqual(
      alterno.hash, normal.hash,
      'el hash tiene que cambiar si el origen de la copia cambia',
    );
  } finally {
    limpiar(normal);
    limpiar(alterno);
    limpiar(referencia);
  }
});

test('el hash del frontend cambia al tocar un .js', () => {
  const antes = ejecutarHarness();
  try {
    assert.equal(
      antes.codigo, 0,
      `el arnés tiene que salir con 0:\n${antes.salida}`,
    );
    assert.ok(antes.hash, 'el arnés tiene que escribir el hash del frontend');
    assert.match(
      antes.hash, /^[0-9a-f]{64}$/,
      `el hash tiene que ser un SHA-256 en hexadecimal: ${antes.hash}`,
    );

    // Ahora se toca el .js del frontend y se vuelve a ejecutar.
    const despues = ejecutarHarness({
      frontend: frontendCompleto({
        'index.js': 'export const a = 1;\n// T040: frontend tocado\n',
      }),
    });
    try {
      assert.equal(
        despues.codigo, 0,
        `el arnés tiene que salir con 0:\n${despues.salida}`,
      );
      assert.ok(despues.hash, 'el arnés tiene que escribir el hash del frontend');
      assert.notEqual(
        despues.hash, antes.hash,
        'el hash del frontend NO ha cambiado tras tocar un .js: si no ' +
        'cambia, no se puede saber qué frontend lleva la build, y el ' +
        'valor incrustado se quedaría viejo (T-040)',
      );
    } finally {
      limpiar(despues);
    }
  } finally {
    limpiar(antes);
  }
});

test('el hash NO cambia si el frontend no cambia', () => {
  // La otra cara: el hash tiene que ser estable. Si cambiara con cada
  // build, el valor incrustado sería distinto en cada compilación
  // (y la build no sería reproducible).
  const a = ejecutarHarness();
  const b = ejecutarHarness();
  try {
    assert.equal(a.codigo, 0, `el arnés tiene que salir con 0:\n${a.salida}`);
    assert.equal(b.codigo, 0, `el arnés tiene que salir con 0:\n${b.salida}`);
    assert.equal(
      a.hash, b.hash,
      'el hash del frontend tiene que ser el mismo si el frontend no ha cambiado',
    );
  } finally {
    limpiar(a);
    limpiar(b);
  }
});

test('el hash depende del contenido, no solo del nombre del fichero', () => {
  // Dos .js con el mismo nombre pero distinto contenido: el hash
  // tiene que ser distinto (si no, tocar el contenido de un fichero
  // no cambiaría nada).
  const a = ejecutarHarness({
    frontend: frontendCompleto({ 'index.js': 'export const a = 1;\n' }),
  });
  const b = ejecutarHarness({
    frontend: frontendCompleto({ 'index.js': 'export const a = 2;\n' }),
  });
  try {
    assert.notEqual(
      a.hash, b.hash,
      'el hash tiene que cambiar si cambia el contenido del .js, aunque ' +
      'su nombre sea el mismo',
    );
  } finally {
    limpiar(a);
    limpiar(b);
  }
});

test('el hash depende de la ruta del asset, no solo de su contenido', () => {
  // Dos ficheros con el MISMO contenido en sitios distintos: si el hash
  // no tuviera en cuenta la ruta, no se podrían distinguir.
  const a = ejecutarHarness({
    frontend: frontendCompleto({ 'ui/uno/app.js': 'export const a = 1;\n' }),
  });
  const b = ejecutarHarness({
    frontend: frontendCompleto({ 'ui/dos/app.js': 'export const a = 1;\n' }),
  });
  try {
    assert.notEqual(
      a.hash, b.hash,
      'el hash tiene que cambiar si el asset cambia de sitio, aunque su ' +
      'contenido sea el mismo',
    );
  } finally {
    limpiar(a);
    limpiar(b);
  }
});

test('el código escribe la lista de assets con su ruta', () => {
  // Sin la lista, el hash sería un valor que nadie puede verificar.
  const res = ejecutarHarness({
    frontend: frontendCompleto({ 'ui/legal/legal-card.js': 'export const a = 1;\n' }),
  });
  try {
    assert.equal(res.codigo, 0, `el arnés tiene que salir con 0:\n${res.salida}`);
    assert.ok(res.assets, 'el arnés tiene que escribir la lista de assets');
    assert.ok(
      res.assets.includes('index.html'),
      `la lista de assets tiene que incluir index.html: ${res.assets.join(', ')}`,
    );
    assert.ok(
      res.assets.includes('ui/legal/legal-card.js'),
      `la lista de assets tiene que incluir ui/legal/legal-card.js: ${res.assets.join(', ')}`,
    );
  } finally {
    limpiar(res);
  }
});

test('si dist/ no se puede borrar, la copia falla (no se ignora el error)', () => {
  // Si el error se ignorara, los ficheros viejos se quedarían en
  // `dist/` y Tauri los incrustaría igual: el binario llevaría un
  // frontend que ya no existe en el repo.
  const raiz = mkdtempSync(join(tmpdir(), 'planner-t040-'));
  try {
    const srcTauri = join(raiz, 'src-tauri');
    mkdirSync(srcTauri, { recursive: true });
    for (const [ruta, contenido] of Object.entries(frontendCompleto())) {
      const destino = join(raiz, ruta);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, contenido, 'utf8');
    }
    const outDir = join(raiz, 'out');
    mkdirSync(outDir, { recursive: true });

    // Se crea `dist/` con un fichero dentro y se quita el permiso de
    // escritura del directorio: `remove_dir_all` fallará.
    const dist = join(raiz, 'dist');
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, 'viejo.js'), '// frontend anterior\n', 'utf8');
    chmodSync(dist, 0o500);

    let res;
    try {
      res = spawnSync(harness(), [raiz, outDir], { encoding: 'utf8' });
    } finally {
      // Se restauran los permisos para poder borrar el temporal.
      chmodSync(dist, 0o700);
    }

    assert.notEqual(
      res.status, 0,
      'la copia tiene que FALLAR si no puede borrar dist/: ' +
      `el arnés salió con ${res.status}\n${res.stdout ?? ''}${res.stderr ?? ''}`,
    );
    const salida = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    assert.match(
      salida, /no se pudo borrar/,
      'el error tiene que decir que no se pudo borrar dist/',
    );
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

// ── 3. El hash está en el binario de verdad ──────────────────────────

test('FRONTEND_HASH se usa en runtime (no lo elimina el enlazador)', () => {
  // Si `FRONTEND_HASH` solo se usara en `#[cfg(test)]`, el enlazador
  // lo borraría del binario y no se podría comprobar con `grep -a`
  // qué frontend lleva una build.
  const usos = [...LIB_RS.matchAll(/FRONTEND_HASH/g)].length;
  assert.ok(usos >= 3,
    `FRONTEND_HASH solo se usa ${usos} veces en lib.rs: tiene que usarlo ` +
    'el código de la app (por ejemplo en AppInfo), no solo las pruebas');

  // Y en concreto: se expone al frontend.
  assert.match(
    LIB_RS,
    /frontend_hash:\s*FRONTEND_HASH/,
    'AppInfo tiene que llevar el hash del frontend: así el hash está ' +
    'de verdad en el binario y se puede leer con `grep -a`',
  );
});

test('las pruebas de Rust recalculan el hash desde dist/', () => {
  // Las pruebas tautológicas (mirar solo el formato del hash) no
  // demuestran nada: el hash lo genera el propio build script, así que
  // un mecanismo roto las dejaría en verde. Estas pruebas recalculan el
  // hash con el contenido de `dist/` y lo comparan con el incrustado.
  assert.match(
    LIB_RS,
    /FRONTEND_ASSETS/,
    'lib.rs tiene que usar la lista de assets para recalcular el hash',
  );
  assert.match(
    LIB_RS,
    /el_hash_incrustado_es_el_del_contenido_de_dist/,
    'lib.rs tiene que tener una prueba que compare el hash incrustado ' +
    'con el que sale de recalcularlo sobre dist/',
  );
});

// ── 4. La comprobación de que el binario lleva el frontend nuevo ────

test('tools/test.sh comprueba que el binario lleva el frontend nuevo', () => {
  // La comprobación de verdad (compilar, tocar un .js, recompilar y
  // mirar el blob incrustado) la hace el script de pruebas.
  assert.match(
    TEST_SH,
    /check_frontend_embebido/,
    'tools/test.sh tiene que tener la comprobación del frontend incrustado',
  );
  assert.match(
    TEST_SH,
    /tauri-codegen-assets/,
    'la comprobación tiene que mirar los assets incrustados por Tauri',
  );
  assert.match(
    TEST_SH,
    /brotli/,
    'la comprobación tiene que descomprimir los blobs (brotli): el texto ' +
    'no se puede buscar en crudo',
  );
});

test('la comprobación mira la última build (la carpeta de assets más nueva)', () => {
  // Puede haber varias carpetas `tauri-codegen-assets` (una por cada
  // versión de build.rs compilada): hay que mirar la **última**, que
  // es la que lleva el frontend recién copiado. Si se cogiera la
  // primera, la comprobación miraría un build viejo y fallaría
  // siempre.
  const bloque = bloqueDe('dir_assets_codegen()', 'assets_llevan_marca()');
  assert.match(
    bloque,
    /sort\s+-rn|ls\s+-td/,
    'dir_assets_codegen tiene que elegir la carpeta de assets más ' +
    'reciente (por fecha): si coge una cualquiera, la comprobación ' +
    'mira un build viejo',
  );
  // Y no puede conformarse con coger **una cualquiera**: un `find`
  // sin ordenar devolvería la primera (la vieja) y la comprobación
  // miraría un build anterior. El `find` puede ocupar varias líneas
  // (continuadas con `\`), así que se unen las líneas continuedas
  // antes de mirar cada orden.
  const ordenes = bloque
    .replace(/\\\n\s*/g, ' ')          // se unen las líneas continuadas
    .split('\n')
    .map(linea => linea.trim())
    .filter(linea => linea.includes('find "$E2E_TARGET_DIR"'));
  assert.ok(ordenes.length > 0, 'dir_assets_codegen tiene que buscar las carpetas de assets');
  for (const orden of ordenes) {
    assert.match(
      orden,
      /sort\s+-rn|ls\s+-td/,
      'dir_assets_codegen no puede coger una carpeta de assets cualquiera: ' +
      `la orden "${orden}" tiene que ordenar por fecha`,
    );
  }
});

test('tools/test.sh llama a la comprobación del frontend antes de los E2E', () => {
  const bloque = TEST_SH.slice(TEST_SH.indexOf('run_e2e()'));
  const llamada = bloque.indexOf('check_frontend_embebido ||');
  assert.ok(llamada !== -1,
    'run_e2e tiene que llamar a check_frontend_embebido (si no, la ' +
    'comprobación no se hace nunca)');
  assert.ok(llamada < bloque.indexOf('npx wdio run'),
    'la comprobación del frontend tiene que ir ANTES de lanzar los E2E');
});

// ── 4b. La comprobación tiene que notar el hash y no dejar traps ────

test('la comprobación falla si el hash del frontend no cambia', () => {
  // La comprobación no puede ser "toca un .js y mira el asset": eso
  // lo cumple solo el `rerun-if-changed` de las carpetas, y el hash no
  // participa. Tiene que leer el hash incrustado en el binario antes
  // y después de tocar el `.js`, y fallar si no ha cambiado.
  const bloque = bloqueDe('check_frontend_embebido()', 'compilar_binario_pruebas()');
  assert.match(
    bloque,
    /hash_frontend_binario/,
    'check_frontend_embebido tiene que leer el hash del binario',
  );
  assert.match(
    bloque,
    /hash_antes.*hash_despues/s,
    'check_frontend_embebido tiene que comparar el hash de antes con el de después',
  );
  assert.match(
    bloque,
    /NO ha cambiado/,
    'check_frontend_embebido tiene que fallar si el hash no ha cambiado',
  );
});

test('la comprobación lee el hash del binario de verdad', () => {
  // El hash tiene que estar en el binario: `AppInfo` lo expone al
  // frontend, así que el enlazador no lo elimina. Se lee con `grep -a`.
  const bloque = bloqueDe('hash_frontend_binario()');
  assert.match(
    bloque,
    /grep -a/,
    'hash_frontend_binario tiene que leer el binario con `grep -a`',
  );
  assert.match(
    bloque,
    /\[0-9a-f\]\{64\}/,
    'hash_frontend_binario tiene que buscar el SHA-256 en hexadecimal',
  );
});

test('la comprobación no deja traps colgados', () => {
  // Si `check_frontend_embebido` instala un `trap ... RETURN` y no lo
  // restaura, ese trap salta en cada función posterior del script y
  // lo rompe (con "backup: variable sin asignar").
  const bloque = bloqueDe('check_frontend_embebido()', 'hash_frontend_binario()');

  // Se miran solo las líneas de CÓDIGO (sin comentarios): si no, un
  // comentario con el texto basta para que la comprobación pase.
  const codigo = bloque
    .split('\n')
    .filter(linea => !linea.trim().startsWith('#'))
    .join('\n');

  assert.match(
    codigo,
    /trap_previo/,
    'check_frontend_embebido tiene que guardar los traps que había antes',
  );
  assert.match(
    codigo,
    /trap - EXIT INT TERM HUP RETURN/,
    'check_frontend_embebido tiene que quitar sus traps al salir',
  );
  assert.match(
    codigo,
    /eval "\$trap_previo_(exit|int|term|hup|return)"/,
    'check_frontend_embebido tiene que restaurar los traps anteriores',
  );
});

// ── 4c. Si la comprobación se interrumpe, el repo queda limpio ──────

/**
 * Ejecuta la comprobación REAL de `tools/test.sh` (extraída tal cual
 * con `sed`, para no copiar su lógica) contra un repo de mentira.
 *
 * `modo` decide qué hace la segunda compilación (la del frontend
 * marcado):
 *
 *   * `interrumpir`: se queda esperando. La prueba la mata con un
 *     SIGTERM: la señal con la que se mata un proceso de verdad
 *     (`timeout`, `kill`, al cerrar la terminal).
 *   * `fallar`: falla. La comprobación tiene que terminar con error y
 *     dejar el entorno y los traps como estaban.
 *
 * Devuelve `{ codigo, salida, js, original, copias, dir, repo, ms }`.
 */
function ejecutarComprobacion(modo) {
  const dir = mkdtempSync(join(tmpdir(), 'planner-t040-'));
  const repo = join(dir, 'repo');
  const log = join(dir, 'log');
  const js = join(repo, 'ui', 'legal', 'legal-card.js');
  const original = 'export const a = 1;\n';

  mkdirSync(join(repo, 'ui', 'legal'), { recursive: true });
  // La copia del frontend que dejó el build script.
  mkdirSync(join(repo, 'dist', 'ui', 'legal'), { recursive: true });
  mkdirSync(log, { recursive: true });
  writeFileSync(js, original, 'utf8');
  writeFileSync(join(repo, 'dist', 'ui', 'legal', 'legal-card.js'), original, 'utf8');

  // Las funciones del script, tal cual están (incluida la que compila:
  // la prueba no copia su lógica, la usa).
  const funcs = [
    'limpiar_copia_frontend()',
    'matar_compilacion()',
    'compilar_binario_pruebas()',
    'check_frontend_embebido()',
  ]
    .map(nombre => execFileSync('sed', [
      '-n', `/^${nombre}/,/^}/p`, join(RAIZ, 'tools', 'test.sh'),
    ], { encoding: 'utf8' }))
    .join('\n');
  assert.match(funcs, /check_frontend_embebido/,
    'no se ha podido extraer la comprobación del script');
  assert.match(funcs, /compilar_binario_pruebas/,
    'no se ha podido extraer la compilación del script');

  const guion = join(dir, 'harness.sh');
  writeFileSync(guion, `#!/usr/bin/env bash
set -uo pipefail
ROOT="$1"
FRONTEND_DIST="$2"
E2E_BIN="$3"
E2E_TARGET_DIR="$4"
LOG="$5"
MODO="$6"
COPIA_FRONTEND=""
PID_COMPILACION=""

# El mktemp de la comprobación se anota, para poder mirar después
# dónde estaba la copia temporal del frontend.
mktemp() {
  local d
  d=$(command mktemp "$@")
  printf '%s\\n' "$d" >> "$LOG/mktemp.log"
  printf '%s\\n' "$d"
}

# El "cargo" de mentira: cuenta las compilaciones. A partir de la
# segunda (la del frontend marcado) se queda esperando (para que la
# prueba la pueda interrumpir) o falla (para probar el camino de
# error).
cargo() {
  printf 'build\\n' >> "$LOG/build.log"
  local n
  n=$(wc -l < "$LOG/build.log")
  if [[ "$n" -ge 2 ]]; then
    if [[ "$MODO" == "fallar" ]]; then
      return 1
    fi
    # El PID de esta compilación se anota: la prueba comprueba que
    # también muere (si no, la build seguiría compilando sola).
    printf '%s\\n' "$BASHPID" >> "$LOG/pids.log"
    # El exec deja el proceso con el MISMO pid (el que se acaba de
    # anotar): así la compilación de mentira es ese mismo proceso y no
    # queda ningún proceso vivo detrás sujetando la salida del script
    # (si queda, la prueba espera a que termine de dormir).
    exec sleep 60
  fi
  return 0
}

# El hash del binario: cada llamada devuelve un valor distinto (así
# la comprobación del hash no falla antes de tiempo).
hash_frontend_binario() {
  local n
  n=$(cat "$LOG/hash.contador" 2>/dev/null || echo 0)
  n=$((n + 1))
  printf '%s' "$n" > "$LOG/hash.contador"
  printf 'a%063d' "$n"
  echo
}
dir_assets_codegen() { printf '%s\\n' "$E2E_TARGET_DIR/assets"; }
assets_llevan_marca() { return 0; }

${funcs}

check_frontend_embebido
echo "código: $?"
printf 'origen=[%s]\\n' "\${PLANNER_FRONTEND_ORIGEN-<vacío>}" >> "$LOG/entorno.log"
trap -p RETURN > "$LOG/traps.log"
trap -p EXIT >> "$LOG/traps.log"
`, 'utf8');

  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [
      guion, repo, join(repo, 'dist'), join(repo, 'bin'), join(repo, 'target'), log, modo,
    ], { encoding: 'utf8' });

    let salida = '';
    proc.stdout.on('data', d => { salida += d; });
    proc.stderr.on('data', d => { salida += d; });

    const inicio = Date.now();

    // Se espera a que empiece la segunda compilación (la del frontend
    // marcado): para entonces la copia del frontend ya está hecha.
    //
    // Se espera al FICHERO DE PIDS y no al número de compilaciones: el
    // "cargo" de mentira anota el PID cuando empieza la segunda
    // compilación, así que cuando el PID está anotado la compilación
    // está en marcha de verdad. Contando las líneas de build.log se
    // mataba el script en mitad de la segunda compilación (entre que
    // empieza y que se anota su PID) y entonces el PID se perdía: la
    // prueba fallaba de forma aleatoria, según el ritmo de la máquina.
    const esperando = setInterval(() => {
      const logPids = join(log, 'pids.log');
      if (!existsSync(logPids)) return;
      const pids = readFileSync(logPids, 'utf8').split('\n').filter(Boolean);
      if (pids.length === 0) return;
      clearInterval(esperando);
      proc.kill('SIGTERM');
    }, 25);

    const limite = setTimeout(() => {
      clearInterval(esperando);
      proc.kill('SIGKILL');
      reject(new Error(`la comprobación no llegó a la segunda compilación:\n${salida}`));
    }, 30_000);

    proc.on('error', reject);
    proc.on('close', (codigo) => {
      clearTimeout(limite);
      clearInterval(esperando);
      const logMk = join(log, 'mktemp.log');
      const copias = existsSync(logMk)
        ? readFileSync(logMk, 'utf8').split('\n').filter(Boolean)
        : [];
      const leer = (nombre) => (existsSync(join(log, nombre))
        ? readFileSync(join(log, nombre), 'utf8')
        : '');
      resolve({
        codigo,
        salida,
        js,
        original,
        copias,
        dir,
        repo,
        ms: Date.now() - inicio,
        entorno: leer('entorno.log'),
        traps: leer('traps.log'),
        pids: leer('pids.log').split('\n').filter(Boolean).map(Number),
      });
    });
  });
}

test('si la comprobación se interrumpe, el repo queda limpio', async () => {
  // Esto es lo que pasó de verdad: la comprobación marcaba un `.js` del
  // repo y, al matarla con un TERM, el fichero se quedó marcado en el
  // repo (con la marca pegada al final, sin salto de línea).
  //
  // Ahora la marca va en una COPIA del frontend (en un directorio
  // temporal): el repo no se toca y, aunque el script se interrumpa,
  // lo único que hay que limpiar es esa copia (de lo que se encargan
  // los traps).
  const res = await ejecutarComprobacion('interrumpir');
  try {
    // 1. El script ha muerto DE VERDAD: si siguiera compiling, la
    //    segunda compilación (la de mentira) tardaría un minuto. El
    //    `close` de Node tiene que llegar en seguida.
    assert.equal(res.codigo, 143,
      `el script tiene que salir con el código de TERM (143), salió con ${res.codigo}:\n${res.salida}`);
    assert.ok(res.ms < 20_000,
      `el script tiene que morir al recibir el TERM (tardó ${res.ms} ms): ` +
      'si siguiera vivo, la comprobación no se puede interrumpir');

    // 2. El fichero del repo está intacto.
    assert.equal(
      readFileSync(res.js, 'utf8'), res.original,
      'el fichero del repo no puede cambiar al interrumpir la comprobación: ' +
      `quedó así:\n${readFileSync(res.js, 'utf8')}`,
    );

    // 3. En el repo no hay ninguna marca.
    const marcas = [];
    for (const ruta of listarFicheros(res.repo)) {
      if (readFileSync(ruta, 'utf8').includes('T040-')) marcas.push(ruta);
    }
    assert.deepEqual(marcas, [],
      `la comprobación ha dejado su marca en el repo: ${marcas.join(', ')}`);

    // 4. La copia temporal se ha borrado (el trap de TERM la limpia).
    assert.ok(res.copias.length > 0,
      'la comprobación tiene que crear una copia temporal del frontend');
    for (const copia of res.copias) {
      assert.ok(!existsSync(copia),
        `la copia temporal del frontend se ha quedado ahí: ${copia}`);
    }

    // 5. Y la compilación también ha muerto: si siguiera compilando
    //    sola, seguiría escribiendo en la carpeta de compilación y la
    //    siguiente compilación se pelearía con ella.
    assert.ok(res.pids.length > 0,
      'la comprobación tiene que compilar (para poder interrumpirla)');
    for (const pid of res.pids) {
      assert.ok(await esperarProcesoMuerto(pid),
        `la compilación sigue viva (PID ${pid}): al interrumpir la ` +
        'comprobación hay que pararla, no solo salir');
    }
  } finally {
    rmSync(res.dir, { recursive: true, force: true });
  }
});

/** ¿Sigue vivo el proceso? */
function procesoVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: el proceso existe, pero otro usuario lo tiene.
    return err.code === 'EPERM';
  }
}

/** Espera a que el proceso muera (y dice si ha muerto). */
async function esperarProcesoMuerto(pid, ms = 5_000) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (!procesoVivo(pid)) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return !procesoVivo(pid);
}

test('si la comprobación falla a mitad, no deja el entorno cambiado', async () => {
  // Si la comprobación falla (aquí: porque la segunda compilación
  // falla), no puede dejar nada cambiado: ni la variable que dice de
  // dónde copiar el frontend (afectaría a la compilación siguiente),
  // ni los traps (un `trap ... RETURN` colgado salta en cada función
  // posterior del script y lo rompe).
  const res = await ejecutarComprobacion('fallar');
  try {
    assert.match(res.salida, /código: 1/,
      `la comprobación tiene que fallar:\n${res.salida}`);

    assert.match(res.entorno, /origen=\[<vacío>\]/,
      'PLANNER_FRONTEND_ORIGEN no puede quedar puesta en el entorno del ' +
      `script (afectaría a la compilación siguiente): ${res.entorno}`);

    assert.equal(res.traps.trim(), '',
      `al terminar la comprobación no puede quedar ningún trap instalado:\n${res.traps}`);

    for (const copia of res.copias) {
      assert.ok(!existsSync(copia),
        `la copia temporal del frontend se ha quedado ahí: ${copia}`);
    }
  } finally {
    rmSync(res.dir, { recursive: true, force: true });
  }
});

/** Todos los ficheros de una carpeta (para poder mirarlos). */
function listarFicheros(ruta) {
  const encontrados = [];
  for (const entrada of readdirSync(ruta, { withFileTypes: true })) {
    const hijo = join(ruta, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...listarFicheros(hijo));
    else encontrados.push(hijo);
  }
  return encontrados;
}

// ── 5. El hash se ve en «Acerca de» ─────────────────────────────────

test('el hash del frontend se muestra en «Acerca de»', () => {
  // El hash tiene que SERVIR para algo: se expone en `AppInfo` (para
  // que el enlazador no lo elimine) y el frontend lo muestra en
  // «Acerca de».
  assert.match(
    LIB_RS,
    /frontend_hash:\s*FRONTEND_HASH/,
    'AppInfo tiene que llevar el hash del frontend',
  );

  const html = leer('ui', 'legal', 'legal-card.html');
  assert.match(
    html,
    /id="legal-app-frontend-hash"/,
    'la tarjeta legal tiene que tener el hueco del hash del frontend',
  );

  const js = leer('ui', 'legal', 'legal-card.js');
  assert.match(
    js,
    /frontend_hash/,
    'la tarjeta legal tiene que pintar el hash del frontend',
  );
});

test('el CSS define la clase del hash del frontend', () => {
  // Sin esto, la clase del HTML sería muerta (y el hash se vería
  // como el resto de datos, sin distinguirlo).
  const css = leer('ui', 'legal', 'legal-card.css');
  assert.match(
    css,
    /\.legal-about-hash/,
    'legal-card.css tiene que definir .legal-about-hash (la clase que ' +
    'usa el HTML del hash del frontend)',
  );
  // Y solo con variables de tema: nunca colores fijos (rompen el
  // tema claro, el oscuro y el alto contraste).
  const bloque = css.slice(css.indexOf('.legal-about-hash'));
  const regla = bloque.slice(0, bloque.indexOf('}') + 1);
  assert.ok(
    !/#[0-9a-f]{3,8}\b/i.test(regla),
    `la regla .legal-about-hash no puede tener colores fijos: ${regla}`,
  );
  assert.match(
    regla,
    /var\(--/,
    'la regla .legal-about-hash tiene que usar variables de tema',
  );
});

test('hay una prueba E2E del hash del frontend en «Acerca de»', () => {
  // El cambio de UI necesita una prueba de comportamiento: sin ella,
  // nadie comprueba que el hash se pinte de verdad.
  const spec = leer('tests', 'e2e', 'specs', '14-hash-frontend.spec.mjs');
  assert.match(
    spec,
    /legal-app-frontend-hash/,
    'el spec E2E tiene que mirar el dd del hash del frontend',
  );
  assert.match(
    spec,
    /\^\[0-9a-f\]\{12\}\$/,
    'el spec E2E tiene que comprobar que se muestran 12 hexadecimales',
  );
});

// ── 6. El arnés ejecuta el mismo código que la app ──────────────────

test('el arnés de pruebas ejecuta el mismo código que la app', () => {
  // Si el arnés copiara el código, la prueba comprobaría una copia y
  // no el código real: el mecanismo podría romperse en la app y la
  // prueba seguiría en verde.
  assert.match(
    HARNESS_MAIN_RS,
    /#\[path = "\.\.\/\.\.\/\.\.\/\.\.\/src-tauri\/frontend_copy\.rs"\]/,
    'el arnés tiene que incluir src-tauri/frontend_copy.rs (el código ' +
    'real de la app), no una copia',
  );
  assert.match(
    HARNESS_MAIN_RS,
    /frontend_copy::copy_web_assets/,
    'el arnés tiene que llamar a la función real de copia',
  );
});
