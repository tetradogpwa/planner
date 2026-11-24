// Pruebas de la migración de los datos GUARDADOS (context.js).
//
// Un localStorage con el formato viejo (tareas con `daysFrom`, un
// offset respecto al origen del planificador) tiene que:
//   1. arrancar con las tareas migradas a fechas reales, y
//   2. guardarse ya migrado: si no, la migración se repetiría en cada
//      arranque y, sin fecha de inicio guardada, las tareas se moverían
//      un día cada vez (T-045).
//
// Sin DOM: simulamos un localStorage mínimo, como en api.test.mjs. El
// bloque estático de context.js lee el localStorage al cargarse, así
// que lo preparamos antes del import dinámico.

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

// Fecha de inicio guardada: el lunes 23/11/2026. Es el origen de las
// tareas del formato viejo.
storage.setItem('Context_START_DATE', String(new Date(2026, 10, 23).getTime()));

// Dos tareas en el formato viejo: una diaria y una de los lunes.
storage.setItem('Context_TASKS', JSON.stringify([
  { className: 'DailyTask', name: 'Agua', total: 1, daysFrom: 0, nDays: 1 },
  { className: 'DaysOfWeekTask', name: 'Gimnasio', total: 1, daysFrom: 2, flags: 1 },
]));

const { Context } = await import('../../context.js');

test('las tareas guardadas en el formato viejo se migran a fechas reales', () => {
  assert.equal(Context.Tasks.length, 2);
  assert.deepEqual(Context.Tasks.map(t => t.Name), ['Agua', 'Gimnasio']);
  // El `daysFrom` se traduce a su fecha: origen (23/11) + días.
  assert.deepEqual(Context.Tasks.map(t => t.StartDate), ['2026-11-23', '2026-11-25']);
});

test('las tareas migradas se guardan ya en el formato nuevo', () => {
  const guardado = JSON.parse(localStorage.getItem('Context_TASKS'));
  assert.equal(guardado.length, 2);
  assert.deepEqual(guardado.map(t => t.startDate), ['2026-11-23', '2026-11-25']);
  assert.equal(guardado[0].daysFrom, undefined);
});

test('la fecha de inicio guardada se conserva', () => {
  assert.equal(Context.StartDate.getTime(), new Date(2026, 10, 23).getTime());
});
