import { DAY_NAMES } from './dayNames.js';

// ── Helpers de fecha ─────────────────────────────────────────────────────────

/** Fecha en formato YYYY-MM-DD usando la zona horaria LOCAL (no UTC,
 *  como haría `Date.toISOString().slice(0,10)`). La comparten getStartDate
 *  y buildWeekJson para que las fechas no se desfase un día al cruzar
 *  medianoche en UTC. */
export function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convierte una fecha (string ISO YYYY-MM-DD o Date) en un Date local a
 *  las 00:00. Lanza Error con un mensaje en español si no es válida:
 *  '2026-02-31' se desplazaría al 3 de marzo sin avisar, así que se
 *  comprueba que el Date construido coincide con la cadena original. */
export function parseLocalDate(isoDate) {
  let next;
  if (isoDate instanceof Date) {
    if (Number.isNaN(isoDate.getTime())) throw new Error('Fecha inválida');
    // Copiamos para no mutar el objeto recibido.
    next = new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate());
  } else if (typeof isoDate === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
    if (!m) throw new Error('Fecha inválida (usa YYYY-MM-DD)');
    const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
    const d = new Date(y, mo, da);
    // Si JS desbordó el día (p. ej. 31-feb → 3-mar), el mes ya no
    // coincide con el que pedimos.
    if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da)
      throw new Error('Fecha inválida');
    next = d;
  } else {
    throw new Error('Fecha inválida');
  }
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Devuelve la fecha de hoy a las 00:00 en hora local. */
export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Devuelve la fecha de hoy en formato YYYY-MM-DD (hora local). */
export function todayISO() {
  return formatLocalDate(today());
}

/** Suma `n` días a una fecha sin mutarla. */
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Diferencia en días naturales entre dos fechas (ignora el cambio de hora). */
export function diffDays(from, to) {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo   = Date.UTC(to.getFullYear(),   to.getMonth(),   to.getDate());
  return Math.round((utcTo - utcFrom) / (1000 * 60 * 60 * 24));
}

/** Índice del día de la semana en el orden que usa la interfaz
 *  (0 = lunes … 6 = domingo). `Date.getDay()` va de domingo (0) a
 *  sábado (6), así que se rota: el lunes de getDay() es el 1 y tiene
 *  que ser el 0 de la interfaz. */
export function weekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

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
  return Math.ceil(Math.abs(diffDays(from, to)) / 7);
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
  return Math.ceil(diffDays(first, last) / 7);
}

// ── Tareas por día ───────────────────────────────────────────────────────────

/** Filtra las tareas que aplican el día `date` (una fecha real: Date o
 *  'YYYY-MM-DD'). Cada tarea decide con su propia fecha de inicio
 *  absoluta, así que el resultado no depende del día en que se abra la
 *  app. */
export function GetTasksOfDay(date, tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(t => {
    try { return t?.thisDayHas?.(date); }
    catch (e) { console.error('Error checking task for day', date, e); return false; }
  });
}

// ── Semanas ──────────────────────────────────────────────────────────────────

/** Devuelve los datos de una semana concreta: la semana real (lunes a
 *  domingo) que va `numWeek` semanas después de la que contiene
 *  `from`. Cada día lleva su fecha real, que es la que decide qué
 *  tareas le tocan. */
export function GetWeek(from, numWeek, tasks) {
  const monday = getMondayOfWeek(from);
  monday.setDate(monday.getDate() + numWeek * 7);

  const weekTasks = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(monday);
    dia.setDate(dia.getDate() + i);
    return GetTasksOfDay(dia, tasks);
  });
  return { mondayTo: monday, weekTasks };
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
  const hoy = today();
  return GetWeeks(from, getLastDayOfMonth(hoy), getDiffWeeks(from, hoy), tasks);
}

/** Devuelve las semanas del mes indicado. */
export function GetMonth(from, month, year, tasks = []) {
  const date = new Date(year, month, 1); date.setHours(0, 0, 0, 0);
  if (from.getTime() > date.getTime()) {
    const hoy = today();
    return GetWeeks(hoy, getLastDayOfMonth(hoy), 0, tasks);
  }
  return GetWeeks(from, getLastDayOfMonth(date), getDiffWeeks(from, date), tasks);
}

// ── Semana en JSON plano ─────────────────────────────────────────────────────

/** Devuelve los 7 días de la semana `offset` desde `from`, cada uno con
 *  su fecha ISO local y los nombres de las tareas que tocan. */
export function buildWeekJson(from, offset, tasks) {
  const weeks = GetNWeeks(from, 1, offset, tasks);
  const week  = weeks[0];
  if (!week) return [];
  return week.weekTasks.map((dayTasks, i) => {
    const d = new Date(week.mondayTo);
    d.setDate(d.getDate() + i);
    return {
      date:    formatLocalDate(d),
      weekday: DAY_NAMES[i],
      tasks:   dayTasks.map(t => t.Name),
    };
  });
}
