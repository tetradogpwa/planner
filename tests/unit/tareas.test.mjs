// Pruebas de los tipos de repetición de back/ (sin DOM).
//
// Cada tarea guarda su fecha de inicio ABSOLUTA ('YYYY-MM-DD') y
// `thisDayHas` recibe una fecha real: la columna en la que sale una
// tarea depende del día de la semana de verdad, no del día en que se
// abrió la app.

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

const ISO = (dia) => `2026-06-${String(dia).padStart(2, '0')}`;

/** Días (0 = el lunes de inicio) en los que aplica la tarea. */
const diasActivos = (tarea, hasta = 21) =>
  Array.from({ length: hasta }, (_, d) => d)
    .filter(d => tarea.thisDayHas(new Date(2026, 5, 1 + d)));

test('diaria: aplica todos los días', () => {
  assert.deepEqual(diasActivos(createDailyTask('Agua', 1, ISO(1)), 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('cada N días: empieza en su fecha de inicio y repite cada N', () => {
  const tarea = createNDaysTask('Regar', 3, 1, ISO(3));
  assert.deepEqual(diasActivos(tarea, 12), [2, 5, 8, 11]);
});

test('días de la semana: solo los marcados (0 = lunes)', () => {
  const tarea = createDaysOfWeekTask('Gimnasio', [0, 2], 1, ISO(1));   // lunes y miércoles
  assert.deepEqual(diasActivos(tarea, 15), [0, 2, 7, 9, 14]);
});

test('días de la semana: no aplica antes de su fecha de inicio', () => {
  const tarea = createDaysOfWeekTask('Gimnasio', [0, 2], 1, ISO(8));
  assert.deepEqual(diasActivos(tarea, 15), [7, 9, 14]);
});

test('ciclo de semanas: alterna los días de cada semana y vuelve a empezar', () => {
  // Semana A: lunes. Semana B: martes y viernes.
  const tarea = createCycleDaysOfWeekTask('Turnos', [[0], [1, 4]], 1, ISO(1));
  assert.deepEqual(diasActivos(tarea, 21), [0, 8, 11, 14]);
});

test('una sola vez: solo la primera aparición de la tarea base', () => {
  const base  = createDaysOfWeekTask('Dentista', [2], 1, ISO(1));       // miércoles
  const tarea = createOneTimeTask(base, 1, ISO(1));
  assert.deepEqual(diasActivos(tarea, 21), [2]);
  assert.equal(tarea.Name, 'Dentista');
});

test('una sola vez: no vuelve a aparecer al día siguiente', () => {
  // Regresión (T-045): antes, la tarea "sin repetición" salía en la
  // misma columna todos los días.
  const tarea = createOneTimeTask(createDailyTask('Dentista', 1, ISO(3)), 1, ISO(3));
  assert.equal(tarea.thisDayHas(new Date(2026, 5, 3)), true);
  assert.equal(tarea.thisDayHas(new Date(2026, 5, 4)), false);
  assert.equal(tarea.thisDayHas(new Date(2026, 5, 10)), false);
});

test('ciclo vacío: no aplica ningún día y no peta', () => {
  // Regresión (R-32): con el ciclo vacío, buscar la semana del ciclo
  // devolvía undefined y la app se caía al pintar.
  const tarea = createCycleDaysOfWeekTask('Turnos', [], 1, ISO(1));
  assert.equal(tarea.Cicles.length, 0);
  assert.equal(tarea.thisDayHas(new Date(2026, 5, 3)), false);
});

// ── Periodicidades predefinidas de nDays.js ──────────────────────────────
// WeeklyTask / MonthlyTask / QuaterlyTask son subtipos de NDaysTask
// con nDays fijo (7 / 30 / 90). Cubrimos las fechas en que caen usando
// la fecha de inicio de cada tarea.

test('semanal: aplica cada 7 días desde el inicio', () => {
  const tarea = new WeeklyTask();
  tarea.Name = 'Revisión'; tarea.StartDate = ISO(1);
  assert.deepEqual(diasActivos(tarea, 21), [0, 7, 14]);
});

test('mensual: aplica cada 30 días desde el inicio', () => {
  const tarea = new MonthlyTask();
  tarea.Name = 'Factura'; tarea.StartDate = ISO(1);
  assert.deepEqual(diasActivos(tarea, 95), [0, 30, 60, 90]);
});

test('trimestral: aplica cada 90 días desde el inicio', () => {
  const tarea = new QuaterlyTask();
  tarea.Name = 'Revisión médica'; tarea.StartDate = ISO(1);
  assert.deepEqual(diasActivos(tarea, 275), [0, 90, 180, 270]);
});

test('periodicidades predefinidas respetan la fecha de inicio', () => {
  // La mensual empieza el 6 de junio, no el 1.
  const tarea = new MonthlyTask();
  tarea.Name = 'Cobro'; tarea.StartDate = ISO(6);
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
