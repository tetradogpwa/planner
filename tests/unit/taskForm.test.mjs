// T-047: el formulario de tarea es un módulo compartido por el alta y
// la edición.
//
// Antes de esta tarea el alta (addTask-card) y la edición
// (editTask-card) tenían cada una su copia del formulario: el CSS de
// la edición dependía del del alta y necesitaba 21 `!important` para
// imponerse. Aquí se comprueba el contrato del módulo compartido:
//
//   1. Los ids del formulario salen del prefijo de la tarjeta: sin
//      prefijo, los del alta (taskName, timesPerDay…); con "edit", los
//      de la edición (editTaskName, editTimesPerDay…).
//   2. Las dos tarjetas usan ese módulo y ninguna tiene su propia
//      copia del formulario.
//   3. El CSS de la edición no depende del del alta: ni un solo
//      `!important` ni una mención a las clases de la otra tarjeta.
//   4. Las clases del formulario (form-group, repeat-option, cycle-week…)
//      están en el CSS del módulo compartido, no en el de las tarjetas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { idsDelFormulario } from '../../ui/taskManager/taskForm/taskForm-card.js';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

// ── 1. Los ids salen del prefijo ───────────────────────────────────────────

test('sin prefijo, el formulario usa los ids del alta', () => {
  assert.deepEqual(idsDelFormulario(''), {
    nameId:        'taskName',
    timesId:       'timesPerDay',
    dateId:        'taskDate',
    errorId:       'taskError',
    formId:        'taskForm',
    repeatLabelId: 'repeatLabel',
    extraId:       'extraOptions',
    intervalId:    'interval',
    repeatName:    'repeat',
  });
});

test('con prefijo "edit", el formulario usa los ids de la edición', () => {
  assert.deepEqual(idsDelFormulario('edit'), {
    nameId:        'editTaskName',
    timesId:       'editTimesPerDay',
    dateId:        'editTaskDate',
    errorId:       'editTaskError',
    formId:        'editTaskForm',
    repeatLabelId: 'editRepeatLabel',
    extraId:       'editExtraOptions',
    intervalId:    'editInterval',
    repeatName:    'edit-repeat',
  });
});

// ── 2. Las dos tarjetas usan el módulo ─────────────────────────────────────

test('las dos tarjetas usan el módulo compartido, sin copia propia', () => {
  const tarjetas = [
    ['alta',    leer('ui', 'taskManager', 'addTask', 'addTask-card.js')],
    ['edición', leer('ui', 'taskManager', 'editTask', 'editTask-card.js')],
  ];

  for (const [nombre, js] of tarjetas) {
    assert.match(js, /import\s*\{\s*TaskForm\s*\}\s*from\s*'\.\.\/taskForm\/taskForm-card\.js'/,
      `la tarjeta de ${nombre} tiene que usar el módulo compartido del formulario`);
    assert.doesNotMatch(js, /dayCheckboxes|renderExtra\(|#buildSpec/,
      `la tarjeta de ${nombre} no puede tener su propia copia del formulario`);
  }
});

// ── 3. El CSS de la edición no depende del del alta ────────────────────────

test('el CSS de la edición no usa !important ni las clases del alta', () => {
  const css = leer('ui', 'taskManager', 'editTask', 'editTask-card.css');
  // Los comentarios no cuentan: el fichero puede hablar de
  // `!important` sin usarlo.
  const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const importantes = reglas.match(/!important/g) ?? [];
  assert.equal(importantes.length, 0,
    `el CSS de la edición no necesita \`!important\` (hay ${importantes.length})`);

  assert.doesNotMatch(reglas, /add-task-card|#addTaskBtn/,
    'el CSS de la edición no puede depender del CSS del alta');
});

// ── 4. Las clases del formulario viven en el CSS compartido ────────────────

test('las clases del formulario las define el CSS del módulo compartido', () => {
  const compartido = leer('ui', 'taskManager', 'taskForm', 'taskForm-card.css');
  const alta       = leer('ui', 'taskManager', 'addTask', 'addTask-card.css');
  const edicion    = leer('ui', 'taskManager', 'editTask', 'editTask-card.css');

  for (const clase of ['.form-group', '.repeat-option', '.day-toggle',
                       '.cycle-week', '.extra-interval']) {
    assert.ok(compartido.includes(clase),
      `el CSS del módulo compartido tiene que definir ${clase}`);
    assert.ok(!alta.includes(clase),
      `el CSS del alta no tiene que redefinir ${clase}`);
    assert.ok(!edicion.includes(clase),
      `el CSS de la edición no tiene que redefinir ${clase}`);
  }
});

// ── 5. El formulario es un <form> con campo de fecha (T-048) ───────────────

test('la plantilla del formulario es un <form> con el campo de fecha', () => {
  const html = leer('ui', 'taskManager', 'taskForm', 'taskForm-card.html');

  // Un <form> de verdad: es lo que hace que Enter en el nombre envíe la
  // tarea (y que el botón pueda ser type="submit").
  assert.match(html, /<form[^>]*class="task-form"/);
  assert.match(html, /<\/form>/);

  // El campo de fecha, con su etiqueta (los dos con marcador: el módulo
  // los sustituye por los ids de cada instancia).
  assert.match(html, /<label for="\{\{dateId\}\}"/);
  assert.match(html, /<input type="date" id="\{\{dateId\}\}"/);

  // La región del error de validación, junto al campo del nombre.
  assert.match(html, /id="\{\{errorId\}\}"[^>]*role="alert"/);
});

test('los botones de alta y de edición son type="submit" de su formulario', () => {
  const alta    = leer('ui', 'taskManager', 'addTask', 'addTask-card.html');
  const edicion = leer('ui', 'taskManager', 'editTask', 'editTask-card.html');

  assert.match(alta, /<button id="addTaskBtn" type="submit"/,
    'el botón de añadir tiene que ser type="submit"');
  assert.match(edicion, /<button id="saveEditBtn"[^>]*type="submit"/,
    'el botón de guardar tiene que ser type="submit"');
});

test('la fecha la lee el formulario, no el llamante', () => {
  // El llamante no puede pasar la fecha: buildSpec() no la recibe.
  const form = leer('ui', 'taskManager', 'taskForm', 'taskForm-card.js');
  assert.match(form, /buildSpec\(\)/,
    'buildSpec no puede recibir la fecha del llamante');

  for (const [nombre, js] of [
    ['alta',    leer('ui', 'taskManager', 'addTask', 'addTask-card.js')],
    ['edición', leer('ui', 'taskManager', 'editTask', 'editTask-card.js')],
  ]) {
    assert.doesNotMatch(js, /buildSpec\s*\(/,
      `la tarjeta de ${nombre} no puede pasar la fecha al formulario`);
  }
});

// ── 6. Ni un alert() en la interfaz (T-048) ─────────────────────────────────

test('no queda ningún alert() en ui/', () => {
  const ficheros = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.name.endsWith('.js')) ficheros.push(ruta);
    }
  };
  recorrer(join(RAIZ, 'ui'));

  assert.ok(ficheros.length > 0, 'no se ha encontrado ningún .js en ui/');
  for (const ruta of ficheros) {
    const codigo = readFileSync(ruta, 'utf8');
    assert.doesNotMatch(codigo, /\balert\s*\(/,
      `${ruta.replace(`${RAIZ}/`, '')} no puede llamar a alert(): los errores se muestran junto al campo`);
  }
});
