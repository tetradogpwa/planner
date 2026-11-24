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
//
// Las tareas se localizan por su `id` (T-049). El `index` (la posición
// en la lista) se sigue aceptando, pero está obsoleto: si otra tarea
// se borra mientras el asistente edita esta, la posición ya no es la
// misma tarea.
// ────────────────────────────────────────────────────────────────────

import { PlannerApi } from './api.js';

/** Elige cómo se refiere el asistente a una tarea: por su `id` (lo
 *  normal) o por su `index` (obsoleto, se conserva por compatibilidad
 *  con las integraciones antiguas). */
function referenciaTarea({ index, id } = {}) {
  if (typeof id === 'string' && id.trim()) return id.trim();
  if (Number.isInteger(index)) return index;
  throw new Error('Indica el id de la tarea (o su index, obsoleto)');
}

/** Procesa un payload { id, tool, args } recibido del backend y devuelve
 *  la respuesta que se enviará con `mcp_reply`. La función de PlannerApi
 *  a la que se delega se inyecta (`api`) para poder probarla con un
 *  stub en los tests sin tocar `api.js`. Por defecto usa la real.
 *
 *  El mapa de herramientas vive aquí dentro y no en una constante de
 *  módulo: es el único que se usa (el de fuera estaba muerto, T-054). */
export async function handleMcpCall(payload, api = PlannerApi) {
  const { id, tool, args } = payload ?? {};
  const toolMap = {
    listar_tareas:        ()                 => api.listTasks(),
    ver_tarea:            (args)             => api.getTask(referenciaTarea(args)),
    crear_tarea:          (spec)             => api.addTask(spec),
    editar_tarea:         (args)             => api.updateTask(referenciaTarea(args), args.spec),
    borrar_tarea:         (args)             => api.deleteTask(referenciaTarea(args)),
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