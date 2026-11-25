// ────────────────────────────────────────────────────────────────────
// back/taskSummary.js — El resumen legible de cuándo se repite una
// tarea.
//
// La lista de tareas de la vista Tareas mostraba el nombre de la clase
// ("WeeklyTask", "MonthlyTask", "QuaterlyTask", "LimitedTimeTask") o
// una etiqueta corta ("Días esp.", "Cada 3d") que no decía cuándo se
// repite la tarea. Aquí vive el texto que se muestra:
//
//   Diaria · 3 veces
//   Lun, Mié, Vie
//   Cada 3 días desde el 25/11
//   Ciclo de 2 semanas
//   Una vez · 25/11
//
// Es la única fuente de ese texto: lo usan la vista Tareas (la lista) y
// la API, que lo devuelve en el campo `summary` de cada tarea.
//
// Los tipos heredados (WeeklyTask, MonthlyTask y QuaterlyTask) son
// NDaysTask con un número de días fijo (7, 30 y 90), así que su
// resumen es el de "cada N días": "Cada 7 días desde el 25/11".
//
// No toca el DOM: se puede probar sin navegador (ver
// tests/unit/taskSummary.test.mjs).
// ────────────────────────────────────────────────────────────────────

import { DAY_NAMES }     from './dayNames.js';
import { parseLocalDate } from './calendar.js';
import { NDaysTask }      from './nDays.js';
import { LimitedTimeTask, OneTimeTask }      from './limitedTime.js';
import { DaysOfWeekTask, CiclesDaysOfWeekTask } from './daysOfWeek.js';

/** La fecha de inicio de la tarea en formato corto (DD/MM). Si la fecha
 *  no se puede leer, se devuelve '' y el resumen se queda sin ella. */
function fechaCorta(task) {
  try {
    const d = parseLocalDate(task.StartDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/** El texto que dice CÓMO se repite la tarea (sin las veces al día). */
function resumenDe(task) {
  if (!task) return '';

  // El ciclo va antes que los días de la semana: las semanas del
  // ciclo son DaysOfWeekTask, pero la tarea que se ve es el ciclo.
  if (task instanceof CiclesDaysOfWeekTask) {
    const semanas = (task.Cicles ?? []).length;
    if (semanas === 0) return '';
    return `Ciclo de ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
  }

  if (task instanceof DaysOfWeekTask) {
    const dias = [0, 1, 2, 3, 4, 5, 6].filter(i => task.hasDay(i));
    return dias.map(i => DAY_NAMES[i]).join(', ');
  }

  // OneTimeTask antes que LimitedTimeTask: la primera es un caso
  // particular de la segunda.
  if (task instanceof OneTimeTask) {
    const fecha = fechaCorta(task);
    return fecha ? `Una vez · ${fecha}` : 'Una vez';
  }

  if (task instanceof LimitedTimeTask) {
    // Solo aparece en la repetición número `Repeat` de la tarea base:
    // con 1 es "una vez"; con más, "solo la 3ª vez".
    const n = Number(task.Repeat);
    const texto = Number.isInteger(n) && n > 1 ? `Solo la ${n}ª vez` : 'Una vez';
    const fecha = fechaCorta(task);
    return fecha ? `${texto} · ${fecha}` : texto;
  }

  if (task instanceof NDaysTask) {
    const n = Number(task.NDays);
    if (!Number.isInteger(n) || n < 1) return '';
    if (n === 1) return 'Diaria';
    const fecha = fechaCorta(task);
    return fecha ? `Cada ${n} días desde el ${fecha}` : `Cada ${n} días`;
  }

  // Un tipo que no se conoce (o una tarea sin tipo): no se enseña el
  // nombre de la clase, se deja el resumen vacío.
  return '';
}

/** El resumen de una tarea: cuándo se repite y cuántas veces al día.
 *
 *  Devuelve '' si no se puede decir nada (una tarea de un tipo
 *  desconocido): el nombre de la clase nunca se muestra. */
export function taskSummary(task) {
  const base = resumenDe(task);
  if (!base) return '';
  const veces = Number(task.Total);
  if (Number.isInteger(veces) && veces > 1) return `${base} · ${veces} veces`;
  return base;
}
