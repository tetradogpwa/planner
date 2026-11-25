// Pruebas del estado global (context.js): la lista de tareas, la fecha
// de inicio del planificador y las marcas de «hecho».
//
// Sin DOM: simulamos un localStorage mínimo, como en context.test.mjs.
// El bloque estático de context.js lee el almacenamiento al cargarse,
// así que lo preparamos ANTES del import dinámico: se guarda a
// propósito un JSON de tareas que no se puede leer (como quedaría si la
// app se cerrara mientras guardaba) y una fecha de inicio.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/** localStorage mínimo basado en Map: suficiente para context.js. */
class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k)    { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear()       { this.m.clear(); }
  key(i)        { return [...this.m.keys()][i] ?? null; }
  get length()  { return this.m.size; }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

storage.setItem('Context_TASKS', '{esto no es json');
storage.setItem('Context_START_DATE', String(new Date(2026, 10, 23).getTime()));

const { Context } = await import('../../context.js');
const { createDailyTask, createCycleDaysOfWeekTask } = await import('../../back/taskFactory.js');

// Lo que había en el almacenamiento justo después de arrancar (antes de
// que el `beforeEach` lo vacíe): el JSON de tareas roto tiene que seguir
// ahí, para que el usuario pueda recuperarlo desde fuera.
const jsonGuardadoAlArrancar = storage.getItem('Context_TASKS');

beforeEach(() => {
  storage.clear();
  Context.Tasks = [];
  Context.ClearAllMarks();
});

// ── Las claves del almacenamiento ──────────────────────────────────────

test('cada dato se guarda en su propia clave, con el nombre de la clase', () => {
  assert.equal(Context.KeyTasks, 'Context_TASKS');
  assert.equal(Context.KeyStartDate, 'Context_START_DATE');
  assert.equal(Context.KeyMarks, 'Context_MARKS');
});

// ── La lista de tareas ─────────────────────────────────────────────────

test('la lista de tareas se guarda entera y se puede volver a leer', () => {
  Context.Tasks = [createDailyTask('Agua', 3)];

  assert.equal(Context.Tasks.length, 1);
  assert.equal(Context.Tasks[0].Name, 'Agua');
  assert.equal(Context.Tasks[0].Total, 3);

  const guardado = JSON.parse(storage.getItem('Context_TASKS'));
  assert.equal(guardado.length, 1);
  assert.equal(guardado[0].name, 'Agua');
});

test('cambiar el nombre de una tarea vuelve a guardar la lista', () => {
  Context.Tasks = [createDailyTask('Agua', 3)];
  Context.Tasks[0].Name = 'Agua con hielo';

  const guardado = JSON.parse(storage.getItem('Context_TASKS'));
  assert.equal(guardado[0].name, 'Agua con hielo');
});

test('añadir una tarea a la lista la guarda', () => {
  Context.Tasks = [];
  Context.Tasks.push(createDailyTask('Gimnasio'));

  const guardado = JSON.parse(storage.getItem('Context_TASKS'));
  assert.equal(guardado.length, 1);
  assert.equal(guardado[0].name, 'Gimnasio');
});

test('una lista que no es un array se rechaza y deja la lista como estaba', () => {
  Context.Tasks = [createDailyTask('Agua')];
  assert.throws(() => { Context.Tasks = 'no soy un array'; }, /array/);
  assert.equal(Context.Tasks.length, 1);
});

test('UpdateTasks guarda la lista que hay ahora mismo', () => {
  Context.Tasks = [createDailyTask('Leer', 2)];
  storage.removeItem('Context_TASKS');

  Context.UpdateTasks();

  const guardado = JSON.parse(storage.getItem('Context_TASKS'));
  assert.equal(guardado.length, 1);
  assert.equal(guardado[0].name, 'Leer');
});

test('las tareas con una lista dentro se pueden leer (ciclos)', () => {
  Context.Tasks = [createCycleDaysOfWeekTask('Lavar', [[1, 3]])];
  // Al leer la lista de ciclos sale otro proxy: tiene que poder leerse.
  assert.equal(Context.Tasks[0].Cicles.length, 1);
  assert.equal(Context.Tasks[0].Cicles[0].hasDay(1), true);
  assert.equal(Context.Tasks[0].Cicles[0].hasDay(2), false);
});

// ── La fecha de inicio ─────────────────────────────────────────────────

test('la fecha de inicio se guarda en el almacenamiento', () => {
  const fecha = new Date(2026, 10, 23);
  Context.StartDate = fecha;

  assert.equal(Number(storage.getItem('Context_START_DATE')), fecha.getTime());
  assert.equal(Context.StartDate.getTime(), fecha.getTime());
});

test('la fecha de inicio guardada es la que se lee al arrancar', () => {
  assert.equal(Context.StartDate.getTime(), new Date(2026, 10, 23).getTime());
});

// ── Las marcas de «hecho» ──────────────────────────────────────────────

test('marcar una aparición la deja como hecha', () => {
  const marca = Context.Mark('t1', '2026-11-25', 0);

  assert.deepEqual(marca, { id: 't1', date: '2026-11-25', slot: 0 });
  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), true);
  assert.equal(Context.IsMarked('t1', '2026-11-26', 0), false);
  assert.equal(Context.IsMarked('t2', '2026-11-25', 0), false);
});

test('desmarcar una aparición la deja como pendiente', () => {
  Context.Mark('t1', '2026-11-25', 0);
  Context.Unmark('t1', '2026-11-25', 0);

  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), false);
});

test('cada vez de una tarea es una marca distinta', () => {
  Context.Mark('t1', '2026-11-25', 0);
  Context.Mark('t1', '2026-11-25', 1);

  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), true);
  assert.equal(Context.IsMarked('t1', '2026-11-25', 1), true);

  Context.Unmark('t1', '2026-11-25', 0);
  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), false);
  assert.equal(Context.IsMarked('t1', '2026-11-25', 1), true);
});

test('las marcas se guardan en su propia clave, por tarea y por día', () => {
  Context.Mark('t1', '2026-11-25', 0);
  Context.Mark('t1', '2026-11-26', 1);

  const marcas = JSON.parse(storage.getItem('Context_MARKS'));
  assert.deepEqual(marcas, { t1: { '2026-11-25': [0], '2026-11-26': [1] } });
  assert.equal(storage.getItem('Context_TASKS'), '[]', 'las marcas no van con las tareas');
});

test('unas marcas guardadas que no se pueden leer no rompen la app', () => {
  storage.setItem('Context_MARKS', '{esto no es json');

  // Se puede seguir marcando con normalidad.
  Context.Mark('t2', '2026-11-26', 0);
  assert.equal(Context.IsMarked('t2', '2026-11-26', 0), true);
  // Y lo que no está marcado no aparece como marcado.
  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), false);
});

test('unas marcas guardadas que no son un mapa se ignoran', () => {
  storage.setItem('Context_MARKS', '[1, 2, 3]');

  assert.deepEqual(Context.GetAllMarks(), {});
});

test('borrar las marcas de una tarea no toca las de otra', () => {
  Context.Mark('t1', '2026-11-25', 0);
  Context.Mark('t2', '2026-11-25', 0);

  Context.ClearMarks('t1');

  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), false);
  assert.equal(Context.IsMarked('t2', '2026-11-25', 0), true);
});

test('borrar todas las marcas las deja vacías', () => {
  Context.Mark('t1', '2026-11-25', 0);
  Context.Mark('t2', '2026-11-26', 0);

  Context.ClearAllMarks();

  assert.deepEqual(Context.GetAllMarks(), {});
  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), false);
});

test('GetAllMarks devuelve una copia: lo guardado no se puede tocar', () => {
  Context.Mark('t1', '2026-11-25', 0);

  const marcas = Context.GetAllMarks();
  marcas['t1']['2026-11-25'].push(9);
  delete marcas['t1'];

  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), true);
  assert.deepEqual(Context.GetAllMarks()['t1']['2026-11-25'], [0]);
});

test('SetAllMarks sustituye todas las marcas por las dadas', () => {
  Context.Mark('t1', '2026-11-25', 0);

  Context.SetAllMarks({ t2: { '2026-11-27': [0, 1] } });

  assert.equal(Context.IsMarked('t1', '2026-11-25', 0), false);
  assert.equal(Context.IsMarked('t2', '2026-11-27', 0), true);
  assert.equal(Context.IsMarked('t2', '2026-11-27', 1), true);
});

test('SetAllMarks con marcas que no valen deja la lista de marcas vacía', () => {
  Context.Mark('t1', '2026-11-25', 0);

  // Una lista no es un mapa de marcas: no se guarda nada (y no se lanza).
  Context.SetAllMarks([{ '2026-11-25': [0] }]);
  assert.deepEqual(Context.GetAllMarks(), {},
    'una lista no vale como mapa de marcas: no se guarda ninguna');

  // Un mapa cuya tarea no tiene marcas tampoco.
  Context.SetAllMarks({ t2: 'no son marcas' });
  assert.deepEqual(Context.GetAllMarks(), {});

  // Y un día sin marcas no deja la tarea a medias.
  Context.SetAllMarks({ t3: { '2026-11-25': [] } });
  assert.deepEqual(Context.GetAllMarks(), {});
});

// ── Las marcas de una tarea, para poder deshacer su borrado ────────────

test('las marcas de una tarea se pueden guardar y devolver', () => {
  Context.Mark('t1', '2026-11-25', 0);
  Context.Mark('t1', '2026-11-26', 1);

  const marcas = Context.GetMarks('t1');
  assert.deepEqual(marcas, { '2026-11-25': [0], '2026-11-26': [1] });

  // Lo que devuelve es una copia: tocarla no cambia lo guardado.
  const copia = Context.GetMarks('t1');
  copia['2026-11-25'].push(9);
  delete copia['2026-11-26'];
  assert.deepEqual(Context.GetMarks('t1'), { '2026-11-25': [0], '2026-11-26': [1] },
    'GetMarks devuelve una copia: lo guardado no se puede tocar');

  Context.ClearMarks('t1');
  assert.deepEqual(Context.GetMarks('t1'), {});

  Context.RestoreMarks('t1', marcas);
  assert.deepEqual(Context.GetMarks('t1'), marcas);
  assert.equal(Context.IsMarked('t1', '2026-11-26', 1), true);
});

test('una tarea sin marcas devuelve un mapa vacío', () => {
  assert.deepEqual(Context.GetMarks('no-existe'), {});
});

test('restaurar marcas que no valen no deja marcas a medias', () => {
  // Un dato que no es un mapa de marcas: no se lanza y no se guarda nada.
  assert.doesNotThrow(() => Context.RestoreMarks('t1', null));
  assert.doesNotThrow(() => Context.RestoreMarks('t1', undefined));
  assert.doesNotThrow(() => Context.RestoreMarks('t1', 'no son marcas'));
  assert.doesNotThrow(() => Context.RestoreMarks('t1', 42));
  assert.deepEqual(Context.GetMarks('t1'), {});

  // Un día sin marcas tampoco deja la tarea a medias.
  Context.RestoreMarks('t1', { '2026-11-25': [] });
  assert.deepEqual(Context.GetMarks('t1'), {});
});

// ── Deshacer un borrado ────────────────────────────────────────────────

test('la foto de una tarea guarda su posición y sus marcas', () => {
  const a = createDailyTask('A');
  const b = createDailyTask('B');
  Context.Tasks = [a, b];
  Context.Mark(b.Id, '2026-11-25', 0);

  const foto = Context.FotoTarea(b.Id);

  assert.ok(foto, 'la foto de una tarea que existe se hace');
  assert.equal(foto.posicion, 1);
  assert.deepEqual(foto.marcas[b.Id], { '2026-11-25': [0] });
});

test('la foto de una tarea que no existe es null', () => {
  Context.Tasks = [createDailyTask('A')];
  assert.equal(Context.FotoTarea('no-existe'), null);
});

test('deshacer el borrado devuelve la tarea a su posición, con su id y sus marcas', () => {
  const a = createDailyTask('A');
  const b = createDailyTask('B');
  const c = createDailyTask('C');
  Context.Tasks = [a, b, c];
  Context.Mark(b.Id, '2026-11-25', 0);

  const foto = Context.FotoTarea(b.Id);
  Context.Tasks.splice(1, 1);
  Context.ClearMarks(b.Id);

  const restaurada = Context.RestaurarTarea(foto);

  assert.ok(restaurada, 'la tarea se ha restaurado');
  assert.equal(Context.Tasks.length, 3);
  assert.equal(Context.Tasks[1].Name, 'B', 'vuelve a SU posición');
  assert.equal(Context.Tasks[1].Id, b.Id, 'vuelve con SU id');
  assert.equal(Context.IsMarked(b.Id, '2026-11-25', 0), true, 'vuelve con sus marcas');
});

test('restaurar una foto que no vale no hace nada', () => {
  Context.Tasks = [createDailyTask('A')];

  assert.equal(Context.RestaurarTarea(null), null);
  assert.equal(Context.RestaurarTarea({}), null);
  assert.equal(Context.Tasks.length, 1);
});

test('la foto de todas las tareas se puede restaurar entera', () => {
  const a = createDailyTask('A');
  const b = createDailyTask('B');
  Context.Tasks = [a, b];
  Context.Mark(a.Id, '2026-11-25', 0);

  const foto = Context.FotoTodas();
  Context.Tasks.length = 0;
  Context.ClearAllMarks();

  const restauradas = Context.RestaurarTodas(foto);

  assert.equal(restauradas.length, 2);
  assert.equal(Context.Tasks.length, 2);
  assert.equal(Context.Tasks[0].Id, a.Id, 'vuelven con SU id');
  assert.equal(Context.IsMarked(a.Id, '2026-11-25', 0), true, 'vuelven con sus marcas');
});

test('restaurar todas las tareas sin foto no hace nada', () => {
  Context.Tasks = [createDailyTask('A')];

  assert.deepEqual(Context.RestaurarTodas(null), []);
  assert.equal(Context.Tasks.length, 1);
});

// ── Datos que no valen ─────────────────────────────────────────────────

test('una marca con un id que no vale se rechaza', () => {
  assert.throws(() => Context.Mark('', '2026-11-25', 0), /Identificador de tarea inválido/);
  assert.throws(() => Context.Mark(null, '2026-11-25', 0), /Identificador de tarea inválido/);
});

test('una marca con una fecha que no vale se rechaza', () => {
  assert.throws(() => Context.Mark('t1', '31-12-2026', 0), /Fecha inválida/);
  assert.throws(() => Context.Mark('t1', '2026-02-31', 0), /Fecha inválida/);
  assert.throws(() => Context.Mark('t1', '', 0), /Fecha inválida/);
});

test('una marca con un número de vez que no vale se rechaza', () => {
  assert.throws(() => Context.Mark('t1', '2026-11-25', -1), /Número de vez inválido/);
  assert.throws(() => Context.Mark('t1', '2026-11-25', 1.5), /Número de vez inválido/);
});

test('consultar una marca con datos que no valen devuelve false (no lanza)', () => {
  assert.equal(Context.IsMarked('t1', '2026-02-31', 0), false);
  assert.equal(Context.IsMarked('', '2026-11-25', 0), false);
});

// ── El arranque con el almacenamiento a medias ─────────────────────────

test('un JSON de tareas guardado que no se puede leer no impide arrancar', () => {
  assert.equal(Context.Tasks.length, 0, 'la app arranca con la lista vacía');
  assert.equal(jsonGuardadoAlArrancar, '{esto no es json',
    'el JSON guardado NO se borra: el usuario puede recuperarlo desde fuera');
  // Y la app sigue funcionando: se puede guardar una tarea.
  Context.Tasks = [createDailyTask('Agua')];
  assert.equal(JSON.parse(storage.getItem('Context_TASKS')).length, 1);
});
