// ────────────────────────────────────────────────────────────────────
// back/idTarea.js — El identificador único de cada tarea.
//
// Cada tarea lleva un `id` (un UUID) que no cambia al editarla, al
// guardarla, al recargar la app ni al exportar e importar. Con él, la
// API, el MCP y la interfaz pueden referirse a una tarea concreta en
// vez de a su posición en la lista: si un asistente borra una tarea
// mientras el usuario edita otra, el guardado tiene que ir a la tarea
// correcta (T-049).
// ────────────────────────────────────────────────────────────────────

/** Genera un identificador único para una tarea.
 *
 *  Usa `crypto.randomUUID()`, que es lo que hay en los navegadores
 *  (WebKitGTK incluido) y en Node 19+. Si el motor no lo tuviera (o no
 *  fuera un contexto seguro), se recurre a `getRandomValues` y, en
 *  último caso, a `Math.random`: el id tiene que ser único dentro de
 *  la lista, no secreto. */
export function nuevoId() {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  if (typeof c?.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    // Formato UUID v4: la versión (4) y la variante (10xx).
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
         + `-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
