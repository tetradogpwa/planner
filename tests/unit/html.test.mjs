// T-042: el escapado de texto para interpolarlo en HTML.
// T-061: el escapado vive en un solo módulo (`ui/html.js`).
//
// El nombre de una tarea lo escribe el usuario (teclado, importado de
// un JSON o creado por un asistente vía MCP). Si ese texto entra sin
// escapar en un `innerHTML`, un `<img src=x onerror=…>` deja de ser
// texto y se convierte en una etiqueta viva con su manejador en línea
// en un WebView que tiene acceso a `window.__TAURI__`.
//
// Aquí se comprueba la utilidad compartida (`ui/html.js`) que usan
// las vistas al interpolar datos del usuario en HTML.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml, escapeAttr } from '../../ui/html.js';

/** Lo contrario de escapeHtml: deshace las entidades. Sirve para
 *  comprobar que el texto escaped sigue siendo el mismo. */
function desescapar(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|#96|#61);/g, (_, entidad) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#96': '`', '#61': '=',
  }[entidad]));
}

test('escapeHtml neutraliza el payload de XSS', () => {
  const escapado = escapeHtml('<img src=x onerror="window.__xss=1">');

  // Sin etiquetas ni atributos: el texto no puede abrir nada.
  assert.ok(!escapado.includes('<'), `quedan etiquetas sin escapar: ${escapado}`);
  assert.ok(!escapado.includes('>'), `quedan etiquetas sin escapar: ${escapado}`);
  assert.ok(!escapado.includes('"'), `quedan comillas sin escapar: ${escapado}`);
  assert.ok(!escapado.includes("'"), `quedan comillas sin escapar: ${escapado}`);
});

test('escapeHtml neutraliza también un payload con comillas simples', () => {
  const escapado = escapeHtml("<img src=x onerror='window.__xss=1'>");
  assert.ok(!escapado.includes('<'), `quedan etiquetas sin escapar: ${escapado}`);
  assert.ok(!escapado.includes("'"), `quedan comillas sin escapar: ${escapado}`);
});

test('escapeHtml escapa también el & (para no romper las entidades)', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml deja el texto intacto: se puede volver a leer', () => {
  const nombre = '<img src=x onerror="window.__xss=1">';
  assert.equal(desescapar(escapeHtml(nombre)), nombre);
});

test('escapeHtml no rompe el texto normal', () => {
  assert.equal(escapeHtml('Gimnasio'), 'Gimnasio');
  assert.equal(escapeHtml('Leer 20 minutos'), 'Leer 20 minutos');
  assert.equal(escapeHtml('Emoji 🏃'), 'Emoji 🏃');
});

test('escapeHtml trata lo que no es texto como texto vacío', () => {
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(null), '');
});

// ── escapeAttr: el valor de un atributo ───────────────────────────────

test('escapeAttr neutraliza el payload de XSS', () => {
  const escapado = escapeAttr('<img src=x onerror="window.__xss=1">');

  assert.ok(!escapado.includes('<'), `quedan etiquetas sin escapar: ${escapado}`);
  assert.ok(!escapado.includes('>'), `quedan etiquetas sin escapar: ${escapado}`);
  assert.ok(!escapado.includes('"'), `quedan comillas sin escapar: ${escapado}`);
  assert.ok(!escapado.includes("'"), `quedan comillas sin escapar: ${escapado}`);
});

test('escapeAttr escapa también el = y el acento grave (atributo sin comillas)', () => {
  // Sin comillas alrededor, un espacio o un signo igual abriría otro
  // atributo: por eso se escapan también.
  const escapado = escapeAttr('a=b `c`');
  assert.ok(!escapado.includes('='), `queda el signo igual sin escapar: ${escapado}`);
  assert.ok(!escapado.includes('`'), `queda el acento grave sin escapar: ${escapado}`);
});

test('escapeAttr deja el texto intacto: se puede volver a leer', () => {
  const valor = 'Gimnasio & "pesas"';
  assert.equal(desescapar(escapeAttr(valor)), valor);
});

test('escapeAttr escapa el & (para no romper las entidades)', () => {
  assert.equal(escapeAttr('a & b'), 'a &amp; b');
});

test('escapeAttr no rompe el texto normal', () => {
  assert.equal(escapeAttr('Gimnasio'), 'Gimnasio');
  assert.equal(escapeAttr('Leer 20 minutos'), 'Leer 20 minutos');
  assert.equal(escapeAttr('https://ejemplo.com/?a=1&b=2'),
    'https://ejemplo.com/?a&#61;1&amp;b&#61;2');
});

test('escapeAttr trata lo que no es texto como texto vacío', () => {
  assert.equal(escapeAttr(undefined), '');
  assert.equal(escapeAttr(null), '');
});
