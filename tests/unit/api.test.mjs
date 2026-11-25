// Pruebas de la capa de API (api.js). Sin DOM: simulamos un
// localStorage mínimo y un window EventTarget para que api.js
// pueda ejecutarse bajo node:test.
//
// api.js importa context.js, cuyo bloque estático lee localStorage;
// por eso lo preparamos antes del import dinámico. Para fijar las
// fechas que devuelven getWeek / getStartDate usamos TZ=Europe/Madrid
// en tools/test.sh.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Stubs de navegador ──────────────────────────────────────────────────

/** localStorage mínimo basado en Map: suficiente para context.js
 *  (setItem / getItem con strings) y para el observador Proxy. */
class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k)    { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear()       { this.m.clear(); }
  key(i)        { return [...this.m.keys()][i] ?? null; }
  get length()  { return this.m.size; }
}

// `EventTarget` ya implementa addEventListener / removeEventListener /
// dispatchEvent como necesitamos. Para los `new CustomEvent(...)` de
// api.js aportamos uno que extienda la Event interna de Node (su
// EventTarget exige un instance-of Event, no un objeto plano).
globalThis.window      = new EventTarget();
globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    Object.assign(this, init);
  }
};

// Antes del import: localStorage con un startDate estable. context.js
// lo lee en su bloque estático al cargarse por primera vez.
const storage = new MemoryStorage();
globalThis.localStorage = storage;
storage.setItem('Context_START_DATE', String(new Date(2026, 9, 19).getTime()));

// Importamos api.js (carga context.js como efecto secundario).
const { PlannerApi } = await import('../../api.js');
// El estado y el resumen: se importan después de preparar el
// localStorage, porque context.js lo lee al cargarse.
const { Context }      = await import('../../context.js');
const { taskSummary }  = await import('../../back/taskSummary.js');

// ── Helpers ─────────────────────────────────────────────────────────────

beforeEach(() => {
  // Vacía las tareas entre pruebas. deleteTask emite eventos; los
  // tests que los observan añaden su propio listener en cada caso.
  while (PlannerApi.listTasks().length) PlannerApi.deleteTask(0);
});

/** Devuelve la lista de eventos 'planner:changed' capturados durante
 *  una función, con su detalle. */
function captureEvents(fn) {
  const events = [];
  const handler = (e) => events.push(e.detail);
  window.addEventListener('planner:changed', handler);
  try { fn(); } finally { window.removeEventListener('planner:changed', handler); }
  return events;
}

// ── addTask: 5 tipos ────────────────────────────────────────────────────

test('addTask: none (OneTimeTask)', () => {
  const out = PlannerApi.addTask({ name: 'Una', repeat: 'none' });
  assert.equal(out.index, 0);
  assert.equal(out.repeat, 'none');
  assert.equal(out.name, 'Una');
});

test('addTask: daily', () => {
  const out = PlannerApi.addTask({ name: 'Agua', repeat: 'daily', total: 3 });
  assert.equal(out.repeat, 'daily');
  assert.equal(out.total, 3);
});

test('addTask: nDays', () => {
  const out = PlannerApi.addTask({ name: 'Regar', repeat: 'nDays', nDays: 5 });
  assert.equal(out.repeat, 'nDays');
  assert.equal(out.nDays, 5);
});

test('addTask: daysOfWeek', () => {
  const out = PlannerApi.addTask({ name: 'Gym', repeat: 'daysOfWeek', days: [0, 2] });
  assert.equal(out.repeat, 'daysOfWeek');
  assert.deepEqual(out.days, [0, 2]);
});

test('addTask: cycle (incluida semana de descanso)', () => {
  const out = PlannerApi.addTask({ name: 'Turnos', repeat: 'cycle', cycle: [[0], []] });
  assert.equal(out.repeat, 'cycle');
  assert.deepEqual(out.cycle, [[0], []]);
});

// ── listTasks / getTask: forma JSON sin clases ni Proxy ────────────────

test('listTasks y getTask devuelven solo datos planos', () => {
  PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  PlannerApi.addTask({ name: 'B', repeat: 'daysOfWeek', days: [0] });
  PlannerApi.addTask({ name: 'C', repeat: 'cycle', cycle: [[1], [2]] });

  const list = PlannerApi.listTasks();
  assert.equal(list.length, 3);
  list.forEach((t, i) => {
    assert.equal(t.index, i);
    // Sin clases, sin Proxy: solo los campos planos que documentamos.
    assert.equal(typeof t.name, 'string');
    assert.ok(['none','daily','nDays','daysOfWeek','cycle'].includes(t.repeat));
    assert.equal(typeof t.total, 'number');
    assert.equal(typeof t.daysFrom, 'number');
    // Y la fecha de inicio real de cada tarea (T-045).
    assert.match(t.startDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  // Round-trip por JSON.stringify sin perder información.
  const round = JSON.parse(JSON.stringify(list));
  assert.equal(round.length, 3);
  assert.equal(round[2].cycle[1][0], 2);

  assert.deepEqual(PlannerApi.getTask(1), list[1]);
  assert.equal(PlannerApi.getTask(99), null);
  assert.equal(PlannerApi.getTask(-1), null);
});

// El resumen legible de cuándo se repite cada tarea (T-052): la API
// lo devuelve en el campo `summary`, que es lo mismo que muestra la
// lista de tareas de la vista Tareas.
test('cada tarea lleva su resumen de repetición (summary)', () => {
  const specs = [
    { name: 'Agua',     repeat: 'daily' },
    { name: 'Regar',    repeat: 'nDays', nDays: 5 },
    { name: 'Gym',      repeat: 'daysOfWeek', days: [0, 2] },
    { name: 'Turnos',   repeat: 'cycle', cycle: [[0], [2]] },
    { name: 'Dentista', repeat: 'none' },
  ];
  specs.forEach(spec => PlannerApi.addTask(spec));

  const list = PlannerApi.listTasks();
  assert.equal(list.length, specs.length);

  list.forEach((t, i) => {
    assert.equal(typeof t.summary, 'string', `la tarea ${i} no trae summary`);
    assert.ok(t.summary.length > 0, `la tarea ${i} se queda sin resumen`);
    // Y es EXACTAMENTE el resumen que produce back/taskSummary.js
    // para esa misma tarea (no una copia de su lógica).
    assert.equal(t.summary, taskSummary(Context.Tasks[i]));
    // Nunca el nombre de la clase de la tarea.
    assert.ok(!t.summary.includes('Task'), `sale el nombre de la clase: "${t.summary}"`);
    // getTask devuelve lo mismo.
    assert.equal(PlannerApi.getTask(t.id).summary, t.summary);
  });

  // Y el resumen dice cuándo se repite cada una.
  assert.equal(list[0].summary, 'Diaria');
  assert.match(list[1].summary, /^Cada 5 días desde el \d{2}\/\d{2}$/);
  assert.equal(list[2].summary, 'Lun, Mié');
  assert.equal(list[3].summary, 'Ciclo de 2 semanas');
  assert.match(list[4].summary, /^Una vez · \d{2}\/\d{2}$/);
});

test('addTask acepta la fecha de inicio de la tarea (startDate)', () => {
  const out = PlannerApi.addTask({
    name: 'Dentista', repeat: 'none', startDate: '2026-11-25',
  });
  assert.equal(out.startDate, '2026-11-25');
  assert.equal(PlannerApi.getTask(0).startDate, '2026-11-25');
});

test('addTask acepta daysFrom por compatibilidad (días desde el origen)', () => {
  // El origen del planificador en esta prueba es el 19/10/2026.
  const out = PlannerApi.addTask({ name: 'Regar', repeat: 'daily', daysFrom: 3 });
  assert.equal(out.startDate, '2026-10-22');
  assert.equal(out.daysFrom, 3);
});

test('el daysFrom devuelto se deriva del origen actual, no es un dato de la tarea', () => {
  PlannerApi.setStartDate('2026-11-23');
  try {
    const out = PlannerApi.addTask({ name: 'Agua', repeat: 'daily', startDate: '2026-11-25' });
    assert.equal(out.startDate, '2026-11-25');
    assert.equal(out.daysFrom, 2);

    // El origen se mueve (como cuando no hay fecha guardada y el
    // origen es "hoy"): la fecha de inicio de la tarea NO cambia
    // (ese es el dato que manda) pero el daysFrom derivado sí.
    PlannerApi.setStartDate('2026-11-26');
    const despues = PlannerApi.getTask(0);
    assert.equal(despues.startDate, '2026-11-25');
    assert.equal(despues.daysFrom, -1);

    // Y lo que se guarda es la fecha de inicio, no el offset.
    const guardado = JSON.parse(localStorage.getItem('Context_TASKS'));
    assert.equal(guardado[0].startDate, '2026-11-25');
    assert.equal(guardado[0].daysFrom, undefined);
  } finally {
    PlannerApi.setStartDate('2026-10-19');
  }
});

test('una tarea que empieza antes del origen devuelve un daysFrom que la API acepta de vuelta', () => {
  PlannerApi.setStartDate('2026-11-23');
  try {
    const out = PlannerApi.addTask({ name: 'Dentista', repeat: 'none', startDate: '2026-11-20' });
    assert.equal(out.daysFrom, -3);

    // Ese daysFrom se puede volver a pasar a la API sin que lo rechace
    // y sin que la tarea cambie de fecha.
    const actualizada = PlannerApi.updateTask(0, {
      name: 'Dentista', repeat: 'none', daysFrom: out.daysFrom,
    });
    assert.equal(actualizada.startDate, '2026-11-20');
    assert.equal(actualizada.daysFrom, -3);
  } finally {
    PlannerApi.setStartDate('2026-10-19');
  }
});

test('las tareas guardadas llevan su fecha de inicio (no un offset)', () => {
  PlannerApi.addTask({ name: 'Agua', repeat: 'daily', startDate: '2026-11-25' });
  const guardado = JSON.parse(localStorage.getItem('Context_TASKS'));
  assert.equal(guardado[0].startDate, '2026-11-25');
  assert.equal(guardado[0].daysFrom, undefined);
});

// ── updateTask / deleteTask (incluido índice inválido) ─────────────────

test('updateTask: sustituye la tarea y devuelve el JSON nuevo', () => {
  PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  const out = PlannerApi.updateTask(0, { name: 'A2', repeat: 'daysOfWeek', days: [0] });
  assert.equal(out.name, 'A2');
  assert.equal(out.repeat, 'daysOfWeek');
  assert.equal(PlannerApi.getTask(0).name, 'A2');
});

test('updateTask: índice inválido lanza', () => {
  PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  assert.throws(() => PlannerApi.updateTask(5,  { name: 'X', repeat: 'daily' }), /Índice de tarea inválido/);
  assert.throws(() => PlannerApi.updateTask(-1, { name: 'X', repeat: 'daily' }), /Índice de tarea inválido/);
  // Un texto ya no es un índice (obsoleto) sino un id: si no
  // corresponde a ninguna tarea, el error lo dice (T-049).
  assert.throws(() => PlannerApi.updateTask('a', { name: 'X', repeat: 'daily' }), /Tarea no encontrada/);
});

test('deleteTask: borra y devuelve el nombre', () => {
  PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  PlannerApi.addTask({ name: 'B', repeat: 'daily' });
  const removed = PlannerApi.deleteTask(0);
  assert.equal(removed, 'A');
  assert.equal(PlannerApi.listTasks().length, 1);
  assert.equal(PlannerApi.getTask(0).name, 'B');
});

test('deleteTask: índice inválido lanza', () => {
  PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  assert.throws(() => PlannerApi.deleteTask(7), /Índice de tarea inválido/);
});

// ── Marcar y desmarcar tareas (T-050) ──────────────────────────────────

test('markTask marca la aparición y devuelve la marca', () => {
  const t = PlannerApi.addTask({ name: 'Agua', repeat: 'daily' });
  const marca = PlannerApi.markTask(t.id, '2026-11-25', 0);

  assert.equal(marca.done, true);
  assert.equal(marca.id, t.id);
  assert.equal(marca.date, '2026-11-25');
  assert.equal(marca.slot, 0);

  // Y queda guardada en su propia clave, indexada por id, fecha y vez.
  const marcas = JSON.parse(localStorage.getItem('Context_MARKS'));
  assert.deepEqual(marcas[t.id], { '2026-11-25': [0] });
});

test('unmarkTask quita la marca de la aparición', () => {
  const t = PlannerApi.addTask({ name: 'Agua', repeat: 'daily' });
  PlannerApi.markTask(t.id, '2026-11-25', 0);
  const marca = PlannerApi.unmarkTask(t.id, '2026-11-25', 0);

  assert.equal(marca.done, false);
  const marcas = JSON.parse(localStorage.getItem('Context_MARKS'));
  assert.deepEqual(marcas[t.id], undefined);
});

test('cada vez de una tarea es una marca distinta', () => {
  const t = PlannerApi.addTask({ name: 'Agua', repeat: 'daily', total: 2 });
  PlannerApi.markTask(t.id, '2026-11-25', 0);

  const marcas = JSON.parse(localStorage.getItem('Context_MARKS'));
  assert.deepEqual(marcas[t.id], { '2026-11-25': [0] });

  PlannerApi.markTask(t.id, '2026-11-25', 1);
  const conDos = JSON.parse(localStorage.getItem('Context_MARKS'));
  assert.deepEqual(conDos[t.id], { '2026-11-25': [0, 1] });
});

test('markTask y unmarkTask emiten su evento con el mensaje', () => {
  const t = PlannerApi.addTask({ name: 'Agua', repeat: 'daily' });
  const evs = captureEvents(() => {
    PlannerApi.markTask(t.id, '2026-11-25', 0);
    PlannerApi.unmarkTask(t.id, '2026-11-25', 0);
  });
  assert.equal(evs.length, 2);
  assert.equal(evs[0].action, 'mark');
  assert.equal(evs[0].status, 'Tarea «Agua» marcada como hecha');
  assert.equal(evs[0].id, t.id);
  assert.equal(evs[0].date, '2026-11-25');
  assert.equal(evs[1].action, 'unmark');
  assert.equal(evs[1].status, 'Tarea «Agua» marcada como pendiente');
});

test('borrar una tarea borra también sus marcas', () => {
  const t = PlannerApi.addTask({ name: 'Agua', repeat: 'daily' });
  PlannerApi.markTask(t.id, '2026-11-25', 0);
  assert.ok(JSON.parse(localStorage.getItem('Context_MARKS'))[t.id]);

  PlannerApi.deleteTask(t.id);

  const marcas = JSON.parse(localStorage.getItem('Context_MARKS'));
  assert.equal(marcas[t.id], undefined,
    'la tarea se ha borrado: sus marcas tienen que irse con ella');
});

test('markTask con datos que no valen lanza', () => {
  const t = PlannerApi.addTask({ name: 'Agua', repeat: 'daily' });
  assert.throws(() => PlannerApi.markTask(t.id, '2026-02-31', 0), /Fecha inválida/);
  assert.throws(() => PlannerApi.markTask(t.id, '2026-11-25', -1), /Número de vez inválido/);
  assert.throws(() => PlannerApi.markTask('no-existe', '2026-11-25', 0), /Tarea no encontrada/);
});

// ── Identificador estable de cada tarea (T-049) ───────────────────────────

test('cada tarea creada tiene un id único', () => {
  const a = PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  const b = PlannerApi.addTask({ name: 'B', repeat: 'daily' });

  assert.equal(typeof a.id, 'string');
  assert.ok(a.id.length > 0);
  assert.notEqual(a.id, b.id);

  // Y la lista los lleva: es lo que hay que usar para referirse a una
  // tarea concreta.
  const ids = PlannerApi.listTasks().map(t => t.id);
  assert.deepEqual(ids, [a.id, b.id]);
});

test('getTask, updateTask y deleteTask aceptan el id de la tarea', () => {
  const a = PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  const b = PlannerApi.addTask({ name: 'B', repeat: 'daily' });

  // Por id.
  assert.equal(PlannerApi.getTask(a.id).name, 'A');
  assert.equal(PlannerApi.getTask(b.id).name, 'B');
  assert.equal(PlannerApi.getTask('no-existe'), null);

  const actualizada = PlannerApi.updateTask(b.id, { name: 'B2', repeat: 'daily' });
  assert.equal(actualizada.name, 'B2');
  assert.equal(PlannerApi.getTask(a.id).name, 'A');

  assert.equal(PlannerApi.deleteTask(b.id), 'B2');
  assert.equal(PlannerApi.listTasks().length, 1);
});

test('editar una tarea no cambia su id', () => {
  const a = PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  const editada = PlannerApi.updateTask(a.id, { name: 'A2', repeat: 'daysOfWeek', days: [0] });
  assert.equal(editada.id, a.id);
  assert.equal(PlannerApi.getTask(a.id).name, 'A2');
});

test('un id que no existe lanza "Tarea no encontrada"', () => {
  PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  assert.throws(() => PlannerApi.updateTask('no-existe', { name: 'X', repeat: 'daily' }), /Tarea no encontrada/);
  assert.throws(() => PlannerApi.deleteTask('no-existe'), /Tarea no encontrada/);
});

test('editar una tarea mientras otra se borra por la API modifica la correcta', () => {
  // El caso del que habla T-049: un asistente borra la tarea 2
  // mientras el usuario edita la 3. Con la posición, el guardado
  // acabaría en la tarea equivocada.
  const a = PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  const b = PlannerApi.addTask({ name: 'B', repeat: 'daily' });
  const c = PlannerApi.addTask({ name: 'C', repeat: 'daily' });

  // Se borra la del medio.
  assert.equal(PlannerApi.deleteTask(b.id), 'B');

  // La 3 se sigue editando (por su id) y la lista ya es [A, C].
  const editada = PlannerApi.updateTask(c.id, { name: 'C editada', repeat: 'daily' });
  assert.equal(editada.name, 'C editada');
  assert.equal(editada.id, c.id);

  const lista = PlannerApi.listTasks();
  assert.deepEqual(lista.map(t => t.name), ['A', 'C editada']);
  assert.deepEqual(lista.map(t => t.id), [a.id, c.id]);
});

test('el id sobrevive a recargar: se guarda con la tarea', () => {
  const a = PlannerApi.addTask({ name: 'Agua', repeat: 'daily' });
  const guardado = JSON.parse(localStorage.getItem('Context_TASKS'));
  assert.equal(guardado[0].id, a.id);
});

// ── Eventos 'planner:changed' con status ────────────────────────────────

test('addTask emite planner:changed con "Tarea «X» añadida"', () => {
  const events = captureEvents(() => {
    PlannerApi.addTask({ name: 'Hola', repeat: 'daily' });
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'add');
  assert.equal(events[0].status, 'Tarea «Hola» añadida');
  assert.equal(events[0].name, 'Hola');
  assert.equal(events[0].index, 0);
});

test('updateTask / deleteTask emiten su evento y status', () => {
  PlannerApi.addTask({ name: 'A', repeat: 'daily' });
  const evs = captureEvents(() => {
    PlannerApi.updateTask(0, { name: 'A2', repeat: 'daily' });
    PlannerApi.deleteTask(0);
  });
  assert.equal(evs.length, 2);
  assert.equal(evs[0].action, 'update');
  assert.equal(evs[0].status, 'Tarea «A2» actualizada');
  assert.equal(evs[1].action, 'delete');
  assert.equal(evs[1].status, 'Tarea «A2» eliminada');
});

// ── getWeek(0) con fechas locales correctas ─────────────────────────────

test('getWeek(0) devuelve 7 días con fecha local (no UTC)', () => {
  const week = PlannerApi.getWeek(0);
  assert.equal(week.length, 7);
  // Empezamos el lunes 2026-10-19: la primera fecha debe ser ESE día,
  // no el 2026-10-18 que daría toISOString con TZ=Europe/Madrid.
  assert.equal(week[0].date, '2026-10-19');
  assert.equal(week[0].weekday, 'Lun');
  assert.equal(week[6].date, '2026-10-25');
  assert.equal(week[6].weekday, 'Dom');
});

test('getWeek(0) lista las tareas que tocan cada día', () => {
  // Diaria → todos los días. Días de la semana [0,2] → lunes y miércoles.
  // Las tareas empiezan el 19/10/2026 (la semana que se pinta).
  PlannerApi.addTask({ name: 'Agua',     repeat: 'daily',        startDate: '2026-10-19' });
  PlannerApi.addTask({ name: 'Gimnasio', repeat: 'daysOfWeek', days: [0, 2], startDate: '2026-10-19' });
  const week = PlannerApi.getWeek(0);
  // Lunes (i=0): ambas. Miércoles (i=2): Agua + Gimnasio. Resto: solo Agua.
  assert.deepEqual(week[0].tasks, ['Agua', 'Gimnasio']);
  assert.deepEqual(week[2].tasks, ['Agua', 'Gimnasio']);
  assert.deepEqual(week[1].tasks, ['Agua']);
  assert.deepEqual(week[6].tasks, ['Agua']);
});

test('getWeek: offset no entero lanza', () => {
  assert.throws(() => PlannerApi.getWeek('a'), /Offset inválido/);
});

// ── setStartDate: fechas inválidas ─────────────────────────────────────

test('setStartDate: cadena YYYY-MM-DD válida se acepta y se normaliza a 00:00', () => {
  PlannerApi.setStartDate('2026-11-02');
  assert.equal(PlannerApi.getStartDate(), '2026-11-02');
});

test('setStartDate: "2026-02-31" se rechaza (no se traga el desbordamiento)', () => {
  assert.throws(() => PlannerApi.setStartDate('2026-02-31'), /Fecha inválida/);
});

test('setStartDate: cadena mal formada se rechaza', () => {
  assert.throws(() => PlannerApi.setStartDate('31-02-2026'), /Fecha inválida/);
  assert.throws(() => PlannerApi.setStartDate(''),            /Fecha inválida/);
  assert.throws(() => PlannerApi.setStartDate(12345),         /Fecha inválida/);
});

test('setStartDate: Date inválido se rechaza', () => {
  assert.throws(() => PlannerApi.setStartDate(new Date('no-es-fecha')), /Fecha inválida/);
});

test('setStartDate: Date válido no muta el objeto recibido', () => {
  const original = new Date(2026, 9, 19, 14, 30, 0);
  PlannerApi.setStartDate(original);
  // El original mantiene su hora; la fecha interna se queda a 00:00.
  assert.equal(original.getHours(), 14);
  assert.equal(original.getMinutes(), 30);
  assert.equal(PlannerApi.getStartDate(), '2026-10-19');
});

// ── listViews / navigate: vistas conocidas y desconocida ───────────────

test('listViews incluye las 4 vistas canónicas: tasks, week, allWeeks, ajustes', () => {
  const views = PlannerApi.listViews();
  assert.ok(Array.isArray(views));
  assert.ok(views.includes('tasks'));
  assert.ok(views.includes('week'));
  assert.ok(views.includes('allWeeks'));
  assert.ok(views.includes('ajustes'));
  // Las antiguas entradas del menú ahora son alias de Ajustes y no
  // aparecen en listViews (que devuelve solo las vistas canónicas).
  assert.ok(!views.includes('data'));
  assert.ok(!views.includes('print'));
  assert.ok(!views.includes('settings'));
  assert.ok(!views.includes('legal'));
  assert.ok(!views.includes('accessibility'));
});

test('navigate("ajustes") lanza planner:navigate con esa vista', () => {
  const events = [];
  const navHandler = (e) => events.push(e.detail);
  window.addEventListener('planner:navigate', navHandler);
  try {
    PlannerApi.navigate('ajustes');
    assert.equal(events.length, 1);
    assert.equal(events[0].view, 'ajustes');
  } finally {
    window.removeEventListener('planner:navigate', navHandler);
  }
});

test('navigate acepta las vistas canónicas y dispatch con su view', () => {
  // Las vistas del menú (tasks/week/allWeeks/ajustes) navegan a su
  // propio view, sin tocar Ajustes. Esto cambió en T-022: antes
  // navigate() siempre dispatch con view='ajustes', lo que rompía
  // el spec 07-api (navigate('week') no activaba la vista semana).
  const cases = [
    { view: 'tasks' },
    { view: 'week' },
    { view: 'allWeeks' },
    { view: 'ajustes' },
  ];
  for (const { view } of cases) {
    const events = [];
    const handler = (e) => events.push(e.detail);
    window.addEventListener('planner:navigate', handler);
    try {
      PlannerApi.navigate(view);
      assert.equal(events.length, 1, `${view} no disparó un único evento`);
      assert.equal(events[0].view, view, `${view} debe mapear a view="${view}"`);
      assert.equal(events[0].tab, null, `${view} no debe llevar pestaña`);
    } finally {
      window.removeEventListener('planner:navigate', handler);
    }
  }
});

test('navigate acepta alias heredados y los traduce a Ajustes + pestaña', () => {
  // Cada alias lleva asociado un nombre de pestaña en Ajustes: el
  // evento `planner:navigate` lleva `view: "ajustes"` y `tab: <nombre>`.
  const cases = [
    { alias: 'accessibility', tab: 'accessibility' },
    { alias: 'data',         tab: 'data' },
    { alias: 'print',        tab: 'print' },
    { alias: 'legal',        tab: 'legal' },
    { alias: 'settings',     tab: 'appearance' },
  ];
  for (const { alias, tab } of cases) {
    const events = [];
    const handler = (e) => events.push(e.detail);
    window.addEventListener('planner:navigate', handler);
    try {
      PlannerApi.navigate(alias);
      assert.equal(events.length, 1, `alias ${alias} no disparó un único evento`);
      assert.equal(events[0].view, 'ajustes',
        `alias ${alias} debe mapear a view="ajustes"`);
      assert.equal(events[0].tab, tab,
        `alias ${alias} debe mapear a tab="${tab}"`);
    } finally {
      window.removeEventListener('planner:navigate', handler);
    }
  }
});

test('listAjustesTabs devuelve las pestañas accesibles por navigate()', () => {
  const tabs = PlannerApi.listAjustesTabs();
  assert.ok(Array.isArray(tabs));
  // Debe incluir los nombres de pestaña, sin el canónico "ajustes".
  assert.ok(tabs.includes('data'));
  assert.ok(tabs.includes('print'));
  assert.ok(tabs.includes('legal'));
  assert.ok(tabs.includes('accessibility'));
  assert.ok(tabs.includes('appearance'));
  assert.ok(!tabs.includes('ajustes'));
});

test('navigate: vista desconocida lanza "Vista inválida"', () => {
  assert.throws(() => PlannerApi.navigate('no-existe'), /Vista inválida/);
});