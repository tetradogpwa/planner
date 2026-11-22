// ────────────────────────────────────────────────────────────────────
// mcp-state.js
//
// Estado del servidor MCP que el navegador guarda entre sesiones.
//
// Aquí solo se guarda lo que NO es un secreto: el interruptor y el
// puerto. El token Bearer lo genera y lo guarda la capa nativa (Rust)
// en un fichero con permisos 0600 dentro del directorio de datos de la
// app; el frontend lo pide con `invoke('mcp_token')` cuando lo
// necesita (T-033, hallazgo R-03 de docs/revision-senior.md).
//
// Antes el token se generaba en el navegador y se guardaba aquí, en
// claro: cualquier script que se ejecutara en el WebView podía leerlo
// del `localStorage` y obtener acceso total al plan. Este módulo
// migra el estado viejo: si encuentra un `token` guardado, lo borra y
// lo ignora.
// ────────────────────────────────────────────────────────────────────

/** Clave del `localStorage` donde vive el estado del MCP. */
export const CLAVE_ESTADO_MCP = 'planner_mcp';

/** Puerto por defecto del servidor MCP (si el estado no trae uno). */
export const PUERTO_POR_DEFECTO = 41237;

/** Estado que se persiste: solo `enabled` y `port`. Nunca el token. */
export function estadoPersistible(estado) {
  return {
    enabled: !!estado?.enabled,
    port: Number(estado?.port) || PUERTO_POR_DEFECTO,
  };
}

/**
 * Lee el estado guardado y migra el formato viejo.
 *
 * Si el estado guardado traía un `token` (la versión anterior de la
 * app), se borra del almacenamiento y se ignora: el token bueno es el
 * que tiene la capa nativa.
 */
export function leerEstadoMcp(almacen = globalThis.localStorage) {
  let estado;
  try {
    const crudo = almacen?.getItem(CLAVE_ESTADO_MCP);
    estado = crudo ? JSON.parse(crudo) : {};
  } catch {
    estado = {};
  }
  if (!estado || typeof estado !== 'object') estado = {};

  const limpio = estadoPersistible(estado);
  // Migración: el token antiguo no se queda rondando en el navegador.
  if ('token' in estado) {
    guardarEstadoMcp(limpio, almacen);
  }
  return limpio;
}

/** Guarda el estado (interruptor y puerto). Nunca guarda el token. */
export function guardarEstadoMcp(estado, almacen = globalThis.localStorage) {
  if (!almacen) return;
  try {
    almacen.setItem(CLAVE_ESTADO_MCP, JSON.stringify(estadoPersistible(estado)));
  } catch {
    // Almacenamiento lleno o bloqueado: el servidor se puede arrancar
    // igualmente, solo que no se restaurará al reiniciar la app.
  }
}
