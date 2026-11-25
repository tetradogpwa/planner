// Pruebas de la migración del IDENTIFICADOR de las tareas guardadas
// (context.js).
//
// Las tareas guardadas antes de T-049 no tenían `id`: al leerlas se les
// asigna uno, y hay que guardarlas YA MIGRADAS. Si no, en cada
// arranque les tocaría un id nuevo y el identificador no sería
// estable (nada podría referirse a una tarea por su id).
//
// Sin DOM: simulamos un localStorage mínimo, como en api.test.mjs. El
// bloque estático de context.js lee el localStorage al cargarse, así
// que lo preparamos antes del import dinámico.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recargarApp } from './helpers/recargar-app.mjs';

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

storage.setItem('Context_START_DATE', String(new Date(2026, 10, 23).getTime()));

// Dos tareas como las guardaba la versión anterior a T-049: con su
// `startDate` (el formato de T-045) pero SIN `id`.
storage.setItem('Context_TASKS', JSON.stringify([
  { className: 'DailyTask', name: 'Agua', total: 1, startDate: '2026-11-23', nDays: 1 },
  { className: 'DaysOfWeekTask', name: 'Gimnasio', total: 1, startDate: '2026-11-25', flags: 1 },
]));

const { Context } = await import('../../context.js');

test('las tareas guardadas sin id reciben uno al arrancar', () => {
  assert.equal(Context.Tasks.length, 2);
  const ids = Context.Tasks.map(t => t.Id);
  ids.forEach(id => assert.equal(typeof id, 'string'));
  assert.equal(new Set(ids).size, 2, 'las dos tareas tienen el mismo id');
});

test('las tareas migradas se guardan ya con su id', () => {
  const guardado = JSON.parse(localStorage.getItem('Context_TASKS'));
  assert.equal(guardado.length, 2);
  // El id guardado es el mismo que tiene la tarea en memoria: al
  // volver a abrir la app será el mismo (estable).
  assert.equal(guardado[0].id, Context.Tasks[0].Id);
  assert.equal(guardado[1].id, Context.Tasks[1].Id);
});

test('el id es el mismo al volver a abrir la app', () => {
  // Se cierra la app y se vuelve a abrir (en un proceso nuevo): se lee
  // el almacenamiento otra vez. Los ids tienen que ser los mismos: si en
  // cada arranque se asignara uno nuevo, nada podría referirse a una
  // tarea por su id.
  const recargado = recargarApp(storage, 'Context.Tasks.map(t => ({ id: t.Id, name: t.Name }))');

  assert.deepEqual(recargado.map(t => t.id), Context.Tasks.map(t => t.Id));
  assert.deepEqual(recargado.map(t => t.name), ['Agua', 'Gimnasio']);
});
