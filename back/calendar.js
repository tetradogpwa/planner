// ── Helpers de fecha ─────────────────────────────────────────────────────────

/** Devuelve el lunes de la semana que contiene `date`. */
export function getMondayOfWeek(date) {
  const d   = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/** Diferencia en semanas (redondeando hacia arriba) entre dos fechas. */
export function getDiffWeeks(from, to) {
  const d1 = new Date(from); d1.setHours(0, 0, 0, 0);
  const d2 = new Date(to);   d2.setHours(0, 0, 0, 0);
  return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24 * 7));
}

/** Último día del mes de `date`. */
export function getLastDayOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Número de semanas en el mes de `date`. */
export function getWeeksInMonth(date) {
  const d     = new Date(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return Math.ceil(Math.abs(last - first) / (1000 * 60 * 60 * 24 * 7));
}

// ── Tareas por día ───────────────────────────────────────────────────────────

/** Filtra las tareas que aplican al día `dayFromOrigin` desde `from`. */
export function GetTasksOfDay(from, dayFromOrigin, tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(t => {
    try { return t?.thisDayHas?.(from, dayFromOrigin); }
    catch (e) { console.error('Error checking task for day', dayFromOrigin, e); return false; }
  });
}

// ── Semanas ──────────────────────────────────────────────────────────────────

/** Devuelve los datos de una semana concreta (0-indexed desde `from`). */
export function GetWeek(from, numWeek, tasks) {
  const mondayFrom = getMondayOfWeek(from);
  const mondayTo   = new Date(mondayFrom);
  mondayTo.setDate(mondayTo.getDate() + numWeek * 7);

  const dayFromOrigin = Math.ceil(Math.abs(mondayTo - mondayFrom) / (1000 * 60 * 60 * 24));
  const weekTasks     = Array.from({ length: 7 }, (_, i) =>
    GetTasksOfDay(from, dayFromOrigin + i, tasks)
  );
  return { mondayTo, weekTasks };
}

/** Devuelve las semanas entre dos fechas, saltando `avoidWeeks` al inicio. */
export function GetWeeks(from, to, avoidWeeks = 0, tasks = []) {
  const diffWeeks = getDiffWeeks(from, to);
  return Array.from(
    { length: Math.max(0, diffWeeks - avoidWeeks) },
    (_, i) => GetWeek(from, avoidWeeks + i, tasks)
  );
}

/** Devuelve `nWeeks` semanas desde `from`, saltando `nWeeksToAvoid`. */
export function GetNWeeks(from, nWeeks, nWeeksToAvoid = 0, tasks = []) {
  const to = new Date(from);
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + (nWeeksToAvoid + nWeeks) * 7);
  return GetWeeks(from, to, nWeeksToAvoid, tasks);
}

/** Devuelve el resto del mes actual desde `from`. */
export function GetRestoOfMonth(from, tasks = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return GetWeeks(from, getLastDayOfMonth(today), getDiffWeeks(from, today), tasks);
}

/** Devuelve las semanas del mes indicado. */
export function GetMonth(from, month, year, tasks = []) {
  const date = new Date(year, month, 1); date.setHours(0, 0, 0, 0);
  if (from.getTime() > date.getTime()) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return GetWeeks(today, getLastDayOfMonth(today), 0, tasks);
  }
  return GetWeeks(from, getLastDayOfMonth(date), getDiffWeeks(from, date), tasks);
}
