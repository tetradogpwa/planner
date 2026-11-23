// ────────────────────────────────────────────────────────────────────
// wdio.conf.mjs — WebdriverIO contra la app REAL (binario de Tauri).
//
// No se ejecuta a pelo: lo lanza `bash tools/test.sh e2e`, que compila
// el binario, abre un Wayland invisible (weston sin pantalla, o
// Xvfb con PLANNER_E2E_DISPLAY=x11), arranca tauri-driver y define
// estas variables:
//   PLANNER_E2E_BIN    ruta absoluta al binario de pruebas
//   PLANNER_E2E_DATOS  carpeta de datos aislada (XDG_DATA_HOME); nunca
//                      se tocan los datos reales del usuario
//
// Cada archivo de specs abre una sesión nueva y empieza con los datos
// vacíos (ver beforeSession).
//
// Cuando una prueba falla, la salida de WebdriverIO (el log del
// runner) y las capturas van a OUTPUT_DIR (T-039). Así un E2E que
// falla deja pruebas del fallo: sin esto solo queda el texto del
// error, que no dice cómo se veía la app.
// ────────────────────────────────────────────────────────────────────

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN   = process.env.PLANNER_E2E_BIN;
const DATOS = process.env.PLANNER_E2E_DATOS;

if (!BIN || !DATOS) {
  throw new Error('Lanza los E2E con "bash tools/test.sh e2e" (faltan PLANNER_E2E_BIN / PLANNER_E2E_DATOS).');
}

// tests/e2e/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
// Las capturas y las trazas van a tests/e2e/.tmp/capturas/ (dentro de
// la carpeta aislada que ya está en .gitignore y que tools/test.sh
// borra al empezar cada ejecución). PLANNER_E2E_CAPTURAS permite
// cambiarlo (las pruebas unitarias lo usan para no tocar el repo).
const OUTPUT_DIR = process.env.PLANNER_E2E_CAPTURAS
  ?? join(RAIZ, 'tests', 'e2e', '.tmp', 'capturas');

mkdirSync(OUTPUT_DIR, { recursive: true });

export const config = {
  runner: 'local',
  specs: ['./specs/**/*.spec.mjs'],
  maxInstances: 1,
  capabilities: [{ 'tauri:options': { application: BIN } }],
  hostname: '127.0.0.1',
  port: Number(process.env.PLANNER_E2E_PORT ?? 4446),
  path: '/',
  logLevel: 'error',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 60_000 },
  waitforTimeout: 10_000,

  // Dónde deja WebdriverIO el log del runner y las salidas de las
  // pruebas (capturas, trazas). Sin esto, un E2E que falla no deja
  // ninguna prueba del fallo (T-039).
  outputDir: OUTPUT_DIR,

  // Datos limpios en cada archivo de specs: la app arranca como recién
  // instalada (pide los términos y no tiene tareas).
  beforeSession() {
    rmSync(DATOS, { recursive: true, force: true });
  },

  // Captura y traza de cada prueba que falla: es lo único que dice
  // cómo se veía la app cuando falló. Si el driver ya no responde
  // (la app se colgó), se avisa en vez de tapar el error original.
  afterTest: async function (test, context, { error }) {
    if (!error) return;

    const nombre = `fallo-${(test?.title ?? 'prueba')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'prueba'}`;

    // La traza: el error con su pila y el estado de la app en el
    // momento del fallo. Sin esto solo queda una línea de texto.
    try {
      const url = await browser.getUrl().catch(() => '(url desconocida)');
      writeFileSync(join(OUTPUT_DIR, `${nombre}.traza.txt`), [
        `Prueba: ${test?.fullTitle?.() ?? test?.title ?? '(sin título)'}`,
        `Fichero: ${test?.file ?? '(desconocido)'}`,
        `URL: ${url}`,
        '',
        'Error:',
        error?.stack ?? String(error),
        '',
      ].join('\n'), 'utf8');
    } catch (e) {
      console.error(`⚠ No se pudo guardar la traza de "${nombre}": ${e.message}`);
    }

    // La captura: cómo se veía la app cuando falló.
    // Sin `fullPage`: tauri-driver va en modo WebDriver Classic, que
    // no acepta opciones en saveScreenshot.
    try {
      await browser.saveScreenshot(join(OUTPUT_DIR, `${nombre}.png`));
    } catch (e) {
      console.error(`⚠ No se pudo guardar la captura de "${nombre}": ${e.message}`);
    }
  },
};
