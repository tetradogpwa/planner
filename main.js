// ==================== IMPORTAR CLASES ====================
import { TaskBase } from "./baseTarea.js";
import { NDaysTask, DailyTask, WeeklyTask, MonthlyTask, QuaterlyTask } from './nDays.js';
import { LimitedTimeTask, OneTimeTask } from './limitedTime.js';
import { DaysOfWeekTask, CiclesDaysOfWeekTask } from './daysOfWeek.js';


// ==================== CONVERSIÓN JSON ↔ OBJETOS ====================
/**
 * Convierte JSON string a array de objetos Task
 */
export function FromJson(dataStr) {
  try {
    const tasksDirty = JSON.parse(dataStr).tasks;
    return tasksDirty.map(ProcessTask).filter(r => r !== undefined);
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return [];
  }
}

/**
 * Procesa un objeto JSON a su clase correspondiente
 */
function ProcessTask({ className, ...data }) {
  let task = undefined;
  switch (className) {
    case CiclesDaysOfWeekTask.name:
      task = new CiclesDaysOfWeekTask();
      for (let { flags } of data.cicles) {
        task.Cicles.push(new DaysOfWeekTask(flags))
      }
      break;
    case DaysOfWeekTask.name:
      task = new DaysOfWeekTask(data.flags);
      break;
    case OneTimeTask.name:
      task = new OneTimeTask();
      break;
    case LimitedTimeTask.name:
      task = new LimitedTimeTask();
      break;
    case NDaysTask.name: task = new NDaysTask(); break;
    case DailyTask.name: task = new DailyTask(); break;
    case WeeklyTask.name: task = new WeeklyTask(); break;
    case MonthlyTask.name: task = new MonthlyTask(); break;
    case QuaterlyTask.name: task = new QuaterlyTask(); break;
  }
  switch (className) {
    case OneTimeTask.name:
    case LimitedTimeTask.name:
      task.Task = ProcessTask(data.task);
      break;
    case NDaysTask.name:
    case DailyTask.name:
    case WeeklyTask.name:
    case MonthlyTask.name:
    case QuaterlyTask.name:
      task.NDays = data.nDays; break;
  }
  if (task) {
    task.Total = data.total;
    task.Name = data.name;
    task.Start=new Date(data.start);
  }
  return task;
}

/**
 * Convierte array de tareas a JSON string
 */
export function ToJson(tasks) {
  return TaskBase.toJson(tasks);
}

// ==================== FUNCIONES DE CÁLCULO ====================
/**
 * Obtiene las tareas que aplican a un día específico (contando desde origin)
 */
export function GetTasksOfDay(from,dayFromOrigin, tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(t => {
    try {
      return t && typeof t.thisDayHas === 'function' && t.thisDayHas(from,dayFromOrigin);
    } catch (e) {
      console.error('Error checking task for day', dayFromOrigin, e);
      return false;
    }
  });
}

/**
 * Obtiene el lunes de la semana que contiene una fecha
 */
export function getMondayOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = domingo, 1 = lunes, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Calcula la diferencia en semanas entre dos fechas
 */
export function getDiffWeeks(from, to) {
  const d1 = new Date(from);
  const d2 = new Date(to);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(d2 - d1);
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return diffWeeks;
}

/**
 * Obtiene una semana específica con sus tareas
 */
export function GetWeek(from, numWeek, tasks) {
  const mondayFrom = getMondayOfWeek(from);
  let mondayTo = new Date(mondayFrom);
  mondayTo.setDate(mondayTo.getDate() + numWeek * 7);

  const diffTime = Math.abs(mondayTo - mondayFrom);
  const dayFromOrigin = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let weekTasks = [];
  for (let i = 0; i < 7; i++) {
    weekTasks.push(GetTasksOfDay(from,dayFromOrigin + i, tasks));
  }

  return { mondayTo, weekTasks };
}

/**
 * Obtiene múltiples semanas en un rango
 */
export function GetWeeks(from, to, avoidWeeks = 0, tasks = []) {
  const diffWeeks = getDiffWeeks(from, to);
  let weeks = [];

  for (let i = avoidWeeks; i < diffWeeks; i++) {
    weeks.push(GetWeek(from, i, tasks));
  }

  return weeks;
}

/**
 * Obtiene el último día del mes
 */
export function getLastDayOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Obtiene el resto del mes desde una fecha
 */
export function GetRestoOfMonth(from, tasks = []) {
  const timeNow = new Date();
  timeNow.setHours(0, 0, 0, 0);
  const to = getLastDayOfMonth(timeNow);
  const avoidWeeks = getDiffWeeks(from, timeNow);
  return GetWeeks(from, to, avoidWeeks, tasks);
}

/**
 * Obtiene N semanas desde una fecha
 */
export function GetNWeeks(from, nWeeks, nWeeksToAvoid = 0, tasks = []) {
  const to = new Date(from);
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + (nWeeksToAvoid + nWeeks) * 7);
  return GetWeeks(from, to, nWeeksToAvoid, tasks);
}

/**
 * Obtiene el número de semanas en un mes
 */
export function getWeeksInMonth(date) {
  const d = new Date(date);
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);

  const diffTime = Math.abs(lastDay - firstDay);
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

  return diffWeeks;
}

/**
 * Obtiene las semanas de un mes específico
 */
export function GetMonth(from, month, year, tasks = []) {
  const date = new Date(year, month, 1);
  date.setHours(0, 0, 0, 0);

  if (from.getTime() > date.getTime()) {
    // Si ya pasó, empezar desde today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = getLastDayOfMonth(today);
    return GetWeeks(today, endDate, 0, tasks);
  }

  const endDate = getLastDayOfMonth(date);
  const diffWeeks = getDiffWeeks(from, date);

  return GetWeeks(from, endDate, diffWeeks, tasks);
}

// ==================== UTILIDADES ====================
/**
 * Valida que una tarea tenga los campos requeridos
 */
export function ValidateTask(task) {
  if (!task) return false;
  if (!task.name || typeof task.name !== 'string') return false;
  if (typeof task.thisDayHas !== 'function') return false;
  return true;
}

/**
 * Crea una tarea simple (sin repetición)
 */
export function CreateSimpleTask(name, total = 1,start = new Date()) {
  const task = new TaskBase();
  task.Name = name;
  task.Start=start;
  task.Total = total;
  return task;
}

/**
 * Crea una tarea diaria
 */
export function CreateDailyTask(name, total = 1,start = new Date()) {
  const task = new DailyTask();
  task.Name = name;
  task.Start=start;
  task.Total = total;
  return task;
}

/**
 * Crea una tarea semanal
 */
export function CreateWeeklyTask(name, total = 1,start = new Date()) {
  const task = new WeeklyTask();
  task.Name = name;
  task.Start=start;
  task.Total = total;
  return task;
}

/**
 * Crea una tarea de N días
 */
export function CreateNDaysTask(name, nDays, total = 1,start = new Date()) {
  const task = new NDaysTask();
  task.Name = name;
  task.Start=start;
  task.NDays = nDays;
  task.Total = total;
  return task;
}

/**
 * Crea una tarea limitada en tiempo
 */
export function CreateLimitedTimeTask(baseTask, repeat = 1, total = 1,start = new Date()) {
  const task = new LimitedTimeTask();
  task.Name = baseTask.Name;
  task.Start=start;
  task.Task = baseTask;
  task.Repeat = repeat;
  task.Total = total;
  return task;
}

/**
 * Crea una tarea de un solo uso
 */
export function CreateOneTimeTask(baseTask, total = 1,start = new Date()) {
  const task = new OneTimeTask();
  task.Name = baseTask.Name;
  task.Start=start;
  task.Task = baseTask;
  task.Total = total;
  return task;
}

/**
 * Crea una tarea de días específicos de la semana
 */
export function CreateDaysOfWeekTask(name, daysArray, total = 1,start = new Date()) {
  const task = new DaysOfWeekTask();
  task.Name = name;
  task.Start=start;
  task.Total = total;

  for (let day of daysArray) {
    task.setDay(day);
  }

  return task;
}

/**
 * Crea una tarea con ciclo personalizado
 */
export function CreateCycleDaysOfWeekTask(name, cycleWeeks, total = 1,start = new Date()) {
  const task = new CiclesDaysOfWeekTask();
  task.Name = name;
  task.Start=start;
  task.Total = total;

  const cycles = cycleWeeks.map(weekDays => {
    const weekTask = new DaysOfWeekTask();
    for (let day of weekDays) {
      weekTask.setDay(day);
    }
    return weekTask;
  });

  task.Cicles = cycles;
  return task;
}
