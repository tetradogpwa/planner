// T-053: deshacer los borrados.
//
// En la interfaz, borrar ya no es irreversible: sale un aviso con un
// botón «Deshacer». Aquí se comprueban las dos cosas de las que depende:
//
//   1. Que en ui/ no queda ningún confirm(): el que había usaba el
//      diálogo del navegador, que no se puede tematizar, no avisa a los
//      lectores de pantalla y no deja volver atrás.
//
//   2. Que la foto de una tarea (context.js) permite devolverla a la
//      lista tal como estaba: en su posición, con su id y con sus
//      marcas de «hecho».
//
// Sin DOM: simulamos un localStorage mínimo, como en marcas.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** localStorage mínimo basado en Map: suficiente para context.js. */
class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k)    { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear()       { this.m.clear(); }
  key(i)        { return [...this.m.keys()][i] ?? null; }
  get length()  { return this.m.size; }
}

globalThis.localStorage = new MemoryStorage();

const { Context } = await import('../../context.js');
const { buildTaskFromSpec } = await import('../../back/taskSpec.js');

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Una tarea nueva, con su id. */
const tarea = (nombre) => buildTaskFromSpec({ name: nombre, repeat: 'daily' });

// ── 1. Ni un confirm() en la interfaz (T-053) ──────────────────────────────

test('no queda ningún confirm() en ui/', () => {
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
    assert.doesNotMatch(codigo, /\bconfirm\s*\(/,
      `${ruta.replace(`${RAIZ}/`, '')} no puede llamar a confirm(): el borrado se confirma con el diálogo propio de la app y se puede deshacer`);
  }
});

// ── 2. La foto de una tarea y su restauración ─────────────────────────────

test('la foto de una tarea guarda su id, su posición y sus marcas de «hecho»', () => {
  const a = tarea('A');
  const b = tarea('B');
  Context.Tasks = [a, b];
  Context.Mark(b.Id, '2026-11-25', 0);

  const foto = Context.FotoTarea(b.Id);
  assert.ok(foto, 'la foto de una tarea que existe se hace');
  assert.equal(foto.posicion, 1, 'la foto guarda la posición que tenía');
  assert.deepEqual(foto.marcas[b.Id], { '2026-11-25': [0] },
    'la foto guarda las marcas de «hecho» de la tarea');
});

test('deshacer el borrado devuelve la tarea a su posición, con su id y sus marcas', () => {
  const a = tarea('A');
  const b = tarea('B');
  const c = tarea('C');
  Context.Tasks = [a, b, c];
  Context.Mark(b.Id, '2026-11-25', 0);
  Context.Mark(b.Id, '2026-11-26', 1);

  // Se borra la del medio, como hace la vista Tareas.
  const foto = Context.FotoTarea(b.Id);
  Context.Tasks.splice(1, 1);
  Context.ClearMarks(b.Id);

  assert.equal(Context.Tasks.length, 2);
  assert.equal(Context.IsMarked(b.Id, '2026-11-25', 0), false,
    'al borrar la tarea, sus marcas se van con ella');

  // Y se deshace.
  const restaurada = Context.RestaurarTarea(foto);

  assert.ok(restaurada, 'la tarea se ha restaurado');
  assert.equal(Context.Tasks.length, 3);
  assert.equal(Context.Tasks[1].Name, 'B', 'vuelve a SU posición');
  assert.equal(Context.Tasks[1].Id, b.Id, 'vuelve con SU id');
  assert.equal(Context.IsMarked(b.Id, '2026-11-25', 0), true, 'vuelve con sus marcas');
  assert.equal(Context.IsMarked(b.Id, '2026-11-26', 1), true);
});

test('la foto de una tarea que no existe es null', () => {
  Context.Tasks = [tarea('A')];
  assert.equal(Context.FotoTarea('no-existe'), null);
});

test('deshacer un borrado no pisa las tareas que siguen ahí', () => {
  const a = tarea('A');
  const b = tarea('B');
  Context.Tasks = [a, b];

  const foto = Context.FotoTarea(a.Id);
  Context.Tasks.splice(0, 1);

  // Mientras el aviso está en pantalla, el usuario crea otra tarea.
  const c = tarea('C');
  Context.Tasks.push(c);

  Context.RestaurarTarea(foto);

  assert.equal(Context.Tasks.length, 3);
  assert.equal(Context.Tasks[0].Name, 'A');
  assert.equal(Context.Tasks[1].Name, 'B');
  assert.equal(Context.Tasks[2].Name, 'C');
});

// ── 3. La foto de todas las tareas («Borrar todo») ────────────────────────

test('deshacer «Borrar todo» devuelve todas las tareas, con su id y sus marcas', () => {
  const a = tarea('A');
  const b = tarea('B');
  Context.Tasks = [a, b];
  Context.Mark(a.Id, '2026-11-25', 0);
  Context.Mark(b.Id, '2026-11-26', 0);

  const foto = Context.FotoTodas();

  // Se borra todo.
  Context.Tasks.length = 0;
  Context.ClearAllMarks();
  assert.equal(Context.Tasks.length, 0);
  assert.equal(Context.IsMarked(a.Id, '2026-11-25', 0), false);

  // Y se deshace.
  Context.RestaurarTodas(foto);

  assert.equal(Context.Tasks.length, 2);
  assert.equal(Context.Tasks[0].Name, 'A');
  assert.equal(Context.Tasks[1].Name, 'B');
  assert.equal(Context.Tasks[0].Id, a.Id, 'vuelven con SU id');
  assert.equal(Context.Tasks[1].Id, b.Id);
  assert.equal(Context.IsMarked(a.Id, '2026-11-25', 0), true, 'vuelven con sus marcas');
  assert.equal(Context.IsMarked(b.Id, '2026-11-26', 0), true);
});
