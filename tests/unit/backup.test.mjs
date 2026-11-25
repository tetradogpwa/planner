// Pruebas de la copia de seguridad (back/backup.js, T-054).
//
// La copia tiene que guardar TODO lo que la app tiene: las tareas (con
// su id y su fecha de inicio), las marcas de «hecho», la fecha de
// inicio del planificador y las preferencias. Al importarla, la app
// tiene que quedar igual.
//
// La importación también acepta los formatos antiguos (un array de
// tareas o el envoltorio { tasks: [...] }) y dice cuántas tareas ha
// descartado por no reconocerlas.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_ID,
  BACKUP_VERSION,
  buildBackup,
  backupToJson,
  backupFileName,
  parseBackup,
} from '../../back/backup.js';
import { createDailyTask, createDaysOfWeekTask } from '../../back/taskFactory.js';
import { TaskBase } from '../../back/baseTarea.js';

const TAREAS = () => [
  createDailyTask('Agua', 2, '2026-06-01'),
  createDaysOfWeekTask('Gimnasio', [0, 2, 4], 1, '2026-06-01'),
];

// Las marcas de «hecho»: { <id de tarea>: { <fecha>: [<veces>] } }.
const MARCAS = {
  'tarea-agua':  { '2026-06-01': [0] },
  'tarea-gym':   { '2026-06-02': [0, 1] },
};

test('la copia dice quién la hizo, con qué versión y cuándo se hizo', () => {
  const copia = buildBackup({ tasks: TAREAS(), now: new Date('2026-11-25T10:00:00Z') });
  assert.equal(copia.app, APP_ID);
  assert.equal(copia.version, BACKUP_VERSION);
  assert.equal(copia.exportedAt, '2026-11-25T10:00:00.000Z');
});

test('la copia guarda las tareas con su tipo, su id y su fecha de inicio', () => {
  const tareas = TAREAS();
  const copia = buildBackup({ tasks: tareas });

  assert.equal(copia.tasks.length, 2);
  assert.equal(copia.tasks[0].className, 'DailyTask');
  assert.equal(copia.tasks[0].name, 'Agua');
  assert.equal(copia.tasks[0].total, 2);
  assert.equal(copia.tasks[0].id, tareas[0].Id);
  assert.equal(copia.tasks[0].startDate, '2026-06-01');
  assert.equal(copia.tasks[1].className, 'DaysOfWeekTask');
  assert.equal(copia.tasks[1].id, tareas[1].Id);
});

test('la copia guarda las marcas de «hecho»', () => {
  const copia = buildBackup({ tasks: TAREAS(), completions: MARCAS });
  assert.deepEqual(copia.completions, MARCAS);
});

test('la copia guarda la fecha de inicio del planificador y las preferencias', () => {
  const copia = buildBackup({
    tasks: TAREAS(),
    startDate: '2026-11-23',
    preferences: { theme: 'dark', textScale: 130 },
  });
  assert.equal(copia.startDate, '2026-11-23');
  assert.deepEqual(copia.preferences, { theme: 'dark', textScale: 130 });
});

test('ida y vuelta: las tareas vuelven iguales (tipo, nombre, id e inicio)', () => {
  const tareas = TAREAS();
  const leida = parseBackup(backupToJson({ tasks: tareas, completions: MARCAS }));

  assert.equal(leida.tareas.length, 2);
  assert.equal(leida.tareas[0].constructor.name, 'DailyTask');
  assert.equal(leida.tareas[0].Name, 'Agua');
  assert.equal(leida.tareas[0].Total, 2);
  assert.equal(leida.tareas[0].StartDate, '2026-06-01');
  assert.equal(leida.tareas[0].Id, tareas[0].Id);
  assert.equal(leida.tareas[1].Id, tareas[1].Id);
});

test('ida y vuelta: las marcas de «hecho» vuelven iguales', () => {
  const leida = parseBackup(backupToJson({ tasks: TAREAS(), completions: MARCAS }));
  assert.deepEqual(leida.completions, MARCAS);
});

test('ida y vuelta: la fecha de inicio y las preferencias vuelven iguales', () => {
  const leida = parseBackup(backupToJson({
    tasks: TAREAS(),
    startDate: '2026-11-23',
    preferences: { theme: 'dark', textScale: 130, sizes: { title: 150 } },
  }));
  assert.equal(leida.startDate, '2026-11-23');
  assert.deepEqual(leida.preferences, { theme: 'dark', textScale: 130, sizes: { title: 150 } });
});

test('un JSON antiguo (un array de tareas) se sigue importando', () => {
  const viejo = TaskBase.toJson(TAREAS());
  const leida = parseBackup(viejo);

  assert.equal(leida.tareas.length, 2);
  assert.equal(leida.tareas[0].Name, 'Agua');
  // Un archivo antiguo no trae marcas, ni fecha de inicio, ni preferencias.
  assert.equal(leida.completions, null);
  assert.equal(leida.startDate, null);
  assert.equal(leida.preferences, null);
});

test('un JSON antiguo con envoltorio { tasks: [...] } se sigue importando', () => {
  const viejo = JSON.stringify({ tasks: JSON.parse(TaskBase.toJson(TAREAS())) });
  const leida = parseBackup(viejo);
  assert.equal(leida.tareas.length, 2);
});

test('la importación dice cuántas tareas ha descartado', () => {
  const json = JSON.stringify([
    { className: 'TipoQueNoExiste', name: 'X' },
    { className: 'DailyTask', name: 'Agua', total: 1, startDate: '2026-06-01', nDays: 1 },
  ]);
  const leida = parseBackup(json);

  assert.equal(leida.tareas.length, 1);
  assert.equal(leida.descartadas, 1);
});

test('un JSON que no se puede leer lanza un error en vez de devolver nada', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.throws(() => parseBackup('{esto no es json'), /JSON inválido/);
});

test('un JSON sin lista de tareas lanza un error', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.throws(() => parseBackup('{"foo":1}'), /JSON inválido/);
});

test('el nombre del archivo lleva la fecha de la copia', () => {
  assert.equal(backupFileName(new Date(2026, 10, 25, 12, 0)), 'planificador-2026-11-25.json');
});
