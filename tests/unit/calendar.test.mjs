// Pruebas del calendario (back/calendar.js): qué tareas caen en cada
// día de las semanas que pintan las vistas Semana y Vista completa.
//
// Las tareas se colocan por su fecha de inicio real (no por un offset
// respecto a un origen): la columna en la que sale depende del día de
// la semana de verdad.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getMondayOfWeek,
  GetNWeeks,
  GetWeek,
  getDiffWeeks,
  getLastDayOfMonth,
  getWeeksInMonth,
  weekdayIndex,
} from '../../back/calendar.js';
import { createDailyTask, createDaysOfWeekTask } from '../../back/taskFactory.js';

const mismoDia = (a, b) => assert.equal(a.toDateString(), b.toDateString());

test('getMondayOfWeek: de miércoles y de domingo vuelve al lunes', () => {
  mismoDia(getMondayOfWeek(new Date(2026, 5, 3)), new Date(2026, 5, 1));   // miércoles
  mismoDia(getMondayOfWeek(new Date(2026, 5, 7)), new Date(2026, 5, 1));   // domingo
  mismoDia(getMondayOfWeek(new Date(2026, 5, 1)), new Date(2026, 5, 1));   // lunes
});

test('weekdayIndex: el orden de la interfaz es lunes (0) … domingo (6)', () => {
  // 23/11/2026 es lunes; el 29/11/2026 es domingo.
  assert.equal(weekdayIndex(new Date(2026, 10, 23)), 0);
  assert.equal(weekdayIndex(new Date(2026, 10, 25)), 2);   // miércoles
  assert.equal(weekdayIndex(new Date(2026, 10, 29)), 6);   // domingo
});

test('GetNWeeks: una semana de 7 días con las tareas de cada día', () => {
  const from   = new Date(2026, 5, 1);
  const diaria = createDailyTask('Agua', 1, '2026-06-01');
  const lunes  = createDaysOfWeekTask('Gimnasio', [0], 1, '2026-06-01');

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
  const semanas = GetNWeeks(from, 2, 1, [createDaysOfWeekTask('Gimnasio', [0], 1, '2026-06-01')]);

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
  const lunes   = createDaysOfWeekTask('Gimnasio', [0], 1, '2026-10-19');
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
  const lunes   = createDaysOfWeekTask('Gimnasio', [0], 1, '2026-03-23');
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

// ── GetWeek: la semana real (lunes a domingo) ────────────────────────────
// El origen de las semanas es la fecha que se le pasa, pero los días
// tienen su fecha real: la semana del lunes 23/11/2026 va del 23 al 29
// de noviembre, sin importar qué día sea el origen.

test('GetWeek: la semana va del lunes al domingo de verdad', () => {
  // Miércoles 25/11/2026.
  const { mondayTo, weekTasks } = GetWeek(new Date(2026, 10, 25), 0, []);
  mismoDia(mondayTo, new Date(2026, 10, 23));
  assert.equal(weekTasks.length, 7);
});

test('GetWeek: una tarea de los lunes sale en la columna del lunes', () => {
  // La tarea se creó un miércoles (25/11/2026), así que el lunes de
  // esa semana (23/11) ya es pasado: no sale. El siguiente lunes (30/11)
  // sí.
  const tarea = createDaysOfWeekTask('Gimnasio', [0], 1, '2026-11-25');

  const primera = GetWeek(new Date(2026, 10, 25), 0, [tarea]);
  assert.deepEqual(primera.weekTasks.map(d => d.map(t => t.Name)), [
    [], [], [], [], [], [], [],
  ]);

  const siguiente = GetWeek(new Date(2026, 10, 25), 1, [tarea]);
  assert.deepEqual(siguiente.weekTasks[0].map(t => t.Name), ['Gimnasio']);
  assert.deepEqual(siguiente.weekTasks.slice(1).map(d => d.map(t => t.Name)), [
    [], [], [], [], [], [],
  ]);
});

// ── getDiffWeeks ─────────────────────────────────────────────────────────
// Redondea hacia arriba la diferencia en días dividida por 7 (un día de
// más ya suma una semana). Usa meses de junio para evitar el cambio de
// hora de marzo/octubre.

test('getDiffWeeks: misma fecha vale 0', () => {
  const d = new Date(2026, 5, 15);
  assert.equal(getDiffWeeks(d, d), 0);
});

test('getDiffWeeks: lunes a lunes siguiente (7 días) cuenta 1 semana', () => {
  assert.equal(getDiffWeeks(new Date(2026, 5, 1), new Date(2026, 5, 8)), 1);
});

test('getDiffWeeks: un día de más ya cuenta como una semana', () => {
  // Lunes 1/6 → lunes 15/6 son exactamente 14 días → ceil(14/7)=2.
  assert.equal(getDiffWeeks(new Date(2026, 5, 1), new Date(2026, 5, 15)), 2);
});

test('getDiffWeeks: semanas exactas y diferencias grandes', () => {
  assert.equal(getDiffWeeks(new Date(2026, 5, 1), new Date(2026, 5, 8)), 1);   // 1 semana
  assert.equal(getDiffWeeks(new Date(2026, 5, 1), new Date(2026, 5, 29)), 4);  // 4 semanas
  assert.equal(getDiffWeeks(new Date(2026, 5, 1), new Date(2026, 7, 30)), 13); // ~3 meses
});

test('getDiffWeeks: es simétrico (no le importa el orden)', () => {
  const a = new Date(2026, 5, 1);
  const b = new Date(2026, 5, 22); // 21 días → 3 semanas
  assert.equal(getDiffWeeks(a, b), getDiffWeeks(b, a));
});

// ── getLastDayOfMonth ────────────────────────────────────────────────────
// Fecha de junio para evitar el cambio de hora (las pruebas usan meses
// con 30/31 días) y un caso en febrero de 2028, año bisiesto (29 días).

test('getLastDayOfMonth: junio (30 días) y julio (31 días) de 2026', () => {
  mismoDia(getLastDayOfMonth(new Date(2026, 5, 15)), new Date(2026, 5, 30));
  mismoDia(getLastDayOfMonth(new Date(2026, 6,  1)), new Date(2026, 6, 31));
});

test('getLastDayOfMonth: no muta la fecha original', () => {
  const original = new Date(2026, 5, 15);
  const copia    = new Date(original);
  getLastDayOfMonth(original);
  mismoDia(original, copia);
});

test('getLastDayOfMonth: febrero de 2028 es bisiesto (29 días)', () => {
  mismoDia(getLastDayOfMonth(new Date(2028, 1,  1)), new Date(2028, 1, 29));
});

test('getLastDayOfMonth: febrero de 2026 no es bisiesto (28 días)', () => {
  // 2026 no es bisiesto → 28 días (regresión para distinguir del 2028).
  mismoDia(getLastDayOfMonth(new Date(2026, 1,  1)), new Date(2026, 1, 28));
});

// ── getWeeksInMonth ──────────────────────────────────────────────────────
// Junio de 2026 empieza en lunes (1/6) y termina el miércoles 30/6:
// semana 1 = 1–7, semana 2 = 8–14, semana 3 = 15–21, semana 4 = 22–28,
// semana 5 = 29–30. Cualquier día del mes devuelve 5 semanas (ceil(29/7)).

test('getWeeksInMonth: junio de 2026 (empieza en lunes) da 5 semanas', () => {
  assert.equal(getWeeksInMonth(new Date(2026, 5,  1)), 5);
  assert.equal(getWeeksInMonth(new Date(2026, 5, 15)), 5);
});

test('getWeeksInMonth: julio de 2026 también da 5 semanas', () => {
  // 1/7/2026 cae en miércoles; semana 1 empieza el 29/6 fuera del mes.
  assert.equal(getWeeksInMonth(new Date(2026, 6,  1)), 5);
});

test('getWeeksInMonth: depende del mes, no del día de la fecha', () => {
  const a = new Date(2026, 5,  1);
  const b = new Date(2026, 5, 30);
  assert.equal(getWeeksInMonth(a), getWeeksInMonth(b));
});
