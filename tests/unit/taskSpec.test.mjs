// Pruebas de back/taskSpec.js: la construcción de tareas a partir de un
// spec JSON plano y la serialización plana. Sin DOM ni estado global:
// el módulo se importa y se usa tal cual (como lo usan los formularios
// de alta y edición y la API pública).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTaskFromSpec,
  parseDay,
  parseDayArray,
  parseCycle,
  taskToJson,
} from '../../back/taskSpec.js';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

// ── parseDay ────────────────────────────────────────────────────────────

test('parseDay: acepta los días del 0 al 6', () => {
  for (let d = 0; d <= 6; d++) assert.equal(parseDay(d), d);
});

test('parseDay: rechaza lo que no es un día de la semana', () => {
  assert.equal(parseDay(-1), null);
  assert.equal(parseDay(7), null);
  assert.equal(parseDay(1.5), null);
  assert.equal(parseDay('x'), null);
  assert.equal(parseDay(undefined), null);
  assert.equal(parseDay(NaN), null);
});

// ── parseDayArray ───────────────────────────────────────────────────────

test('parseDayArray: devuelve los días en número', () => {
  assert.deepEqual(parseDayArray([0, 2, 6]), [0, 2, 6]);
  assert.deepEqual(parseDayArray([]), []);
});

test('parseDayArray: un array vacío vale, pero no un día repetido ni uno inválido', () => {
  assert.equal(parseDayArray([1, 1]), null);
  assert.equal(parseDayArray([0, 7]), null);
  assert.equal(parseDayArray('no-array'), null);
  assert.equal(parseDayArray(undefined), null);
});

// ── parseCycle ──────────────────────────────────────────────────────────

test('parseCycle: devuelve el ciclo cuando hay días', () => {
  assert.deepEqual(parseCycle([[0], []]), { cycle: [[0], []] });
});

test('parseCycle: avisa de por qué no cuadra', () => {
  assert.deepEqual(parseCycle([]),       { reason: 'empty' });
  assert.deepEqual(parseCycle('nada'),   { reason: 'empty' });
  assert.deepEqual(parseCycle([[], []]),  { reason: 'allEmpty' });
  assert.deepEqual(parseCycle([[0], [7]]), { reason: 'invalid', index: 1 });
});

// ── buildTaskFromSpec: un tipo de repetición cada uno ───────────────────

test('buildTaskFromSpec: "none" crea una OneTimeTask con su DailyTask dentro', () => {
  const task = buildTaskFromSpec({ name: 'Una vez', repeat: 'none', total: 2, startDate: '2026-06-03' });
  assert.equal(task.constructor.name, 'OneTimeTask');
  assert.equal(task.Name, 'Una vez');
  assert.equal(task.Total, 2);
  assert.equal(task.StartDate, '2026-06-03');
  assert.equal(task.Task.constructor.name, 'DailyTask');
  // La tarea base empieza el mismo día que la tarea.
  assert.equal(task.Task.StartDate, '2026-06-03');
});

test('buildTaskFromSpec: "daily" crea una DailyTask', () => {
  const task = buildTaskFromSpec({ name: 'Agua', repeat: 'daily', total: 3, startDate: '2026-06-01' });
  assert.equal(task.constructor.name, 'DailyTask');
  assert.equal(task.Name, 'Agua');
  assert.equal(task.Total, 3);
  assert.equal(task.StartDate, '2026-06-01');
});

test('buildTaskFromSpec: "nDays" crea una NDaysTask con su intervalo', () => {
  const task = buildTaskFromSpec({ name: 'Regar', repeat: 'nDays', nDays: 5, startDate: '2026-06-03' });
  assert.equal(task.constructor.name, 'NDaysTask');
  assert.equal(task.NDays, 5);
  assert.equal(task.StartDate, '2026-06-03');
});

test('buildTaskFromSpec: "daysOfWeek" marca solo los días indicados', () => {
  const task = buildTaskFromSpec({ name: 'Gym', repeat: 'daysOfWeek', days: [0, 2] });
  assert.equal(task.constructor.name, 'DaysOfWeekTask');
  assert.equal(task.hasDay(0), true);
  assert.equal(task.hasDay(2), true);
  assert.equal(task.hasDay(1), false);
  assert.equal(task.hasDay(6), false);
});

test('buildTaskFromSpec: "cycle" guarda una semana por cada elemento del ciclo', () => {
  const task = buildTaskFromSpec({ name: 'Turnos', repeat: 'cycle', cycle: [[0, 1], []] });
  assert.equal(task.constructor.name, 'CiclesDaysOfWeekTask');
  assert.equal(task.Cicles.length, 2);
  assert.equal(task.Cicles[0].hasDay(0), true);
  assert.equal(task.Cicles[0].hasDay(1), true);
  assert.equal(task.Cicles[1].hasDay(0), false);
});

// ── buildTaskFromSpec: un mensaje por cada error ───────────────────────

test('buildTaskFromSpec: un spec que no es un objeto', () => {
  assert.throws(() => buildTaskFromSpec(null),   /Especificación de tarea inválida/);
  assert.throws(() => buildTaskFromSpec('hola'), /Especificación de tarea inválida/);
  assert.throws(() => buildTaskFromSpec(42),     /Especificación de tarea inválida/);
});

test('buildTaskFromSpec: nombre vacío', () => {
  assert.throws(() => buildTaskFromSpec({ repeat: 'daily' }),       /Nombre requerido/);
  assert.throws(() => buildTaskFromSpec({ name: '   ', repeat: 'daily' }), /Nombre requerido/);
});

test('buildTaskFromSpec: total inválido', () => {
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'daily', total: 0 }),   /Total inválido/);
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'daily', total: 1.5 }), /Total inválido/);
});

test('buildTaskFromSpec: daysFrom inválido', () => {
  // Un daysFrom tiene que ser un número entero de días. Un negativo
  // sí es válido: significa "antes de la fecha de inicio del
  // planificador" (es lo que devuelve la API cuando daysFrom es un
  // valor derivado de la fecha de inicio real de la tarea).
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'daily', daysFrom: 1.5 }), /daysFrom inválido/);
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'daily', daysFrom: 'dos' }), /daysFrom inválido/);
});

test('buildTaskFromSpec: startDate inválido', () => {
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'daily', startDate: '2026-02-31' }),
    /Fecha de inicio inválida/);
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'daily', startDate: '31-02-2026' }),
    /Fecha de inicio inválida/);
});

test('buildTaskFromSpec: sin fecha de inicio, la tarea empieza hoy', () => {
  const task = buildTaskFromSpec({ name: 'X', repeat: 'daily' });
  assert.match(task.StartDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('buildTaskFromSpec: daysFrom se acepta por compatibilidad (origen + días)', () => {
  // El formato viejo guardaba un offset respecto al origen del
  // planificador; con el origen del 23/11/2026, 2 días son el 25/11.
  const task = buildTaskFromSpec(
    { name: 'X', repeat: 'daily', daysFrom: 2 },
    { origin: '2026-11-23' },
  );
  assert.equal(task.StartDate, '2026-11-25');
});

test('buildTaskFromSpec: un daysFrom negativo es una fecha antes del origen', () => {
  const task = buildTaskFromSpec(
    { name: 'X', repeat: 'daily', daysFrom: -3 },
    { origin: '2026-11-23' },
  );
  assert.equal(task.StartDate, '2026-11-20');
});

test('buildTaskFromSpec: si viene startDate, manda sobre daysFrom', () => {
  const task = buildTaskFromSpec(
    { name: 'X', repeat: 'daily', startDate: '2026-11-25', daysFrom: 2 },
    { origin: '2026-11-23' },
  );
  assert.equal(task.StartDate, '2026-11-25');
});

test('buildTaskFromSpec: nDays inválido', () => {
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'nDays', nDays: 1 }), /nDays inválido/);
});

test('buildTaskFromSpec: daysOfWeek sin días', () => {
  assert.throws(
    () => buildTaskFromSpec({ name: 'X', repeat: 'daysOfWeek', days: [] }),
    /Selecciona al menos un día/,
  );
  assert.throws(
    () => buildTaskFromSpec({ name: 'X', repeat: 'daysOfWeek' }),
    /Selecciona al menos un día/,
  );
});

test('buildTaskFromSpec: cycle sin semanas', () => {
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'cycle', cycle: [] }),
    /Añade al menos una semana al ciclo/);
});

test('buildTaskFromSpec: cycle con todas las semanas vacías', () => {
  assert.throws(
    () => buildTaskFromSpec({ name: 'X', repeat: 'cycle', cycle: [[], [], []] }),
    /Marca al menos un día en el ciclo/,
  );
});

test('buildTaskFromSpec: cycle con un día que no existe', () => {
  assert.throws(
    () => buildTaskFromSpec({ name: 'X', repeat: 'cycle', cycle: [[0], [7]] }),
    /Días de ciclo inválidos/,
  );
});

test('buildTaskFromSpec: tipo de repetición inválido', () => {
  assert.throws(() => buildTaskFromSpec({ name: 'X', repeat: 'semanal' }), /Tipo de repetición inválido/);
  assert.throws(() => buildTaskFromSpec({ name: 'X' }),                    /Tipo de repetición inválido/);
});

test('buildTaskFromSpec: una semana de descanso en el ciclo sí vale', () => {
  // Regresión: la versión anterior rechazaba semanas vacías.
  const task = buildTaskFromSpec({ name: 'T', repeat: 'cycle', cycle: [[0], []] });
  assert.equal(task.constructor.name, 'CiclesDaysOfWeekTask');
});

// ── taskToJson ──────────────────────────────────────────────────────────

test('taskToJson: cada tipo de repetición vuelve a su forma plana', () => {
  assert.equal(taskToJson(buildTaskFromSpec({ name: 'A', repeat: 'none' })).repeat, 'none');
  assert.equal(taskToJson(buildTaskFromSpec({ name: 'A', repeat: 'daily' })).repeat, 'daily');

  const nDays = taskToJson(buildTaskFromSpec({ name: 'A', repeat: 'nDays', nDays: 4 }));
  assert.equal(nDays.repeat, 'nDays');
  assert.equal(nDays.nDays, 4);

  const dow = taskToJson(buildTaskFromSpec({ name: 'A', repeat: 'daysOfWeek', days: [0, 2] }));
  assert.equal(dow.repeat, 'daysOfWeek');
  assert.deepEqual(dow.days, [0, 2]);

  const cycle = taskToJson(buildTaskFromSpec({ name: 'A', repeat: 'cycle', cycle: [[1], []] }));
  assert.equal(cycle.repeat, 'cycle');
  assert.deepEqual(cycle.cycle, [[1], []]);
});

test('taskToJson: devuelve los datos planos y deja el índice para el llamador', () => {
  const json = taskToJson(buildTaskFromSpec({ name: 'Agua', repeat: 'daily', total: 3, startDate: '2026-06-03' }));
  assert.equal(json.name, 'Agua');
  assert.equal(json.total, 3);
  assert.equal(json.startDate, '2026-06-03');
  assert.equal(json.index, -1);
  // Sin clases: es JSON plano y se puede serializar sin perder nada.
  assert.deepEqual(JSON.parse(JSON.stringify(json)), json);
});

test('taskToJson: con origen, devuelve también los días desde el origen (formato viejo)', () => {
  const json = taskToJson(
    buildTaskFromSpec({ name: 'Agua', repeat: 'daily', startDate: '2026-11-25' }),
    '2026-11-23',
  );
  assert.equal(json.daysFrom, 2);
  assert.equal(json.startDate, '2026-11-25');
});

test('taskToJson: el daysFrom se DERIVA del origen, no es un dato de la tarea', () => {
  const tarea = buildTaskFromSpec({ name: 'Agua', repeat: 'daily', startDate: '2026-11-25' });

  // El mismo origen: el daysFrom es el mismo.
  assert.equal(taskToJson(tarea, '2026-11-23').daysFrom, 2);

  // Si el origen se mueve, el daysFrom cambia (es un valor derivado
  // del origen actual) pero la fecha de inicio de la tarea no: el
  // dato que manda es `startDate`.
  const movido = taskToJson(tarea, '2026-11-26');
  assert.equal(movido.startDate, '2026-11-25');
  assert.equal(movido.daysFrom, -1);

  // Y el daysFrom derivado se puede volver a pasar a la API: la API
  // acepta los negativos (una tarea puede empezar antes del origen).
  const vuelta = buildTaskFromSpec(
    { name: 'Agua', repeat: 'daily', daysFrom: movido.daysFrom },
    { origin: '2026-11-26' },
  );
  assert.equal(vuelta.StartDate, '2026-11-25');
});

// ── La construcción de tareas no vive en api.js ────────────────────────

test('ninguna tarjeta de ui/ construye tareas importando de api.js', () => {
  const ui = join(RAIZ, 'ui');
  const js = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.name.endsWith('.js')) js.push(ruta);
    }
  };
  recorrer(ui);

  const tarjetas = [];
  for (const ruta of js) {
    const texto = readFileSync(ruta, 'utf8');
    // Una tarjeta que importa de api.js solo puede usar la fachada
    // (PlannerApi) o los eventos (emitChanged), nunca la construcción.
    const importa = texto.match(/import\s*\{([^}]*)\}\s*from\s*'[^']*api\.js'/);
    if (!importa) continue;
    const nombres = importa[1].split(',').map(s => s.trim());
    if (nombres.some(n => /buildTaskFromSpec|parseDay|parseDayArray|parseCycle|taskToJson/.test(n))) {
      tarjetas.push(relative(RAIZ, ruta));
    }
  }
  assert.deepEqual(tarjetas, []);
});
