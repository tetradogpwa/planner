import { TaskBase }                                          from './baseTarea.js';
import { NDaysTask, DailyTask, WeeklyTask, MonthlyTask, QuaterlyTask } from './nDays.js';
import { LimitedTimeTask, OneTimeTask }                       from './limitedTime.js';
import { DaysOfWeekTask, CiclesDaysOfWeekTask }               from './daysOfWeek.js';
import { addDays, formatLocalDate, parseLocalDate, today }    from './calendar.js';

// ── JSON → objetos ────────────────────────────────────────────────────────────

/** Convierte el texto de un archivo en el objeto JSON que contiene.
 *
 *  Lanza un `Error` con mensaje en español cuando el texto no es un JSON
 *  válido. */
export function ParseJson(dataStr) {
  try {
    return JSON.parse(dataStr);
  } catch (e) {
    console.warn('[serializer] el JSON no se ha podido leer:', e);
    // El `cause` guarda el error original: el mensaje que ve el
    // usuario sigue siendo este, pero al depurar se sabe por qué.
    throw new Error('JSON inválido: el archivo no contiene un JSON válido', { cause: e });
  }
}

/** Convierte un JSON (el formato que produce `ToJson`) en una lista de
 *  tareas.
 *
 *  Lanza un `Error` con mensaje en español cuando el texto no es un JSON
 *  válido o cuando no contiene una lista de tareas. Antes se tragaba el
 *  error y devolvía `[]`: quien importaba un archivo corrupto se quedaba
 *  sin tareas y con el mensaje "0 tarea(s) importada(s)" (T-031 / R-01).
 *
 *  Un JSON válido pero sin ninguna tarea reconocible (por ejemplo `[]` o
 *  tareas con un `className` desconocido) NO es un error: devuelve una
 *  lista vacía. Quien importe decide qué hacer con esa lista vacía.
 *
 *  `opts.origin` es la fecha de inicio del planificador: sirve para
 *  migrar las tareas del formato viejo (las que guardaban `daysFrom`, un
 *  offset en días respecto al origen) a una fecha real. Si no se pasa
 *  ningún origen, la migración usa la fecha de la migración (hoy). */
export function FromJson(dataStr, opts = {}) {
  return TareasDeDatos(ParseJson(dataStr), opts).tareas;
}

/** Las tareas de un JSON ya leído: un array de tareas o el envoltorio
 *  { tasks: [...] }.
 *
 *  Devuelve las tareas leídas y cuántas se han descartado por no ser
 *  reconocibles (un `className` que no existe, una entrada que no es un
 *  objeto). */
export function TareasDeDatos(datos, opts = {}) {
  // Aceptamos un array de tareas o el envoltorio { tasks: [...] }.
  const lista = Array.isArray(datos)
    ? datos
    : (datos && Array.isArray(datos.tasks) ? datos.tasks : null);

  if (lista === null) {
    throw new Error('JSON inválido: el archivo no contiene una lista de tareas');
  }

  const tareas = [];
  let descartadas = 0;
  try {
    for (const raw of lista) {
      const tarea = processTask(raw, opts);
      if (tarea) tareas.push(tarea);
      else descartadas += 1;
    }
  } catch (e) {
    console.warn('[serializer] alguna tarea del JSON no se ha podido leer:', e);
    throw new Error('JSON inválido: alguna tarea del archivo no se ha podido leer', { cause: e });
  }
  return { tareas, descartadas };
}

/** Dice si el JSON usa el formato viejo (tareas sin `startDate`). Esas
 *  tareas se migran al leerlas, así que hay que guardar el resultado ya
 *  migrado: si no, la migración se repetiría en cada arranque (y, sin
 *  fecha de inicio guardada, movería las tareas un día cada vez). */
export function usaFormatoAntiguo(dataStr) {
  let datos;
  try {
    datos = JSON.parse(dataStr);
  } catch {
    return false;
  }
  const lista = Array.isArray(datos)
    ? datos
    : (datos && Array.isArray(datos.tasks) ? datos.tasks : []);
  if (!Array.isArray(lista)) return false;
  return lista.some(t => t && typeof t === 'object' && !t.startDate);
}

/** Dice si alguna tarea del JSON no tiene `id`. Las tareas guardadas
 *  antes de T-049 no lo tenían: al leerlas se les asigna uno, y hay
 *  que guardar el resultado ya migrado (si no, en cada arranque se les
 *  asignaría un id nuevo y el identificador no sería estable). */
export function faltanIds(dataStr) {
  let datos;
  try {
    datos = JSON.parse(dataStr);
  } catch {
    return false;
  }
  const lista = Array.isArray(datos)
    ? datos
    : (datos && Array.isArray(datos.tasks) ? datos.tasks : []);
  if (!Array.isArray(lista)) return false;
  return lista.some(t => t && typeof t === 'object' && !t.id);
}

/** Fecha de inicio de una tarea que viene del JSON.
 *  - `startDate` (formato nuevo) manda.
 *  - Si no viene, la tarea usaba `daysFrom`: un offset en días
 *    respecto al origen del planificador. El origen es la fecha de
 *    inicio guardada; si no hay ninguna, la fecha de la migración.
 *    El offset puede ser negativo (la tarea empezaba antes del
 *    origen): la API acepta ese mismo valor a la vuelta. */
function startDateDe(data, opts) {
  if (data.startDate) {
    try {
      return formatLocalDate(parseLocalDate(data.startDate));
    } catch (e) {
      throw new Error(`La tarea «${data.name}» tiene una fecha de inicio inválida`, { cause: e });
    }
  }

  const origin   = opts.origin ? parseLocalDate(opts.origin) : today();
  const daysFrom = data.daysFrom ?? 0;
  if (!Number.isInteger(daysFrom)) {
    throw new Error(`La tarea «${data.name}» tiene un daysFrom inválido`);
  }
  return formatLocalDate(addDays(origin, daysFrom));
}

function processTask(raw, opts) {
  // Una entrada que no es un objeto (null, un número…) se descarta: no
  // invalida el archivo entero.
  if (!raw || typeof raw !== 'object') return undefined;

  const { className, ...data } = raw;
  let task;

  switch (className) {
    case CiclesDaysOfWeekTask.name:
      task = new CiclesDaysOfWeekTask();
      // Un ciclo puede venir vacío (o no venir) de un JSON importado:
      // se deja como está, pero sin petar al leerlo.
      for (const semana of (Array.isArray(data.cicles) ? data.cicles : [])) {
        task.Cicles.push(new DaysOfWeekTask(semana?.flags ?? 0));
      }
      break;
    case DaysOfWeekTask.name:   task = new DaysOfWeekTask(data.flags); break;
    case OneTimeTask.name:      task = new OneTimeTask();               break;
    case LimitedTimeTask.name:  task = new LimitedTimeTask();           break;
    case NDaysTask.name:        task = new NDaysTask();                 break;
    case DailyTask.name:        task = new DailyTask();                 break;
    case WeeklyTask.name:       task = new WeeklyTask();                break;
    case MonthlyTask.name:      task = new MonthlyTask();               break;
    case QuaterlyTask.name:     task = new QuaterlyTask();              break;
    default: return undefined;
  }

  switch (className) {
    case OneTimeTask.name:
      task.Task = processTask(data.task, opts);
      if (!task.Task) throw new Error(`La tarea «${data.name}» no tiene su tarea base`);
      break;
    case LimitedTimeTask.name:
      task.Task   = processTask(data.task, opts);
      if (!task.Task) throw new Error(`La tarea «${data.name}» no tiene su tarea base`);
      task.Repeat = data.repeat ?? 1;
      break;
    case NDaysTask.name:      task.NDays = data.nDays; break;
    case DailyTask.name:      task.nDays = 1;          break;
    case WeeklyTask.name:     task.nDays = 7;          break;
    case MonthlyTask.name:    task.nDays = 30;         break;
    case QuaterlyTask.name:   task.nDays = 90;         break;
  }

  task.Total    = data.total;
  task.Name     = data.name;
  task.StartDate = startDateDe(data, opts);
  // El identificador de la tarea: si el JSON lo trae (es lo que pasa
  // al exportar e importar), se conserva; si no, se deja el que la
  // tarea ha nacido con (las tareas guardadas antes de T-049 no lo
  // tenían: es la migración que hace `faltanIds`).
  if (typeof data.id === 'string' && data.id.trim()) task.Id = data.id.trim();
  return task;
}

// ── objetos → JSON ────────────────────────────────────────────────────────────

export function ToJson(tasks) {
  return TaskBase.toJson(tasks);
}

/** Las tareas como un array de objetos JSON planos (lo mismo que
 *  `ToJson`, pero sin pasar por el texto): es lo que va dentro de una
 *  copia de seguridad (T-054). */
export function ToJsonArray(tasks) {
  return TaskBase.toJsonArray(tasks);
}
