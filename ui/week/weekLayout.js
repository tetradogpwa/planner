// ────────────────────────────────────────────────────────────────────
// ui/week/weekLayout.js
//
// Cómo se ve la vista Semana según lo ancha que es la ventana:
//
//   * menos de 1024 px: los 7 días se apilan en un acordeón y solo
//     el de hoy está abierto (como siempre).
//   * 1024 px o más: los 7 días son columnas y se ven todos a la vez.
//
// El ancho está también en el CSS (ui/week/week-card.css y
// ui/week/taskItem/taskItem-card.css). Aquí solo se mira para saber
// si un día se abre o se cierra y por dónde se mueve el foco con las
// flechas del teclado.
// ────────────────────────────────────────────────────────────────────

/** Ancho (px) a partir del cual la semana se pinta como rejilla. */
export const ANCHO_REJILLA = 1024;

/** La consulta de medios que decide el modo de la vista. */
export const consultaRejilla =
  window.matchMedia(`(min-width: ${ANCHO_REJILLA}px)`);

/** ¿La ventana está en modo rejilla (columnas) o en modo acordeón? */
export const enRejilla = () => consultaRejilla.matches;
