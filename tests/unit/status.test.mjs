// Pruebas de las funciones puras de tools/tasks/status.mjs.
//
// Solo se prueban aquí las funciones que NO tocan el árbol real
// (filtros y secuencias ANSI). Lo que lee git, pgrep o el registro
// de MiniMax es side-effect y se cubre con el uso manual.
//
// Importante: la lógica de la CLI está aislada al final del módulo
// detrás de un chequeo de import.meta.url, así que importar este
// módulo NO ejecuta la CLI ni deja ticks programados.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isCurrent,
  currentTasks,
  redrawPrefix,
  lineCount,
} from '../../tools/tasks/status.mjs';

const T = (id, status) => ({ id, status });

test('isCurrent: en_curso y en_revision son actuales', () => {
  assert.equal(isCurrent(T('T-1', 'en_curso')), true);
  assert.equal(isCurrent(T('T-2', 'en_revision')), true);
});

test('isCurrent: pendiente, hecha y cancelada NO son actuales', () => {
  assert.equal(isCurrent(T('T-1', 'pendiente')), false);
  assert.equal(isCurrent(T('T-1', 'hecha')), false);
  assert.equal(isCurrent(T('T-1', 'cancelada')), false);
});

test('isCurrent: tolera tareas sin status o nulas', () => {
  assert.equal(isCurrent(null), false);
  assert.equal(isCurrent({}), false);
  assert.equal(isCurrent({ id: 'T-1' }), false);
});

test('currentTasks: solo deja en_curso y en_revision, en su orden', () => {
  const tasks = [
    T('T-1', 'hecha'),
    T('T-2', 'pendiente'),
    T('T-3', 'en_curso'),
    T('T-4', 'cancelada'),
    T('T-5', 'en_revision'),
  ];
  assert.deepEqual(currentTasks(tasks).map(t => t.id), ['T-3', 'T-5']);
});

test('currentTasks: vacío si no hay tareas actuales', () => {
  assert.deepEqual(currentTasks([T('T-1', 'hecha'), T('T-2', 'pendiente')]), []);
});

test('currentTasks: entrada vacía no rompe', () => {
  assert.deepEqual(currentTasks([]), []);
});

test('redrawPrefix: vacío en el primer print (prev=0)', () => {
  // En el primer tick no hay bloque anterior que borrar; emitir la
  // secuencia igualmente haría parpadear la pantalla.
  assert.equal(redrawPrefix(0), '');
});

test('redrawPrefix: sube N líneas y borra hasta el final', () => {
  // ANSI: ESC[<n>A sube el cursor <n> líneas; ESC[J borra de ahí al
  // final de la pantalla. Es lo que usamos para "machacar" el bloque
  // anterior sin tener que limpiar todo el terminal.
  assert.equal(redrawPrefix(5), '\x1b[5A\x1b[J');
  assert.equal(redrawPrefix(12), '\x1b[12A\x1b[J');
});

test('lineCount: cuenta líneas de un texto terminado en \\n', () => {
  // El '\n' final solo mueve el cursor a la línea siguiente, no añade
  // una línea de contenido propia.
  assert.equal(lineCount('a\n'), 1);
  assert.equal(lineCount('a\nb\n'), 2);
  assert.equal(lineCount('a\nb\nc\n'), 3);
});

test('lineCount: cadena vacía y "solo \\n"', () => {
  assert.equal(lineCount(''), 0);
  assert.equal(lineCount('\n'), 1);
});