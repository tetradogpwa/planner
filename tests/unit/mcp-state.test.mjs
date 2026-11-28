// Pruebas del estado del servidor MCP que guarda el navegador
// (ui/mcp/mcp-state.js) y, en concreto, del puerto por defecto.
//
// El puerto por defecto (41237) está escrito en UN solo sitio:
// PUERTO_POR_DEFECTO, en ui/mcp/mcp-state.js. Aquí se vigila que:
//   * leer el estado sin nada guardado devuelve ese puerto (es el que
//     ve el usuario en el campo «Puerto» de Ajustes → Asistente (MCP)),
//   * el literal 41237 no aparece en ningún otro fichero del frontend,
//     para que el valor no se pueda desincronizar.
//
// La otra mitad del mismo criterio (el prefijo 'saved:') se vigila en
// tests/unit/preferences.test.mjs, donde vive SAVED_PREFIX.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leerEstadoMcp, PUERTO_POR_DEFECTO } from '../../ui/mcp/mcp-state.js';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Almacenamiento falso con la misma interfaz que `localStorage`. */
function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
  };
}

/** Los ficheros del frontend: `ui/` (con sus carpetas) e `index.js`. */
function ficherosFrontend() {
  const lista = [join(RAIZ, 'index.js')];
  const recorrer = directorio => {
    for (const nombre of readdirSync(directorio)) {
      const ruta = join(directorio, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else lista.push(ruta);
    }
  };
  recorrer(join(RAIZ, 'ui'));
  return lista;
}

// ── El puerto por defecto ───────────────────────────────────────────────

test('sin estado guardado, el estado trae el puerto por defecto', () => {
  const estado = leerEstadoMcp(almacenFalso());

  assert.equal(estado.enabled, false, 'sin estado guardado el MCP está apagado');
  assert.equal(estado.port, 41237, 'sin estado guardado el puerto es el de por defecto');
});

test('PUERTO_POR_DEFECTO es el puerto por defecto del servidor MCP', () => {
  assert.equal(PUERTO_POR_DEFECTO, 41237);
});

test('el puerto por defecto está escrito en un solo sitio', () => {
  // El frontend entero (ui/ e index.js) se busca el literal: solo puede
  // aparecer donde está la constante, para que cambiar el puerto
  // por defecto no deje medio app con el valor viejo.
  const donde = ficherosFrontend()
    .filter(ruta => readFileSync(ruta, 'utf8').includes('41237'))
    .map(ruta => relative(RAIZ, ruta));

  assert.deepEqual(donde, ['ui/mcp/mcp-state.js'],
    'el literal 41237 solo puede estar en ui/mcp/mcp-state.js');
});
