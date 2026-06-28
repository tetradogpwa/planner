import { FromJson, ToJson } from './back/serializer.js';

export class Context {
  static _tasks;
  static _startDate;

  static get KeyTasks()     { return `${Context.name}_TASKS`; }
  static get KeyStartDate() { return `${Context.name}_START_DATE`; }
  static get Tasks()        { return Context._tasks; }
  static get StartDate()    { return Context._startDate; }

  static set StartDate(date) {
    Context._startDate = date;
    localStorage.setItem(Context.KeyStartDate, date.getTime() + '');
  }

  static SetTasksFromJson(json) {
    const parsed = FromJson(json);
    if (!Array.isArray(parsed)) throw new Error('Formato de tareas inválido');
    Context._tasks = Context.#observe(parsed);
    Context.UpdateTasks();
  }

  static UpdateTasks() {
    localStorage.setItem(Context.KeyTasks, ToJson(Context.Tasks));
  }

  static #observe(obj) {
    return new Proxy(obj, {
      get(target, prop) {
        const value = target[prop];
        return value !== null && typeof value === 'object'
          ? Context.#observe(value)
          : value;
      },
      set(target, prop, value) {
        target[prop] = value;
        Context.UpdateTasks();
        return true;
      },
    });
  }

  static {
    const tasksJson    = localStorage.getItem(Context.KeyTasks);
    const startDateStr = localStorage.getItem(Context.KeyStartDate);

    Context._tasks = Context.#observe(tasksJson ? FromJson(tasksJson) : []);

    if (startDateStr) {
      Context._startDate = new Date(Number(startDateStr));
    } else {
      Context._startDate = new Date();
      Context._startDate.setHours(0, 0, 0, 0);
    }
  }
}
