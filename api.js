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
//   - `Context.Mark` / `Context.Unmark` guardan las marcas de «hecho»
//     (T-050) en su propia clave del almacenamiento.
//   - Tras cada cambio se dispara un evento `planner:changed` en
//     `window` (con un mensaje en español) para que la vista activa se
//     repinte y se anuncie al usuario en una región role="status".
//
// Los `spec` de `addTask` y `updateTask` son JSON plano validado: sus
// mensajes de error coinciden con los de los formularios (addTask /
// editTask), así que el comportamiento es el mismo desde la UI y la API.
//
// Las tareas se identifican por su `id` (un UUID estable, T-049). Por
// compatibilidad, `getTask`, `updateTask` y `deleteTask` aceptan
// también el `index` (la posición en la lista), que queda OBSOLETO:
// si otra tarea se borra mientras esta se edita, la posición ya no es
// la misma tarea.
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
 *  'delete' | 'startDate' | 'navigate' | 'import' | 'clear' |
 *  'restore') para que la app decida qué repintar. La importación de
 *  JSON (Ajustes › Datos) lo exporta porque también cambia la lista
 *  de tareas (T-031); «Borrar todo» y su «Deshacer» también (T-053). */
export function emitChanged(action, statusMessage, extra = {}) {
  window.dispatchEvent(new CustomEvent('planner:changed', {
    detail: { action, status: statusMessage, ...extra },
  }));
}

// ── Referencia a una tarea ───────────────────────────────────────────────

/** Devuelve el índice de la tarea a la que se refiere `ref`, o -1 si no
 *  existe.
 *
 *  `ref` puede ser el `id` de la tarea (un UUID: lo normal) o su
 *  posición en la lista (`index`), que se conserva por compatibilidad
 *  pero está OBSOLETO: si otra tarea se borra mientras el usuario
 *  edita esta, la posición ya no es la misma tarea (T-049). */
function indiceDeTarea(ref) {
  if (typeof ref === 'string') {
    return Context.Tasks.findIndex(t => t.Id === ref);
  }
  const i = Number(ref);
  if (!Number.isInteger(i) || i < 0 || i >= Context.Tasks.length) return -1;
  return i;
}

/** El mensaje de error cuando la referencia no apunta a ninguna tarea.
 *  Un `id` que no existe y un `index` que no vale no son lo mismo: el
 *  primero significa que la tarea ya no está (p.ej. la borró un
 *  asistente mientras se editaba). */
function mensajeDeReferencia(ref) {
  return typeof ref === 'string' ? 'Tarea no encontrada' : 'Índice de tarea inválido';
}

export const PlannerApi = {

  /** Lista todas las tareas como objetos JSON planos.
   *
   *  Cada tarea lleva su `id`: el identificador único y estable con el
   *  que hay que referirse a ella (no cambia al editarla ni al
   *  recargar). El `index` es su posición en la lista: se conserva por
   *  compatibilidad, pero está OBSOLETO (usa el `id`).
   *
   *  Cada tarea lleva también su `startDate` ('YYYY-MM-DD'): el día en
   *  el que empieza a aplicar. Es el dato que manda. El `daysFrom` que
   *  acompaña es un valor DERIVADO de la fecha de inicio actual del
   *  planificador (días entre esa fecha y la de la tarea), no un dato
   *  guardado: si la fecha de inicio del planificador se mueve, el
   *  `daysFrom` de la misma tarea cambia (y puede ser negativo).
   *
   *  Y su `summary`: el resumen legible de cuándo se repite la tarea
   *  ("Diaria", "Diaria · 3 veces", "Lun, Mié, Vie", "Cada 3 días
   *  desde el 25/11", "Ciclo de 2 semanas", "Una vez · 25/11"). Es el
   *  mismo texto que muestra la lista de tareas de la vista Tareas. */
  listTasks() {
    return Context.Tasks.map((t, i) => ({ ...taskToJson(t, Context.StartDate), index: i }));
  },

  /** Devuelve la tarea identificada por `ref` (o null si no existe)
   *  como JSON plano.
   *
   *  `ref` es el `id` de la tarea. Por compatibilidad con las
   *  integraciones antiguas también acepta su `index`, que está
   *  obsoleto.
   *
   *  Los campos son los mismos que devuelve `listTasks`, incluido el
   *  `summary` con el resumen legible de cuándo se repite la tarea. */
  getTask(ref) {
    const i = indiceDeTarea(ref);
    if (i === -1) return null;
    return { ...taskToJson(Context.Tasks[i], Context.StartDate), index: i };
  },

  /** Añade una tarea desde un spec JSON plano validado. Devuelve la
   *  tarea recién creada como JSON plano (con su `id`).
   *
   *  El spec puede traer `startDate` ('YYYY-MM-DD'): el día en el que
   *  la tarea empieza a aplicar. Por compatibilidad con el formato
   *  viejo también se acepta `daysFrom` (días desde la fecha de inicio
   *  del planificador; puede ser negativo si la tarea empieza antes).
   *  Si no viene ninguno, la tarea empieza hoy. */
  addTask(spec) {
    const task = buildTaskFromSpec(spec, { origin: Context.StartDate });
    Context.Tasks.push(task);
    const newIndex = Context.Tasks.length - 1;
    emitChanged('add', `Tarea «${task.Name}» añadida`, { id: task.Id, index: newIndex, name: task.Name });
    return { ...taskToJson(task, Context.StartDate), index: newIndex };
  },

  /** Sustituye la tarea identificada por `ref` por la construida desde
   *  `spec`. La tarea conserva su `id`: editarla no la convierte en
   *  otra.
   *
   *  `ref` es el `id` de la tarea; por compatibilidad también acepta su
   *  `index` (obsoleto). */
  updateTask(ref, spec) {
    const i = indiceDeTarea(ref);
    if (i === -1) throw new Error(mensajeDeReferencia(ref));
    const task = buildTaskFromSpec(spec, { origin: Context.StartDate });
    task.Id = Context.Tasks[i].Id;
    Context.Tasks[i] = task;
    emitChanged('update', `Tarea «${task.Name}» actualizada`, { id: task.Id, index: i, name: task.Name });
    return { ...taskToJson(task, Context.StartDate), index: i };
  },

  /** Elimina la tarea identificada por `ref`. Devuelve el nombre de la
   *  borrada.
   *
   *  `ref` es el `id` de la tarea; por compatibilidad también acepta su
   *  `index` (obsoleto). Con la tarea se van también sus marcas de
   *  «hecho» (T-050): si no, al volver a importar esa tarea aparecería
   *  como ya hecha. */
  deleteTask(ref) {
    const i = indiceDeTarea(ref);
    if (i === -1) throw new Error(mensajeDeReferencia(ref));
    const name = Context.Tasks[i].Name;
    const id   = Context.Tasks[i].Id;
    Context.Tasks.splice(i, 1);
    Context.ClearMarks(id);
    emitChanged('delete', `Tarea «${name}» eliminada`, { id, index: i, name });
    return name;
  },

  /** Marca como hecha una aparición de una tarea y lo guarda.
   *
   *  Una aparición es una tarea en un día: se identifica con el `id` de
   *  la tarea, la fecha real del día ('YYYY-MM-DD') y el número de vez
   *  (0 = la primera del día; solo hace falta para las tareas con más
   *  de una vez al día).
   *
   *  Devuelve la marca: { id, date, slot, done: true }. */
  markTask(ref, date, slot = 0) {
    const i = indiceDeTarea(ref);
    if (i === -1) throw new Error(mensajeDeReferencia(ref));
    const task = Context.Tasks[i];
    const marca = Context.Mark(task.Id, date, slot);
    emitChanged('mark', `Tarea «${task.Name}» marcada como hecha`, { ...marca, name: task.Name });
    return { ...marca, done: true };
  },

  /** Quita la marca de «hecho» de una aparición (la deja pendiente).
   *
   *  Mismos datos que `markTask`. Devuelve { id, date, slot, done: false }. */
  unmarkTask(ref, date, slot = 0) {
    const i = indiceDeTarea(ref);
    if (i === -1) throw new Error(mensajeDeReferencia(ref));
    const task = Context.Tasks[i];
    const marca = Context.Unmark(task.Id, date, slot);
    emitChanged('unmark', `Tarea «${task.Name}» marcada como pendiente`, { ...marca, name: task.Name });
    return { ...marca, done: false };
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
