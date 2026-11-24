// Pruebas unitarias del puente MCP (mcp-bridge.js). Sin DOM ni
// Tauri: importamos `handleMcpCall` (exportado por el bridge) y le
// inyectamos un stub de PlannerApi. Así verificamos que el código
// REAL del bridge enruta cada tool a su método y que los errores se
// devuelven como `{ ok: false, payload: { message } }`.
//
// Si cambias mcp-bridge.js para que rompa una de estas aserciones, la
// prueba se pone en rojo; esto es lo que el supervisor exige para
// que la prueba cuente.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// mcp-bridge.js hace `import { PlannerApi } from './api.js'`, y api.js
// tira de context.js, cuyo bloque estático lee localStorage. Antes de
// importar el bridge tenemos que tener un localStorage y un window
// mínimos. Lo mismo hace tests/unit/api.test.mjs y funciona.
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
globalThis.localStorage.setItem('Context_START_DATE', String(new Date(2026, 9, 19).getTime()));
globalThis.window      = new EventTarget();
globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type, init = {}) { super(type, init); Object.assign(this, init); }
};

// Importamos mcp-bridge.js (carga api.js y context.js como efecto
// secundario, pero como solo invocamos `handleMcpCall` con un api
// inyectado, su PlannerApi interno nunca se llama en estos tests).
const { handleMcpCall } = await import('../../mcp-bridge.js');

// Stub de PlannerApi: cada tool tiene un comportamiento distinto para
// poder verificar que el bridge los enruta correctamente.
const apiCalls = [];
const apiStub = {
  listTasks: () => { apiCalls.push('listTasks'); return [{ index: 0, name: 'X', repeat: 'daily' }]; },
  getTask: (i) => { apiCalls.push(['getTask', i]); return { index: i, name: 'X', repeat: 'daily' }; },
  addTask: (spec) => { apiCalls.push(['addTask', spec]); return { index: 0, ...spec, repeat: 'daily' }; },
  updateTask: (i, spec) => { apiCalls.push(['updateTask', i, spec]); return { index: i, ...spec }; },
  deleteTask: (i) => { apiCalls.push(['deleteTask', i]); return 'X'; },
  getWeek: (o) => { apiCalls.push(['getWeek', o]); return []; },
  setStartDate: (d) => { apiCalls.push(['setStartDate', d]); return d; },
  navigate: (v) => { apiCalls.push(['navigate', v]); return { view: v }; },
  exportJson: () => { apiCalls.push('exportJson'); return '[]'; },
};

beforeEach(() => {
  apiCalls.length = 0;
});

test('listar_tareas delega en api.listTasks()', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'listar_tareas', args: {} }, apiStub);
  assert.equal(r.ok, true);
  assert.equal(apiCalls[0], 'listTasks');
  assert.deepEqual(r.payload, [{ index: 0, name: 'X', repeat: 'daily' }]);
});

test('ver_tarea pasa index a api.getTask', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'ver_tarea', args: { index: 2 } }, apiStub);
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['getTask', 2]);
  assert.equal(r.payload.index, 2);
});

test('crear_tarea pasa el spec a api.addTask', async () => {
  const spec = { name: 'T', repeat: 'daily' };
  const r = await handleMcpCall({ id: '1', tool: 'crear_tarea', args: spec }, apiStub);
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['addTask', spec]);
  assert.equal(r.payload.name, 'T');
});

test('editar_tarea pasa {index, spec} a api.updateTask', async () => {
  const r = await handleMcpCall(
    { id: '1', tool: 'editar_tarea', args: { index: 2, spec: { name: 'Z', repeat: 'daily' } } },
    apiStub,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['updateTask', 2, { name: 'Z', repeat: 'daily' }]);
});

test('borrar_tarea devuelve el nombre de la tarea borrada', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'borrar_tarea', args: { index: 0 } }, apiStub);
  assert.equal(r.ok, true);
  assert.equal(r.payload, 'X');
  assert.deepEqual(apiCalls[0], ['deleteTask', 0]);
});

// ── Las tareas se localizan por su id (T-049) ────────────────────────────

test('ver_tarea pasa el id a api.getTask', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'ver_tarea', args: { id: 'uuid-1' } }, apiStub);
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['getTask', 'uuid-1']);
});

test('editar_tarea pasa {id, spec} a api.updateTask', async () => {
  const r = await handleMcpCall(
    { id: '1', tool: 'editar_tarea', args: { id: 'uuid-1', spec: { name: 'Z', repeat: 'daily' } } },
    apiStub,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['updateTask', 'uuid-1', { name: 'Z', repeat: 'daily' }]);
});

test('borrar_tarea pasa el id a api.deleteTask', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'borrar_tarea', args: { id: 'uuid-1' } }, apiStub);
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['deleteTask', 'uuid-1']);
});

test('sin id ni index, la herramienta avisa en español', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'ver_tarea', args: {} }, apiStub);
  assert.equal(r.ok, false);
  assert.match(r.payload.message, /id/i);
  assert.equal(apiCalls.length, 0);
});

test('ver_semana usa el offset por defecto 0 si no llega', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'ver_semana', args: {} }, apiStub);
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['getWeek', 0]);
});

test('ver_semana propaga el offset recibido', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'ver_semana', args: { offset: 2 } }, apiStub);
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['getWeek', 2]);
});

test('cambiar_fecha_inicio reenvía el isoDate', async () => {
  const r = await handleMcpCall(
    { id: '1', tool: 'cambiar_fecha_inicio', args: { isoDate: '2026-10-26' } },
    apiStub,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['setStartDate', '2026-10-26']);
  assert.equal(r.payload, '2026-10-26');
});

test('abrir_vista llama a api.navigate y devuelve { view }', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'abrir_vista', args: { view: 'week' } }, apiStub);
  assert.equal(r.ok, true);
  assert.deepEqual(apiCalls[0], ['navigate', 'week']);
  assert.deepEqual(r.payload, { view: 'week' });
});

test('exportar_json devuelve el string JSON de api.exportJson()', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'exportar_json', args: {} }, apiStub);
  assert.equal(r.ok, true);
  assert.equal(r.payload, '[]');
});

test('tool desconocida devuelve ok:false con mensaje en español', async () => {
  const r = await handleMcpCall({ id: '1', tool: 'no-existe', args: {} }, apiStub);
  assert.equal(r.ok, false);
  assert.match(r.payload.message, /desconocida/i);
});

test('un error de la API se devuelve como ok:false con su mensaje', async () => {
  const apiQueFalla = { ...apiStub, addTask: () => { throw new Error('Nombre requerido'); } };
  const r = await handleMcpCall({ id: '1', tool: 'crear_tarea', args: { name: '' } }, apiQueFalla);
  assert.equal(r.ok, false);
  assert.equal(r.payload.message, 'Nombre requerido');
});

test('la respuesta preserva el id recibido', async () => {
  const r = await handleMcpCall({ id: 'abc-123', tool: 'listar_tareas', args: {} }, apiStub);
  assert.equal(r.id, 'abc-123');
});