// ────────────────────────────────────────────────────────────────────
// back/taskSpec.js — Construcción y serialización de tareas.
//
// El "spec" es el mismo JSON plano que acepta la API pública
// (`PlannerApi.addTask` / `updateTask`) y que construyen los
// formularios de alta y de edición. Aquí vive toda esa lógica:
//   - `parseDay`, `parseDayArray` y `parseCycle` validan los días.
//   - `buildTaskFromSpec` valida el spec entero y devuelve la tarea.
//   - `taskToJson` devuelve una copia plana (sin clases ni Proxy) de una
//     tarea.
//
// No toca el DOM ni el estado global: se puede usar y probar sin
// navegador (ver `tests/unit/taskSpec.test.mjs`).
// ────────────────────────────────────────────────────────────────────

import {
  createDailyTask,
  createNDaysTask,
  createOneTimeTask,
  createDaysOfWeekTask,
  createCycleDaysOfWeekTask,
} from './taskFactory.js';

// ── Validación ───────────────────────────────────────────────────────────

/** Normaliza un día a entero en [0,6]. Devuelve null si no es válido. */
export function parseDay(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n;
}

/** Comprueba que `value` es array de días [0,6] sin duplicados. */
export function parseDayArray(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const out  = [];
  for (const v of value) {
    const d = parseDay(v);
    if (d === null || seen.has(d)) return null;
    seen.add(d);
    out.push(d);
  }
  return out;
}

/** Comprueba que `value` es array no vacío de arrays de días [0,6].
 *  Las semanas de descanso (array vacío) están permitidas, pero al menos
 *  una semana tiene que tener días. Devuelve un objeto con el ciclo
 *  parseado y un `reason` si no cuadra:
 *    - { reason: 'empty' }: el array de semanas está vacío.
 *    - { reason: 'allEmpty' }: todas las semanas están vacías. */
export function parseCycle(value) {
  if (!Array.isArray(value) || value.length === 0) return { reason: 'empty' };
  const out = [];
  let someDays = false;
  for (let i = 0; i < value.length; i++) {
    const days = parseDayArray(value[i]);
    if (days === null) return { reason: 'invalid', index: i };
    if (days.length > 0) someDays = true;
    out.push(days);
  }
  if (!someDays) return { reason: 'allEmpty' };
  return { cycle: out };
}

/** Valida y construye una tarea desde un spec JSON plano. Lanza Error
 *  con mensaje en español si algo no cuadra. La usan PlannerApi.addTask
 *  y PlannerApi.updateTask, y también los formularios (addTask / editTask)
 *  para no duplicar la lógica de construcción por tipo de repetición. */
export function buildTaskFromSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('Especificación de tarea inválida');

  const name = typeof spec.name === 'string' ? spec.name.trim() : '';
  if (!name) throw new Error('Nombre requerido');

  const total = spec.total === undefined ? 1 : Number(spec.total);
  if (!Number.isInteger(total) || total < 1) throw new Error('Total inválido');

  const daysFrom = spec.daysFrom === undefined ? 0 : Number(spec.daysFrom);
  if (!Number.isInteger(daysFrom) || daysFrom < 0) throw new Error('daysFrom inválido');

  const repeat = spec.repeat;
  switch (repeat) {
    case 'none': {
      // OneTimeTask: una sola vez envuelve una DailyTask.
      return createOneTimeTask(createDailyTask(name, total, daysFrom), total, daysFrom);
    }
    case 'daily':
      return createDailyTask(name, total, daysFrom);

    case 'nDays': {
      const nDays = Number(spec.nDays);
      if (!Number.isInteger(nDays) || nDays < 2) throw new Error('nDays inválido');
      return createNDaysTask(name, nDays, total, daysFrom);
    }

    case 'daysOfWeek': {
      const days = parseDayArray(spec.days);
      if (!days || days.length === 0) throw new Error('Selecciona al menos un día');
      return createDaysOfWeekTask(name, days, total, daysFrom);
    }

    case 'cycle': {
      const parsed = parseCycle(spec.cycle);
      if (parsed.reason === 'empty')    throw new Error('Añade al menos una semana al ciclo');
      if (parsed.reason === 'allEmpty') throw new Error('Marca al menos un día en el ciclo');
      if (parsed.reason === 'invalid')  throw new Error('Días de ciclo inválidos');
      return createCycleDaysOfWeekTask(name, parsed.cycle, total, daysFrom);
    }

    default:
      throw new Error('Tipo de repetición inválido');
  }
}

// ── Serialización plana (para getters) ───────────────────────────────────

/** Devuelve una copia JSON-segura (sin clases, sin Proxy) de la tarea
 *  en `index`. Acepta tanto instancias reales como Proxies: copiamos
 *  los campos manualmente en lugar de hacer JSON.parse(JSON.stringify)
 *  para no perder tipos. */
export function taskToJson(task) {
  const cn = task.constructor?.name ?? '';
  const base = {
    index: -1,   // lo rellena el llamador
    name:    task.Name,
    total:   task.Total,
    daysFrom: task.DaysFrom ?? 0,
    repeat:  null,
  };
  switch (cn) {
    case 'OneTimeTask':  base.repeat = 'none';      break;
    case 'DailyTask':    base.repeat = 'daily';     break;
    case 'NDaysTask':    base.repeat = 'nDays';     base.nDays  = task.NDays; break;
    case 'DaysOfWeekTask': {
      base.repeat = 'daysOfWeek';
      base.days   = [0,1,2,3,4,5,6].filter(i => task.hasDay?.(i));
      break;
    }
    case 'CiclesDaysOfWeekTask': {
      base.repeat = 'cycle';
      base.cycle  = (task.Cicles ?? []).map(c =>
        [0,1,2,3,4,5,6].filter(i => c.hasDay?.(i))
      );
      break;
    }
    default:
      // Tipo desconocido: lo exponemos como 'none' para no perder la tarea.
      base.repeat = 'none';
  }
  return base;
}
