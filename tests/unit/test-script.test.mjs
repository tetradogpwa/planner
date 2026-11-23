// T-039: `tools/test.sh` a la altura del proyecto.
//
// El script de pruebas es la puerta de entrada de todo el proyecto:
// si él se salta una comprobación o se sale en verde sin haber
// ejecutado nada, el resto de las pruebas no valen nada. Estas pruebas
// lo EJECUTAN (con dobles de `node` y de `cargo`) y comprueban que:
//
//   1. Avisa (y sale con código ≠ 0) si la versión de Node es menor
//      que la mínima: el glob entrecomillado 'tests/unit/*.test.mjs'
//      solo lo expande Node desde la v22 y, con una versión menor, el
//      script se saldría en verde sin ejecutar ninguna prueba.
//   2. Sale con código ≠ 0 si no se ha ejecutado ninguna prueba.
//   3. Ejecuta `node --check` sobre TODO el JavaScript y `cargo test`
//      + `cargo clippy`.
//   4. Muestra la cobertura de las unitarias.
//   5. Poda `logs/` (conserva los N últimos).
//   6. Comprueba el puerto del MCP (41237), no solo el de WebdriverIO.
//   7. Un E2E que falla deja capturas y trazas.
//
// Las pruebas que necesitan el E2E de verdad (que un fallo deje una
// captura) no se pueden hacer aquí: eso lo comprueba el E2E en sí y
// el resto se comprueba leyendo la configuración de WebdriverIO.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, chmodSync, utimesSync }
  from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync, spawn, execFileSync } from 'node:child_process';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

const TEST_SH = leer('tools', 'test.sh');
const WDIO_CONF = leer('tests', 'e2e', 'wdio.conf.mjs');

/**
 * Ejecuta `tools/test.sh` en un entorno controlado.
 *
 * `dobleNode` permite simular una versión de Node antigua y
 * `nodoFalso` sustituir el runner de pruebas por uno que solo dice
 * cuántas pruebas ejecutó (así estas pruebas no lanzan las unitarias
 * de verdad: Node no admite un `node --test` dentro de otro).
 * `dobleCargo` simula un cargo que falla.
 */
function ejecutarTestSh(args, {
  dobleNode = null,
  nodoFalso = null,
  dobleCargo = null,
  cwd = RAIZ,
  env = {},
} = {}) {
  const dir = mkdtempPlano();
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });

  // Un `node` falso. Con `dobleNode` responde con otra versión al
  // --version; con `nodoFalso` responde como un runner de pruebas.
  if (dobleNode || nodoFalso) {
    writeFileSync(join(bin, 'node'), `#!/usr/bin/env bash
if [ "$1" = "--version" ]; then echo "${dobleNode ?? process.version}"; exit 0; fi
${nodoFalso ?? `exec ${process.execPath} "$@"`}
`, 'utf8');
    chmodSync(join(bin, 'node'), 0o755);
  }

  // Un `cargo` falso: falla (o no) como se le pida.
  if (dobleCargo) {
    writeFileSync(join(bin, 'cargo'), `#!/usr/bin/env bash
${dobleCargo === 'falla' ? 'echo "cargo: error simulado" >&2; exit 101' : 'echo "cargo: simulado"'}
exit 0
`, 'utf8');
    chmodSync(join(bin, 'cargo'), 0o755);
  }

  const path = bin + ':' + (process.env.PATH ?? '');
  // Los logs de estas ejecuciones van a una carpeta temporal: si
  // fueran a logs/, estas pruebas dejarían logs espurios en el
  // repositorio (y la poda del script los borraría).
  const logs = join(dir, 'logs');
  mkdirSync(logs, { recursive: true });
  const res = spawnSync('bash', [join(RAIZ, 'tools', 'test.sh'), ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: path,
      PLANNER_LOG_DIR: logs,
      ...env,
    },
    timeout: 120_000,
  });

  return { res, dir, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

/**
 * Igual que `spawnSync`, pero sin bloquear: sirve para lanzar dos
 * ejecuciones a la vez (y ver si comparten el fichero del log).
 */
function spawnAsync(cmd, args, cwd, env) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, env });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

/**
 * Un runner de pruebas falso: dice que ha ejecutado N pruebas y
 * escribe la tabla de cobertura, como hace el runner de verdad.
 */
function runnerFalso(cuantas = 3) {
  return `
echo "# tests ${cuantas}"
echo "# pass ${cuantas}"
echo "# fail 0"
echo "# start of coverage report"
echo "# file | line % | branch % | funcs % | uncovered lines"
echo "#  api.js | 99.19 | 91.74 | 96.43 | 187-188"
echo "# all files | 90.11 | 89.52 | 86.12 | "
echo "# end of coverage report"
exit 0
`;
}

/** Carpeta temporal que se limpia al terminar (en `after`). */
function mkdtempPlano() {
  const dir = join(tmpdir(), `planner-t039-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── 1. La versión de Node ────────────────────────────────────────────

test('el script comprueba la versión de Node antes de ejecutar nada', () => {
  // La comprobación tiene que existir en el script (y ser lo bastante
  // explícita para que se entienda).
  assert.match(TEST_SH, /NODE_MIN\s*=\s*22/,
    'el script tiene que declarar la versión mínima de Node');
  assert.match(TEST_SH, /check_node/,
    'el script tiene que tener una comprobación de la versión de Node');
  // Y se llama ANTES del bucle que ejecuta los objetivos.
  const llamada = TEST_SH.indexOf('check_node ||');
  const bucle = TEST_SH.indexOf('for t in "${TARGETS[@]}"; do');
  assert.ok(llamada !== -1,
    'el script tiene que llamar a check_node antes de ejecutar los objetivos');
  assert.ok(llamada < bucle,
    'la versión de Node se tiene que comprobar ANTES de ejecutar los objetivos');
});

test('con Node menor que el mínimo el script avisa y sale con código ≠ 0', () => {
  const { res, stdout, stderr, dir } = ejecutarTestSh(['unit'], { dobleNode: 'v20.11.0' });
  try {
    const todo = stdout + stderr;
    assert.notEqual(res.status, 0,
      'con Node 20 el script tiene que salir con un código de error');
    assert.match(todo, /Node 22 o superior es necesario/,
      'el aviso tiene que decir qué versión hace falta');
    assert.match(todo, /v20\.11\.0/,
      'el aviso tiene que decir qué versión hay instalada');
    // Y tiene que ser accionable: decir cómo arreglarlo.
    assert.match(todo, /nvm install 22/,
      'el aviso tiene que decir cómo instalar la versión que falta');
    assert.match(todo, /nodejs\.org/,
      'el aviso tiene que dar una alternativa al gestor de versiones');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('con Node suficiente el script sigue adelante', () => {
  const { res, stdout, dir } = ejecutarTestSh(['unit'], {
    dobleNode: 'v22.23.3',
    nodoFalso: runnerFalso(3),
  });
  try {
    assert.match(stdout, /Node v22\.23\.3/,
      'el script tiene que confirmar la versión de Node que usa');
    assert.equal(res.status, 0,
      'con Node 22 las unitarias tienen que pasar');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 2. Si no se ejecuta ninguna prueba, el script falla ─────────────

test('si no se ejecuta ninguna prueba el script sale con código ≠ 0', () => {
  // El runner dice que no ejecutó ninguna prueba (lo que pasa cuando
  // el glob 'tests/unit/*.test.mjs' no matchea ningún fichero: el
  // runner sale con 0 sin hacer nada). El script no puede salirse en
  // verde: tiene que salir con un código de error.
  const { res, stdout, stderr, dir } = ejecutarTestSh(['unit'], {
    nodoFalso: runnerFalso(0),
  });
  try {
    const todo = stdout + stderr;
    assert.notEqual(res.status, 0,
      'sin pruebas que ejecutar, el script tiene que salir con un código de error');
    assert.match(todo, /No se ejecutó ninguna prueba/,
      'el script tiene que decir que no ejecutó ninguna prueba');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('el resumen marca en rojo un objetivo que no ejecutó pruebas', () => {
  const { stdout, dir } = ejecutarTestSh(['unit'], { nodoFalso: runnerFalso(0) });
  try {
    const resumen = (stdout.split('════ Resumen')[1]) ?? '';
    assert.match(resumen, /✗\s+unit/,
      'el resumen tiene que marcar en rojo el objetivo que no ejecutó pruebas');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 3. node --check, cargo test y clippy ─────────────────────────────

test('el script ejecuta node --check sobre todo el JavaScript', () => {
  assert.match(TEST_SH, /node --check/,
    'el script tiene que ejecutar node --check');
  assert.match(TEST_SH, /check_js/,
    'el script tiene que tener una función que haga el node --check');
  // Y la lista tiene que ser la del proyecto entero, no una fija.
  assert.match(TEST_SH, /-name '\*\.js'/,
    'la lista de ficheros tiene que incluir los .js');
  assert.match(TEST_SH, /-name '\*\.mjs'/,
    'la lista de ficheros tiene que incluir los .mjs (los tests)');
  for (const excluido of ['node_modules', 'dist', 'src-tauri']) {
    assert.ok(TEST_SH.includes(excluido),
      `la lista de ficheros tiene que excluir ${excluido}`);
  }
});

test('el node --check comprueba los .js como módulos ES', () => {
  // Los .js del frontend son módulos (se cargan con
  // <script type="module">). `node --check` los trataría como
  // CommonJS y no vería los errores propios de un módulo, así que
  // el script tiene que comprobarlos como .mjs.
  assert.match(TEST_SH, /\.mjs/,
    'el script tiene que comprobar los .js como módulos ES (.mjs)');
  assert.match(TEST_SH, /endsWith\("\.js"\)|endsWith\('\.js'\)/,
    'el script tiene que distinguir los .js de los .mjs');
});

test('un .js del frontend roto hace fallar el script', () => {
  // Comprobación de verdad: se copia el script a una carpeta con un
  // .js roto y se comprueba que el script sale con error y dice qué
  // fichero está roto.
  const dir = mkdtempPlano();
  try {
    mkdirSync(join(dir, 'tools'), { recursive: true });
    mkdirSync(join(dir, 'logs'), { recursive: true });
    writeFileSync(join(dir, 'tools', 'test.sh'), TEST_SH, 'utf8');
    // Un .js con un error de sintaxis, como los del frontend.
    writeFileSync(join(dir, 'roto.js'),
      'export const x = 1;\nconst roto = (;\n', 'utf8');
    // El script se niega a comprobar menos de 10 ficheros (para que un
    // `find` mal escrito no pase en verde), así que hay que poner los
    // que faltan.
    for (let i = 0; i < 12; i++) {
      writeFileSync(join(dir, `sano-${i}.js`), `export const n${i} = ${i};\n`, 'utf8');
    }

    const res = spawnSync('bash', [join(dir, 'tools', 'test.sh'), 'check'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 120_000,
    });

    const todo = (res.stdout ?? '') + (res.stderr ?? '');
    assert.notEqual(res.status, 0,
      'un .js roto tiene que hacer fallar el script');
    assert.match(todo, /roto\.js/,
      'el script tiene que decir qué fichero no compila');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('el script ejecuta cargo test y cargo clippy', () => {
  assert.match(TEST_SH, /cargo test/,
    'el script tiene que ejecutar cargo test');
  assert.match(TEST_SH, /cargo clippy/,
    'el script tiene que ejecutar cargo clippy');
  // Con --locked, como el resto del proyecto.
  const bloque = TEST_SH.slice(TEST_SH.indexOf('check_rust()'));
  assert.match(bloque, /cargo test[^|]*--locked|--locked[^|]*cargo test/s,
    'cargo test tiene que pasar --locked');
  assert.match(bloque, /cargo clippy[^|]*--locked|--locked[^|]*cargo clippy/s,
    'cargo clippy tiene que pasar --locked');
  // Y clippy con los avisos como errores.
  assert.match(bloque, /-D warnings/,
    'clippy tiene que tratar los avisos como errores');
});

test('si cargo test falla el script sale con código ≠ 0', () => {
  const { res, stdout, stderr, dir } = ejecutarTestSh(['check'], { dobleCargo: 'falla' });
  try {
    const todo = stdout + stderr;
    assert.notEqual(res.status, 0,
      'si cargo test falla, el script tiene que salir con un código de error');
    assert.match(todo, /cargo test falló/,
      'el script tiene que decir que falló cargo test');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 4. La cobertura de las unitarias ────────────────────────────────

test('el script pide la cobertura al runner de Node', () => {
  assert.match(TEST_SH, /--experimental-test-coverage/,
    'las unitarias tienen que ejecutarse con la cobertura del runner');
});

test('el resumen de las unitarias muestra la cobertura', () => {
  const { stdout, dir } = ejecutarTestSh(['unit'], { nodoFalso: runnerFalso(3) });
  try {
    assert.match(stdout, /Cobertura/,
      'el resumen tiene que tener un apartado de cobertura');
    assert.match(stdout, /all files\s*\|\s*\d+\.\d+/,
      'el resumen tiene que mostrar la línea "all files" con el porcentaje');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 5. La poda de logs/ ─────────────────────────────────────────────

test('dos ejecuciones no machacan el log la una a la otra', async () => {
  // El nombre del log lleva la fecha (a segundo) y el PID. Sin el PID,
  // dos ejecuciones que empiecen en el mismo segundo comparten el
  // fichero: la segunda lo trunca con ">" y el log de la primera queda
  // con el contenido de la segunda (y con huecos de bytes nulos).
  // Esto pasaba de verdad: las pruebas de este script lanzan copias
  // del script, y el log de la vuelta real acababa con el de la copia.
  assert.match(TEST_SH, /STAMP="\$\(date \+%Y%m%d-%H%M%S\)-\$\$"/,
    'el sello del log tiene que llevar el PID');

  const dir = mkdtempPlano();
  try {
    mkdirSync(join(dir, 'tools'), { recursive: true });
    writeFileSync(join(dir, 'tools', 'test.sh'), TEST_SH, 'utf8');

    // Dos runners falsos que se distinguen por su salida, para saber
    // qué log es de qué ejecución.
    const bin = join(dir, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'node'), `#!/usr/bin/env bash
if [ "$1" = "--version" ]; then echo "v22.23.3"; exit 0; fi
${runnerFalso(3)}
`, 'utf8');
    chmodSync(join(bin, 'node'), 0o755);

    const logs = join(dir, 'logs');
    mkdirSync(logs, { recursive: true });
    const entorno = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      PLANNER_LOG_DIR: logs,
    };

    // Las dos vueltas, en paralelo: si comparten nombre, la segunda
    // machaca el log de la primera.
    const [a, b] = await Promise.all([
      spawnAsync('bash', [join(dir, 'tools', 'test.sh'), 'unit'], dir, entorno),
      spawnAsync('bash', [join(dir, 'tools', 'test.sh'), 'unit'], dir, entorno),
    ]);

    assert.equal(a.status, 0, `la primera vuelta tiene que pasar: ${a.stdout}${a.stderr}`);
    assert.equal(b.status, 0, `la segunda vuelta tiene que pasar: ${b.stdout}${b.stderr}`);

    // Cada vuelta tiene que tener su propio log, con su contenido.
    const ficheros = readdirSync(logs).filter(f => f.startsWith('test-unit-'));
    assert.equal(ficheros.length, 2,
      `las dos vueltas tienen que dejar dos logs distintos, hay: ${ficheros.join(', ')}`);

    // Y ninguno puede estar lleno de bytes nulos (el síntoma de que
    // un log fue truncado por encima mientras otro lo escribía).
    for (const f of ficheros) {
      const texto = readFileSync(join(logs, f), 'utf8');
      assert.ok(!texto.includes('\0'),
        `el log ${f} tiene bytes nulos: se ha machacado con otro`);
      assert.match(texto, /^# tests 3$/m,
        `el log ${f} no tiene el contenido de su ejecución`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('el script poda logs/ y conserva los N últimos', () => {
  assert.match(TEST_SH, /podar_logs/,
    'el script tiene que tener una función que pode logs/');
  assert.match(TEST_SH, /PLANNER_LOG_KEPT/,
    'el número de logs que se conservan tiene que ser configurable');

  // Comprobación de verdad: se crea una carpeta con 30 logs falsos y
  // se ejecuta el script (copiado, para no tocar el repo) con
  // PLANNER_LOG_KEPT=5; solo pueden quedar 5.
  const dir = mkdtempPlano();
  try {
    const logs = join(dir, 'logs');
    mkdirSync(logs, { recursive: true });
    mkdirSync(join(dir, 'tools'), { recursive: true });
    writeFileSync(join(dir, 'tools', 'test.sh'), TEST_SH, 'utf8');
    // Logs viejos primero (mtime antiguo) y nuevos después.
    for (let i = 0; i < 30; i++) {
      const f = join(logs, `test-unit-20260101-0000${String(i).padStart(2, '0')}.log`);
      writeFileSync(f, `log ${i}\n`, 'utf8');
      const viejo = Date.now() / 1000 - (30 - i) * 60;
      utimesSync(f, viejo, viejo);
    }

    // Un runner falso: no queremos lanzar las unitarias de verdad
    // (Node no admite un `node --test` dentro de otro).
    const bin = join(dir, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'node'), `#!/usr/bin/env bash
if [ "$1" = "--version" ]; then echo "v22.23.3"; exit 0; fi
${runnerFalso(3)}
`, 'utf8');
    chmodSync(join(bin, 'node'), 0o755);

    const res = spawnSync('bash', [join(dir, 'tools', 'test.sh'), 'unit'], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        PLANNER_LOG_KEPT: '5',
        // El log y la poda tienen que ir a la carpeta temporal: si
        // heredaran PLANNER_LOG_DIR del ambiente, podarían los logs de
        // otra carpeta y esta prueba mediría lo que sobra.
        PLANNER_LOG_DIR: logs,
      },
      timeout: 120_000,
    });
    assert.equal(res.status, 0, `las unitarias tienen que pasar: ${res.stdout}${res.stderr}`);

    const quedan = readdirSync(logs).filter(f => f.startsWith('test-unit-'));
    assert.ok(quedan.length <= 5,
      `logs/ tiene que quedar con 5 ficheros como máximo, tiene ${quedan.length}`);
    assert.ok(quedan.length >= 1,
      'logs/ no puede quedar vacío: el log de esta ejecución tiene que estar');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 6. El puerto del MCP ────────────────────────────────────────────

test('el script comprueba también el puerto del MCP (41237)', () => {
  assert.match(TEST_SH, /MCP_PORT\s*=\s*41237/,
    'el script tiene que declarar el puerto del MCP');
  assert.match(TEST_SH, /\/dev\/tcp\/127\.0\.0\.1\/\$MCP_PORT/,
    'el script tiene que comprobar que el puerto del MCP está libre');
  // Y el aviso tiene que ser accionable.
  assert.match(TEST_SH, /cierra la app del Planificador/,
    'el aviso del puerto ocupado tiene que decir qué cerrar');
});

test('el script comprueba el puerto del MCP al preparar los E2E', () => {
  // La comprobación tiene que estar dentro de la preparación de los
  // E2E (check_e2e_reqs), no en otro sitio.
  const bloque = TEST_SH.slice(TEST_SH.indexOf('check_e2e_reqs()'));
  assert.match(bloque, /MCP_PORT/,
    'check_e2e_reqs tiene que comprobar el puerto del MCP');
});

// ── 7. Capturas y trazas de un E2E que falla ─────────────────────────

test('WebdriverIO guarda su salida en un outputDir', () => {
  assert.match(WDIO_CONF, /outputDir/,
    'la configuración de WebdriverIO tiene que definir outputDir');
  // Y tiene que estar dentro de la carpeta aislada de las pruebas
  // (que está en .gitignore y que tools/test.sh borra en cada vuelta).
  assert.match(WDIO_CONF, /\.tmp/,
    'el outputDir tiene que estar dentro de tests/e2e/.tmp/');
});

test('la configuración de WebdriverIO guarda una captura de cada fallo', () => {
  assert.match(WDIO_CONF, /afterTest/,
    'la configuración tiene que tener un hook afterTest');
  assert.match(WDIO_CONF, /saveScreenshot/,
    'el afterTest tiene que guardar una captura');
  assert.match(WDIO_CONF, /\.png/,
    'la captura tiene que guardarse como PNG');
});

test('la configuración de WebdriverIO guarda una traza de cada fallo', () => {
  assert.match(WDIO_CONF, /traza/i,
    'el afterTest tiene que guardar una traza del fallo');
  assert.match(WDIO_CONF, /writeFileSync/,
    'la traza tiene que escribirse en un fichero');
  // La traza tiene que incluir el error con su pila.
  assert.match(WDIO_CONF, /error\?\.stack|error\.stack/,
    'la traza tiene que incluir la pila del error');
});

test('el hook afterTest de verdad deja la captura y la traza en disco', async () => {
  // Esto no lee el fichero: EJECUTA el hook con un `browser` falso y
  // comprueba que aparecen la captura y la traza. Si el hook no
  // guardara nada, esta prueba se pondría en rojo.
  const dir = mkdtempPlano();
  try {
    // La configuración se copia con PLANNER_E2E_BIN y PLANNER_E2E_DATOS
    // puestos, para que se pueda importar (si no, lanza).
    process.env.PLANNER_E2E_BIN = '/bin/true';
    process.env.PLANNER_E2E_DATOS = join(dir, 'datos');
    process.env.PLANNER_E2E_CAPTURAS = join(dir, 'capturas');
    mkdirSync(process.env.PLANNER_E2E_DATOS, { recursive: true });

    // Un `browser` global falso: guarda lo que se le pide.
    const guardados = [];
    globalThis.browser = {
      saveScreenshot: async (ruta) => {
        guardados.push(ruta);
        writeFileSync(ruta, 'PNG FALSO', 'utf8');
      },
      getUrl: async () => 'tauri://localhost/',
    };

    // Se importa la configuración de verdad (sin caché: es un módulo).
    const rutaConf = join(RAIZ, 'tests', 'e2e', 'wdio.conf.mjs');
    const conf = await import(rutaConf + `?t=${Date.now()}`);

    const salida = join(dir, 'capturas');
    await conf.config.afterTest(
      { title: 'una prueba que falla', file: 'x.spec.mjs' },
      {},
      { error: new Error('el error de la prueba') },
    );

    const ficheros = readdirSync(salida);
    assert.ok(ficheros.some(f => f.endsWith('.png')),
      `tiene que haber una captura PNG, hay: ${ficheros.join(', ')}`);
    assert.ok(ficheros.some(f => f.includes('traza')),
      `tiene que haber una traza, hay: ${ficheros.join(', ')}`);

    // Y la traza tiene que contener el error.
    const traza = ficheros.find(f => f.includes('traza'));
    const texto = readFileSync(join(salida, traza), 'utf8');
    assert.match(texto, /el error de la prueba/,
      'la traza tiene que contener el mensaje del error');
    assert.match(texto, /una prueba que falla/,
      'la traza tiene que decir qué prueba falló');
  } finally {
    delete globalThis.browser;
    delete process.env.PLANNER_E2E_BIN;
    delete process.env.PLANNER_E2E_DATOS;
    delete process.env.PLANNER_E2E_CAPTURAS;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('una prueba que NO falla no deja capturas (solo los fallos)', async () => {
  const dir = mkdtempPlano();
  try {
    process.env.PLANNER_E2E_BIN = '/bin/true';
    process.env.PLANNER_E2E_DATOS = join(dir, 'datos');
    process.env.PLANNER_E2E_CAPTURAS = join(dir, 'capturas');
    mkdirSync(process.env.PLANNER_E2E_DATOS, { recursive: true });

    let llamadas = 0;
    globalThis.browser = {
      saveScreenshot: async () => { llamadas++; },
      getUrl: async () => 'tauri://localhost/',
    };

    const rutaConf = join(RAIZ, 'tests', 'e2e', 'wdio.conf.mjs');
    const conf = await import(rutaConf + `?t=${Date.now()}`);

    await conf.config.afterTest(
      { title: 'una prueba que pasa', file: 'x.spec.mjs' },
      {},
      { error: undefined },
    );

    assert.equal(llamadas, 0,
      'una prueba que pasa no tiene que dejar capturas');
  } finally {
    delete globalThis.browser;
    delete process.env.PLANNER_E2E_BIN;
    delete process.env.PLANNER_E2E_DATOS;
    delete process.env.PLANNER_E2E_CAPTURAS;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('el script dice dónde están las capturas cuando un E2E falla', () => {
  assert.match(TEST_SH, /resumen_capturas/,
    'el script tiene que listar las capturas de un E2E que falló');
  assert.match(TEST_SH, /capturas/,
    'el script tiene que mencionar la carpeta de capturas');
});

// ── 9. El recuento de los E2E: "fallaron" no es "no se ejecutó nada" ──

/**
 * Ejecuta la función real `comprobar_pruebas_ejecutadas` del script
 * (extraída tal cual) con un log de E2E falso y devuelve lo que dice.
 */
function comprobarConLog(logE2e) {
  const dir = mkdtempPlano();
  try {
    const log = join(dir, 'e2e.log');
    writeFileSync(log, logE2e, 'utf8');

    // La función tal cual está en el script: se extrae con sed para
    // que la prueba no copie su lógica.
    const func = execFileSync('sed', [
      '-n', '/^comprobar_pruebas_ejecutadas()/,/^}/p', join(RAIZ, 'tools', 'test.sh'),
    ], { encoding: 'utf8' });
    assert.match(func, /comprobar_pruebas_ejecutadas/,
      'no se ha podido extraer la función del script');

    const guion = join(dir, 'harness.sh');
    writeFileSync(guion, `#!/usr/bin/env bash
NAMES=(e2e)
LOGS=("$1")
OBJETIVOS_SIN_PRUEBAS=()
${func}
comprobar_pruebas_ejecutadas
echo "código: $?"
`, 'utf8');

    const res = spawnSync('bash', [guion, log], { encoding: 'utf8' });
    return { salida: `${res.stdout ?? ''}${res.stderr ?? ''}`, dir };
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

test('un E2E que falla no se confunde con "no se ejecutó ninguna prueba"', () => {
  // El reporter de WebdriverIO solo imprime "N passing" si hay pruebas
  // que pasan: cuando todas fallan, el log solo tiene "1 failing". Si
  // el script buscara solo "passing", diría (falsamente) que no se
  // ejecutó ninguna prueba.
  const { salida, dir } = comprobarConLog([
    '  [0-0] 2026-11-23T10:00:00.000Z 0m wdio  › 00-arranque',
    '  1 failing (511ms)',
    '  Spec Files:  0 passed, 1 failed, 1 total',
    '',
  ].join('\n'));
  try {
    assert.doesNotMatch(salida, /No se encontró el recuento de pruebas E2E/,
      'un E2E que ha fallado sí tiene recuento: no se ejecutó ninguna prueba es otro caso');
    assert.doesNotMatch(salida, /No se ejecutó ninguna prueba E2E/,
      'un E2E que ha fallado no es lo mismo que no haber ejecutado ninguno');
    assert.match(salida, /fallaron/,
      'el script tiene que decir que se ejecutaron pruebas y fallaron');
    assert.match(salida, /código: 0/,
      'el fallo de un E2E ya lo marca su código de salida: aquí no hay "sin pruebas"');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('un log de E2E sin ningún recuento sigue siendo "no se ejecutó ninguna prueba"', () => {
  // El otro lado: si de verdad no se ejecutó ninguna prueba, el script
  // tiene que decirlo y salir con error (nunca en verde).
  const { salida, dir } = comprobarConLog([
    '  [0-0] 2026-11-23T10:00:00.000Z 0m wdio  › nada que hacer',
    '',
  ].join('\n'));
  try {
    assert.match(salida, /No se encontró el recuento de pruebas E2E/,
      'sin recuento, el script tiene que avisar de que no se ejecutó ninguna prueba');
    assert.match(salida, /código: 1/,
      'sin pruebas ejecutadas, la comprobación tiene que fallar');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
