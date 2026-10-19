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
import {
  WeeklyTask,
  MonthlyTask,
  QuaterlyTask,
} from '../../back/nDays.js';
import { DaysOfWeekTask } from '../../back/daysOfWeek.js';

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

// ── Periodicidades predefinidas de nDays.js ──────────────────────────────
// WeeklyTask / MonthlyTask / QuaterlyTask son subtipos de NDaysTask
// con nDays fijo (7 / 30 / 90). Cubrimos las fechas en que caen usando
// dayFromOrigin.

test('semanal: aplica cada 7 días desde el inicio', () => {
  const tarea = new WeeklyTask();
  tarea.Name = 'Revisión'; tarea.DaysFrom = 0;
  assert.deepEqual(diasActivos(tarea, 21), [0, 7, 14]);
});

test('mensual: aplica cada 30 días desde el inicio', () => {
  const tarea = new MonthlyTask();
  tarea.Name = 'Factura'; tarea.DaysFrom = 0;
  assert.deepEqual(diasActivos(tarea, 95), [0, 30, 60, 90]);
});

test('trimestral: aplica cada 90 días desde el inicio', () => {
  const tarea = new QuaterlyTask();
  tarea.Name = 'Revisión médica'; tarea.DaysFrom = 0;
  assert.deepEqual(diasActivos(tarea, 275), [0, 90, 180, 270]);
});

test('periodicidades predefinidas respetan daysFrom', () => {
  // La mensual empieza el día 5 desde el inicio, no el 0.
  const tarea = new MonthlyTask();
  tarea.Name = 'Cobro'; tarea.DaysFrom = 5;
  assert.deepEqual(diasActivos(tarea, 95), [5, 35, 65, 95].filter(d => d < 95));
});

// ── DaysOfWeekTask.setDay / unSetDay / hasDay ───────────────────────────
// El estado son flags de bits: marcar dos veces no debe cambiar nada,
// y desmarcar debe quitar el día (sin afectar a los demás).

test('DaysOfWeekTask: setDay marca un único día y hasDay lo refleja', () => {
  const t = new DaysOfWeekTask();
  assert.equal(t.hasDay(0), false);
  t.setDay(0);
  assert.equal(t.hasDay(0), true);
  assert.equal(t.hasDay(2), false);
});

test('DaysOfWeekTask: marcar dos veces el mismo día no cambia nada', () => {
  const t = new DaysOfWeekTask();
  t.setDay(2);
  const f1 = t.flags;
  t.setDay(2); // segunda vez
  t.setDay(2); // tercera vez
  assert.equal(t.flags, f1);
  assert.equal(t.hasDay(2), true);
});

test('DaysOfWeekTask: unSetDay quita el día y deja los demás intactos', () => {
  const t = new DaysOfWeekTask();
  t.setDay(0);
  t.setDay(2);
  t.setDay(4);
  t.unSetDay(2);
  assert.equal(t.hasDay(2), false);
  assert.equal(t.hasDay(0), true);
  assert.equal(t.hasDay(4), true);
});

test('DaysOfWeekTask: desmarcar un día que no estaba no hace nada', () => {
  const t = new DaysOfWeekTask();
  t.setDay(1);
  const f1 = t.flags;
  t.unSetDay(5); // no marcado
  assert.equal(t.flags, f1);
  assert.equal(t.hasDay(1), true);
});
