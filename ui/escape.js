// ────────────────────────────────────────────────────────────────────
// escape.js
//
// Escapa el texto que se va a meter dentro de una cadena de HTML.
//
// Los datos que escribe el usuario no son de fiar: el nombre de una
// tarea puede teclearlo él, venir de un JSON importado o crearlo un
// asistente. Si ese texto entra sin escapar en un `innerHTML`, un
// `<img src=x onerror=…>` deja de ser texto y se convierte en una
// etiqueta viva con su manejador en línea, en un WebView que tiene
// acceso a `window.__TAURI__` (Tauri va con `withGlobalTauri: true`).
//
// Escapar NO es validar: aquí el texto no cambia, solo se neutralizan
// los caracteres que el HTML interpretaría (etiquetas, atributos).
// ────────────────────────────────────────────────────────────────────

const ENTIDADES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Devuelve `texto` con los caracteres del HTML escapados, listo para
 *  interpolarse en una cadena que se asigna a `innerHTML`.
 *
 *  Escapa también las comillas, para que el texto sea seguro también
 *  dentro de un atributo (`title="…"`, `value="…"`). */
export function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}
