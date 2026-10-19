// Pruebas de los tipos de repetición de back/ (sin DOM).
//
// `dayFromOrigin` cuenta días desde el lunes de la semana de inicio:
// 0 = lunes de la primera semana, 7 = lunes de la segunda…

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDailyTask,
  createNDaysTask,
  createOneTimeTask,
  createDaysOfWeekTask,
  createCycleDaysOfWeekTask,
} from '../../back/taskFactory.js';

const FROM = new Date(2026, 5, 1);   // lunes 1 de junio de 2026

/** Días (entre 0 y `hasta`-1) en los que aplica la tarea. */
const diasActivos = (tarea, hasta = 21) =>
  Array.from({ length: hasta }, (_, d) => d).filter(d => tarea.thisDayHas(FROM, d));

test('diaria: aplica todos los días', () => {
  assert.deepEqual(diasActivos(createDailyTask('Agua'), 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('cada N días: empieza en daysFrom y repite cada N', () => {
  const tarea = createNDaysTask('Regar', 3, 1, 2);
  assert.deepEqual(diasActivos(tarea, 12), [2, 5, 8, 11]);
});

test('días de la semana: solo los marcados (0 = lunes)', () => {
  const tarea = createDaysOfWeekTask('Gimnasio', [0, 2]);   // lunes y miércoles
  assert.deepEqual(diasActivos(tarea, 15), [0, 2, 7, 9, 14]);
});

test('días de la semana: no aplica antes de daysFrom', () => {
  const tarea = createDaysOfWeekTask('Gimnasio', [0, 2], 1, 7);
  assert.deepEqual(diasActivos(tarea, 15), [7, 9, 14]);
});

test('ciclo de semanas: alterna los días de cada semana y vuelve a empezar', () => {
  // Semana A: lunes. Semana B: martes y viernes.
  const tarea = createCycleDaysOfWeekTask('Turnos', [[0], [1, 4]]);
  assert.deepEqual(diasActivos(tarea, 21), [0, 8, 11, 14]);
});

test('una sola vez: solo la primera aparición de la tarea base', () => {
  const base  = createDaysOfWeekTask('Dentista', [2]);       // miércoles
  const tarea = createOneTimeTask(base);
  assert.deepEqual(diasActivos(tarea, 21), [2]);
  assert.equal(tarea.Name, 'Dentista');
});
