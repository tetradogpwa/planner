// Pruebas de las direcciones públicas de los documentos legales
// (ui/legal/legal-urls.js).
//
// Este módulo es el ÚNICO sitio donde se definen las URL públicas que
// la app abre en el navegador del sistema. Las pruebas comprueban:
//   - que cada documento publicado tenga exactamente la URL pública
//     esperada (mismo nombre que el .md local, sin ".md", en la base
//     de GitHub Pages del proyecto);
//   - que THIRD_PARTY_LICENSES NO se publique (su copia local se
//     muestra siempre en el modal);
//   - que solo se acepten URL https.
//
// No imitamos la lógica: importamos el módulo real y leemos su
// salida.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  PUBLIC_BASE,
  PUBLIC_URLS,
  publicUrlFor,
  isHttpsUrl,
} = await import('../../ui/legal/legal-urls.js');

const BASE = 'https://gabrielcatdeveloper.github.io/papeleo/planner/';

/** Documentos que la app publica y abre en el navegador. */
const PUBLICADOS = [
  'PRIVACY',
  'TERMS',
  'EULA',
  'COOKIES',
  'ACCESSIBILITY',
  'ACCEPTABLE_USE',
  'DMCA',
  'CONTACT',
];

// ── 1. La base pública es la de GitHub Pages del proyecto ────────────

test('la base de las direcciones públicas es la del repositorio papeleo', () => {
  assert.equal(PUBLIC_BASE, BASE);
  assert.match(PUBLIC_BASE, /^https:\/\//);
});

// ── 2. Cada documento publicado tiene su URL exacta ─────────────────

test('cada documento publicado tiene la URL pública exacta', () => {
  for (const clave of PUBLICADOS) {
    assert.equal(
      publicUrlFor(clave),
      BASE + clave,
      `La URL de ${clave} no es la esperada`,
    );
  }
});

test('las URL públicas son las del mapa y no hay URL de más', () => {
  assert.deepEqual(
    Object.keys(PUBLIC_URLS).sort(),
    [...PUBLICADOS].sort(),
  );
});

test('las URL públicas no llevan la extensión .md', () => {
  for (const clave of PUBLICADOS) {
    assert.ok(!publicUrlFor(clave).endsWith('.md'), `${clave} conserva el .md`);
  }
});

// ── 3. THIRD_PARTY_LICENSES no se publica ───────────────────────────

test('THIRD_PARTY_LICENSES no tiene URL pública', () => {
  assert.equal(publicUrlFor('THIRD_PARTY_LICENSES'), null);
  assert.equal(PUBLIC_URLS.THIRD_PARTY_LICENSES, undefined);
});

// ── 4. Las claves desconocidas no tienen URL ─────────────────────────

test('una clave desconocida no devuelve URL', () => {
  assert.equal(publicUrlFor('NO_EXISTE'), null);
  assert.equal(publicUrlFor(''), null);
  assert.equal(publicUrlFor(undefined), null);
});

// ── 5. Solo se aceptan URL https ─────────────────────────────────────

test('isHttpsUrl acepta las URL públicas', () => {
  for (const clave of PUBLICADOS) {
    assert.equal(isHttpsUrl(publicUrlFor(clave)), true);
  }
});

test('isHttpsUrl rechaza lo que no es https', () => {
  const noHttps = [
    'http://gabrielcatdeveloper.github.io/papeleo/planner/PRIVACY',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<h1>hola</h1>',
    'ftp://example.com/PRIVACY',
    '',
    'no es una url',
    null,
    undefined,
    123,
  ];
  for (const url of noHttps) {
    assert.equal(isHttpsUrl(url), false, `No debería aceptar ${url}`);
  }
});
