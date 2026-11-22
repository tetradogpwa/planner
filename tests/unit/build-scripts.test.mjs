// T-035: el build del proyecto tiene que ser coherente y no puede
// contradecirse.
//
// Comprueba tres cosas:
//
//   1. La versión de la app tiene UNA sola fuente de verdad
//      (`src-tauri/Cargo.toml`) y no aparece copiada en ningún otro
//      sitio. `tauri.conf.json` la repite a propósito (Tauri la
//      necesita para el `versionName` de Android y para los recursos
//      de versión del `.exe` de Windows), pero no puede desincronizarse
//      sin que estas pruebas fallen.
//
//   2. Solo hay UN script de build (`tools/build.sh`). Los que había
//      por plataforma (linux, windows, msix, android) se eliminaron
//      porque se contradecían entre sí y con `tauri.conf.json`.
//
//   3. El script y la configuración dicen lo mismo: los bundles que
//      pide el script están declarados en `bundle.targets`, el objetivo
//      de Linux genera los dos formatos que se publican (AppImage y
//      .deb) y el de Android genera de verdad un APK o un AAB.
//
// La parte de "genera de verdad" se comprueba **ejecutando** el script
// con un `cargo` falso que solo anota la línea de comandos: así no
// hace falta el SDK de Android ni compilar nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

const CARGO_TOML = leer('src-tauri', 'Cargo.toml');
const TAURI_CONF = leer('src-tauri', 'tauri.conf.json');
const BUILD_SH = leer('tools', 'build.sh');
const README = leer('README-TAURI.md');

/** Versión declarada en `src-tauri/Cargo.toml` (la fuente de verdad). */
function versionDeCargoToml() {
  const m = CARGO_TOML.match(/^\s*version\s*=\s*"([^"]+)"/m);
  assert.ok(m, 'src-tauri/Cargo.toml tiene que declarar la versión del paquete');
  return m[1];
}

/** Versión declarada en `src-tauri/tauri.conf.json` (la copia). */
function versionDeTauriConf() {
  const conf = JSON.parse(TAURI_CONF);
  return conf.version ?? null;
}

/** Ficheros que se recorren buscando una copia de la versión. */
const RUTAS_REVISADAS = [
  'tools',            // scripts de build y de pruebas
  'src-tauri/src',    // código Rust de la app
  'src-tauri/build.rs',
  'src-tauri/csp.json',
  'README-TAURI.md',
];

/** Recorre una ruta y devuelve los ficheros de texto que encuentra. */
function ficheros(ruta) {
  const absoluto = join(RAIZ, ruta);
  if (!existsSync(absoluto)) return [];
  if (statSync(absoluto).isFile()) return [absoluto];
  const encontrados = [];
  for (const entrada of readdirSync(absoluto, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name === 'target' ||
        entrada.name === 'target-e2e' || entrada.name === 'gen') continue;
    const hijo = join(absoluto, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...ficheros(relative(RAIZ, hijo)));
    else encontrados.push(hijo);
  }
  return encontrados;
}

// ── 1. Una sola fuente de verdad para la versión ─────────────────────

test('la versión del paquete se declara en src-tauri/Cargo.toml', () => {
  const version = versionDeCargoToml();
  assert.match(version, /^\d+\.\d+\.\d+/, `versión con formato semver: ${version}`);
});

test('tauri.conf.json declara la misma versión que Cargo.toml', () => {
  // Tauri usa `config.version` para el `versionName` del paquete de
  // Android y para los recursos de versión del `.exe` de Windows; si
  // las dos copias se desincronizan, la app se publica con dos
  // versiones distintas.
  assert.equal(
    versionDeTauriConf(),
    versionDeCargoToml(),
    'la versión de src-tauri/tauri.conf.json tiene que ser la de ' +
    'src-tauri/Cargo.toml (la fuente de verdad)',
  );
});

test('la versión no aparece copiada en ningún otro fichero', () => {
  const version = versionDeCargoToml();
  const permitidos = new Set([
    join(RAIZ, 'src-tauri', 'Cargo.toml'),
    join(RAIZ, 'src-tauri', 'tauri.conf.json'),
  ]);

  const copias = [];
  for (const ruta of RUTAS_REVISADAS) {
    for (const fichero of ficheros(ruta)) {
      if (permitidos.has(fichero)) continue;
      const texto = readFileSync(fichero, 'utf8');
      if (texto.includes(version)) {
        copias.push(relative(RAIZ, fichero));
      }
    }
  }

  assert.deepEqual(
    copias,
    [],
    `la versión (${version}) está copiada en ${copias.join(', ')}: la fuente ` +
    'de verdad es src-tauri/Cargo.toml y nadie más la debe repetir',
  );
});

test('ningún otro tauri.conf*.json declara una versión', () => {
  // Un tauri.linux.conf.json, tauri.android.conf.json... podría
  // cambiar la versión en un solo objetivo sin que nadie se entere.
  const otros = ficheros('src-tauri')
    .filter(f => /tauri(\.[a-z]+)?\.conf\.json$/.test(f))
    .filter(f => f !== join(RAIZ, 'src-tauri', 'tauri.conf.json'));

  for (const fichero of otros) {
    const conf = JSON.parse(readFileSync(fichero, 'utf8'));
    assert.equal(
      conf.version ?? null,
      null,
      `${relative(RAIZ, fichero)} declara su propia versión: la versión la ` +
      'manda src-tauri/Cargo.toml',
    );
  }
});

test('el package.json de la raíz no declara una versión de la app', () => {
  // El package.json de la raíz solo expone `npx status`; la app no se
  // empaqueta con npm, así que no tiene versión que mantener.
  const raiz = JSON.parse(leer('package.json'));
  assert.equal(
    raiz.version ?? null,
    null,
    'el package.json de la raíz no debe declarar la versión de la app ' +
    '(la fuente de verdad es src-tauri/Cargo.toml)',
  );
});

// ── 2. Un solo script de build ───────────────────────────────────────

test('los scripts de build por plataforma ya no existen', () => {
  for (const nombre of [
    'build-linux.sh',
    'build-windows.ps1',
    'build-msix.ps1',
    'build-android.sh',
  ]) {
    assert.ok(
      !existsSync(join(RAIZ, 'tools', nombre)),
      `tools/${nombre} ya no debe existir: tools/build.sh hace todo y los ` +
      'scripts por plataforma se contradecían con tauri.conf.json',
    );
  }
});

test('tools/build.sh es el único script que empaqueta la app', () => {
  // `tools/test.sh` compila el binario de las E2E con `--no-bundle`
  // (eso no genera ningún instalador), pero ningún otro script puede
  // empaquetar: si lo hiciera, podría contradecir la configuración.
  const otros = [];
  for (const fichero of ficheros('tools')) {
    if (fichero === join(RAIZ, 'tools', 'build.sh')) continue;
    if (!/\.(sh|ps1|mjs|js)$/.test(fichero)) continue;
    readFileSync(fichero, 'utf8').split('\n').forEach((linea, i) => {
      const codigo = linea.replace(/#.*$/, '');
      if (!/cargo\s+tauri\s+(build|android\s+build)\b/.test(codigo)) return;
      if (codigo.includes('--no-bundle')) return;   // solo compila, no empaqueta
      otros.push(`${relative(RAIZ, fichero)}:${i + 1}`);
    });
  }

  assert.deepEqual(
    otros,
    [],
    'solo tools/build.sh puede empaquetar la app: si otro script llama a ' +
    '"cargo tauri build", puede contradecir la configuración',
  );
});

test('ningún script escribe dentro de dist/', () => {
  // `dist/` es el `frontendDist` de Tauri: build.rs lo borra en cada
  // build y Tauri lo embebe dentro del binario. Un artefacto escrito
  // ahí desaparece y además acaba dentro de la app.
  const frontendDist = JSON.parse(TAURI_CONF).build.frontendDist;
  assert.equal(frontendDist, '../dist', 'el frontendDist sigue siendo ../dist');

  for (const fichero of ficheros('tools')) {
    readFileSync(fichero, 'utf8').split('\n').forEach((linea, i) => {
      // Ignora los comentarios: lo que cuenta es lo que el script hace.
      const sinComentario = linea.replace(/#.*$/, '');
      const escribeEnDist = /\bdist\//.test(sinComentario) ||
        /["']dist["']/.test(sinComentario);
      assert.ok(
        !escribeEnDist,
        `${relative(RAIZ, fichero)}:${i + 1} escribe en dist/ (${linea.trim()}): ` +
        'dist/ es el frontendDist, no un directorio de salida',
      );
    });
  }
});

// ── 3. El script y la configuración no se contradicen ────────────────

test('los bundles que pide build.sh están declarados en tauri.conf.json', () => {
  const targets = JSON.parse(TAURI_CONF).bundle.targets;
  const pedidos = new Set();
  for (const m of BUILD_SH.matchAll(/--bundles\s+([a-z0-9,_-]+)/g)) {
    for (const bundle of m[1].split(',')) pedidos.add(bundle.trim());
  }

  assert.ok(pedidos.size > 0, 'build.sh tiene que pedir algún bundle');
  for (const bundle of pedidos) {
    assert.ok(
      targets.includes(bundle),
      `build.sh genera el bundle "${bundle}", pero no está en ` +
      `bundle.targets de tauri.conf.json (${targets.join(', ')})`,
    );
  }
});

test('el objetivo de Linux genera el AppImage y el .deb', () => {
  assert.match(BUILD_SH, /--bundles\s+appimage,deb/, 'el objetivo linux pide AppImage y .deb');
  assert.match(BUILD_SH, /bundle\/deb\/\*\.deb/, 'el .deb se recoge en releases/');
});

test('tauri.conf.json declara los mismos targets que genera el script', () => {
  const targets = JSON.parse(TAURI_CONF).bundle.targets;
  for (const bundle of ['appimage', 'deb', 'nsis']) {
    assert.ok(
      targets.includes(bundle),
      `bundle.targets (${targets.join(', ')}) tiene que incluir "${bundle}": ` +
      'es lo que genera tools/build.sh',
    );
  }
});

test('la ayuda de build.sh describe lo que hace', () => {
  const ayuda = spawnSync('bash', [join(RAIZ, 'tools', 'build.sh'), '--help'], {
    encoding: 'utf8',
  });
  assert.equal(ayuda.status, 0, 'build.sh --help tiene que salir con 0');
  for (const texto of ['--aab', '--apk', 'appimage', '.deb', 'nsis', 'releases/']) {
    assert.ok(
      ayuda.stdout.toLowerCase().includes(texto.toLowerCase()),
      `la ayuda de build.sh no menciona "${texto}"`,
    );
  }
});

// ── 4. El script llama a la CLI como debe (se ejecuta de verdad) ─────

/**
 * Ejecuta `tools/build.sh` con un `cargo` falso que solo anota la
 * línea de comandos. No compila nada: sirve para comprobar qué le
 * pide el script a la CLI de Tauri.
 */
function ejecutarBuildSh(args) {
  const raiz = mkdtempSync(join(tmpdir(), 'planner-build-'));
  const log = join(raiz, 'cargo.log');

  // El script hace `cd` a la carpeta padre de tools/: se le da una
  // raíz falsa para no tocar el repo.
  mkdirSync(join(raiz, 'tools'), { recursive: true });
  copyFileSync(join(RAIZ, 'tools', 'build.sh'), join(raiz, 'tools', 'build.sh'));
  mkdirSync(join(raiz, 'src-tauri', 'gen', 'android'), { recursive: true });
  mkdirSync(join(raiz, 'bin'), { recursive: true });
  writeFileSync(
    join(raiz, 'bin', 'cargo'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> '${log}'\nexit 0\n`,
    { mode: 0o755 },
  );

  let res;
  let llamadas;
  try {
    res = spawnSync('bash', [join(raiz, 'tools', 'build.sh'), ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(raiz, 'bin')}:${process.env.PATH}`,
        ANDROID_HOME: join(raiz, 'sdk'),
        ANDROID_NDK_HOME: join(raiz, 'ndk'),
      },
    });

    llamadas = existsSync(log)
      ? readFileSync(log, 'utf8').split('\n').filter(Boolean)
      : [];
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }

  return { status: res.status, stdout: res.stdout, stderr: res.stderr, llamadas };
}

test('el objetivo android llama a la CLI con --aab (y no con --apk)', () => {
  const res = ejecutarBuildSh(['android', '--aab']);

  const llamada = res.llamadas.find(l => l.includes('android build'));
  assert.ok(llamada, `la CLI no llegó a llamarse (${res.llamadas.join(' | ')})`);
  assert.match(llamada, /tauri android build .*--aab/);
  assert.ok(!llamada.includes('--apk'), `no debe pedir un APK: ${llamada}`);
});

test('el objetivo android sin --aab pide un APK', () => {
  const res = ejecutarBuildSh(['android']);
  const llamada = res.llamadas.find(l => l.includes('android build'));
  assert.ok(llamada, `la CLI no llegó a llamarse (${res.llamadas.join(' | ')})`);
  assert.match(llamada, /tauri android build .*--apk/);
  assert.ok(!llamada.includes('--aab'), `no debe pedir un AAB: ${llamada}`);
});

test('el objetivo linux pide los dos bundles de Linux', () => {
  const res = ejecutarBuildSh(['linux']);
  const llamada = res.llamadas.find(l => l.includes('tauri build'));
  assert.ok(llamada, `la CLI no llegó a llamarse (${res.llamadas.join(' | ')})`);
  assert.match(llamada, /--bundles appimage,deb/);
});

test('--apk y --aab a la vez son un error', () => {
  const res = ejecutarBuildSh(['android', '--apk', '--aab']);
  assert.equal(res.status, 2, 'tiene que salir con el código de error de argumentos');
  assert.match(res.stderr, /excluyentes/);
});

// ── 5. La documentación no manda a scripts que no existen ────────────

test('la config crea el directorio del frontend antes de compilar', () => {
  // El CLI de Tauri comprueba que `frontendDist` EXISTA antes de
  // compilar, y en un clon limpio no existe (dist/ esta en .gitignore y
  // lo crea build.rs, que se ejecuta mas tarde). Sin esto, en un clon
  // nuevo el build falla con "Unable to find your web assets" y los
  // E2E no se pueden ni compilar: fue lo que paso en el primer CI en
  // GitHub.
  const conf = JSON.parse(leer('src-tauri', 'tauri.conf.json'));
  const comando = conf.build?.beforeBuildCommand ?? '';
  assert.ok(comando.length > 0,
    'tauri.conf.json necesita un beforeBuildCommand que cree el ' +
    'directorio del frontend (frontendDist) antes de compilar');
  assert.match(comando, /mkdir\b/,
    'el beforeBuildCommand tiene que crear el directorio');
  const destino = conf.build.frontendDist.replace(/^\.\.\//, '');
  assert.ok(comando.includes(destino),
    `el beforeBuildCommand tiene que crear el frontendDist de la ` +
    `configuracion (${conf.build.frontendDist}), y crea: ${comando}`);
});

test('la toolchain de Rust está fijada', () => {
  // Sin rust-toolchain.toml, cada máquina usa la versión de Rust que
  // tenga: el mismo commit compila en unos sitios y en otros no.
  const toml = leer('rust-toolchain.toml');
  assert.match(toml, /channel\s*=\s*"\d+\.\d+\.\d+"/,
    'rust-toolchain.toml tiene que fijar una versión exacta de Rust ' +
    '(no "stable": esa cambia sin avisar)');
});

test('las herramientas se instalan con versión exacta y --locked', () => {
  for (const script of ['build.sh', 'test.sh']) {
    const texto = leer('tools', script);
    for (const m of texto.matchAll(/cargo install ([a-z0-9-]+)([^\n]*)/g)) {
      const [, herramienta, resto] = m;
      assert.match(resto, /--version\s+['"]?\d/,
        `tools/${script}: "${herramienta}" se instala con un rango de ` +
        'versiones; tiene que ser una versión exacta');
      assert.match(resto, /--locked/,
        `tools/${script}: "${herramienta}" se instala sin --locked`);
    }
  }
});

test('todas las compilaciones pasan --locked', () => {
  for (const script of ['build.sh', 'test.sh']) {
    const texto = leer('tools', script);
    const lineas = texto.split('\n');
    for (let i = 0; i < lineas.length; i++) {
      if (!/cargo tauri (build|android build)/.test(lineas[i])) continue;
      // La llamada puede ocupar varias líneas: se mira el bloque
      // entero hasta que acaba la orden.
      const bloque = lineas.slice(i, i + 8).join('\n');
      assert.match(bloque, /-- --locked/,
        `tools/${script}:${i + 1}: la compilación tiene que pasar ` +
        '--locked (si el lock no cuadra, que falle y no se resuelva solo)');
    }
  }
});

test('no hay dependencias directas sin usar', () => {
  const cargo = leer('src-tauri', 'Cargo.toml');
  const fuentes = [
    ...leer('src-tauri', 'src', 'lib.rs'),
    ...leer('src-tauri', 'src', 'mcp.rs'),
    ...leer('src-tauri', 'src', 'ads.rs'),
    ...leer('src-tauri', 'build.rs'),
  ].join('\n');
  for (const dep of ['thiserror', 'tauri-plugin-dialog', 'tauri-plugin-fs']) {
    assert.ok(!cargo.includes(dep),
      `src-tauri/Cargo.toml declara "${dep}", que no se usa`);
    assert.ok(!fuentes.includes(dep.replace(/-/g, '_')),
      `"${dep}" no se usa en el código`);
  }
});

test('el MSRV declarado es el de la toolchain fijada', () => {
  const cargo = leer('src-tauri', 'Cargo.toml');
  const m = /rust-version\s*=\s*"(\d+\.\d+)"/.exec(cargo);
  assert.ok(m, 'Cargo.toml tiene que declarar rust-version');
  const toolchain = /channel\s*=\s*"(\d+\.\d+)\.\d+"/.exec(leer('rust-toolchain.toml'));
  assert.ok(toolchain, 'rust-toolchain.toml tiene que fijar la versión');
  assert.equal(m[1], toolchain[1],
    'el MSRV de Cargo.toml y la versión fijada tienen que ser la misma');
});

test('el README-TAURI.md apunta al script unificado', () => {
  assert.ok(
    README.includes('tools/build.sh'),
    'README-TAURI.md tiene que documentar tools/build.sh',
  );
  for (const nombre of [
    'build-linux.sh',
    'build-windows.ps1',
    'build-msix.ps1',
    'build-android.sh',
  ]) {
    assert.ok(
      !README.includes(nombre),
      `README-TAURI.md sigue hablando de ${nombre}, que ya no existe`,
    );
  }
});

test('el README-TAURI.md explica la firma de Windows y el tema MSIX', () => {
  assert.ok(
    README.includes('[TU_THUMBPRINT_CERTIFICADO_NSIS]'),
    'el README tiene que explicar el placeholder del thumbprint de NSIS',
  );
  assert.match(
    README,
    /sin firmar/i,
    'el README tiene que decir que sin thumbprint real el instalador sale sin firmar',
  );
  assert.ok(
    /msix/i.test(README),
    'el README tiene que explicar qué pasa con el MSIX',
  );
  assert.ok(
    README.includes('cargo-msix'),
    'el README tiene que decir qué es cargo-msix y en qué estado está',
  );
});
