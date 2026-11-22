// T-036: el CI tiene que existir y decir lo que tiene que decir.
//
// Esto es una GUARDA, no una prueba del workflow: desde aquí no se
// puede ejecutar GitHub Actions (ni el runner de Ubuntu con sus
// dependencias de WebKitGTK y tauri-driver). Lo que se comprueba es que
// el fichero del workflow está, que lanza TODAS las pruebas del repo
// (unitarias, `node --check` del frontend, Rust y la suite E2E
// completa), que reutiliza `tools/test.sh` en vez de reimplementarlo,
// que guarda los logs como artefactos siempre, y que el README lleva
// el badge y la documentación de la protección de `main` con los
// nombres exactos de los jobs.
//
// Si algún día se cambia el workflow (o se rompe), estas pruebas lo
// dicen; lo que no pueden decir es si el runner se comporta bien.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

const WORKFLOW = join('.github', 'workflows', 'ci.yml');
const REPO = 'tetradogpwa/planner';
const NOMBRE_WORKFLOW = 'ci.yml';

/**
 * Jobs del workflow: id → texto del job (sus pasos).
 * Es un recorte de texto, no un parser de YAML: solo necesita el
 * bloque `jobs:` con sus claves de dos espacios.
 */
function jobsDelWorkflow(texto) {
  const lineas = texto.split('\n');
  const inicio = lineas.findIndex((l) => /^jobs:\s*$/.test(l));
  assert.notEqual(inicio, -1, 'el workflow tiene que tener un bloque `jobs:`');

  const mapa = new Map();
  let id = null;
  for (const linea of lineas.slice(inicio + 1)) {
    if (linea.trim() === '') continue;
    if (!/^\s/.test(linea)) break; // se acabó el bloque `jobs:`
    const clave = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(linea);
    if (clave) {
      id = clave[1];
      mapa.set(id, []);
      continue;
    }
    if (id) mapa.get(id).push(linea);
  }
  return new Map([...mapa].map(([k, v]) => [k, v.join('\n')]));
}

const cuerpoWorkflow = () => leer(WORKFLOW);
const cuerpoJob = (id) => {
  const jobs = jobsDelWorkflow(cuerpoWorkflow());
  assert.ok(jobs.has(id), `el workflow tiene que tener el job \`${id}\``);
  return jobs.get(id);
};

/**
 * Lo que el job ejecuta de verdad: sin comentarios y sin los nombres
 * de los pasos. Un paso que se llama "cargo clippy" no significa que
 * se ejecute clippy: si el `run:` dejara de llamarlo, la guarda tiene
 * que detectinglo.
 */
function comandosEjecutados(id) {
  return cuerpoJob(id)
    .split('\n')
    .filter((linea) => {
      const t = linea.trim();
      if (t.startsWith('#')) return false;        // comentario
      if (t.startsWith('- name:')) return false;   // nombre del paso
      return true;
    })
    .join('\n');
}

// ── El workflow existe y tiene los tres jobs ─────────────────────────

test('existe el workflow del CI', () => {
  assert.ok(existsSync(join(RAIZ, WORKFLOW)), `falta ${WORKFLOW}`);
});

test('el workflow tiene los jobs unit, rust y e2e', () => {
  const jobs = jobsDelWorkflow(cuerpoWorkflow());
  for (const esperado of ['unit', 'rust', 'e2e']) {
    assert.ok(jobs.has(esperado), `falta el job \`${esperado}\` en el workflow`);
  }
});

test('cada job se llama como su id (ese es el nombre del status check)', () => {
  // El nombre del job es lo que GitHub muestra como status check y lo
  // que hay que poner en la protección de `main`. Si el `name:` no
  // coincide con el id, la documentación de la protección se queda
  // desfasada sin que nadie se entere.
  for (const [id, cuerpo] of jobsDelWorkflow(cuerpoWorkflow())) {
    const m = /^\s*name:\s*(\S+)\s*$/m.exec(cuerpo);
    assert.ok(m, `el job \`${id}\` no declara \`name:\``);
    assert.equal(m[1], id, `el job \`${id}\` debería llamarse \`${id}\``);
  }
});

test('el workflow se dispara en push y en pull_request', () => {
  const texto = cuerpoWorkflow();
  assert.match(texto, /^on:/m, 'el workflow tiene que declarar sus disparadores');
  assert.match(texto, /^\s+push:/m);
  assert.match(texto, /^\s+pull_request:/m);
});

// ── Cada job lanza lo que tiene que lanzar ──────────────────────────

test('el job unit lanza las unitarias y el node --check de todo el frontend', () => {
  const cuerpo = comandosEjecutados('unit');
  assert.match(cuerpo, /bash tools\/test\.sh unit/,
    'las unitarias se lanzan con el script del repo, no reimplementadas');
  assert.match(cuerpo, /node --check/,
    'el frontend (JavaScript sin bundler) tiene que pasar node --check');
  assert.match(cuerpo, /node-version:\s*['"]?22/,
    'Node 22 es el mínimo: el glob de `node --test` solo se expande desde la v22');
});

test('el job rust hace cargo check, cargo test y clippy', () => {
  const cuerpo = comandosEjecutados('rust');
  assert.match(cuerpo, /cargo check/);
  assert.match(cuerpo, /cargo test/);
  assert.match(cuerpo, /cargo clippy/);
});

test('el job e2e lanza la suite completa con lo que necesita', () => {
  const cuerpo = comandosEjecutados('e2e');
  assert.match(cuerpo, /bash tools\/test\.sh e2e/,
    'los E2E se lanzan con el script del repo (aísla los datos y el display)');
  assert.match(cuerpo, /npm ci/,
    'las dependencias de los E2E se instalan con npm ci (versiones exactas)');
  assert.match(cuerpo, /PLANNER_E2E_DISPLAY/,
    'hay que elegir servidor gráfico: x11 (Xvfb) o wayland (weston)');
  for (const paquete of ['weston', 'webkit2gtk-driver', 'xvfb']) {
    assert.ok(cuerpo.includes(paquete), `el job e2e tiene que instalar \`${paquete}\``);
  }
  assert.match(cuerpo, /cargo install tauri-driver/);
  assert.match(cuerpo, /cargo install tauri-cli/);
});

// ── El CI bloquea de verdad y guarda los logs ────────────────────────

test('los logs de las pruebas se suben como artefactos siempre', () => {
  const texto = cuerpoWorkflow();
  const subidas = (texto.match(/actions\/upload-artifact@v\d+/g) || []).length;
  const siempre = (texto.match(/if:\s*always\(\)/g) || []).length;
  assert.ok(subidas >= 3, 'cada job tiene que subir su log como artefacto');
  assert.ok(siempre >= subidas,
    'cada subida de artefacto tiene que ser `if: always()` (también al fallar)');
  assert.match(texto, /path:\s*logs\//,
    'los logs de tools/test.sh (logs/) tienen que subirse');
});

test('ningún paso del CI puede ignorar sus errores', () => {
  const texto = cuerpoWorkflow();
  assert.ok(!/continue-on-error/.test(texto),
    'con continue-on-error el CI no fallaría y la protección de main no serviría');
});

// ── El badge y la documentación ──────────────────────────────────────

test('el README.md lleva el badge del CI con la URL del repo', () => {
  const readme = leer('README.md');
  const url = `https://github.com/${REPO}/actions/workflows/${NOMBRE_WORKFLOW}`;
  assert.ok(readme.includes(`${url}/badge.svg`), 'falta el badge del CI en el README');
  assert.ok(readme.includes(`](${url})`), 'el badge tiene que enlazar al workflow');
});

test('README-TAURI.md explica cómo proteger main', () => {
  const doc = leer('README-TAURI.md');
  assert.match(doc, /Settings\s*→\s*Branches/,
    'hay que indicar la ruta exacta de la interfaz');
  assert.match(doc, /Add rule/);
  assert.match(doc,
    /gh api -X PUT repos\/tetradogpwa\/planner\/branches\/main\/protection/,
    'hay que dejar el comando equivalente con gh api, copiable');
  assert.match(doc, /a mano/,
    'hay que decir que la regla se activa a mano una vez');
});

test('la protección de main exige exactamente los checks del workflow', () => {
  const doc = leer('README-TAURI.md');
  const bloque = /"contexts"\s*:\s*\[([^\]]*)\]/.exec(doc);
  assert.ok(bloque, 'el comando de gh api tiene que listar los checks en "contexts"');
  const contexts = bloque[1]
    .split(',')
    .map((s) => s.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
  const delWorkflow = [...jobsDelWorkflow(cuerpoWorkflow()).keys()].sort();
  assert.deepEqual(contexts.sort(), delWorkflow,
    'los status checks exigidos tienen que ser los jobs del workflow');
});
