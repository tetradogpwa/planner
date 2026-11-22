// ────────────────────────────────────────────────────────────────────
// api.js — Capa pública del planificador.
//
// Punto único para que la app se pueda manejar desde código (consola
// del navegador, futuros servidores MCP, automatizaciones…). Hoy
// todavía no se expone al exterior: solo se monta en `window.PlannerApi`
// para depurar y se usará desde T-009 (servidor MCP).
//
// Toda mutación de tareas y de la fecha de inicio pasa por aquí:
//   - `Context.Tasks` (Proxy en context.js) ya persiste en localStorage
//     al mutar, así que basta con hacer push/splice sobre él.
//   - `Context.StartDate` tiene un setter que también persiste.
//   - Tras cada cambio se dispara un evento `planner:changed` en
//     `window` (con un mensaje en español) para que la vista activa se
//     repinte y se anuncie al usuario en una región role="status".
//
// Los `spec` que aceptan `addTask` y `updateTask` son JSON plano y
// validado. Los mensajes de error coinciden con los que ya usan los
// formularios (addTask / editTask) para que el comportamiento sea el
// mismo desde la UI y desde la API.
// ────────────────────────────────────────────────────────────────────

import { Context } from './context.js';
import {
  createDailyTask,
  createNDaysTask,
  createOneTimeTask,
  createDaysOfWeekTask,
  createCycleDaysOfWeekTask,
} from './back/taskFactory.js';
import { ToJson }    from './back/serializer.js';
import { GetNWeeks } from './back/calendar.js';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Vistas válidas para `navigate(view)` (T-022). Los antiguos nombres
// ('data' | 'print' | 'legal' | 'accessibility' | 'settings') se
// conservan como alias: cada uno abre Ajustes en la pestaña
// correspondiente para no romper integraciones ya publicadas
// (servidor MCP, atajos de teclado externos, automatizaciones).
const VIEWS = ['tasks', 'week', 'allWeeks', 'ajustes'];
// Mapeo de alias → pestaña dentro de Ajustes. 'settings' (alias
// histórico) y 'ajustes' abren la pestaña Apariencia.
// Nombre canónico de la vista al que apunta cada alias (todos acaban
// en 'ajustes' excepto los alias históricos que ya eran Ajustes).
const VIEW_TAB_ALIAS = {
  'settings':     { view: 'ajustes', tab: 'appearance' },
  'ajustes':      { view: 'ajustes', tab: 'appearance' },
  'data':         { view: 'ajustes', tab: 'data' },
  'print':        { view: 'ajustes', tab: 'print' },
  'legal':        { view: 'ajustes', tab: 'legal' },
  'accessibility':{ view: 'ajustes', tab: 'accessibility' },
};

/** Fecha en formato YYYY-MM-DD usando la zona horaria LOCAL (no UTC,
 *  como haría `Date.toISOString().slice(0,10)`). Lo comparten getStartDate
 *  y buildWeekJson para que las fechas no se desfase un día al cruzar
 *  medianoche en UTC. */
function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Validación ───────────────────────────────────────────────────────────

/** Normaliza un día a entero en [0,6]. Devuelve null si no es válido. */
function parseDay(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n;
}

/** Comprueba que `value` es array de días [0,6] sin duplicados. */
function parseDayArray(value) {
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
function parseCycle(value) {
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
function taskToJson(task) {
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

/** Devuelve los 7 días de la semana `offset` desde `Context.StartDate`,
 *  cada uno con su fecha ISO local y los nombres de las tareas que tocan. */
function buildWeekJson(offset) {
  const weeks = GetNWeeks(Context.StartDate, 1, offset, Context.Tasks);
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

// ── Notificación de cambios ──────────────────────────────────────────────

/** Despacha `planner:changed` en window con un mensaje listo para una
 *  región role="status". El evento lleva la causa ('add' | 'update' |
 *  'delete' | 'startDate' | 'navigate' | 'import') para que la app
 *  decida qué repintar.
 *
 *  Lo exporta la importación de JSON (Ajustes › Datos), que también
 *  cambia la lista de tareas y tiene que avisar como el resto de
 *  mutaciones (T-031). */
export function emitChanged(action, statusMessage, extra = {}) {
  window.dispatchEvent(new CustomEvent('planner:changed', {
    detail: { action, status: statusMessage, ...extra },
  }));
}

// ── Helpers de mutación ──────────────────────────────────────────────────

// ── API pública ─────────────────────────────────────────────────────────

export const PlannerApi = {

  /** Lista todas las tareas como objetos JSON planos. */
  listTasks() {
    return Context.Tasks.map((t, i) => ({ ...taskToJson(t), index: i }));
  },

  /** Devuelve la tarea en `index` (o null si no existe) como JSON plano. */
  getTask(index) {
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= Context.Tasks.length) return null;
    return { ...taskToJson(Context.Tasks[i]), index: i };
  },

  /** Añade una tarea desde un spec JSON plano validado. Devuelve la
   *  tarea recién creada como JSON plano. */
  addTask(spec) {
    const task = buildTaskFromSpec(spec);
    Context.Tasks.push(task);
    const newIndex = Context.Tasks.length - 1;
    emitChanged('add', `Tarea «${task.Name}» añadida`, { index: newIndex, name: task.Name });
    return { ...taskToJson(task), index: newIndex };
  },

  /** Sustituye la tarea en `index` por la construida desde `spec`. */
  updateTask(index, spec) {
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= Context.Tasks.length)
      throw new Error('Índice de tarea inválido');
    const task = buildTaskFromSpec(spec);
    Context.Tasks[i] = task;
    emitChanged('update', `Tarea «${task.Name}» actualizada`, { index: i, name: task.Name });
    return { ...taskToJson(task), index: i };
  },

  /** Elimina la tarea en `index`. Devuelve el nombre de la borrada. */
  deleteTask(index) {
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= Context.Tasks.length)
      throw new Error('Índice de tarea inválido');
    const name = Context.Tasks[i].Name;
    Context.Tasks.splice(i, 1);
    emitChanged('delete', `Tarea «${name}» eliminada`, { index: i, name });
    return name;
  },

  /** Devuelve los 7 días de la semana `offset` desde la fecha de inicio. */
  getWeek(offset = 0) {
    const o = Number(offset);
    if (!Number.isInteger(o)) throw new Error('Offset inválido');
    return buildWeekJson(o);
  },

  /** Devuelve la fecha de inicio actual en formato ISO local (YYYY-MM-DD). */
  getStartDate() {
    return formatLocalDate(Context.StartDate);
  },

  /** Cambia la fecha de inicio (acepta string ISO YYYY-MM-DD o Date).
 *  Rechaza fechas inválidas: '2026-02-31' se desplazaría al 3 de marzo
 *  sin avisar, así que comprobamos que el Date construido coincide con
 *  la cadena original. */
  setStartDate(isoDate) {
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
    Context.StartDate = next;
    emitChanged('startDate', 'Fecha de inicio cambiada');
  },

  /** Pide a la app que navegue a `view`. Dispara un evento `planner:navigate`
   *  en window para que index.js haga el cambio de vista (no tocamos
   *  directamente las clases del DOM desde aquí).
   *
   *  Acepta los alias heredados ('settings', 'data', 'print', 'legal',
   *  'accessibility') además del nombre canónico 'ajustes'. Los alias
   *  abren Ajustes en la pestaña adecuada para no romper integraciones
   *  ya publicadas (MCP, automatizaciones). Si el alias lleva
   *  asociada una pestaña, el evento `planner:navigate` lleva
   *  también `tab` para que la app abra Ajustes directamente ahí. */
  navigate(view) {
    if (VIEWS.includes(view)) {
      // Vista canónica (tasks / week / allWeeks / ajustes): navegar a
      // esa vista. Si es 'ajustes' la app abrirá la pestaña por defecto.
      window.dispatchEvent(new CustomEvent('planner:navigate', {
        detail: { view, tab: null },
      }));
      return;
    }
    if (view in VIEW_TAB_ALIAS) {
      const { view: target, tab } = VIEW_TAB_ALIAS[view];
      window.dispatchEvent(new CustomEvent('planner:navigate', {
        detail: { view: target, tab },
      }));
      return;
    }
    throw new Error('Vista inválida');
  },

  /** Devuelve las pestañas disponibles dentro de Ajustes. Lo usa el
   *  servidor MCP (`abrir_vista`) y futuras integraciones que
   *  quieran saltar a una sección concreta de Ajustes sin tener que
   *  recordar el mapeo de la UI. */
  listAjustesTabs() {
    return Object.entries(VIEW_TAB_ALIAS)
      .filter(([k]) => k !== 'ajustes')
      .map(([, v]) => v.tab);
  },

  /** Devuelve un string JSON con todas las tareas (el mismo formato
   *  que `Importar JSON` en Ajustes › Datos). */
  exportJson() {
    return ToJson(Context.Tasks);
  },

  /** Lista las vistas disponibles para `navigate(view)`. */
  listViews() {
    return [...VIEWS];
  },
};

// Para depurar desde la consola del navegador (la usará T-009, el
// servidor MCP, y cualquier integración futura).
if (typeof window !== 'undefined') {
  window.PlannerApi = PlannerApi;
}