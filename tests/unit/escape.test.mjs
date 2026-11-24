// T-042: el escapado de texto para interpolarlo en HTML.
//
// El nombre de una tarea lo escribe el usuario (teclado, importado de
// un JSON o creado por un asistente vía MCP). Si ese texto entra sin
// escapar en un `innerHTML`, un `<img src=x onerror=…>` deja de ser
// texto y se convierte en una etiqueta viva con su manejador en línea
// en un WebView que tiene acceso a `window.__TAURI__`.
//
// Aquí se comprueba la utilidad compartida (`ui/escape.js`) que usan
// las vistas al interpolar datos del usuario en HTML.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml } from '../../ui/escape.js';

/** Lo contrario de escapeHtml: deshace las entidades. Sirve para
 *  comprobar que el texto escaped sigue siendo el mismo. */
function desescapar(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, entidad) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
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
