// El guard de build (T-034): una build publicable no puede salir sin
// claves de anuncios, ni con el App ID de prueba de Google, y el log de
// compilación no puede enseñar los valores de las variables.
//
// Estas pruebas leen los ficheros de build como texto (igual que
// `permisos.test.mjs`): comprueban que las reglas siguen escritas. El
// comportamiento real (que el build falle sin claves y sin
// `ALLOW_NO_ADS=1`) lo comprueba `tools/test.sh`, que ejecuta el build
// script del proyecto en esa situación antes de lanzar los E2E.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

const BUILD_RS = leer('src-tauri', 'build.rs');
const ADS_RS = leer('src-tauri', 'src', 'ads.rs');
const GRADLE = leer(
  'src-tauri', 'plugins', 'tauri-plugin-admob', 'android', 'build.gradle.kts',
);
const TEST_SH = leer('tools', 'test.sh');
const BUILD_SH = leer('tools', 'build.sh');
const ENV_EXAMPLE = leer('.env.example');

/** Los fragmentos que se imprimen: desde `println!` hasta el `;` que
 *  cierra la sentencia (puede abarcar varias líneas). */
function impresiones(texto) {
  const trozos = [];
  const re = /(println!|eprintln!|cargo:warning)/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const fin = texto.indexOf(';', m.index);
    trozos.push(texto.slice(m.index, fin === -1 ? texto.length : fin + 1));
  }
  return trozos;
}

/** Identificadores que serían el valor de una variable de anuncios. */
const VALOR = /\b(valor|valores|value|values)\b/;

/** Un valor metido en la impresión con `{...}`. */
const VALOR_INTERPOLADO = /\{(valor|valores|value|values|clave|claves)\b/;

/** Código sin comentarios (para no contar lo que solo se documenta). */
function sinComentarios(texto) {
  return texto.split('\n').filter(linea => !/^\s*#/.test(linea)).join('\n');
}

// ── Los valores no van al log ────────────────────────────────────────

test('build.rs no imprime los valores de las variables de anuncios', () => {
  for (const impresion of impresiones(BUILD_RS)) {
    assert.ok(
      !VALOR.test(impresion),
      `build.rs escribe en el log algo que puede ser el valor de una ` +
      `variable: ${impresion.trim()}`,
    );
    assert.ok(
      !VALOR_INTERPOLADO.test(impresion),
      `build.rs escribe en el log un valor interpolado: ${impresion.trim()}`,
    );
  }
});

test('las claves no viajan en una directiva cargo:rustc-env', () => {
  // `cargo:rustc-env=CLAVE=valor` sale en el log con `cargo build -vv`
  // y cargo además muestra la variable en la línea de comandos de
  // rustc: el valor tiene que ir en un fichero generado.
  assert.ok(
    !/rustc-env=\{key\}=\{value\}/.test(BUILD_RS),
    'build.rs no debe incrustar las claves con cargo:rustc-env: el valor ' +
    'sale en el log de cargo',
  );
  assert.ok(
    /ads_env\.rs/.test(BUILD_RS),
    'build.rs debe escribir las claves en el fichero generado ads_env.rs',
  );
  assert.ok(
    /fs::write/.test(BUILD_RS),
    'build.rs debe escribir ese fichero (fs::write)',
  );
});

test('ads.rs lee las claves del fichero generado, no del entorno', () => {
  assert.ok(
    ADS_RS.includes('ads_env.rs'),
    'ads.rs debe incluir el fichero que genera build.rs',
  );
  assert.ok(
    !ADS_RS.includes('option_env!'),
    'ads.rs no debe leer las claves con option_env!: build.rs las ' +
    'incrusta en un fichero para que el valor no salga en el log',
  );
});

// ── Sin claves de anuncios, el build falla ───────────────────────────

test('sin claves de anuncios el build falla y dice cómo arreglarlo', () => {
  assert.ok(
    BUILD_RS.includes('ALLOW_NO_ADS'),
    'build.rs debe conocer el permiso explícito ALLOW_NO_ADS',
  );
  assert.ok(
    /panic!/.test(BUILD_RS),
    'build.rs debe fallar (panic) cuando no hay claves de anuncios',
  );
  assert.ok(
    BUILD_RS.includes('cp .env.example .env'),
    'el error debe decir el comando exacto para crear el .env',
  );
  assert.ok(
    BUILD_RS.includes('ALLOW_NO_ADS=1'),
    'el error debe decir cómo compilar sin anuncios a propósito',
  );
});

test('el guard solo se exige en las builds que se publican', () => {
  // El guard se aplica al perfil release y a Android. En depuracion
  // (cargo check, cargo build --debug) solo avisa: si no, un clon
  // limpio sin .env no compilaria y el flujo de trabajo se romperia
  // (cargo check esta en la lista de comprobaciones de CLAUDE.md).
  assert.ok(
    /PROFILE/.test(BUILD_RS),
    'build.rs debe mirar el perfil de la build (PROFILE) para saber si es de publicacion',
  );
  assert.ok(
    /release/.test(BUILD_RS) && /android/.test(BUILD_RS),
    'el guard debe distinguir las builds de publicacion (release, Android) de las de depuracion',
  );
});

test('el flag ALLOW_NO_ADS se documenta en .env.example', () => {
  assert.ok(
    ENV_EXAMPLE.includes('ALLOW_NO_ADS'),
    '.env.example debe explicar el permiso para compilar sin anuncios',
  );
});

// ── Android: nada de App ID de prueba en un APK ───────────────────────

test('el App ID de prueba de Google se rechaza sin permiso', () => {
  assert.ok(
    BUILD_RS.includes('ca-app-pub-3940256099942544'),
    'build.rs debe reconocer el publicizador de prueba de Google',
  );
  assert.ok(
    GRADLE.includes('ca-app-pub-3940256099942544'),
    'el plugin de AdMob debe reconocer el App ID de prueba de Google',
  );
});

test('el plugin de AdMob no cae al App ID de prueba en silencio', () => {
  assert.ok(
    GRADLE.includes('ALLOW_NO_ADS'),
    'el plugin de AdMob debe aceptar ALLOW_NO_ADS=1 (igual que build.rs)',
  );
  assert.ok(
    /GradleException|RuntimeException|error\(/.test(GRADLE),
    'el plugin de AdMob debe fallar si no hay un App ID real y no se ha ' +
    'permitido usar el de prueba',
  );
  // El App ID de prueba solo puede ser un resultado de una decisión
  // explícita, no un valor por defecto.
  assert.ok(
    /allowNoAds[\s\S]{0,400}googleTestAppId|googleTestAppId[\s\S]{0,400}allowNoAds/.test(GRADLE),
    'el App ID de prueba de Google debe estar condicionado a ALLOW_NO_ADS',
  );
});

// ── Quién compila sin anuncios y quién no ────────────────────────────

test('las pruebas compilan sin anuncios con el permiso explícito', () => {
  assert.ok(
    /ALLOW_NO_ADS=1/.test(sinComentarios(TEST_SH)),
    'tools/test.sh debe poner ALLOW_NO_ADS=1 al compilar el binario de ' +
    'pruebas (si no, el build falla)',
  );
});

test('las builds de publicación no se saltan el guard', () => {
  assert.ok(
    !/ALLOW_NO_ADS\s*=/.test(sinComentarios(BUILD_SH)),
    'tools/build.sh no debe poner ALLOW_NO_ADS: publicar sin anuncios por ' +
    'accidente es justo lo que hay que evitar',
  );
});
