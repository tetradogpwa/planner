// Pruebas del almacén de marcas de «hecho» (context.js, T-050).
//
// Una marca dice que una APARICIÓN está hecha: la tarea (por su id
// estable), el día (por su fecha real 'YYYY-MM-DD') y el número de vez
// (para las tareas con más de una vez al día). Se guardan en su propia
// clave del almacenamiento, aparte de las tareas.
//
// Sin DOM: simulamos un localStorage mínimo, como en context.test.mjs.

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

globalThis.localStorage = new MemoryStorage();

const { Context } = await import('../../context.js');

// ── Marcar y desmarcar ─────────────────────────────────────────────────

test('una marca recién puesta se puede consultar', () => {
  Context.Mark('tarea-1', '2026-11-25', 0);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 0), true);
});

test('lo que no está marcado no aparece como marcado', () => {
  Context.Mark('tarea-1', '2026-11-25', 0);
  assert.equal(Context.IsMarked('tarea-2', '2026-11-25', 0), false);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-26', 0), false);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 1), false);
});

test('desmarcar devuelve la aparición a pendiente', () => {
  Context.Mark('tarea-1', '2026-11-25', 0);
  Context.Unmark('tarea-1', '2026-11-25', 0);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 0), false);
});

test('cada vez de una tarea es una marca distinta', () => {
  Context.Mark('tarea-1', '2026-11-25', 0);
  Context.Mark('tarea-1', '2026-11-25', 1);

  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 0), true);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 1), true);

  // Desmarcar una no toca la otra.
  Context.Unmark('tarea-1', '2026-11-25', 0);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 0), false);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 1), true);
});

test('las marcas de un día no se mezclan con las de otro', () => {
  Context.Mark('tarea-1', '2026-11-25', 0);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-26', 0), false);
  Context.Mark('tarea-1', '2026-11-26', 0);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 0), true);
  assert.equal(Context.IsMarked('tarea-1', '2026-11-26', 0), true);
});

test('las marcas de una tarea no tocan las de otra', () => {
  Context.Mark('tarea-1', '2026-11-25', 0);
  Context.Mark('tarea-2', '2026-11-25', 0);
  Context.ClearMarks('tarea-1');
  assert.equal(Context.IsMarked('tarea-1', '2026-11-25', 0), false);
  assert.equal(Context.IsMarked('tarea-2', '2026-11-25', 0), true);
});

// ── Persistencia ───────────────────────────────────────────────────────

test('las marcas se guardan en su propia clave del almacenamiento', () => {
  // Se empieza de cero: esta prueba mira cómo queda lo guardado.
  localStorage.removeItem('Context_MARKS');
  Context.Mark('tarea-9', '2026-11-25', 2);

  const crudo = localStorage.getItem('Context_MARKS');
  assert.ok(crudo, 'las marcas tienen que estar guardadas en Context_MARKS');
  const tareas = localStorage.getItem('Context_TASKS');
  assert.ok(!tareas || !tareas.includes('tarea-9'),
    'las marcas no se guardan dentro de las tareas');

  // La marca se indexa por id de tarea, fecha y número de vez.
  const marcas = JSON.parse(crudo);
  assert.deepEqual(Object.keys(marcas), ['tarea-9']);
  assert.deepEqual(Object.keys(marcas['tarea-9']), ['2026-11-25']);
  assert.deepEqual(marcas['tarea-9']['2026-11-25'], [2]);
});

test('las marcas sobreviven a recargar la app', async () => {
  Context.Mark('tarea-3', '2026-12-01', 0);

  // Recargar la app es volver a cargar el módulo: lee el
  // almacenamiento otra vez.
  const recargado = await import('../../context.js?recarga=1');
  assert.equal(recargado.Context.IsMarked('tarea-3', '2026-12-01', 0), true);
  assert.equal(recargado.Context.IsMarked('tarea-3', '2026-12-02', 0), false);
});

test('un almacenamiento de marcas que no se puede leer no rompe la app', async () => {
  localStorage.setItem('Context_MARKS', '{esto no es json');
  const recargado = await import('../../context.js?recarga=2');
  assert.equal(recargado.Context.IsMarked('tarea-3', '2026-12-01', 0), false);
  // Y se puede seguir marcando con normalidad.
  recargado.Context.Mark('tarea-4', '2026-12-03', 0);
  assert.equal(recargado.Context.IsMarked('tarea-4', '2026-12-03', 0), true);
});

// ── Datos que no valen ────────────────────────────────────────────────

test('una fecha que no existe se rechaza', () => {
  assert.throws(() => Context.Mark('tarea-1', '2026-02-31', 0), /Fecha inválida/);
  assert.throws(() => Context.Mark('tarea-1', '31-12-2026', 0), /Fecha inválida/);
  assert.throws(() => Context.Mark('tarea-1', '', 0), /Fecha inválida/);
});

test('un id de tarea vacío se rechaza', () => {
  assert.throws(() => Context.Mark('', '2026-11-25', 0), /Identificador de tarea inválido/);
  assert.throws(() => Context.Mark(null, '2026-11-25', 0), /Identificador de tarea inválido/);
});

test('un número de vez inválido se rechaza', () => {
  assert.throws(() => Context.Mark('tarea-1', '2026-11-25', -1), /Número de vez inválido/);
  assert.throws(() => Context.Mark('tarea-1', '2026-11-25', 1.5), /Número de vez inválido/);
});

test('consultar una marca con datos que no valen devuelve false (no lanza)', () => {
  assert.equal(Context.IsMarked('tarea-1', '2026-02-31', 0), false);
  assert.equal(Context.IsMarked('', '2026-11-25', 0), false);
});
