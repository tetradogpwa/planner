// ────────────────────────────────────────────────────────────────────
// api.js — Capa pública del planificador.
//
// Punto único para que la app se pueda manejar desde código (consola
// del navegador, futuros servidores MCP, automatizaciones…). Hoy solo
// se monta en `window.PlannerApi` para depurar.
//
// Esta capa es una FACHADA: no construye ni serializa tareas (eso vive
// en `back/taskSpec.js`, sin DOM). Solo muta el estado y avisa de los
// cambios.
//
// Toda mutación de tareas y de la fecha de inicio pasa por aquí:
//   - `Context.Tasks` (Proxy en context.js) ya persiste en localStorage
//     al mutar, así que basta con hacer push/splice sobre él.
//   - `Context.StartDate` tiene un setter que también persiste.
//   - Tras cada cambio se dispara un evento `planner:changed` en
//     `window` (con un mensaje en español) para que la vista activa se
//     repinte y se anuncie al usuario en una región role="status".
//
// Los `spec` de `addTask` y `updateTask` son JSON plano validado: sus
// mensajes de error coinciden con los de los formularios (addTask /
// editTask), así que el comportamiento es el mismo desde la UI y la API.
// ────────────────────────────────────────────────────────────────────

import { Context } from './context.js';
import { ToJson }    from './back/serializer.js';
import { buildWeekJson, formatLocalDate, parseLocalDate } from './back/calendar.js';
import { buildTaskFromSpec, taskToJson } from './back/taskSpec.js';

// Vistas válidas para `navigate(view)` (T-022). Los antiguos nombres
// ('data' | 'print' | 'legal' | 'accessibility' | 'settings') se
// conservan como alias que abren Ajustes en su pestaña.
const VIEWS = ['tasks', 'week', 'allWeeks', 'ajustes'];
// Mapeo de alias → pestaña dentro de Ajustes. 'settings' (alias
// histórico) y 'ajustes' abren la pestaña Apariencia.
const VIEW_TAB_ALIAS = {
  'settings':     { view: 'ajustes', tab: 'appearance' },
  'ajustes':      { view: 'ajustes', tab: 'appearance' },
  'data':         { view: 'ajustes', tab: 'data' },
  'print':        { view: 'ajustes', tab: 'print' },
  'legal':        { view: 'ajustes', tab: 'legal' },
  'accessibility':{ view: 'ajustes', tab: 'accessibility' },
};

// ── Notificación de cambios ──────────────────────────────────────────────

/** Despacha `planner:changed` en window con un mensaje listo para una
 *  región role="status". El evento lleva la causa ('add' | 'update' |
 *  'delete' | 'startDate' | 'navigate' | 'import') para que la app
 *  decida qué repintar. La importación de JSON (Ajustes › Datos) lo
 *  exporta porque también cambia la lista de tareas (T-031). */
export function emitChanged(action, statusMessage, extra = {}) {
  window.dispatchEvent(new CustomEvent('planner:changed', {
    detail: { action, status: statusMessage, ...extra },
  }));
}

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
    return buildWeekJson(Context.StartDate, o, Context.Tasks);
  },

  /** Devuelve la fecha de inicio actual en formato ISO local (YYYY-MM-DD). */
  getStartDate() {
    return formatLocalDate(Context.StartDate);
  },

  /** Cambia la fecha de inicio (acepta string ISO YYYY-MM-DD o Date).
   *  Las fechas inválidas se rechazan con un error en español. */
  setStartDate(isoDate) {
    Context.StartDate = parseLocalDate(isoDate);
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
