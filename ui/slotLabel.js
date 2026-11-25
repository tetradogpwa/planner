// ────────────────────────────────────────────────────────────────────
// ui/slotLabel.js
//
// La etiqueta de la «vez» de una tarea que se repite varias veces al
// día: "1/3", "2/3", "3/3".
//
// Antes se ponían franjas horarias ("0–12H" y "12–24H"): con tres
// veces al día la segunda y la tercera salían con la misma etiqueta
// ("12–24H") y no se distinguían. La app no pide horas: lo que hace
// falta es saber qué vez es cuál.
//
// Es la única fuente de la etiqueta: la usan la vista Semana y el PDF.
// ────────────────────────────────────────────────────────────────────

/** Etiqueta de la aparición `indice` (0 = la primera) de una tarea que
 *  se repite `total` veces al día: "1/3", "2/3", "3/3".
 *
 *  Con una sola vez al día no hay etiqueta (''): no hay nada que
 *  distinguir. */
export function slotLabel(total, indice) {
  const veces = Number(total);
  const n     = Number(indice) + 1;
  if (!Number.isInteger(veces) || veces < 2) return '';
  if (!Number.isInteger(n) || n < 1 || n > veces) return '';
  return `${n}/${veces}`;
}
