// Pruebas del almacenamiento del token del servidor MCP (T-033).
//
// El token Bearer NO puede vivir en el navegador: lo genera y lo
// guarda la capa nativa (Rust) en un fichero con permisos 0600 dentro
// del directorio de datos de la app. En el `localStorage` del webview
// solo queda el interruptor y el puerto, que no son secretos.
//
// Estas pruebas vigilan que:
//   * el estado guardado en el navegador nunca lleve el token,
//   * el estado guardado por la versión anterior (que sí llevaba el
//     token en claro) se migre y se limpie al leerlo,
//   * el frontend pida el token a la capa nativa y no lo genere,
//   * la capa nativa lo guarde en un fichero con permisos 0600.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLAVE_ESTADO_MCP,
  guardarEstadoMcp,
  leerEstadoMcp,
} from '../../ui/mcp/mcp-state.js';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

/** Almacenamiento falso con la misma interfaz que `localStorage`. */
function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
    key: (i) => Object.keys(datos)[i] ?? null,
    get length() { return Object.keys(datos).length; },
  };
}

// ── El estado del navegador ───────────────────────────────────────────

test('el estado guardado en el navegador nunca lleva el token', () => {
  const almacen = almacenFalso();
  guardarEstadoMcp(
    { enabled: true, port: 41237, token: 'a'.repeat(64) },
    almacen,
  );
  const bruto = almacen.datos[CLAVE_ESTADO_MCP];
  assert.ok(!bruto.includes('a'.repeat(64)), 'el token no debe quedar en el almacenamiento');
  const guardado = JSON.parse(bruto);
  assert.deepEqual(Object.keys(guardado).sort(), ['enabled', 'port']);
  assert.equal(guardado.enabled, true);
  assert.equal(guardado.port, 41237);
});

test('leer el estado borra el token que guardó la versión anterior', () => {
  const tokenViejo = 'b'.repeat(64);
  const almacen = almacenFalso({
    [CLAVE_ESTADO_MCP]: JSON.stringify({ enabled: true, port: 42000, token: tokenViejo }),
  });

  const estado = leerEstadoMcp(almacen);
  assert.equal(estado.token, undefined, 'el token antiguo se ignora');
  assert.equal(estado.enabled, true);
  assert.equal(estado.port, 42000);

  // Y desaparece del almacenamiento (migración).
  const guardado = JSON.parse(almacen.datos[CLAVE_ESTADO_MCP]);
  assert.equal(guardado.token, undefined);
  assert.ok(!almacen.datos[CLAVE_ESTADO_MCP].includes(tokenViejo));
});

test('leer el estado aguanta un almacenamiento corrupto', () => {
  const almacen = almacenFalso({ [CLAVE_ESTADO_MCP]: 'esto no es json' });
  const estado = leerEstadoMcp(almacen);
  assert.equal(estado.enabled, false);
  assert.equal(estado.port, 41237);
});

test('leer el estado no toca el almacenamiento si no hay token antiguo', () => {
  const almacen = almacenFalso({
    [CLAVE_ESTADO_MCP]: JSON.stringify({ enabled: false, port: 41237 }),
  });
  const antes = almacen.datos[CLAVE_ESTADO_MCP];
  leerEstadoMcp(almacen);
  assert.equal(almacen.datos[CLAVE_ESTADO_MCP], antes);
});

// ── El frontend ───────────────────────────────────────────────────────

test('el frontend no genera el token ni lo guarda en el navegador', () => {
  const fuentes = [
    leer('ui', 'mcp', 'mcp-card.js'),
    leer('ui', 'mcp', 'mcp-state.js'),
    leer('index.js'),
  ].join('\n');

  assert.ok(
    !fuentes.includes('getRandomValues'),
    'el token no se genera en el navegador: lo genera la capa nativa',
  );
  assert.ok(
    !/setItem\([^)]*token/i.test(fuentes),
    'no se escribe un token en el almacenamiento del navegador',
  );
  // Se pide a la capa nativa, que es quien lo tiene.
  assert.ok(fuentes.includes("'mcp_token'"), 'el token se pide con invoke(\'mcp_token\')');
  assert.ok(
    fuentes.includes("'mcp_token_regenerate'"),
    'el token se regenera con invoke(\'mcp_token_regenerate\')',
  );
});

// ── La capa nativa ────────────────────────────────────────────────────

test('la capa nativa guarda el token en un fichero con permisos 0600', () => {
  const mcp = leer('src-tauri', 'src', 'mcp.rs');

  assert.ok(
    mcp.includes('app_data_dir()'),
    'el token se guarda en el directorio de datos de la app',
  );
  assert.ok(
    mcp.includes('0o600'),
    'el fichero del token se escribe con permisos 0600 (solo el usuario)',
  );
  assert.ok(
    mcp.includes('getrandom::fill'),
    'el token se genera con entropía criptográfica del sistema',
  );

  const lib = leer('src-tauri', 'src', 'lib.rs');
  assert.ok(lib.includes('mcp::mcp_token'), 'el comando mcp_token está registrado');
  assert.ok(
    lib.includes('mcp::mcp_token_regenerate'),
    'el comando mcp_token_regenerate está registrado',
  );
});
