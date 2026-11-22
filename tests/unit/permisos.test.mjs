// Comprobaciones de los permisos que la app concede al WebView.
//
// La app NO usa los plugins `fs` ni `dialog`: la importación y la
// exportación de tareas van con `Blob`/`FileReader` y el PDF con
// html2pdf. Concederles daba al WebView acceso al disco del usuario
// (Documentos, Descargas, Escritorio, AppData) sin ningún uso real,
// junto con la API completa de Tauri (`withGlobalTauri`) y los scripts
// remotos de AdSense en el mismo WebView.
//
// Estas pruebas fallan si vuelve a aparecer un permiso concedido sin
// usar, y vigilan que la CSP solo permita los hosts de AdSense en las
// builds que llevan anuncios.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const CAPACIDADES = ['default.json', 'mobile.json']
  .map(f => join(RAIZ, 'src-tauri', 'capabilities', f));

// Plugins que la app no usa. Concederlos sería acceso al disco.
const PLUGINS_SIN_USO = ['fs', 'dialog'];

// Carpetas y archivos del frontend (lo único que puede usar un plugin).
const FRONTEND_DIRS = ['ads', 'back', 'ui'];
const FRONTEND_ARCHIVOS = [
  'index.js', 'context.js', 'api.js', 'mcp-bridge.js',
  'monetization.js', 'theme-boot.js', 'sw.js',
];

const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

// ── Utilidades ───────────────────────────────────────────────────────

/** Todos los archivos .js del frontend, como texto (recursivo: los
 *  proveedores de anuncios viven en `ads/providers/`). */
function fuentesDelFrontend() {
  const textos = [];
  for (const archivo of FRONTEND_ARCHIVOS) {
    textos.push(leer(archivo));
  }
  const recorrer = dir => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.isFile() && entrada.name.endsWith('.js')) {
        textos.push(readFileSync(ruta, 'utf8'));
      }
    }
  };
  for (const dir of FRONTEND_DIRS) recorrer(join(RAIZ, dir));
  return textos.join('\n');
}

/** Identificadores de los permisos de una capability (los objetos de
 *  scope cuentan con su `identifier`). */
function identificadores(capability) {
  return (capability.permissions || [])
    .map(p => (typeof p === 'string' ? p : p.identifier) ?? '')
    .filter(id => id.length > 0);
}

/** Plugin al que pertenece un permiso ('fs:allow-read-text-file' → 'fs'). */
function pluginDe(permiso) {
  return permiso.split(':')[0];
}

/** ¿El frontend usa de verdad ese plugin?
 *  Se admite cualquiera de las dos formas de llamar a un plugin:
 *  - por comando:  `invoke('plugin:shell|open', …)`
 *  - por la API global: `window.__TAURI__.shell.open` (con `?.` o sin él) */
function frontendUsaPlugin(texto, plugin) {
  const global = new RegExp(`__TAURI__\\s*\\??\\s*\\.\\s*${plugin}\\b`);
  return texto.includes(`plugin:${plugin}|`) || global.test(texto);
}

/** Normaliza una CSP: directivas sin fuentes → 'none'. */
function normalizarCsp(csp) {
  return csp.split(';')
    .map(d => d.trim())
    .filter(d => d.length > 0)
    .map(d => {
      const [nombre, ...fuentes] = d.split(/\s+/);
      return fuentes.length ? `${nombre} ${fuentes.join(' ')}` : `${nombre} 'none'`;
    })
    .join('; ');
}

/** Quita de la CSP las fuentes que solo hacen falta con anuncios. */
function quitarFuentes(csp, fuentes) {
  return csp.split(';')
    .map(d => d.trim())
    .filter(d => d.length > 0)
    .map(d => {
      const [nombre, ...resto] = d.split(/\s+/);
      const quedan = resto.filter(f => !fuentes.includes(f));
      return quedan.length ? `${nombre} ${quedan.join(' ')}` : `${nombre} 'none'`;
    })
    .join('; ');
}

// ── Permisos que la app concede ──────────────────────────────────────

test('las capabilities no conceden permisos de fs ni de dialog', () => {
  for (const ruta of CAPACIDADES) {
    const capability = JSON.parse(readFileSync(ruta, 'utf8'));
    const prohibidos = identificadores(capability).filter(p =>
      PLUGINS_SIN_USO.some(plugin => p === plugin || p.startsWith(`${plugin}:`)));
    assert.deepEqual(
      prohibidos, [],
      `${ruta}: la app no usa ${PLUGINS_SIN_USO.join(' ni ')}; no se deben conceder`,
    );
  }
});

test('todo plugin que concede permisos lo usa el frontend de verdad', () => {
  const frontend = fuentesDelFrontend();
  const concedidos = new Set();
  for (const ruta of CAPACIDADES) {
    const capability = JSON.parse(readFileSync(ruta, 'utf8'));
    for (const permiso of identificadores(capability)) {
      concedidos.add(pluginDe(permiso));
    }
  }

  // `core` es la API propia de Tauri (invoke, eventos…): se comprueba
  // aparte, pero también tiene que usarse.
  assert.ok(concedidos.size > 0, 'ninguna capability concede permisos');

  for (const plugin of concedidos) {
    assert.ok(
      frontendUsaPlugin(frontend, plugin),
      `se concede el plugin "${plugin}" pero el frontend no lo usa`,
    );
  }
});

test('el frontend no llama a los plugins sin uso', () => {
  const frontend = fuentesDelFrontend();
  for (const plugin of PLUGINS_SIN_USO) {
    assert.ok(
      !frontend.includes(`plugin:${plugin}|`),
      `el frontend llama a plugin:${plugin}|, pero ese plugin no debe existir`,
    );
  }
});

// ── La capa nativa ───────────────────────────────────────────────────

test('lib.rs no registra los plugins fs ni dialog', () => {
  const lib = leer('src-tauri', 'src', 'lib.rs');
  for (const plugin of PLUGINS_SIN_USO) {
    assert.ok(
      !lib.includes(`tauri_plugin_${plugin}`),
      `lib.rs registra tauri_plugin_${plugin}, que la app no usa`,
    );
  }
});

test('los plugins registrados en lib.rs los usa el frontend', () => {
  const lib = leer('src-tauri', 'src', 'lib.rs');
  const frontend = fuentesDelFrontend();
  const registrados = [...lib.matchAll(/\.plugin\(tauri_plugin_(\w+)::/g)]
    .map(m => m[1]);

  assert.ok(registrados.length > 0, 'lib.rs no registra ningún plugin');
  for (const plugin of registrados) {
    assert.ok(
      frontendUsaPlugin(frontend, plugin),
      `lib.rs registra el plugin "${plugin}" pero el frontend no lo usa`,
    );
  }
});

test('Cargo.toml no depende de los plugins fs ni dialog', () => {
  const cargo = leer('src-tauri', 'Cargo.toml');
  for (const plugin of PLUGINS_SIN_USO) {
    assert.ok(
      !cargo.includes(`tauri-plugin-${plugin}`),
      `Cargo.toml depende de tauri-plugin-${plugin}, que la app no usa`,
    );
  }
});

// ── CSP: los hosts de AdSense solo si la build lleva anuncios ────────

test('la CSP por defecto de tauri.conf.json es la de sin anuncios', () => {
  const conf = JSON.parse(leer('src-tauri', 'tauri.conf.json'));
  const csp = JSON.parse(leer('src-tauri', 'csp.json'));

  assert.equal(
    conf.app.security.csp,
    csp.sin_anuncios,
    'tauri.conf.json debe llevar la CSP sin anuncios (la segura); ' +
    'build.rs mete la de con anuncios solo si la build lleva claves de AdSense',
  );
});

test('la CSP sin anuncios no permite ningún host de AdSense', () => {
  const csp = JSON.parse(leer('src-tauri', 'csp.json'));

  for (const fuente of csp.fuentes_solo_con_anuncios) {
    assert.ok(
      !csp.sin_anuncios.includes(fuente),
      `la CSP sin anuncios no debería permitir "${fuente}"`,
    );
  }
  // Y tampoco como subcadena suelta (p. ej. "google").
  assert.ok(
    !/google|doubleclick|googlesyndication|googletag/i.test(csp.sin_anuncios),
    'la CSP sin anuncios no debería mencionar hosts de Google',
  );
});

test('las dos variantes de la CSP no se desincronizan', () => {
  const csp = JSON.parse(leer('src-tauri', 'csp.json'));

  const quitadas = normalizarCsp(
    quitarFuentes(csp.con_anuncios, csp.fuentes_solo_con_anuncios));
  assert.equal(
    quitadas,
    normalizarCsp(csp.sin_anuncios),
    'la CSP sin anuncios debe ser la de con anuncios quitando las ' +
    'fuentes que solo hacen falta para los anuncios',
  );
});

test('build.rs inyecta la CSP con TAURI_CONFIG', () => {
  const build = leer('src-tauri', 'build.rs');

  assert.ok(
    build.includes('TAURI_CONFIG'),
    'build.rs debe inyectar la CSP elegida con TAURI_CONFIG',
  );
  assert.ok(
    build.includes('GOOGLE_ADSENSE_CLIENT'),
    'build.rs debe decidir con las claves de AdSense si la build lleva anuncios',
  );
});
