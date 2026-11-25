// Pruebas del resumen legible de las tareas (back/taskSummary.js).
//
// El resumen es lo que la lista de tareas y la API muestran para decir
// cuándo se repite cada tarea. Antes, esa lista enseñaba el nombre de
// la clase ("WeeklyTask", "MonthlyTask", "QuaterlyTask",
// "LimitedTimeTask") o una etiqueta corta ("Días esp.", "Cada 3d") que
// no decía nada del ritmo.
//
// Aquí se comprueba el texto de cada tipo de tarea (incluidos los
// heredados) y que NINGÚN tipo muestre el nombre de su clase.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { taskSummary } from '../../back/taskSummary.js';
import {
  createDailyTask,
  createNDaysTask,
  createOneTimeTask,
  createDaysOfWeekTask,
  createCycleDaysOfWeekTask,
} from '../../back/taskFactory.js';
import { WeeklyTask, MonthlyTask, QuaterlyTask } from '../../back/nDays.js';
import { LimitedTimeTask } from '../../back/limitedTime.js';

// Fecha de inicio de todas las tareas de esta prueba: 25/11.
const INICIO = '2026-11-25';

/** Una tarea heredada (Weekly/Monthly/Quaterly) con nombre e inicio. */
const heredada = (Clase) => {
  const t = new Clase();
  t.Name = 'Revisión';
  t.StartDate = INICIO;
  return t;
};

// ── Cada tipo de tarea ──────────────────────────────────────────────────

test('diaria: "Diaria", y con varias veces al día, "Diaria · 3 veces"', () => {
  assert.equal(taskSummary(createDailyTask('Agua', 1, INICIO)), 'Diaria');
  assert.equal(taskSummary(createDailyTask('Agua', 3, INICIO)), 'Diaria · 3 veces');
});

test('cada N días: "Cada 3 días desde el 25/11"', () => {
  assert.equal(
    taskSummary(createNDaysTask('Regar', 3, 1, INICIO)),
    'Cada 3 días desde el 25/11',
  );
});

test('días de la semana: los nombres cortos de los días marcados', () => {
  // Lunes, miércoles y viernes (0 = lunes).
  assert.equal(
    taskSummary(createDaysOfWeekTask('Gimnasio', [0, 2, 4], 1, INICIO)),
    'Lun, Mié, Vie',
  );
  // Los días salen en el orden del calendario, no en el que se marcaron.
  assert.equal(
    taskSummary(createDaysOfWeekTask('Gimnasio', [4, 0], 1, INICIO)),
    'Lun, Vie',
  );
});

test('ciclo: "Ciclo de 2 semanas" (y "Ciclo de 1 semana")', () => {
  assert.equal(
    taskSummary(createCycleDaysOfWeekTask('Turnos', [[0], [4]], 1, INICIO)),
    'Ciclo de 2 semanas',
  );
  assert.equal(
    taskSummary(createCycleDaysOfWeekTask('Turnos', [[0]], 1, INICIO)),
    'Ciclo de 1 semana',
  );
});

test('una vez: "Una vez · 25/11"', () => {
  const tarea = createOneTimeTask(createDailyTask('Dentista', 1, INICIO), 1, INICIO);
  assert.equal(taskSummary(tarea), 'Una vez · 25/11');
});

// ── Los tipos heredados ─────────────────────────────────────────────────

test('semanal (heredado): "Cada 7 días desde el 25/11"', () => {
  assert.equal(taskSummary(heredada(WeeklyTask)), 'Cada 7 días desde el 25/11');
});

test('mensual (heredado): "Cada 30 días desde el 25/11"', () => {
  assert.equal(taskSummary(heredada(MonthlyTask)), 'Cada 30 días desde el 25/11');
});

test('trimestral (heredado): "Cada 90 días desde el 25/11"', () => {
  assert.equal(taskSummary(heredada(QuaterlyTask)), 'Cada 90 días desde el 25/11');
});

test('con número de repeticiones limitado: dice en cuál de ellas aparece', () => {
  const t = new LimitedTimeTask();
  t.Name = 'Dentista';
  t.StartDate = INICIO;
  t.Task = createDailyTask('Base', 1, INICIO);
  t.Repeat = 3;
  assert.equal(taskSummary(t), 'Solo la 3ª vez · 25/11');
});

// ── Ningún tipo muestra el nombre de la clase ──────────────────────────

test('ningún tipo de tarea muestra el nombre de su clase', () => {
  const tareas = [
    ['DailyTask',           createDailyTask('Agua', 1, INICIO)],
    ['NDaysTask',           createNDaysTask('Regar', 3, 1, INICIO)],
    ['DaysOfWeekTask',      createDaysOfWeekTask('Gimnasio', [0, 2, 4], 1, INICIO)],
    ['CiclesDaysOfWeekTask',createCycleDaysOfWeekTask('Turnos', [[0], [4]], 1, INICIO)],
    ['OneTimeTask',         createOneTimeTask(createDailyTask('Dentista', 1, INICIO), 1, INICIO)],
    ['WeeklyTask',          heredada(WeeklyTask)],
    ['MonthlyTask',         heredada(MonthlyTask)],
    ['QuaterlyTask',        heredada(QuaterlyTask)],
    ['LimitedTimeTask',     (() => {
      const t = new LimitedTimeTask();
      t.Name = 'Dentista';
      t.StartDate = INICIO;
      t.Task = createDailyTask('Base', 1, INICIO);
      t.Repeat = 2;
      return t;
    })()],
  ];

  for (const [clase, tarea] of tareas) {
    const resumen = taskSummary(tarea);
    assert.ok(resumen.length > 0, `${clase} se queda sin resumen`);
    assert.ok(!resumen.includes(clase), `${clase} aparece en su resumen: "${resumen}"`);
    assert.ok(!/Task/.test(resumen), `${clase} aparece en su resumen: "${resumen}"`);
  }
});

test('una tarea de un tipo desconocido no enseña el nombre de su clase', () => {
  // Ni una clase real ni un objeto con un `constructor` raro: el
  // resumen se queda vacío antes que mostrar "FooTask".
  class FooTask {}
  const t = new FooTask();
  assert.equal(taskSummary(t), '');
  assert.equal(taskSummary(null), '');
});
