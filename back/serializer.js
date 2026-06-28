import { TaskBase }                                          from './baseTarea.js';
import { NDaysTask, DailyTask, WeeklyTask, MonthlyTask, QuaterlyTask } from './nDays.js';
import { LimitedTimeTask, OneTimeTask }                       from './limitedTime.js';
import { DaysOfWeekTask, CiclesDaysOfWeekTask }               from './daysOfWeek.js';

// ── JSON → objetos ────────────────────────────────────────────────────────────

export function FromJson(dataStr) {
  try {
    const tasksDirty = JSON.parse(dataStr);
    return (tasksDirty.tasks ?? tasksDirty).map(processTask).filter(Boolean);
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return [];
  }
}

function processTask({ className, ...data }) {
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
      break;
    case LimitedTimeTask.name:
      task.Task   = processTask(data.task);
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
