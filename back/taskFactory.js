import { DailyTask, NDaysTask }                from './nDays.js';
import { OneTimeTask }                          from './limitedTime.js';
import { DaysOfWeekTask, CiclesDaysOfWeekTask } from './daysOfWeek.js';

export function createDailyTask(name, total = 1, daysFrom = 0) {
  const t = new DailyTask();
  t.Name = name; t.Total = total; t.DaysFrom = daysFrom;
  return t;
}

export function createNDaysTask(name, nDays, total = 1, daysFrom = 0) {
  const t = new NDaysTask();
  t.Name = name; t.NDays = nDays; t.Total = total; t.DaysFrom = daysFrom;
  return t;
}

export function createOneTimeTask(baseTask, total = 1, daysFrom = 0) {
  const t = new OneTimeTask();
  t.Name = baseTask.Name; t.Task = baseTask; t.Total = total; t.DaysFrom = daysFrom;
  return t;
}

export function createDaysOfWeekTask(name, daysArray, total = 1, daysFrom = 0) {
  const t = new DaysOfWeekTask();
  t.Name = name; t.Total = total; t.DaysFrom = daysFrom;
  daysArray.forEach(d => t.setDay(d));
  return t;
}

export function createCycleDaysOfWeekTask(name, cycleWeeks, total = 1, daysFrom = 0) {
  const t = new CiclesDaysOfWeekTask();
  t.Name = name; t.Total = total; t.DaysFrom = daysFrom;
  t.Cicles = cycleWeeks.map(weekDays => {
    const week = new DaysOfWeekTask();
    weekDays.forEach(d => week.setDay(d));
    return week;
  });
  return t;
}
