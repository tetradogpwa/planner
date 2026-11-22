// Pruebas del guardado en JSON (back/serializer.js): es lo que usan
// localStorage y la exportación/importación de datos.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FromJson, ToJson } from '../../back/serializer.js';
import {
  createDailyTask,
  createNDaysTask,
  createOneTimeTask,
  createDaysOfWeekTask,
  createCycleDaysOfWeekTask,
} from '../../back/taskFactory.js';

const FROM = new Date(2026, 5, 1);
const diasActivos = (tarea, hasta = 28) =>
  Array.from({ length: hasta }, (_, d) => d).filter(d => tarea.thisDayHas(FROM, d));

const TAREAS = () => [
  createDailyTask('Agua', 8),
  createNDaysTask('Regar', 3, 1, 2),
  createDaysOfWeekTask('Gimnasio', [0, 2, 4]),
  createCycleDaysOfWeekTask('Turnos', [[0], [1, 4]], 2, 7),
  createOneTimeTask(createDaysOfWeekTask('Dentista', [3])),
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
    assert.equal(leida.DaysFrom, orig.DaysFrom);
    assert.deepEqual(diasActivos(leida), diasActivos(orig), `días de ${orig.Name}`);
  });
});

test('una sola vez: la tarea base anidada también se restaura', () => {
  const [leida] = FromJson(ToJson([createOneTimeTask(createDaysOfWeekTask('Dentista', [3]))]));
  assert.equal(leida.Task.constructor.name, 'DaysOfWeekTask');
  assert.deepEqual(diasActivos(leida), [3]);
});

test('acepta el formato exportado con envoltorio { tasks: [...] }', () => {
  const json = JSON.stringify({ tasks: JSON.parse(ToJson([createDailyTask('Agua')])) });
  const leidas = FromJson(json);
  assert.equal(leidas.length, 1);
  assert.equal(leidas[0].Name, 'Agua');
});

test('descarta las tareas de un tipo desconocido', () => {
  const json = JSON.stringify([
    { className: 'TipoQueNoExiste', name: 'X' },
    ...JSON.parse(ToJson([createDailyTask('Agua')])),
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
