// T-062: la base común de las tarjetas.
//
// Aquí se comprueba lo que hace ui/base-card.js, que es lo que todas
// las tarjetas usan ahora:
//
//   1. `cargarFragmento` comprueba que la descarga sea OK (un asset que
//      falta no es un fragmento) y avisa en la vista: "No se pudo
//      cargar esta sección" en vez de dejar la vista en blanco.
//   2. Cada fragmento se descarga UNA sola vez por sesión (las 84
//      celdas de "Todas semanas" comparten la descarga).
//   3. Una tarjeta del mismo tipo comparte su etiqueta <style>: en
//      "Todas semanas" no se inyectan 96 etiquetas, sino una por tipo
//      de tarjeta.
//   4. Ninguna tarjeta hace `fetch` por su cuenta: solo la base
//      común descarga.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AVISO_CARGA,
  cargarFragmento,
  cargarFragmentos,
  inyectarHtml,
  limpiarCache,
  montarTarjeta,
} from '../../ui/base-card.js';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// ── Dobles mínimos del navegador ─────────────────────────────────────

/** Un `root` de mentira: solo lo que usa la base común.
 *
 *  Se parece al DOM en lo que importa aquí:
 *    - `innerHTML` es el contenido de la tarjeta: al reasignarlo se
 *      pierde lo que había dentro (como el <style> del CSS).
 *    - `querySelector('style')` devuelve el <style> del contenido, si
 *      lo hay, y `contains()` dice si un elemento está dentro.
 *    - `estado.conectado` permite simular que la tarjeta se ha quitado
 *      de la página (su <style> deja de estar en ella). */
function crearRaiz() {
  const estado = { conectado: true };
  const estilo = {
    get isConnected() {
      return estado.conectado && raiz.innerHTML.includes('<style>');
    },
  };
  const raiz = {
    estado,
    innerHTML: '',
    querySelector(sel) {
      if (sel !== 'style') return null;
      return this.innerHTML.includes('<style>') ? estilo : null;
    },
    contains(el) {
      return el === estilo && this.innerHTML.includes('<style>');
    },
  };
  return raiz;
}

/** Los recursos que la app puede descargar en esta prueba. */
const RECURSOS = {
  './ui/x/x-card.html': '<div class="x">hola</div>',
  './ui/x/x-card.css':  '.x { color: red; }',
  './ui/y/y-card.html': '<div class="y">adios</div>',
  './ui/y/y-card.css':  '.y { color: blue; }',
};

/** Las rutas que se han descargado en esta prueba. */
let descargas = [];

beforeEach(() => {
  limpiarCache();
  descargas = [];
  globalThis.fetch = async (url) => {
    descargas.push(url);
    const texto = RECURSOS[url];
    if (texto === undefined) {
      // Como un 404: la respuesta llega, pero no es un fragmento.
      return { ok: false, status: 404, text: async () => 'no encontrado' };
    }
    return { ok: true, status: 200, text: async () => texto };
  };
});

/** Cuántas veces se ha descargado `ruta`. */
const veces = (ruta) => descargas.filter(u => u === ruta).length;

// ── 1. La descarga se comprueba y el error se ve ──────────────────────

test('cargarFragmento devuelve el texto del fragmento', async () => {
  const texto = await cargarFragmento('./ui/x/x-card.html');
  assert.equal(texto, RECURSOS['./ui/x/x-card.html']);
});

test('si el asset no está (respuesta no OK), la vista avisa en vez de quedar en blanco', async () => {
  const raiz = crearRaiz();

  await assert.rejects(
    () => cargarFragmento('./ui/no-existe/no-existe.html', raiz),
    /no-existe/,
    'la descarga que no es OK tiene que lanzar un error',
  );

  // La vista no está en blanco: dice qué ha pasado.
  assert.match(raiz.innerHTML, /No se pudo cargar esta sección/);
  assert.match(raiz.innerHTML, /role="status"/);
  assert.equal(AVISO_CARGA, 'No se pudo cargar esta sección');
});

test('si la descarga falla, no se cachea: se puede reintentar', async () => {
  const raiz = crearRaiz();

  await assert.rejects(() => cargarFragmento('./ui/no-existe/no-existe.html', raiz));
  await assert.rejects(() => cargarFragmento('./ui/no-existe/no-existe.html', raiz));

  assert.equal(veces('./ui/no-existe/no-existe.html'), 2,
    'un fallo no se cachea: la segunda vez se vuelve a descargar');
});

test('cargarFragmentos avisa y devuelve null si algún fragmento falta', async () => {
  const raiz = crearRaiz();

  const partes = await cargarFragmentos(
    ['./ui/x/x-card.html', './ui/no-existe/no-existe.css'], raiz);

  assert.equal(partes, null);
  assert.match(raiz.innerHTML, /No se pudo cargar esta sección/);
});

// ── 2. Cada fragmento se descarga una sola vez ────────────────────────

test('cada ruta se descarga una sola vez por sesión', async () => {
  await cargarFragmento('./ui/x/x-card.html');
  await cargarFragmento('./ui/x/x-card.html');
  await cargarFragmento('./ui/x/x-card.css');

  assert.equal(veces('./ui/x/x-card.html'), 1);
  assert.equal(veces('./ui/x/x-card.css'), 1);
});

test('las tarjetas que piden el mismo fragmento a la vez comparten la descarga', async () => {
  // Las 84 celdas de "Todas semanas" piden lo mismo a la vez.
  await Promise.all([
    cargarFragmento('./ui/x/x-card.html'),
    cargarFragmento('./ui/x/x-card.html'),
    cargarFragmento('./ui/x/x-card.html'),
  ]);

  assert.equal(veces('./ui/x/x-card.html'), 1);
});

// ── 3. Una etiqueta <style> por tipo de tarjeta ──────────────────────

test('una tarjeta monta su HTML y su CSS', async () => {
  const raiz = crearRaiz();

  const html = await montarTarjeta(raiz, './ui/x/x-card.html', './ui/x/x-card.css');

  assert.equal(html, RECURSOS['./ui/x/x-card.html']);
  assert.match(raiz.innerHTML, /^<style>.*<\/style>/, 'el CSS no se ha inyectado');
  assert.match(raiz.innerHTML, /<div class="x">hola<\/div>$/, 'el HTML no se ha inyectado');
});

test('dos tarjetas del mismo tipo comparten la misma etiqueta <style>', async () => {
  const primera = crearRaiz();
  const segunda = crearRaiz();

  await montarTarjeta(primera, './ui/x/x-card.html', './ui/x/x-card.css');
  await montarTarjeta(segunda, './ui/x/x-card.html', './ui/x/x-card.css');

  const etiquetas = (primera.innerHTML + segunda.innerHTML).match(/<style>/g) ?? [];
  assert.equal(etiquetas.length, 1,
    'las dos tarjetas del mismo tipo no pueden inyectar dos <style>');
  // La segunda tarjeta no repite el CSS (el de la primera ya está en
  // la página), pero sí su HTML.
  assert.match(segunda.innerHTML, /<div class="x">hola<\/div>$/);
});

test('tarjetas de tipos distintos tienen su propia etiqueta <style>', async () => {
  const primera = crearRaiz();
  const segunda = crearRaiz();

  await montarTarjeta(primera, './ui/x/x-card.html', './ui/x/x-card.css');
  await montarTarjeta(segunda, './ui/y/y-card.html', './ui/y/y-card.css');

  const etiquetas = (primera.innerHTML + segunda.innerHTML).match(/<style>/g) ?? [];
  assert.equal(etiquetas.length, 2);
});

test('si la etiqueta <style> se queda fuera de la página, se vuelve a inyectar', async () => {
  const primera = crearRaiz();
  const segunda = crearRaiz();

  await montarTarjeta(primera, './ui/x/x-card.html', './ui/x/x-card.css');
  // La tarjeta que tenía el CSS se quita de la página.
  primera.estado.conectado = false;

  await montarTarjeta(segunda, './ui/x/x-card.html', './ui/x/x-card.css');

  assert.match(segunda.innerHTML, /^<style>/,
    'la tarjeta nueva tiene que traer el CSS otra vez');
});

test('al repintar una tarjeta, su CSS vuelve a inyectarse', async () => {
  const raiz = crearRaiz();

  await montarTarjeta(raiz, './ui/x/x-card.html', './ui/x/x-card.css');
  // La tarjeta se repinta: su contenido (con el <style> del CSS) se
  // sustituye. El CSS no puede quedarse en la tarjeta anterior: la
  // nueva se quedaría sin estilo.
  await montarTarjeta(raiz, './ui/x/x-card.html', './ui/x/x-card.css');

  assert.match(raiz.innerHTML, /^<style>.*<\/style>/,
    'la tarjeta repintada tiene que traer su CSS otra vez');
  assert.match(raiz.innerHTML, /<div class="x">hola<\/div>$/);
});

test('una tarjeta con estilo propio no lo comparte con las de su tipo', async () => {
  // El formulario de tarea está a la vez en el alta y en la edición:
  // cada una lleva su CSS (si compartieran el <style>, al vaciar uno de
  // los dos paneles el otro se quedaría sin estilo).
  const alta = crearRaiz();
  const edicion = crearRaiz();

  inyectarHtml(alta, '<p>alta</p>', ['./ui/x/x-card.css'], ['.x { color: red; }'], { propia: true });
  inyectarHtml(edicion, '<p>edición</p>', ['./ui/x/x-card.css'], ['.x { color: red; }'], { propia: true });

  assert.match(alta.innerHTML, /^<style>/, 'el alta tiene que llevar su CSS');
  assert.match(edicion.innerHTML, /^<style>/, 'la edición tiene que llevar su CSS');
});

test('si un fragmento falta, la tarjeta no se monta y la vista avisa', async () => {
  const raiz = crearRaiz();

  const html = await montarTarjeta(raiz, './ui/no-existe/no-existe.html', './ui/x/x-card.css');

  assert.equal(html, null);
  assert.match(raiz.innerHTML, /No se pudo cargar esta sección/);
  assert.doesNotMatch(raiz.innerHTML, /<style>/,
    'una tarjeta que no se ha montado no deja su CSS a medias');
});

test('inyectarHtml deja el HTML y el CSS de una tarjeta ya descargados', async () => {
  const raiz = crearRaiz();

  inyectarHtml(raiz, '<p>hola</p>', ['./ui/x/x-card.css'], ['.x { color: red; }']);

  assert.equal(raiz.innerHTML, '<style>.x { color: red; }</style><p>hola</p>');
});

// ── 4. Ninguna tarjeta hace fetch por su cuenta ──────────────────────

test('ninguna tarjeta hace fetch directo: solo la base común descarga', () => {
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
    const nombre = ruta.replace(`${RAIZ}/`, '');
    if (nombre === 'ui/base-card.js') continue;   // la base común es la que descarga
    const codigo = readFileSync(ruta, 'utf8');
    assert.doesNotMatch(codigo, /\bfetch\s*\(/,
      `${nombre} no puede hacer fetch: las plantillas se descargan con ui/base-card.js`);
  }
});
