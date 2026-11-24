// ────────────────────────────────────────────────────────────────────
// back/dayNames.js — Nombres de los días de la semana.
//
// Única fuente de verdad: el resto del proyecto los importa de aquí en
// vez de copiar la lista (la API, los formularios de alta y edición,
// la vista de semana y la de impresión).
//
// El orden es el del calendario del planificador: lunes primero
// (índice 0) y domingo el último (índice 6). Es el mismo orden que
// usan los bits de día de `back/daysOfWeek.js`.
// ────────────────────────────────────────────────────────────────────

/** Nombres cortos: los que usan la API y los formularios. */
export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Nombres largos: los que usa la vista de semana. */
export const DAY_NAMES_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
