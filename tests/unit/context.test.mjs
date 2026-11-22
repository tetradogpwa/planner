// Pruebas del estado global (context.js): la lista de tareas se guarda
// en localStorage y se sustituye entera de golpe (importar un JSON no
// puede dejar al usuario sin tareas a medio rellenar: T-031 / R-01).
//
// Sin DOM: simulamos un localStorage mínimo, como en api.test.mjs.
// El bloque estático de context.js lee localStorage al cargarse, así que
// lo preparamos antes del import dinámico.

import { test } from 'node:test';
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

// Guardamos a propósito un JSON que no se puede leer (como quedaría si
// la app se cerrara mientras guardaba). La app debe arrancar igual.
storage.setItem('Context_TASKS', '{esto no es json');

const { Context } = await import('../../context.js');
const { createDailyTask } = await import('../../back/taskFactory.js');

test('un JSON guardado corrupto no impide arrancar: la lista queda vacía', () => {
  assert.equal(Context.Tasks.length, 0);
});

test('el JSON guardado corrupto no se borra (el usuario puede recuperarlo)', () => {
  assert.equal(localStorage.getItem('Context_TASKS'), '{esto no es json');
});

test('Context.Tasks = [...] sustituye la lista entera y la guarda', () => {
  Context.Tasks = [createDailyTask('Agua', 3)];

  assert.equal(Context.Tasks.length, 1);
  assert.equal(Context.Tasks[0].Name, 'Agua');
  assert.equal(Context.Tasks[0].Total, 3);

  // Queda persistido (y se puede volver a leer).
  const guardado = JSON.parse(localStorage.getItem('Context_TASKS'));
  assert.equal(guardado.length, 1);
  assert.equal(guardado[0].name, 'Agua');
  assert.equal(guardado[0].className, 'DailyTask');
});

test('Context.Tasks = [] deja la lista vacía y la guarda vacía', () => {
  Context.Tasks = [];

  assert.equal(Context.Tasks.length, 0);
  assert.deepEqual(JSON.parse(localStorage.getItem('Context_TASKS')), []);
});

test('Context.Tasks = algo que no es un array lanza', () => {
  assert.throws(() => { Context.Tasks = 'no soy un array'; }, /array/);
  // La lista sigue como estaba: el rechazo no la deja a medias.
  assert.equal(Context.Tasks.length, 0);
});
