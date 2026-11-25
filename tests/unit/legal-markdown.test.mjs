// T-061: el renderizador de Markdown de los textos legales.
//
// Los textos legales se muestran como HTML (son archivos .md que van
// dentro de la app). El renderizador es propio, sin dependencias, y
// por eso hay que probarlo: un fallo aquí no rompe la app, pero puede
// enseñar HTML en pantalla o dejar un enlace que ejecuta código.
//
// Lo que se comprueba:
//   · Las piezas de Markdown: títulos, énfasis, listas, tablas, código
//     y enlaces.
//   · La seguridad: el texto se escapa, la URL del enlace se escapa
//     para el atributo y los enlaces `javascript:` no son enlaces.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown } from '../../ui/legal/legal-markdown.js';

/** Deshace las entidades HTML: lo que el navegador leería al leer el
 *  atributo (o el texto). */
function desescapar(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|#96|#61);/g, (_, entidad) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#96': '`', '#61': '=',
  }[entidad]));
}

/** El valor del atributo `href` del primer enlace del HTML. */
function href(html) {
  return /href="([^"]*)"/.exec(html)?.[1];
}

// ── Las piezas de Markdown ────────────────────────────────────────────

test('los títulos se convierten en su etiqueta', () => {
  assert.match(renderMarkdown('# Título'),       /<h1>Título<\/h1>/);
  assert.match(renderMarkdown('## Subtítulo'),   /<h2>Subtítulo<\/h2>/);
  assert.match(renderMarkdown('### Tercero'),     /<h3>Tercero<\/h3>/);
  assert.match(renderMarkdown('#### Cuarto'),     /<h4>Cuarto<\/h4>/);
});

test('la negrita y la cursiva se convierten', () => {
  assert.match(renderMarkdown('**negrita**'), /<strong>negrita<\/strong>/);
  assert.match(renderMarkdown('*cursiva*'),   /<em>cursiva<\/em>/);
});

test('las listas con viñetas se convierten en <ul>', () => {
  const html = renderMarkdown('- uno\n- dos');
  assert.match(html, /<ul><li>uno<\/li><li>dos<\/li><\/ul>/);
});

test('las listas numeradas se convierten en <ol>', () => {
  const html = renderMarkdown('1. uno\n2. dos');
  assert.match(html, /<ol><li>uno<\/li><li>dos<\/li><\/ol>/);
});

test('el código en bloque va en <pre><code>', () => {
  const html = renderMarkdown('```\nconst a = 1;\n```');
  assert.match(html, /<pre><code>const a = 1;<\/code><\/pre>/);
});

test('el código en bloque escapa el HTML que lleva dentro', () => {
  const html = renderMarkdown('```\n<script>alert(1)</script>\n```');
  assert.ok(!html.includes('<script>'), `queda HTML sin escapar: ${html}`);
  assert.match(html, /&lt;script&gt;/);
});

test('las tablas se convierten en <table> con cabecera y filas', () => {
  const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n');
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody>/);
});

test('una tabla sin fila de alineación no se convierte en tabla', () => {
  const html = renderMarkdown('| A | B |\n| 1 | 2 |\n');
  assert.ok(!html.includes('<table>'), `se ha inventado una tabla: ${html}`);
});

test('el separador horizontal se convierte en <hr>', () => {
  assert.match(renderMarkdown('---'), /<hr>/);
});

test('los párrafos se separan y las líneas sueltas llevan <br>', () => {
  const html = renderMarkdown('uno\ndos\n\ntres');
  assert.match(html, /<p>uno<br>dos<\/p>/);
  assert.match(html, /<p>tres<\/p>/);
});

// ── Los enlaces ───────────────────────────────────────────────────────

test('un enlace https se convierte en <a> con rel y target', () => {
  const html = renderMarkdown('[texto](https://ejemplo.com)');
  assert.match(html,
    /<a href="https:\/\/ejemplo\.com" rel="noopener noreferrer" target="_blank">texto<\/a>/);
});

test('un enlace mailto: es un enlace', () => {
  const html = renderMarkdown('[correo](mailto:hola@ejemplo.com)');
  assert.equal(href(html), 'mailto:hola@ejemplo.com');
});

test('una ruta relativa es un enlace', () => {
  const html = renderMarkdown('[sección](#privacidad)');
  assert.equal(href(html), '#privacidad');
});

test('el texto del enlace se escapa', () => {
  const html = renderMarkdown('[<img src=x onerror=alert(1)>](https://ejemplo.com)');
  assert.ok(!html.includes('<img'), `queda HTML sin escapar: ${html}`);
  assert.match(html, /&lt;img/);
});

// ── La seguridad de las URLs ──────────────────────────────────────────

test('una URL con comillas no rompe el atributo href', () => {
  const html = renderMarkdown('[x](https://ejemplo.com/?a="b")');
  const valor = href(html);
  assert.ok(valor, `el enlace no tiene href: ${html}`);
  // El valor del atributo no puede traer una comilla suelta: si la
  // trajo, el atributo se cerraría antes de tiempo y el resto de la
  // URL se convertiría en atributos inventados.
  assert.ok(!valor.includes('"'), `la URL rompe el atributo: ${valor}`);
  // Y lo que se lee es la URL entera.
  assert.equal(desescapar(valor), 'https://ejemplo.com/?a="b"');
});

test('una URL con & no rompe el atributo href', () => {
  const html = renderMarkdown('[x](https://ejemplo.com/?a=1&b=2)');
  assert.equal(desescapar(href(html)), 'https://ejemplo.com/?a=1&b=2');
});

test('un enlace javascript: no es un enlace', () => {
  const html = renderMarkdown('[click](javascript:alert(1))');
  assert.ok(!html.includes('<a'), `el enlace javascript: se ha convertido en un <a>: ${html}`);
  assert.ok(!html.includes('javascript:'), `la URL javascript: sigue en el HTML: ${html}`);
  // El texto se sigue enseñando: el documento se puede leer.
  assert.match(html, /click/);
});

test('un javascript: disfrazado tampoco es un enlace', () => {
  const urls = [
    'JaVaScRiPt:alert(1)',        // mayúsculas y minúsculas mezcladas
    ' javascript:alert(1)',       // un espacio delante
    'java\tscript:alert(1)',      // un tabulador en medio
    'java\nscript:alert(1)',      // un salto de línea en medio
  ];
  for (const url of urls) {
    const html = renderMarkdown(`[click](${url})`);
    assert.ok(!html.includes('<a'),
      `el enlace ${JSON.stringify(url)} se ha convertido en un <a>: ${html}`);
    assert.ok(!html.includes('alert(1)'),
      `la URL ${JSON.stringify(url)} sigue en el HTML: ${html}`);
  }
});

test('los demás esquemas peligrosos tampoco son enlaces', () => {
  const urls = [
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ];
  for (const url of urls) {
    const html = renderMarkdown(`[x](${url})`);
    assert.ok(!html.includes('<a'),
      `el enlace ${JSON.stringify(url)} se ha convertido en un <a>: ${html}`);
  }
});

// ── El texto del documento ────────────────────────────────────────────

test('el HTML del documento se escapa', () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>'), `queda HTML sin escapar: ${html}`);
  assert.match(html, /&lt;script&gt;/);
});

test('los ampersandes del documento se escapan', () => {
  assert.match(renderMarkdown('Fisher & Price'), /Fisher &amp; Price/);
});

// ── Los casos raros ───────────────────────────────────────────────────

test('un documento vacío no da error', () => {
  // Sin texto: lo que se ve en pantalla está vacío.
  assert.equal(renderMarkdown('').replace(/<[^>]+>/g, ''), '');
  assert.equal(renderMarkdown(undefined).replace(/<[^>]+>/g, ''), '');
});

test('un enlace sin URL no es un enlace', () => {
  const html = renderMarkdown('[texto]()');
  assert.ok(!html.includes('<a'), `el enlace vacío se ha convertido en un <a>: ${html}`);
  assert.match(html, /texto/);
});
