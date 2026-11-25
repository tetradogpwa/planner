// ────────────────────────────────────────────────────────────────────
// back/backup.js — La copia de seguridad de la app (T-054).
//
// Antes la exportación solo guardaba las tareas, en un archivo que se
// llamaba siempre igual (planner.json): al importarlo se perdían la
// fecha de inicio del planificador, las marcas de «hecho» y las
// preferencias. Ahora la copia guarda todo y lleva un formato con
// versión, para que mañana se pueda leer sin adivinar:
//
//   {
//     app:        'planificador-semanal',  // quién hizo el archivo
//     version:    2,                       // versión del formato
//     exportedAt: '2026-11-25T10:00:00Z',  // cuándo se hizo
//     tasks:      [ … ],                   // las tareas
//     completions:{ … },                   // las marcas de «hecho»
//     startDate:  '2026-11-23',            // la fecha de inicio del planificador
//     preferences:{ … }                    // el tema y los tamaños de letra
//   }
//
// La importación acepta también los formatos antiguos (un array de
// tareas o el envoltorio { tasks: [...] }), que no traen marcas, ni
// fecha de inicio, ni preferencias.
//
// Este módulo no toca el DOM ni el almacenamiento: solo sabe leer y
// escribir el formato.
// ────────────────────────────────────────────────────────────────────

import { ParseJson, TareasDeDatos, ToJsonArray } from './serializer.js';
import { formatLocalDate, parseLocalDate }     from './calendar.js';

/** Quién hizo el archivo. */
export const APP_ID = 'planificador-semanal';

/** Versión del FORMATO de la copia (no la de la app). */
export const BACKUP_VERSION = 2;

/** Construye la copia de seguridad: el objeto que se guarda en el JSON.
 *
 *  `tasks` son las tareas, `completions` las marcas de «hecho» (por id
 *  de tarea y fecha), `startDate` la fecha de inicio del planificador y
 *  `preferences` sus preferencias de apariencia. */
export function buildBackup({
  tasks = [],
  completions = {},
  startDate = null,
  preferences = null,
  now = new Date(),
} = {}) {
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    tasks: ToJsonArray(tasks),
    completions: marcasDe(completions),
    startDate,
    preferences: preferences ?? null,
  };
}

/** La copia como texto JSON: es lo que se descarga. */
export function backupToJson(datos) {
  return JSON.stringify(buildBackup(datos), null, 2);
}

/** El nombre del archivo de la copia: lleva la fecha, para no pisar la
 *  copia de otro día (T-054). */
export function backupFileName(date = new Date()) {
  return `planificador-${formatLocalDate(date)}.json`;
}

/** Lee una copia de seguridad.
 *
 *  Devuelve las tareas que se han reconocido, cuántas se han descartado
 *  por no reconocerlas y lo que traía el archivo aparte de las tareas:
 *  las marcas de «hecho», la fecha de inicio y las preferencias (si el
 *  archivo las trae; los archivos antiguos no las tienen).
 *
 *  Lanza un `Error` en español si el archivo no es un JSON válido o si
 *  no trae una lista de tareas. */
export function parseBackup(dataStr, opts = {}) {
  const datos = ParseJson(dataStr);
  const { tareas, descartadas } = TareasDeDatos(datos, opts);

  return {
    tareas,
    descartadas,
    completions: tieneCompletions(datos) ? marcasDe(datos.completions) : null,
    startDate: startDateDe(datos),
    preferences: preferencesDe(datos),
  };
}

// ── Ayudas ───────────────────────────────────────────────────────────────

/** Las marcas de «hecho» como una copia limpia: solo se quedan las
 *  que tienen la forma { <id>: { <fecha>: [<veces>] } }. */
function marcasDe(marcas) {
  const copia = {};
  if (!marcas || typeof marcas !== 'object' || Array.isArray(marcas)) return copia;
  for (const [id, porDia] of Object.entries(marcas)) {
    if (!porDia || typeof porDia !== 'object' || Array.isArray(porDia)) continue;
    const dias = {};
    for (const [dia, veces] of Object.entries(porDia)) {
      if (!Array.isArray(veces)) continue;
      const lista = [...new Set(veces.filter(v => Number.isInteger(v) && v >= 0))]
        .sort((a, b) => a - b);
      if (lista.length) dias[dia] = lista;
    }
    if (Object.keys(dias).length) copia[id] = dias;
  }
  return copia;
}

/** Dice si el archivo trae marcas de «hecho» (los antiguos no las
 *  tienen: si no, al importarlos se dejarían las marcas que ya había). */
function tieneCompletions(datos) {
  return !!datos && typeof datos === 'object' && !Array.isArray(datos)
    && Object.prototype.hasOwnProperty.call(datos, 'completions');
}

/** La fecha de inicio del planificador del archivo, si es válida. */
function startDateDe(datos) {
  const valor = datos?.startDate;
  if (typeof valor !== 'string') return null;
  try {
    parseLocalDate(valor);
  } catch {
    return null;
  }
  return valor.trim();
}

/** Las preferencias del archivo, si trae alguna. */
function preferencesDe(datos) {
  const valor = datos?.preferences;
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  return valor;
}
