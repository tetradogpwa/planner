// Pruebas del calendario (back/calendar.js): qué tareas caen en cada
// día de las semanas que pintan las vistas Semana y Vista completa.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getMondayOfWeek, GetNWeeks } from '../../back/calendar.js';
import { createDailyTask, createDaysOfWeekTask } from '../../back/taskFactory.js';

const mismoDia = (a, b) => assert.equal(a.toDateString(), b.toDateString());

test('getMondayOfWeek: de miércoles y de domingo vuelve al lunes', () => {
  mismoDia(getMondayOfWeek(new Date(2026, 5, 3)), new Date(2026, 5, 1));   // miércoles
  mismoDia(getMondayOfWeek(new Date(2026, 5, 7)), new Date(2026, 5, 1));   // domingo
  mismoDia(getMondayOfWeek(new Date(2026, 5, 1)), new Date(2026, 5, 1));   // lunes
});

test('GetNWeeks: una semana de 7 días con las tareas de cada día', () => {
  const from   = new Date(2026, 5, 1);
  const diaria = createDailyTask('Agua');
  const lunes  = createDaysOfWeekTask('Gimnasio', [0]);

  const semanas = GetNWeeks(from, 1, 0, [diaria, lunes]);
  assert.equal(semanas.length, 1);

  const { mondayTo, weekTasks } = semanas[0];
  mismoDia(mondayTo, from);
  assert.equal(weekTasks.length, 7);
  assert.deepEqual(weekTasks.map(dia => dia.map(t => t.Name)), [
    ['Agua', 'Gimnasio'], ['Agua'], ['Agua'], ['Agua'], ['Agua'], ['Agua'], ['Agua'],
  ]);
});

test('GetNWeeks: saltar semanas empieza en el lunes correcto', () => {
  const from    = new Date(2026, 5, 1);
  const semanas = GetNWeeks(from, 2, 1, [createDaysOfWeekTask('Gimnasio', [0])]);

  assert.equal(semanas.length, 2);
  mismoDia(semanas[0].mondayTo, new Date(2026, 5, 8));
  mismoDia(semanas[1].mondayTo, new Date(2026, 5, 15));
  semanas.forEach(s => assert.deepEqual(s.weekTasks[0].map(t => t.Name), ['Gimnasio']));
});
