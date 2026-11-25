import { FromJson, ToJson, usaFormatoAntiguo, faltanIds } from './back/serializer.js';
import { today, parseLocalDate } from './back/calendar.js';

export class Context {
  static _tasks;
  static _startDate;
  // Marcas de «hecho»: el texto guardado en el almacenamiento y las
  // marcas ya interpretadas (se releen si el almacenamiento cambia).
  static #marcasRaw = null;
  static #marcas = null;

  static get KeyTasks()     { return `${Context.name}_TASKS`; }
  static get KeyStartDate() { return `${Context.name}_START_DATE`; }
  static get KeyMarks()     { return `${Context.name}_MARKS`; }
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

  static UpdateTasks() {
    localStorage.setItem(Context.KeyTasks, ToJson(Context.Tasks));
  }

  // ── Marcas de «hecho» (T-050) ─────────────────────────────────────────
  //
  // Una marca dice que una APARICIÓN de una tarea está hecha: la tarea
  // (por su id estable), el DÍA (por su fecha real, 'YYYY-MM-DD') y el
  // número de vez (para las tareas con más de una vez al día). La fecha
  // es la real del día, no el índice del día de la semana: así la marca
  // sigue siendo válida al cambiar de semana.
  //
  // Se guardan aparte de las tareas (su propia clave) porque una marca
  // no es parte de la tarea: es el seguimiento del usuario.

  /** Las marcas guardadas, indexadas por id de tarea y fecha.
   *
   *  Estructura: { <id de tarea>: { <fecha ISO>: [<números de vez>] } }.
   *  Si el almacenamiento no se puede leer (se guardó a medias), se
   *  empieza con las marcas vacías en vez de romper la app. */
  static #leerMarcas() {
    const raw = localStorage.getItem(Context.KeyMarks) ?? '';
    if (raw !== Context.#marcasRaw) {
      Context.#marcasRaw = raw;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }
      Context.#marcas = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        ? parsed
        : {};
    }
    return Context.#marcas;
  }

  /** Guarda las marcas en el almacenamiento. */
  static #guardarMarcas(marcas) {
    Context.#marcas     = marcas;
    Context.#marcasRaw  = JSON.stringify(marcas);
    localStorage.setItem(Context.KeyMarks, Context.#marcasRaw);
  }

  /** Comprueba que el id de la tarea no está vacío. */
  static #validarId(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error('Identificador de tarea inválido');
    }
    return id.trim();
  }

  /** Comprueba que la fecha es una fecha ISO real ('YYYY-MM-DD'). */
  static #validarFecha(fecha) {
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
      throw new Error('Fecha inválida (usa YYYY-MM-DD)');
    }
    const dia = fecha.trim();
    // parseLocalDate lanza si la fecha no existe (31-feb, por ejemplo).
    parseLocalDate(dia);
    return dia;
  }

  /** Comprueba que el número de vez es un entero ≥ 0. */
  static #validarVez(vez) {
    const n = Number(vez ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new Error('Número de vez inválido');
    return n;
  }

  /** Marca la aparición (id, fecha, vez) como hecha y la guarda.
   *
   *  Devuelve la marca normalizada: { id, date, slot }. */
  static Mark(id, fecha, vez = 0) {
    const tarea = Context.#validarId(id);
    const dia   = Context.#validarFecha(fecha);
    const n     = Context.#validarVez(vez);

    const marcas = Context.#leerMarcas();
    const porDia = marcas[tarea] ?? {};
    const veces  = Array.isArray(porDia[dia]) ? porDia[dia] : [];
    if (!veces.includes(n)) veces.push(n);
    porDia[dia] = veces.sort((a, b) => a - b);
    marcas[tarea] = porDia;

    Context.#guardarMarcas(marcas);
    return { id: tarea, date: dia, slot: n };
  }

  /** Quita la marca de la aparición (id, fecha, vez). */
  static Unmark(id, fecha, vez = 0) {
    const tarea = Context.#validarId(id);
    const dia   = Context.#validarFecha(fecha);
    const n     = Context.#validarVez(vez);

    const marcas = Context.#leerMarcas();
    const porDia = marcas[tarea];
    if (porDia && Array.isArray(porDia[dia])) {
      const veces = porDia[dia].filter(v => v !== n);
      if (veces.length) porDia[dia] = veces;
      else delete porDia[dia];
      if (Object.keys(porDia).length === 0) delete marcas[tarea];
      else marcas[tarea] = porDia;
      Context.#guardarMarcas(marcas);
    }
    return { id: tarea, date: dia, slot: n };
  }

  /** Dice si la aparición (id, fecha, vez) está marcada como hecha.
   *
   *  No lanza: es una consulta, y un dato que no vale no está marcado. */
  static IsMarked(id, fecha, vez = 0) {
    try {
      const tarea = Context.#validarId(id);
      const dia   = Context.#validarFecha(fecha);
      const n     = Context.#validarVez(vez);
      const porDia = Context.#leerMarcas()[tarea];
      return Array.isArray(porDia?.[dia]) && porDia[dia].includes(n);
    } catch {
      return false;
    }
  }

  /** Borra todas las marcas de una tarea (cuando se borra la tarea). */
  static ClearMarks(id) {
    const tarea = Context.#validarId(id);
    const marcas = Context.#leerMarcas();
    if (Object.prototype.hasOwnProperty.call(marcas, tarea)) {
      delete marcas[tarea];
      Context.#guardarMarcas(marcas);
    }
  }

  /** Borra todas las marcas (cuando se borran todas las tareas). */
  static ClearAllMarks() {
    Context.#guardarMarcas({});
  }

  /** Todas las marcas de «hecho», como una copia:
   *  { <id de tarea>: { <fecha ISO>: [<números de vez>] } }.
   *
   *  Es una copia: la que se guarda en la copia de seguridad (T-054) no
   *  cambia cuando la app siga marcando cosas. */
  static GetAllMarks() {
    const marcas = Context.#leerMarcas();
    const copia = {};
    for (const [id, porDia] of Object.entries(marcas)) {
      const dias = {};
      for (const [dia, veces] of Object.entries(porDia ?? {})) {
        if (Array.isArray(veces)) dias[dia] = [...veces];
      }
      copia[id] = dias;
    }
    return copia;
  }

  /** Sustituye TODAS las marcas de «hecho» por las dadas: al importar
   *  una copia de seguridad, las marcas del archivo sustituyen a las
   *  que había (T-054). */
  static SetAllMarks(marcas) {
    const nuevas = {};
    if (marcas && typeof marcas === 'object' && !Array.isArray(marcas)) {
      for (const [id, porDia] of Object.entries(marcas)) {
        if (!porDia || typeof porDia !== 'object' || Array.isArray(porDia)) continue;
        const dias = {};
        for (const [dia, veces] of Object.entries(porDia)) {
          if (!Array.isArray(veces) || veces.length === 0) continue;
          dias[dia] = [...veces].sort((a, b) => a - b);
        }
        if (Object.keys(dias).length > 0) nuevas[id] = dias;
      }
    }
    Context.#guardarMarcas(nuevas);
  }

  // ── Deshacer un borrado (T-053) ───────────────────────────────────────
  //
  // Borrar una tarea (o todas) ya no es irreversible: la interfaz
  // guarda una «foto» de lo que había y, si el usuario pulsa
  // «Deshacer», lo devuelve tal como estaba: en su posición, con su
  // id y con sus marcas de «hecho».
  //
  // La foto guarda las tareas en el mismo formato que se guardan en
  // el almacenamiento (back/serializer.js), así que al restaurarlas
  // vuelven a ser tareas de verdad (con su clase y su id), no datos
  // sueltos.

  /** Las marcas de «hecho» de una tarea, como una copia:
   *  { <fecha ISO>: [<números de vez>] }.
   *
   *  Es una copia: la que se guarda en la foto no cambia cuando la
   *  tarea se borra y sus marcas se van con ella. */
  static GetMarks(id) {
    const tarea = Context.#validarId(id);
    const porDia = Context.#leerMarcas()[tarea];
    if (!porDia) return {};
    const copia = {};
    for (const [dia, veces] of Object.entries(porDia)) {
      if (Array.isArray(veces)) copia[dia] = [...veces];
    }
    return copia;
  }

  /** Vuelve a guardar las marcas de «hecho» de una tarea.
   *
   *  `marcas` tiene la forma que devuelve `GetMarks`. */
  static RestoreMarks(id, marcas) {
    const tarea = Context.#validarId(id);
    if (!marcas || typeof marcas !== 'object') return;
    const todas = Context.#leerMarcas();
    const porDia = {};
    for (const [dia, veces] of Object.entries(marcas)) {
      if (!Array.isArray(veces) || veces.length === 0) continue;
      porDia[dia] = [...veces].sort((a, b) => a - b);
    }
    if (Object.keys(porDia).length === 0) delete todas[tarea];
    else todas[tarea] = porDia;
    Context.#guardarMarcas(todas);
  }

  /** Una foto de una tarea y de sus marcas de «hecho», para poder
   *  deshacer su borrado.
   *
   *  La foto guarda también la posición que tenía, para devolverla al
   *  mismo sitio. Devuelve null si la tarea no existe. */
  static FotoTarea(id) {
    const tarea = Context.#validarId(id);
    const i = Context.Tasks.findIndex(t => t.Id === tarea);
    if (i === -1) return null;
    return {
      json: ToJson([Context.Tasks[i]]),
      marcas: { [tarea]: Context.GetMarks(tarea) },
      posicion: i,
    };
  }

  /** Vuelve a poner en la lista la tarea de una foto: en su posición,
   *  con su id y con sus marcas de «hecho». */
  static RestaurarTarea(foto) {
    if (!foto?.json) return null;
    const tareas = FromJson(foto.json, { origin: Context.StartDate });
    if (tareas.length === 0) return null;
    const pos = Math.max(0, Math.min(foto.posicion ?? 0, Context.Tasks.length));
    Context.Tasks.splice(pos, 0, tareas[0]);
    for (const [id, marcas] of Object.entries(foto.marcas ?? {})) {
      Context.RestoreMarks(id, marcas);
    }
    return tareas[0];
  }

  /** Una foto de TODAS las tareas y de sus marcas de «hecho», para
   *  poder deshacer un «Borrar todo». */
  static FotoTodas() {
    const marcas = {};
    for (const t of Context.Tasks) marcas[t.Id] = Context.GetMarks(t.Id);
    return { json: ToJson(Context.Tasks), marcas };
  }

  /** Vuelve a poner en la lista todas las tareas de una foto, con sus
   *  id y con sus marcas de «hecho». */
  static RestaurarTodas(foto) {
    if (!foto?.json) return [];
    const tareas = FromJson(foto.json, { origin: Context.StartDate });
    Context.Tasks = tareas;
    for (const [id, marcas] of Object.entries(foto.marcas ?? {})) {
      Context.RestoreMarks(id, marcas);
    }
    return tareas;
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
