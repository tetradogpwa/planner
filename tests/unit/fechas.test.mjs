// Pruebas del anclaje a fechas reales (T-045).
//
// Las tareas guardan su fecha de inicio absoluta y se colocan por la
// fecha real del día: la columna en la que sale depende del día de la
// semana de verdad y NO del día en que se abrió la app.
//
// Aquí el reloj se fija con `mock.timers` ("hoy" es el día que dice la
// prueba) para poder comprobar las dos cosas: que la tarea sale el día
// que se creó y que sigue ahí (en su columna) cuando pasan los días.

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { buildTaskFromSpec } from '../../back/taskSpec.js';
import { GetWeek, formatLocalDate } from '../../back/calendar.js';

// El aviso "The MockTimers API is an experimental feature" ensucia la
// salida del runner de pruebas. Lo callamos: aquí el reloj falso es
// justo lo que se quiere.
process.removeAllListeners('warning');

/** Congela el reloj en el día indicado (mes 1-12). */
const fijarReloj = (anio, mes, dia, hora = 10) =>
  mock.timers.enable({ apis: ['Date'], now: new Date(anio, mes - 1, dia, hora, 0, 0) });

const soltarReloj = () => mock.timers.reset();

/** Nombres de las tareas de cada día de la semana (lunes a domingo). */
const porDia = (semana) => semana.weekTasks.map(d => d.map(t => t.Name));

/** Fechas (ISO) en las que aplica la tarea entre dos fechas. */
const diasQueAplica = (tarea, desde, hasta) => {
  const salida = [];
  const d = new Date(desde);
  while (d.getTime() <= new Date(hasta).getTime()) {
    if (tarea.thisDayHas(d)) salida.push(formatLocalDate(d));
    d.setDate(d.getDate() + 1);
  }
  return salida;
};

test('una tarea sin repetición creada el 25/11 sale solo ese día, en la columna del miércoles', () => {
  fijarReloj(2026, 11, 25);   // miércoles
  try {
    const tarea = buildTaskFromSpec({ name: 'Dentista', repeat: 'none' });
    // Empieza el día en que se creó.
    assert.equal(tarea.StartDate, '2026-11-25');

    // La semana del lunes 23/11 al domingo 29/11: solo el miércoles.
    const semana = GetWeek(new Date(2026, 10, 25), 0, [tarea]);
    assert.deepEqual(porDia(semana), [
      [], [], ['Dentista'], [], [], [], [],
    ]);
  } finally {
    soltarReloj();
  }
});

test('al pasar "hoy" al 26/11, la tarea sigue el 25/11 y no caduca al día siguiente', () => {
  const tarea = buildTaskFromSpec({ name: 'Dentista', repeat: 'none', startDate: '2026-11-25' });

  fijarReloj(2026, 11, 26);   // jueves
  try {
    // La semana que se pinta es la del 23 al 29 de noviembre: la tarea
    // sigue en su columna (miércoles) y no se ha movido.
    const semana = GetWeek(new Date(2026, 10, 26), 0, [tarea]);
    assert.deepEqual(porDia(semana), [
      [], [], ['Dentista'], [], [], [], [],
    ]);

    // La semana siguiente ya no la tiene: una tarea "sin repetición"
    // no puede volver a salir (antes salía en la misma columna todos
    // los días).
    const siguiente = GetWeek(new Date(2026, 10, 26), 1, [tarea]);
    assert.deepEqual(siguiente.weekTasks.flat().map(t => t.Name), []);
  } finally {
    soltarReloj();
  }
});

test('"cada 3 días" empezando el 25/11 sale el 25, el 28 y el 1/12, se abra la app el día que se abra', () => {
  // La tarea se crea con el reloj en el 25/11: empieza ese día.
  fijarReloj(2026, 11, 25);
  let tarea;
  try {
    tarea = buildTaskFromSpec({ name: 'Regar', repeat: 'nDays', nDays: 3 });
    assert.equal(tarea.StartDate, '2026-11-25');
  } finally {
    soltarReloj();
  }

  // Da igual el día en que se abra la app: los días son los mismos.
  for (const dia of [25, 26, 27, 28, 30]) {
    fijarReloj(2026, 11, dia);
    try {
      const salida = diasQueAplica(tarea, new Date(2026, 10, 25), new Date(2026, 11, 1));
      assert.deepEqual(salida, ['2026-11-25', '2026-11-28', '2026-12-01'],
        `con el reloj en el ${dia}/11/2026`);
    } finally {
      soltarReloj();
    }
  }
});

test('una tarea de los lunes sale en la columna del lunes, se cree el día que se cree', () => {
  // Se crea un miércoles (25/11/2026) con los lunes marcados.
  const tarea = buildTaskFromSpec({
    name: 'Gimnasio', repeat: 'daysOfWeek', days: [0], startDate: '2026-11-25',
  });

  // En la semana del 23/11 el lunes es pasado: no sale.
  const primera = GetWeek(new Date(2026, 10, 23), 0, [tarea]);
  assert.deepEqual(porDia(primera), [[], [], [], [], [], [], []]);

  // En la semana del 30/11 sale en la columna del lunes (índice 0).
  const siguiente = GetWeek(new Date(2026, 10, 30), 0, [tarea]);
  assert.deepEqual(porDia(siguiente), [
    ['Gimnasio'], [], [], [], [], [], [],
  ]);
});

test('una tarea de los lunes creada un lunes sale ese mismo lunes', () => {
  const tarea = buildTaskFromSpec({
    name: 'Gimnasio', repeat: 'daysOfWeek', days: [0], startDate: '2026-11-23',
  });
  const semana = GetWeek(new Date(2026, 10, 23), 0, [tarea]);
  assert.deepEqual(porDia(semana), [
    ['Gimnasio'], [], [], [], [], [], [],
  ]);
});

test('un ciclo de semanas rota por semanas reales (lunes a domingo)', () => {
  // Ciclo de dos semanas: la primera, lunes y miércoles; la segunda,
  // viernes. La primera semana del ciclo es la que contiene la fecha
  // de inicio de la tarea.
  const tarea = buildTaskFromSpec({
    name: 'Turnos', repeat: 'cycle', cycle: [[0, 2], [4]], startDate: '2026-11-23',
  });

  const primera = GetWeek(new Date(2026, 10, 23), 0, [tarea]);
  assert.deepEqual(porDia(primera), [
    ['Turnos'], [], ['Turnos'], [], [], [], [],
  ]);

  const segunda = GetWeek(new Date(2026, 10, 23), 1, [tarea]);
  assert.deepEqual(porDia(segunda), [
    [], [], [], [], ['Turnos'], [], [],
  ]);

  // Y la tercera vuelve a la primera semana del ciclo.
  const tercera = GetWeek(new Date(2026, 10, 23), 2, [tarea]);
  assert.deepEqual(porDia(tercera), [
    ['Turnos'], [], ['Turnos'], [], [], [], [],
  ]);
});
