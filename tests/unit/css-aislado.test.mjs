// T-063: el CSS de cada tarjeta va aislado.
//
// Cada tarjeta inyecta su CSS en el documento (una etiqueta <style> por
// tipo de tarjeta, en ui/base-card.js), así que las reglas de dos
// tarjetas conviven en la misma hoja de estilos. Si las dos nombran la
// misma clase, la que se inyectó después gana (misma especificidad,
// orden en el cascade) y el aspecto de la app depende del orden de
// navegación: eso era lo que pasaba con .switch, .slider y
// .switch-row, definidas en taskManager-card.css y en
// settings-card.css (el interruptor "Gestionar" cambiaba de aspecto
// según si se había pasado antes por Ajustes).
//
// Aquí no hay DOM: se miran los ficheros CSS que se empaquetan en la
// app y se comprueba que ninguna clase aparece en dos de ellos (ni en
// una tarjeta y en el CSS global), y que la regla global de `hidden`
// (que tiene que ganar a cualquier `display` que pongamos) está en el
// CSS global y no en una tarjeta.
//
// El aspecto de verdad se comprueba en los E2E
// (tests/e2e/specs/28-css-aislado.spec.mjs), que miden el interruptor
// antes y después de visitar Ajustes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Todos los ficheros CSS de las tarjetas (ui/**), en orden. */
function cssDeLasTarjetas() {
  const encontrados = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.name.endsWith('.css')) encontrados.push(ruta);
    }
  };
  recorrer(join(RAIZ, 'ui'));
  return encontrados.sort();
}

/** El CSS sin comentarios: los comentarios no son reglas. */
const sinComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '');

/** Los selectores de todas las reglas de un CSS. */
function selectoresDe(texto) {
  const selectores = [];
  for (const [, bruto] of sinComentarios(texto).matchAll(/([^{}]+)\{/g)) {
    const selector = bruto.trim();
    // Las reglas @media, @keyframes… no definen clases: dentro van
    // reglas normales, que se recogen por separado.
    if (selector.startsWith('@')) continue;
    for (const parte of selector.split(',')) {
      const limpio = parte.trim();
      if (limpio) selectores.push(limpio);
    }
  }
  return selectores;
}

/** Las clases que un CSS nombra (las que define y las que usa). */
function clasesDe(texto) {
  const clases = new Set();
  for (const selector of selectoresDe(texto)) {
    for (const clase of selector.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)) {
      clases.add(clase[1]);
    }
  }
  return clases;
}

test('ninguna clase aparece en dos tarjetas', () => {
  const porClase = new Map();
  for (const fichero of cssDeLasTarjetas()) {
    const nombre = relative(RAIZ, fichero);
    for (const clase of clasesDe(readFileSync(fichero, 'utf8'))) {
      if (!porClase.has(clase)) porClase.set(clase, []);
      porClase.get(clase).push(nombre);
    }
  }
  const repetidas = [...porClase.entries()]
    .filter(([, ficheros]) => ficheros.length > 1)
    .map(([clase, ficheros]) => `  .${clase} → ${ficheros.join(', ')}`)
    .sort();
  assert.deepEqual(
    repetidas, [],
    'Estas clases aparecen en más de una tarjeta. Cada tarjeta inyecta su CSS\n' +
    'en el documento, así que la que se inyecte después gana y el aspecto\n' +
    'depende del orden de navegación. Hay que usar un nombre propio por\n' +
    'tarjeta (o un componente compartido):\n' + repetidas.join('\n'),
  );
});

test('ninguna tarjeta nombra una clase que ya nombra el CSS global', () => {
  const global = readFileSync(join(RAIZ, 'index.css'), 'utf8');
  const delGlobal = clasesDe(global);
  const repites = [];
  for (const fichero of cssDeLasTarjetas()) {
    const nombre = relative(RAIZ, fichero);
    for (const clase of clasesDe(readFileSync(fichero, 'utf8'))) {
      if (delGlobal.has(clase)) repites.push(`  .${clase} → ${nombre}`);
    }
  }
  assert.deepEqual(
    repites.sort(), [],
    'Estas clases ya están en index.css: si una tarjeta las nombra otra vez,\n' +
    'su versión pisa la global (y al revés, según el orden de carga):\n' +
    repites.sort().join('\n'),
  );
});

test('la regla global de [hidden] está en index.css y en ninguna tarjeta', () => {
  // Sin ella, el atributo `hidden` solo funciona en las partes de la
  // app donde ninguna clase pone `display`: el resultado depende de
  // qué tarjeta se ha cargado antes.
  const global = readFileSync(join(RAIZ, 'index.css'), 'utf8');
  const reglaGlobal = selectoresDe(global).filter(s => s === '[hidden]');
  assert.equal(
    reglaGlobal.length, 1,
    'index.css tiene que tener la regla global `[hidden] { display: none !important; }`',
  );
  // Sin comentarios: un comentario que mencione la regla no es la
  // regla, así que el `!important` tiene que estar en el CSS de verdad.
  const sinComentario = sinComentarios(global);
  assert.match(
    sinComentario, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
    'la regla global de [hidden] tiene que ganar con !important a cualquier ' +
    '`display` que declare una clase',
  );
  // Y el `!important` tiene que estar DENTRO del bloque de la regla
  // (no en cualquier otro sitio del fichero).
  const bloque = sinComentario.match(/\[hidden\]\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(
    bloque, /display:\s*none\s*!important/,
    'el bloque de la regla global de [hidden] tiene que llevar ' +
    '`display: none !important` dentro, no fuera',
  );

  for (const fichero of cssDeLasTarjetas()) {
    const nombre = relative(RAIZ, fichero);
    const selectores = selectoresDe(readFileSync(fichero, 'utf8'));
    assert.ok(
      !selectores.includes('[hidden]'),
      `${nombre} no puede traer la regla global de [hidden]: es global, ` +
      'y por eso vive en index.css',
    );
  }
});
