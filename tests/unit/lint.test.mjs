// T-037: el linter, el formato y los ficheros que faltaban.
//
// Esto es una GUARDA, no una prueba del linter: desde aquí no se
// ejecuta ESLint (eso lo hace el job `lint` del CI, que tiene las
// dependencias instaladas). Lo que se comprueba es que las piezas
// existan y digan lo que tienen que decir:
//
//   1. `npm run lint` existe y apunta a ESLint, y `eslint` está en las
//      devDependencies de la raíz (la app sigue sin npm).
//   2. `eslint.config.js` existe y cubre el frontend, las pruebas y
//      las herramientas; `vendor/` queda fuera.
//   3. `.editorconfig` y `.gitattributes` fijan las convenciones de
//      formato (2 espacios, LF, UTF-8) y los `.sh` se guardan con LF.
//   4. `LICENSE` en la raíz es el mismo texto que `legal/LICENSE`.
//   5. `CHANGELOG.md`, `CONTRIBUTING.md` y `SECURITY.md` existen y
//      no se contradicen con los textos legales.
//   6. Dependabot está configurado para npm y para cargo.
//
// Si alguien borra o vacía uno de estos ficheros, estas pruebas lo
// dicen; lo que no pueden decir es si el linter encuentra algo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

// ── 1. `npm run lint` ───────────────────────────────────────────────

test('el package.json de la raíz declara el script de lint', () => {
  const pkg = JSON.parse(leer('package.json'));
  assert.ok(pkg.scripts?.lint, 'el package.json de la raíz necesita un script "lint"');
  assert.match(pkg.scripts.lint, /\beslint\b/,
    'el script "lint" tiene que ejecutar ESLint');
});

test('eslint es una devDependency de la raíz, no una dependencia de la app', () => {
  const pkg = JSON.parse(leer('package.json'));
  assert.ok(pkg.devDependencies?.eslint,
    'eslint tiene que estar en las devDependencies de la raíz');
  assert.equal(pkg.dependencies, undefined,
    'la raíz no debe tener dependencias de producción: la app no lleva npm');
  assert.equal(pkg.version, undefined,
    'el package.json de la raíz no declara versión de la app (la manda src-tauri/Cargo.toml)');
});

// ── 2. La configuración del linter ──────────────────────────────────

test('existe eslint.config.js', () => {
  assert.ok(existsSync(join(RAIZ, 'eslint.config.js')), 'falta eslint.config.js');
});

test('el linter cubre el frontend, las pruebas y las herramientas', () => {
  const config = leer('eslint.config.js');
  for (const ambito of ['index.js', 'back/', 'ui/', 'tests/', 'tools/']) {
    assert.ok(config.includes(ambito),
      `la configuración del linter tiene que cubrir \`${ambito}\``);
  }
});

test('el linter excluye vendor/ (es un bundle de terceros)', () => {
  const config = leer('eslint.config.js');
  assert.match(config, /vendor\/\*\*/,
    'la configuración del linter tiene que ignorar vendor/');
});

test('el linter no formatea: el formato lo marcan .editorconfig', () => {
  // El proyecto se escribe a mano: si el linter metiera reglas de
  // estilo (indent, quotes…), reformatear el código existente sería
  // un diff imposible de revisar. Se comprueba que no están.
  const config = leer('eslint.config.js');
  for (const regla of ['indent', 'quotes', 'semi', 'max-len']) {
    assert.ok(!new RegExp(`['"]${regla}['"]\\s*:`).test(config),
      `el linter no debe activar la regla de estilo \`${regla}\``);
  }
});

// ── 3. Convenciones de formato ─────────────────────────────────────

test('existe .editorconfig con 2 espacios, LF y UTF-8', () => {
  const ec = leer('.editorconfig');
  assert.match(ec, /^root\s*=\s*true\s*$/m,
    '.editorconfig tiene que declarar root = true');
  assert.match(ec, /^\s*indent_style\s*=\s*space\s*$/m);
  assert.match(ec, /^\s*indent_size\s*=\s*2\s*$/m);
  assert.match(ec, /^\s*end_of_line\s*=\s*lf\s*$/m);
  assert.match(ec, /^\s*charset\s*=\s*utf-8\s*$/m);
});

test('existe .gitattributes y los .sh se guardan con LF', () => {
  const ga = leer('.gitattributes');
  assert.match(ga, /^\*\.sh\s+text\s+eol=lf\s*$/m,
    '.gitattributes tiene que forzar LF en los scripts de shell: con CRLF no funcionan en Windows');
  assert.match(ga, /^\*\s+text=auto\s+eol=lf\s*$/m,
    '.gitattributes tiene que normalizar el resto de ficheros de texto a LF');
});

// ── 4. La licencia ──────────────────────────────────────────────────

test('LICENSE en la raíz es el mismo texto que legal/LICENSE', () => {
  assert.ok(existsSync(join(RAIZ, 'LICENSE')), 'falta LICENSE en la raíz');
  assert.equal(leer('LICENSE'), leer('legal', 'LICENSE'),
    'la LICENSE de la raíz tiene que ser la misma que legal/LICENSE (mismo texto, sin cambios legales)');
});

// ── 5. CHANGELOG, CONTRIBUTING y SECURITY ───────────────────────────

test('existe CHANGELOG.md con la versión actual', () => {
  assert.ok(existsSync(join(RAIZ, 'CHANGELOG.md')), 'falta CHANGELOG.md');
  const changelog = leer('CHANGELOG.md');
  assert.match(changelog, /0\.1\.0/,
    'el CHANGELOG tiene que mencionar la versión actual (0.1.0)');
  assert.match(changelog, /Keep a Changelog/i,
    'el CHANGELOG tiene que seguir el formato de Keep a Changelog');
});

test('existe CONTRIBUTING.md y explica cómo se trabaja en el proyecto', () => {
  assert.ok(existsSync(join(RAIZ, 'CONTRIBUTING.md')), 'falta CONTRIBUTING.md');
  const c = leer('CONTRIBUTING.md');
  for (const tema of [
    ['.tasks', 'la cola de tareas'],
    ['tools/test.sh', 'el script de pruebas'],
    ['CLAUDE.md', 'las convenciones del proyecto'],
  ]) {
    assert.ok(c.includes(tema[0]),
      `CONTRIBUTING.md tiene que hablar de ${tema[1]} (\`${tema[0]}\`)`);
  }
});

test('existe SECURITY.md con el correo de contacto de legal/CONTACT.md', () => {
  assert.ok(existsSync(join(RAIZ, 'SECURITY.md')), 'falta SECURITY.md');
  const seguridad = leer('SECURITY.md');
  const contacto = leer('legal', 'CONTACT.md');

  // El correo se saca de los textos legales: no se inventa otro.
  const correo = /[\w.+-]+@[\w.-]+\.\w+/.exec(contacto);
  assert.ok(correo, 'legal/CONTACT.md tiene que tener un correo de contacto');
  assert.ok(seguridad.includes(correo[0]),
    `SECURITY.md tiene que avisar al correo de contacto (${correo[0]})`);
});

test('SECURITY.md explica cómo está protegido el servidor MCP local', () => {
  const seguridad = leer('SECURITY.md');
  assert.match(seguridad, /127\.0\.0\.1/,
    'SECURITY.md tiene que decir que el servidor MCP solo escucha en 127.0.0.1');
  assert.match(seguridad, /Bearer/i,
    'SECURITY.md tiene que mencionar el token Bearer del servidor MCP');
});

// ── 6. Dependabot ───────────────────────────────────────────────────

test('Dependabot está configurado para npm y para cargo', () => {
  const ruta = join('.github', 'dependabot.yml');
  assert.ok(existsSync(join(RAIZ, ruta)), 'falta .github/dependabot.yml');
  const yml = leer('.github', 'dependabot.yml');

  assert.match(yml, /package-ecosystem:\s*npm/,
    'Dependabot tiene que vigilar las dependencias de npm');
  assert.match(yml, /package-ecosystem:\s*cargo/,
    'Dependabot tiene que vigilar las dependencias de cargo');
  // npm: la raíz (el linter) y las E2E.
  assert.match(yml, /directory:\s*"\/"/,
    'Dependabot tiene que vigilar el package.json de la raíz');
  assert.match(yml, /directory:\s*"\/tests\/e2e"/,
    'Dependabot tiene que vigilar el package.json de las E2E');
  // cargo: la capa nativa.
  assert.match(yml, /directory:\s*"\/src-tauri"/,
    'Dependabot tiene que vigilar el Cargo.toml de src-tauri');
});
