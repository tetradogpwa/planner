// ────────────────────────────────────────────────────────────────────
// base-card.js
//
// La base común de las tarjetas: traer su HTML y su CSS, comprobar que
// la descarga ha ido bien y decir en la vista qué ha pasado cuando no.
//
// Antes cada tarjeta hacía sus propios `fetch` (41 en ui/) sin
// comprobar `r.ok` ni capturar los errores: si faltaba un asset, la
// vista se quedaba en blanco y sin decir nada. Y cada tarjeta se
// inyectaba su CSS en una etiqueta <style> propia: al pintar "Todas
// semanas" (12 semanas × 7 días) eran ~192 descargas y ~96 etiquetas
// <style> de golpe.
//
// Aquí:
//
//   * `cargarFragmento(ruta)` descarga un fragmento (HTML o CSS),
//     comprueba que la respuesta sea OK y lo cachea por ruta: cada
//     fichero se descarga UNA sola vez por sesión. Las tarjetas que lo
//     piden a la vez (los 84 días de "Todas semanas") comparten la
//     descarga.
//   * `montarTarjeta(destino, html, ...css)` deja el HTML y el CSS de
//     una tarjeta en su sitio, con UNA sola etiqueta <style> por tipo
//     de tarjeta (aunque haya mil tarjetas del mismo tipo en pantalla).
//   * Si algo no se puede cargar, la vista muestra "No se pudo cargar
//     esta sección" en vez de quedarse en blanco.
// ────────────────────────────────────────────────────────────────────

/** Lo que ve la persona cuando una sección no se puede cargar. */
export const AVISO_CARGA = 'No se pudo cargar esta sección';

/** Los fragmentos ya descargados: ruta → promesa con su texto.
 *
 *  Se cachea la PROMESA y no el texto para que las tarjetas que piden
 *  el mismo fragmento a la vez compartan una sola descarga. */
const fragmentos = new Map();

/** Las etiquetas <style> ya inyectadas: tipo de tarjeta → elemento.
 *
 *  Se guarda el elemento (y no un "ya inyectado") para poder saber si
 *  sigue en la página: si la tarjeta que lo tenía se ha quitado del
 *  DOM, el CSS se vuelve a inyectar en la siguiente tarjeta de ese
 *  tipo. */
const estilos = new Map();

/** Muestra el aviso de carga en `destino` (la vista de la tarjeta).
 *
 *  Va en una región role="status" para que los lectores de pantalla lo
 *  anuncien. */
export function mostrarAvisoCarga(destino) {
  if (!destino) return;
  destino.innerHTML = `<p class="aviso-carga" role="status">${AVISO_CARGA}</p>`;
}

/** Descarga el fragmento de `ruta` (un HTML o un CSS) y devuelve su
 *  texto.
 *
 *  - Cada ruta se descarga una sola vez por sesión.
 *  - Se comprueba `r.ok`: un 404 no es un fragmento.
 *  - Si la descarga falla, se avisa en `destino` (si lo hay) y se
 *    lanza el error. */
export async function cargarFragmento(ruta, destino = null) {
  if (!fragmentos.has(ruta)) {
    const descarga = fetch(ruta).then(r => {
      if (!r.ok) throw new Error(`No se ha podido cargar ${ruta} (HTTP ${r.status})`);
      return r.text();
    });
    // Un fallo no se cachea: así se puede reintentar más tarde.
    descarga.catch(() => {
      if (fragmentos.get(ruta) === descarga) fragmentos.delete(ruta);
    });
    fragmentos.set(ruta, descarga);
  }
  try {
    return await fragmentos.get(ruta);
  } catch (err) {
    mostrarAvisoCarga(destino);
    throw err;
  }
}

/** Descarga varios fragmentos a la vez. Si alguno falla, se avisa en
 *  `destino` y se devuelve null (en vez de dejar la vista a medias). */
export async function cargarFragmentos(rutas, destino = null) {
  try {
    return await Promise.all(rutas.map(ruta => cargarFragmento(ruta, destino)));
  } catch (err) {
    mostrarAvisoCarga(destino);
    console.warn('[tarjeta] no se ha podido cargar:', err);
    return null;
  }
}

/** Deja el HTML y el CSS de una tarjeta en `destino`.
 *
 *  El CSS va en UNA etiqueta <style> por tipo de tarjeta: las doce
 *  semanas de "Todas semanas" comparten la misma, en vez de inyectar
 *  una por semana.
 *
 *  Con `propia: true` cada instancia lleva su propia etiqueta <style>:
 *  lo necesita el formulario de tarea, que está a la vez en el alta y
 *  en la edición (si las dos compartieran el CSS, quitar el del alta
 *  dejaría sin estilo al de edición). */
export function inyectarHtml(destino, html, rutasCss, textosCss, { propia = false } = {}) {
  const clave = rutasCss.join('|');
  const previo = estilos.get(clave);
  // El <style> de antes se reutiliza si sigue en la página. No se
  // reutiliza si lo lleva el propio destino: al cambiar el innerHTML
  // del destino se perdería (la tarjeta se quedaría sin CSS).
  const reutilizable = !propia && previo?.isConnected && !destino.contains?.(previo);
  destino.innerHTML = (reutilizable ? '' : `<style>${textosCss.join('')}</style>`) + html;
  if (!reutilizable) estilos.set(clave, destino.querySelector('style'));
}

/** Monta una tarjeta: descarga su HTML y su CSS y los deja en
 *  `destino`. Devuelve el HTML montado, o null si no se pudo cargar
 *  (entonces la vista ya muestra el aviso de carga). */
export async function montarTarjeta(destino, rutaHtml, ...rutasCss) {
  const partes = await cargarFragmentos([rutaHtml, ...rutasCss], destino);
  if (!partes) return null;
  const [html, ...css] = partes;
  inyectarHtml(destino, html, rutasCss, css);
  return html;
}

/** Vacía la caché de fragmentos y de estilos.
 *
 *  En la app no se llama nunca: los fragmentos se descargan una vez y
 *  se quedan. Las pruebas la usan para partir de cero en cada caso. */
export function limpiarCache() {
  fragmentos.clear();
  estilos.clear();
}
