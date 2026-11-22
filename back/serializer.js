import { TaskBase }                                          from './baseTarea.js';
import { NDaysTask, DailyTask, WeeklyTask, MonthlyTask, QuaterlyTask } from './nDays.js';
import { LimitedTimeTask, OneTimeTask }                       from './limitedTime.js';
import { DaysOfWeekTask, CiclesDaysOfWeekTask }               from './daysOfWeek.js';

// ── JSON → objetos ────────────────────────────────────────────────────────────

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
 *  lista vacía. Quien importe decide qué hacer con esa lista vacía. */
export function FromJson(dataStr) {
  let datos;
  try {
    datos = JSON.parse(dataStr);
  } catch (e) {
    console.warn('[serializer] el JSON no se ha podido leer:', e);
    throw new Error('JSON inválido: el archivo no contiene un JSON válido');
  }

  // Aceptamos un array de tareas o el envoltorio { tasks: [...] }.
  const lista = Array.isArray(datos)
    ? datos
    : (datos && Array.isArray(datos.tasks) ? datos.tasks : null);

  if (lista === null) {
    throw new Error('JSON inválido: el archivo no contiene una lista de tareas');
  }

  try {
    return lista.map(processTask).filter(Boolean);
  } catch (e) {
    console.warn('[serializer] alguna tarea del JSON no se ha podido leer:', e);
    throw new Error('JSON inválido: alguna tarea del archivo no se ha podido leer');
  }
}

function processTask(raw) {
  // Una entrada que no es un objeto (null, un número…) se descarta: no
  // invalida el archivo entero.
  if (!raw || typeof raw !== 'object') return undefined;

  const { className, ...data } = raw;
  let task;

  switch (className) {
    case CiclesDaysOfWeekTask.name:
      task = new CiclesDaysOfWeekTask();
      for (const { flags } of data.cicles) task.Cicles.push(new DaysOfWeekTask(flags));
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
      task.Task = processTask(data.task);
      if (!task.Task) throw new Error(`La tarea «${data.name}» no tiene su tarea base`);
      break;
    case LimitedTimeTask.name:
      task.Task   = processTask(data.task);
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
  task.DaysFrom = data.daysFrom ?? 0;
  return task;
}

// ── objetos → JSON ────────────────────────────────────────────────────────────

export function ToJson(tasks) {
  return TaskBase.toJson(tasks);
}
