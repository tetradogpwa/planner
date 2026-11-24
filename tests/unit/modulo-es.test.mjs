// T-043: el package.json de la raíz declara "type": "module".
//
// Sin esa declaración Node tiene que ADIVINAR si un .js es CommonJS o
// un módulo ES: cuando encuentra sintaxis de módulo, lo reparsea y
// avisa con MODULE_TYPELESS_PACKAGE_JSON ("Reparsing as ES module…",
// "This incurs a performance overhead").
//
// El aviso salía al CARGAR los .js del frontend, que es lo que hacen
// las pruebas unitarias al importarlos. `node --check` NO lo daba: esa
// orden solo analiza la sintaxis, sin cargar el módulo, así que allí no
// hay aviso que ver.
//
// Lo que se comprueba:
//   1. El package.json de la raíz declara "type": "module".
//   2. Node carga un .js del frontend como módulo ES desde el principio:
//      importarlo no reparsea y no avisa (y el módulo se carga de verdad).
//   3. Con ese package.json, `node --check` trata los .js como módulos
//      ES y no como CommonJS.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// El aviso que se quiere quitar.
const AVISO = 'MODULE_TYPELESS_PACKAGE_JSON';

/**
 * Lanza Node en la raíz del repo y devuelve su salida (stdout + stderr)
 * y su código de salida.
 *
 * El entorno va limpio a propósito: el runner de las unitarias deja
 * NODE_V8_COVERAGE y NODE_OPTIONS, y el hijo no las necesita (si las
 * hereda, Node peta al escribir el perfil de cobertura).
 *
 * `cwd` permite lanzar Node en otra carpeta, para comprobar cómo
 * interpreta un .js según el package.json que lo rodea.
 */
function correrNode(args, cwd = RAIZ) {
  const entorno = { ...process.env };
  delete entorno.NODE_V8_COVERAGE;
  delete entorno.NODE_OPTIONS;

  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: entorno,
  });
  return {
    codigo: r.status,
    salida: (r.stdout || '') + (r.stderr || ''),
  };
}

// ── 1. El package.json de la raíz ────────────────────────────────────

test('el package.json de la raíz declara "type": "module"', () => {
  const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module',
    'sin "type": "module" Node reparsea los .js como módulos ES y avisa');
});

// ── 2. Importar un .js del frontend ──────────────────────────────────

test('importar un .js del frontend no reparsea ni avisa', () => {
  // Se importa el módulo DE VERDAD y se mira lo que vería quien lo usa:
  // la función que exporta. Si el módulo no se cargara, el código no
  // imprimiría nada y la prueba fallaría.
  const r = correrNode([
    '-e',
    "import('./back/calendar.js').then(m => console.log(typeof m.getMondayOfWeek))",
  ]);

  assert.equal(r.codigo, 0, `Node falló al importar el módulo:\n${r.salida}`);
  assert.match(r.salida, /function/,
    `el módulo no se cargó de verdad:\n${r.salida}`);
  assert.ok(!r.salida.includes(AVISO),
    `Node avisó de ${AVISO} al importar el .js:\n${r.salida}`);
});

// ── 3. `node --check` y el tipo de módulo ─────────────────────────────

test('con el package.json de la raíz, node --check trata los .js como módulos ES', () => {
  // Un `return` fuera de una función vale en CommonJS (Node envuelve el
  // fichero en una función) pero es un error de sintaxis en un módulo
  // ES. Por eso sirve de sonda: si `node --check` la acepta, está
  // tratando el .js como CommonJS; si la rechaza, lo trata como módulo
  // ES.
  const SONDA_COMUNJS = 'return 1;\n';

  // La sonda se comprueba en dos carpetas temporales: una con el
  // package.json de la raíz (copiado tal cual, para que mande lo mismo
  // que en el repo) y otra sin "type", que es como estaba el repo
  // antes de este cambio. La comparación es la que demuestra que la
  // declaración del package.json es la que decide.
  const conTipo = mkdtempSync(join(tmpdir(), 'planner-tipo-si-'));
  const sinTipo = mkdtempSync(join(tmpdir(), 'planner-tipo-no-'));
  try {
    writeFileSync(join(conTipo, 'package.json'),
      readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    writeFileSync(join(sinTipo, 'package.json'),
      JSON.stringify({ name: 'sin-tipo', private: true }));
    writeFileSync(join(conTipo, 'sonda.js'), SONDA_COMUNJS);
    writeFileSync(join(sinTipo, 'sonda.js'), SONDA_COMUNJS);

    const conTipoR = correrNode(['--check', 'sonda.js'], conTipo);
    const sinTipoR = correrNode(['--check', 'sonda.js'], sinTipo);

    assert.equal(sinTipoR.codigo, 0,
      `sin "type": "module" la sonda debería compilar como CommonJS:\n${sinTipoR.salida}`);
    assert.notEqual(conTipoR.codigo, 0,
      `con el package.json de la raíz la sonda debería fallar (módulo ES):\n${conTipoR.salida}`);
  } finally {
    rmSync(conTipo, { recursive: true, force: true });
    rmSync(sinTipo, { recursive: true, force: true });
  }
});
