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
// ────────────────────────────────────────────────────────────────────

import { rmSync } from 'node:fs';

const BIN   = process.env.PLANNER_E2E_BIN;
const DATOS = process.env.PLANNER_E2E_DATOS;

if (!BIN || !DATOS) {
  throw new Error('Lanza los E2E con "bash tools/test.sh e2e" (faltan PLANNER_E2E_BIN / PLANNER_E2E_DATOS).');
}

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

  // Datos limpios en cada archivo de specs: la app arranca como recién
  // instalada (pide los términos y no tiene tareas).
  beforeSession() {
    rmSync(DATOS, { recursive: true, force: true });
  },
};
