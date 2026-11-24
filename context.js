import { FromJson, ToJson, usaFormatoAntiguo, faltanIds } from './back/serializer.js';
import { today } from './back/calendar.js';

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
    // El origen (la fecha de inicio del planificador) sirve para
    // migrar las tareas del formato viejo a fechas reales.
    const parsed = FromJson(json, { origin: Context._startDate });   // lanza si el JSON no es válido
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

    // La fecha de inicio del planificador: la que fijó la API, o hoy si
    // el usuario no ha fijado ninguna. Las tareas ya no dependen de
    // ella (cada una guarda su fecha de inicio absoluta), pero sigue
    // siendo el origen de las semanas que se pintan y el punto de
    // referencia para migrar los datos del formato viejo.
    if (startDateStr) {
      const guardada = new Date(Number(startDateStr));
      Context._startDate = Number.isNaN(guardada.getTime()) ? today() : guardada;
    } else {
      Context._startDate = today();
    }

    // Un JSON guardado que ya no se puede leer (guardado a medias, por
    // ejemplo) no puede dejar la app sin arrancar: se avisa y se empieza
    // con la lista vacía. El valor guardado NO se borra, para que el
    // usuario pueda recuperarlo desde fuera.
    Context._tasks = Context.#observe([]);
    if (tasksJson) {
      try {
        const tareas = FromJson(tasksJson, { origin: Context._startDate });
        Context._tasks = Context.#observe(tareas);
        // Las tareas del formato viejo (las que guardaban `daysFrom`)
        // se guardan ya migradas: si no, la migración se repetiría en
        // cada arranque y, sin fecha de inicio guardada, las tareas
        // irían un día hacia atrás cada vez (T-045).
        //
        // Lo mismo con el identificador: las tareas guardadas antes de
        // T-049 no tenían `id` y al leerlas se les asigna uno. Si no se
        // guardara ya migrado, en cada arranque les tocaría un id
        // nuevo y el identificador no sería estable (T-049).
        if (usaFormatoAntiguo(tasksJson) || faltanIds(tasksJson)) Context.UpdateTasks();
      } catch (e) {
        console.warn('[contexto] las tareas guardadas no se han podido leer:', e);
      }
    }
  }
}
