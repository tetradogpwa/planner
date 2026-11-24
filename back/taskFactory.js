import { DailyTask, NDaysTask }                from './nDays.js';
import { OneTimeTask }                          from './limitedTime.js';
import { DaysOfWeekTask, CiclesDaysOfWeekTask } from './daysOfWeek.js';
import { todayISO }                             from './calendar.js';

// Las tareas guardan su fecha de inicio absoluta ('YYYY-MM-DD'): el día
// en el que empiezan a aplicarse. Si no se dice ninguna, empiezan hoy.
const inicio = (startDate) => startDate ?? todayISO();

export function createDailyTask(name, total = 1, startDate = null) {
  const t = new DailyTask();
  t.Name = name; t.Total = total; t.StartDate = inicio(startDate);
  return t;
}

export function createNDaysTask(name, nDays, total = 1, startDate = null) {
  const t = new NDaysTask();
  t.Name = name; t.NDays = nDays; t.Total = total; t.StartDate = inicio(startDate);
  return t;
}

export function createOneTimeTask(baseTask, total = 1, startDate = null) {
  const t = new OneTimeTask();
  t.Name = baseTask.Name; t.Task = baseTask; t.Total = total; t.StartDate = inicio(startDate);
  return t;
}

export function createDaysOfWeekTask(name, daysArray, total = 1, startDate = null) {
  const t = new DaysOfWeekTask();
  t.Name = name; t.Total = total; t.StartDate = inicio(startDate);
  daysArray.forEach(d => t.setDay(d));
  return t;
}

export function createCycleDaysOfWeekTask(name, cycleWeeks, total = 1, startDate = null) {
  const t = new CiclesDaysOfWeekTask();
  t.Name = name; t.Total = total; t.StartDate = inicio(startDate);
  t.Cicles = cycleWeeks.map(weekDays => {
    const week = new DaysOfWeekTask();
    weekDays.forEach(d => week.setDay(d));
    return week;
  });
  return t;
}
