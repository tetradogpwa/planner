// ────────────────────────────────────────────────────────────────────
// mcp-bridge.js — Puente entre el servidor MCP (Rust) y la app.
//
// El servidor MCP vive en Rust (src-tauri/src/mcp.rs) pero los datos
// (tareas, fecha de inicio) viven en el webview (`PlannerApi`).
// Cuando llega una herramienta (tool call), el servidor emite un
// evento Tauri 'mcp:call' con `{ id, tool, args }`; este módulo lo
// escucha, llama a `PlannerApi[tool]`, y responde con `mcp_reply`.
//
// Se registra DESPUÉS de `requireTerms()` y `startMonetization()` en
// `index.js` para no aceptar llamadas antes de que el usuario haya
// aceptado términos y (si hay) consentimiento de anuncios.
// ────────────────────────────────────────────────────────────────────

import { PlannerApi } from './api.js';

/** Mapa de tool → método de PlannerApi al que delegar.
 *  Solo exponemos las herramientas del contrato MCP; cualquier tool
 *  desconocida se devuelve como error al cliente. */
const TOOL_TO_API = {
  listar_tareas:       ()                => PlannerApi.listTasks(),
  ver_tarea:           ({ index })        => PlannerApi.getTask(index),
  crear_tarea:         (spec)             => PlannerApi.addTask(spec),
  editar_tarea:        ({ index, spec }) => PlannerApi.updateTask(index, spec),
  borrar_tarea:        ({ index })        => PlannerApi.deleteTask(index),
  ver_semana:          ({ offset = 0 })  => PlannerApi.getWeek(offset),
  cambiar_fecha_inicio:({ isoDate })      => PlannerApi.setStartDate(isoDate),
  abrir_vista:         ({ view })         => { PlannerApi.navigate(view); return { view }; },
  exportar_json:       ()                => PlannerApi.exportJson(),
};

/** Procesa un payload { id, tool, args } recibido del backend y devuelve
 *  la respuesta que se enviará con `mcp_reply`. La función de PlannerApi
 *  a la que se delega se inyecta (`api`) para poder probarla con un
 *  stub en los tests sin tocar `api.js`. Por defecto usa la real. */
export async function handleMcpCall(payload, api = PlannerApi) {
  const { id, tool, args } = payload ?? {};
  const toolMap = {
    listar_tareas:        ()                 => api.listTasks(),
    ver_tarea:            ({ index })        => api.getTask(index),
    crear_tarea:          (spec)             => api.addTask(spec),
    editar_tarea:         ({ index, spec })  => api.updateTask(index, spec),
    borrar_tarea:         ({ index })        => api.deleteTask(index),
    ver_semana:           ({ offset = 0 })   => api.getWeek(offset),
    cambiar_fecha_inicio: ({ isoDate })      => api.setStartDate(isoDate),
    abrir_vista:          ({ view })         => { api.navigate(view); return { view }; },
    exportar_json:        ()                 => api.exportJson(),
  };
  const fn = toolMap[tool];
  if (!fn) {
    return { id, ok: false, payload: { message: `Herramienta MCP desconocida: ${tool}` } };
  }
  try {
    const result = await fn(args ?? {});
    return { id, ok: true, payload: result ?? null };
  } catch (err) {
    const message = (err && err.message) ? err.message : String(err);
    return { id, ok: false, payload: { message } };
  }
}

/** Arranca el bridge. Devuelve una función para detenerlo (por si
 *  hace falta en tests). */
export async function startMcpBridge() {
  // `window.__TAURI__` solo existe dentro de Tauri. Si no, no
  // hacemos nada (útil para tests en navegador o node).
  if (!window.__TAURI__?.event?.listen) return () => {};
  if (!window.__TAURI__.core?.invoke)   return () => {};

  const unlisten = await window.__TAURI__.event.listen('mcp:call', async (event) => {
    const reply = await handleMcpCall(event.payload);
    try {
      await window.__TAURI__.core.invoke('mcp_reply', reply);
    } catch (err) {
      console.warn('[mcp] no se pudo enviar la respuesta:', err);
    }
  });

  return unlisten;
}