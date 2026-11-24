// Pruebas de back/dayNames.js: los nombres de los días de la semana
// viven en un único sitio (T-044) y en el orden del calendario del
// planificador (lunes el primero, domingo el último).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DAY_NAMES, DAY_NAMES_LONG } from '../../back/dayNames.js';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

test('DAY_NAMES: los siete días, con el lunes el primero', () => {
  assert.deepEqual(DAY_NAMES, ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
});

test('DAY_NAMES_LONG: los siete días, con el lunes el primero', () => {
  assert.deepEqual(DAY_NAMES_LONG,
    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
});

test('los nombres de los días solo se declaran en back/dayNames.js', () => {
  // Buscamos listas de días escritas a mano en todo el proyecto: si
  // aparece otra, la fuente de verdad está partida y las vistas pueden
  // mostrar nombres distintos.
  const IGNORAR = new Set([
    'node_modules', 'dist', 'vendor', 'logs', '.git', 'target', 'target-e2e',
  ]);
  const js = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR.has(entrada.name)) continue;
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.name.endsWith('.js')) js.push(ruta);
    }
  };
  recorrer(RAIZ);

  // Una lista de días empieza por 'Lunes' o por 'Lun' (con comillas).
  const listaDeDias = /\[\s*(['"])(Lunes|Lun)\1\s*,/;
  const declarados = js
    .filter(ruta => listaDeDias.test(readFileSync(ruta, 'utf8')))
    .map(ruta => relative(RAIZ, ruta));

  assert.deepEqual(declarados, ['back/dayNames.js']);
});
