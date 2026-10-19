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

// Cambio al horario de invierno (octubre): en Europe/Madrid el domingo
// 25/10/2026 se retrocede una hora, así que la semana del 19/10 mide
// 7 días + 1 h. El cálculo no debe añadir días fantasma ni pintar
// semanas de más, y los lunes deben seguir cayendo en lunes.
test('GetNWeeks: cruza el cambio de hora de octubre (invierno) sin desfase', () => {
  const from    = new Date(2026, 9, 19); // lunes 19/10/2026
  const lunes   = createDaysOfWeekTask('Gimnasio', [0]);
  const semanas = GetNWeeks(from, 3, 0, [lunes]);

  assert.equal(semanas.length, 3);

  const fechas = [
    new Date(2026, 9, 19),
    new Date(2026, 9, 26),
    new Date(2026, 10, 2),
  ];
  semanas.forEach((s, i) => mismoDia(s.mondayTo, fechas[i]));

  semanas.forEach(s =>
    assert.deepEqual(s.weekTasks[0].map(t => t.Name), ['Gimnasio'])
  );
});

// Cambio al horario de verano (marzo): el domingo 29/03/2026 se adelanta
// una hora, así que la semana del 23/03 mide 7 días − 1 h. Igual que el
// caso de octubre, no debe añadir ni quitar semanas.
test('GetNWeeks: cruza el cambio de hora de marzo (verano) sin desfase', () => {
  const from    = new Date(2026, 2, 23); // lunes 23/03/2026
  const lunes   = createDaysOfWeekTask('Gimnasio', [0]);
  const semanas = GetNWeeks(from, 3, 0, [lunes]);

  assert.equal(semanas.length, 3);

  const fechas = [
    new Date(2026, 2, 23),
    new Date(2026, 2, 30),
    new Date(2026, 3, 6),
  ];
  semanas.forEach((s, i) => mismoDia(s.mondayTo, fechas[i]));

  semanas.forEach(s =>
    assert.deepEqual(s.weekTasks[0].map(t => t.Name), ['Gimnasio'])
  );
});
