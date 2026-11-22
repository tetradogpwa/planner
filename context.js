import { FromJson, ToJson } from './back/serializer.js';

export class Context {
  static _tasks;
  static _startDate;

  static get KeyTasks()     { return `${Context.name}_TASKS`; }
  static get KeyStartDate() { return `${Context.name}_START_DATE`; }
  static get Tasks()        { return Context._tasks; }
  static get StartDate()    { return Context._startDate; }

  /** Sustituye la lista de tareas entera de golpe: el Proxy se crea
   *  nuevo y se persiste una sola vez.
   *
   *  Vaciar la lista y rellenarla después (lo que hacía la importación
   *  de JSON) deja al usuario sin tareas si algo falla a mitad, y
   *  persiste el archivo entero en cada tarea (T-031). */
  static set Tasks(tasks) {
    if (!Array.isArray(tasks)) throw new Error('La lista de tareas debe ser un array');
    Context._tasks = Context.#observe(tasks);
    Context.UpdateTasks();
  }

  static set StartDate(date) {
    Context._startDate = date;
    localStorage.setItem(Context.KeyStartDate, date.getTime() + '');
  }

  static SetTasksFromJson(json) {
    const parsed = FromJson(json);   // lanza si el JSON no es válido
    if (!Array.isArray(parsed)) throw new Error('Formato de tareas inválido');
    Context.Tasks = parsed;
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

    // Un JSON guardado que ya no se puede leer (guardado a medias, por
    // ejemplo) no puede dejar la app sin arrancar: se avisa y se empieza
    // con la lista vacía. El valor guardado NO se borra, para que el
    // usuario pueda recuperarlo desde fuera.
    Context._tasks = Context.#observe([]);
    if (tasksJson) {
      try {
        Context._tasks = Context.#observe(FromJson(tasksJson));
      } catch (e) {
        console.warn('[contexto] las tareas guardadas no se han podido leer:', e);
      }
    }

    if (startDateStr) {
      Context._startDate = new Date(Number(startDateStr));
    } else {
      Context._startDate = new Date();
      Context._startDate.setHours(0, 0, 0, 0);
    }
  }
}
