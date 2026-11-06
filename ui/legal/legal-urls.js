// ────────────────────────────────────────────────────────────────────
// legal-urls.js
//
// Direcciones públicas de los documentos legales.
//
// Este es el ÚNICO sitio donde se definen las URL públicas: la app
// abre estos documentos en el navegador del sistema, sin descargar
// nada por red. Los textos que se muestran dentro de la app siguen
// leyéndose de la copia local (`legal/*.md`).
//
// La URL pública tiene la forma:
//   https://gabrielcatdeveloper.github.io/papeleo/planner/<CLAVE>
// con el mismo nombre de archivo que la copia local, pero sin `.md`.
//
// `THIRD_PARTY_LICENSES` no aparece aquí a propósito: ese inventario
// de licencias no se publica, así que la app lo muestra siempre desde
// su copia local, en el modal.
// ────────────────────────────────────────────────────────────────────

/** Base de las direcciones públicas (GitHub Pages del repositorio). */
export const PUBLIC_BASE = 'https://gabrielcatdeveloper.github.io/papeleo/planner/';

/**
 * URL pública de cada documento, por clave. Solo https.
 * Las claves son las mismas que usa `legal-card.js` para los
 * `data-doc` de la pestaña Legal de Ajustes.
 */
export const PUBLIC_URLS = {
  PRIVACY:        PUBLIC_BASE + 'PRIVACY',
  TERMS:          PUBLIC_BASE + 'TERMS',
  EULA:           PUBLIC_BASE + 'EULA',
  COOKIES:        PUBLIC_BASE + 'COOKIES',
  ACCESSIBILITY:  PUBLIC_BASE + 'ACCESSIBILITY',
  ACCEPTABLE_USE: PUBLIC_BASE + 'ACCEPTABLE_USE',
  DMCA:           PUBLIC_BASE + 'DMCA',
  CONTACT:        PUBLIC_BASE + 'CONTACT',
};

/**
 * URL pública de un documento, o `null` si no se publica (si no hay
 * Tauri, por ejemplo). Devuelve `null` para claves desconocidas y
 * para `THIRD_PARTY_LICENSES`.
 */
export function publicUrlFor(key) {
  const url = PUBLIC_URLS[key];
  return url ?? null;
}

/**
 * `true` si la URL es una https válida. La app solo abre direcciones
 * https: ni el sistema operativo ni el plugin deben recibir nada más.
 */
export function isHttpsUrl(url) {
  if (typeof url !== 'string' || url === '') return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
