// Pruebas del guardado en JSON (back/serializer.js): es lo que usan
// localStorage y la exportación/importación de datos.
//
// También cubren la migración del formato viejo (T-045): las tareas
// guardaban `daysFrom` (un offset respecto al origen del planificador)
// y ahora guardan su fecha de inicio real (`startDate`).

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FromJson, ToJson, usaFormatoAntiguo } from '../../back/serializer.js';
import {
  createDailyTask,
  createNDaysTask,
  createOneTimeTask,
  createDaysOfWeekTask,
  createCycleDaysOfWeekTask,
} from '../../back/taskFactory.js';

const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// El aviso "The MockTimers API is an experimental feature" ensucia la
// salida del runner de pruebas. Lo callamos: aquí el reloj falso es
// justo lo que se quiere.
process.removeAllListeners('warning');

// Un JSON real en el formato viejo (el que guardaba la app antes de
// T-045): tareas con `daysFrom` y sin `startDate`.
const JSON_VIEJO = readFileSync(
  join(RAIZ, 'tests', 'unit', 'fixtures', 'tareas-formato-viejo.json'), 'utf8');

const diasActivos = (tarea, hasta = 28) =>
  Array.from({ length: hasta }, (_, d) => d)
    .filter(d => tarea.thisDayHas(new Date(2026, 5, 1 + d)));

const TAREAS = () => [
  createDailyTask('Agua', 8, '2026-06-01'),
  createNDaysTask('Regar', 3, 1, '2026-06-03'),
  createDaysOfWeekTask('Gimnasio', [0, 2, 4], 1, '2026-06-01'),
  createCycleDaysOfWeekTask('Turnos', [[0], [1, 4]], 2, '2026-06-08'),
  createOneTimeTask(createDaysOfWeekTask('Dentista', [3], 1, '2026-06-01'), 1, '2026-06-01'),
];

test('ida y vuelta: conserva tipo, nombre, total, inicio y días de cada tarea', () => {
  const originales = TAREAS();
  const leidas = FromJson(ToJson(originales));

  assert.equal(leidas.length, originales.length);
  originales.forEach((orig, i) => {
    const leida = leidas[i];
    assert.equal(leida.constructor.name, orig.constructor.name, `tipo de ${orig.Name}`);
    assert.equal(leida.Name, orig.Name);
    assert.equal(leida.Total, orig.Total);
    assert.equal(leida.StartDate, orig.StartDate);
    assert.deepEqual(diasActivos(leida), diasActivos(orig), `días de ${orig.Name}`);
  });
});

test('una sola vez: la tarea base anidada también se restaura', () => {
  // La base marca el día 3 (jueves): con inicio el lunes 1/6/2026, la
  // primera aparición es el jueves 4/6 (índice 3).
  const [leida] = FromJson(ToJson([createOneTimeTask(createDaysOfWeekTask('Dentista', [3], 1, '2026-06-01'), 1, '2026-06-01')]));
  assert.equal(leida.Task.constructor.name, 'DaysOfWeekTask');
  assert.deepEqual(diasActivos(leida), [3]);
});

test('acepta el formato exportado con envoltorio { tasks: [...] }', () => {
  const json = JSON.stringify({ tasks: JSON.parse(ToJson([createDailyTask('Agua', 1, '2026-06-01')])) });
  const leidas = FromJson(json);
  assert.equal(leidas.length, 1);
  assert.equal(leidas[0].Name, 'Agua');
});

test('descarta las tareas de un tipo desconocido', () => {
  const json = JSON.stringify([
    { className: 'TipoQueNoExiste', name: 'X' },
    ...JSON.parse(ToJson([createDailyTask('Agua', 1, '2026-06-01')])),
  ]);
  assert.deepEqual(FromJson(json).map(t => t.Name), ['Agua']);
});

test('JSON roto: lanza un error en vez de devolver una lista vacía', (t) => {
  t.mock.method(console, 'warn', () => {});   // el aviso esperado no ensucia la salida
  // Antes devolvía [] y quien importaba se quedaba sin tareas sin
  // avisar (T-031 / R-01): ahora el error se ve.
  assert.throws(() => FromJson('{esto no es json'), /JSON inválido/);
  assert.throws(() => FromJson(''),              /JSON inválido/);
});

test('JSON que no es una lista de tareas: lanza un error', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.throws(() => FromJson('42'),       /JSON inválido/);
  assert.throws(() => FromJson('"hola"'),   /JSON inválido/);
  assert.throws(() => FromJson('null'),     /JSON inválido/);
  assert.throws(() => FromJson('{"foo":1}'), /JSON inválido/);
});

test('JSON válido vacío: devuelve una lista vacía, sin error', () => {
  assert.deepEqual(FromJson('[]'), []);
});

test('solo tareas de tipo desconocido: lista vacía y sin error', () => {
  // Un className que no conocemos se descarta, pero el archivo es
  // válido: no es un error y no invalida el resto del JSON.
  const json = JSON.stringify([{ className: 'TipoQueNoExiste', name: 'X' }]);
  assert.deepEqual(FromJson(json), []);
});

// ── Migración del formato viejo (T-045) ─────────────────────────────────

test('un JSON del formato viejo se migra a fechas reales sin perder tareas', () => {
  // El origen del planificador era el lunes 23/11/2026.
  const tareas = FromJson(JSON_VIEJO, { origin: '2026-11-23' });

  assert.equal(tareas.length, 5);
  assert.deepEqual(tareas.map(t => t.Name), [
    'Beber agua', 'Gimnasio', 'Regar plantas', 'Dentista', 'Turnos',
  ]);
  // Cada `daysFrom` se traduce a su fecha: origen + días.
  assert.deepEqual(tareas.map(t => t.StartDate), [
    '2026-11-23',   // daysFrom 0
    '2026-11-25',   // daysFrom 2
    '2026-11-28',   // daysFrom 5
    '2026-11-30',   // daysFrom 7
    '2026-11-23',   // daysFrom 0
  ]);
  // Y los tipos y los días se conservan.
  assert.deepEqual(tareas.map(t => t.constructor.name), [
    'DailyTask', 'DaysOfWeekTask', 'NDaysTask', 'OneTimeTask', 'CiclesDaysOfWeekTask',
  ]);
  assert.equal(tareas[1].hasDay(0), true);
  assert.equal(tareas[1].hasDay(2), true);
  assert.equal(tareas[4].Cicles.length, 2);
  assert.equal(tareas[4].Cicles[1].hasDay(4), true);
});

test('sin fecha de inicio guardada, la migración usa la fecha de la migración (hoy)', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 26, 10, 0, 0) });
  try {
    const tareas = FromJson(JSON_VIEJO);
    assert.equal(tareas[0].StartDate, '2026-11-26');   // daysFrom 0
    assert.equal(tareas[2].StartDate, '2026-12-01');   // daysFrom 5
  } finally {
    mock.timers.reset();
  }
});

test('las tareas del formato viejo se detectan para guardarlas ya migradas', () => {
  assert.equal(usaFormatoAntiguo(JSON_VIEJO), true);
  assert.equal(usaFormatoAntiguo(ToJson(TAREAS())), false);
  assert.equal(usaFormatoAntiguo('{esto no es json'), false);
});

test('un ciclo vacío importado no rompe nada', () => {
  const json = JSON.stringify([
    { className: 'CiclesDaysOfWeekTask', name: 'Turnos', total: 1, daysFrom: 0, cicles: [] },
  ]);
  const tareas = FromJson(json, { origin: '2026-11-23' });

  assert.equal(tareas.length, 1);
  assert.equal(tareas[0].Cicles.length, 0);
  // Antes, buscar la semana del ciclo con el ciclo vacío petaba.
  assert.doesNotThrow(() => tareas[0].thisDayHas(new Date(2026, 10, 25)));
  assert.equal(tareas[0].thisDayHas(new Date(2026, 10, 25)), false);
});

test('una tarea sin `startDate` ni `daysFrom` se migra al origen', () => {
  const json = JSON.stringify([
    { className: 'DailyTask', name: 'Agua', total: 1, nDays: 1 },
  ]);
  const tareas = FromJson(json, { origin: '2026-11-23' });
  assert.equal(tareas[0].StartDate, '2026-11-23');
});
