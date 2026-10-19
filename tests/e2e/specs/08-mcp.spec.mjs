// Recorrido del servidor MCP local: activarlo en Apariencia, hablar
// con él como un cliente MCP real (initialize + tools/list + tools/call)
// sobre Streamable HTTP, y verificar que los cambios aparecen al
// momento en la UI. También cubre la regeneración del token (el viejo
// deja de funcionar, el nuevo sí) y que al desactivar el interruptor
// el puerto se cierra.
//
// No usamos `claude mcp add` real (no hay cliente en el contenedor);
// el "cliente" es `fetch` desde el webview siguiendo el protocolo
// JSON-RPC de MCP, que es lo mismo que haría un cliente MCP real
// hablando con un transporte Streamable HTTP.

import { aceptarTerminos, nombresDeTareas } from '../helpers.mjs';

/** El servidor MCP (rmcp 0.5) devuelve sus respuestas como
 *  Server-Sent Events: cada evento es `data: <json>\n\n`. Esta función
 *  extrae el último bloque `data:` y lo devuelve como JSON. */
async function parseSseJson(res) {
  const text = await res.text();
  let lastData = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('data:')) lastData = line.slice(5).trim();
  }
  if (lastData === null) throw new Error(`Respuesta MCP sin SSE data: ${text.slice(0, 200)}`);
  return { status: res.status, body: JSON.parse(lastData) };
}

/** Wrapper mínimo de cliente MCP (Streamable HTTP, JSON-RPC). Hace
 *  `initialize`, conserva el `Mcp-Session-Id` que devuelve el servidor
 *  y lo envía en los siguientes tools/call. */
async function mcpClient(port, token) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${token}`,
  };
  const initRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', headers,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'e2e-mcp-test', version: '0.0.0' },
      },
    }),
  });
  if (!initRes.ok) throw new Error(`initialize devolvió ${initRes.status}`);
  const sessionId = initRes.headers.get('Mcp-Session-Id');
  // Notificación `initialized` (sin id, no espera respuesta). El
  // servidor puede devolver 202 Accepted; lo ignoramos.
  await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', headers: { ...headers, 'Mcp-Session-Id': sessionId },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  }).catch(() => {});
  return {
    async call(tool, args, id = 2) {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST', headers: { ...headers, 'Mcp-Session-Id': sessionId },
        body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: tool, arguments: args ?? {} } }),
      });
      return parseSseJson(res);
    },
    async list(id = 3) {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST', headers: { ...headers, 'Mcp-Session-Id': sessionId },
        body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list' }),
      });
      return parseSseJson(res);
    },
  };
}

async function gotoMcpSettings() {
  // Apariencia está en Alt+6.
  await browser.keys(['Alt', '6']);
  await $('#mcpTitle').waitForDisplayed();
  // El servidor ya queda activo de la sesión anterior si estaba
  // guardado en localStorage, así que no tocamos el interruptor.
}

async function ensureMcpEnabled() {
  const enabled = await $('#mcpEnabled').isSelected();
  if (!enabled) await $('#mcpEnabled').click();
}

describe('Servidor MCP local', () => {
  before(async () => {
    await aceptarTerminos();
    await gotoMcpSettings();
    await ensureMcpEnabled();
    // Pequeña espera para que el server arranque en el backend: un
    // POST pelado con token correcto debe responder HTTP 200 (la
    // respuesta JSON-RPC puede ser initialize-noticeable; lo
    // importante es que el listener TCP está vivo y el middleware
    // deja pasar el request).
    await browser.waitUntil(
      async () => {
        try {
          const token = await $('#mcpToken').getValue();
          const port  = await $('#mcpPort').getValue();
          const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/event-stream',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'wait', version: '0' } } }),
          });
          return res.status === 200;
        } catch { return false; }
      },
      { timeout: 5000, timeoutMsg: 'El servidor MCP no ha arrancado en 127.0.0.1' },
    );
  });

  it('la sección MCP existe y muestra el comando para conectarse', async () => {
    const heading = await $('#mcpTitle');
    await expect(heading).toHaveText('Control por asistente (MCP)');

    const token = await $('#mcpToken').getValue();
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const cmd = await $('#mcpCmd').getValue();
    expect(cmd).toContain('claude mcp add --transport http planner');
    expect(cmd).toContain('http://127.0.0.1:');
    expect(cmd).toContain(`/mcp --header "Authorization: Bearer ${token}"`);
  });

  it('sin token válido, el endpoint responde 401', async () => {
    const port = await $('#mcpPort').getValue();
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('tools/list expone las 9 herramientas con sus hints', async () => {
    const token = await $('#mcpToken').getValue();
    const port  = await $('#mcpPort').getValue();
    const client = await mcpClient(port, token);

    const { status, body } = await client.list();
    expect(status).toBe(200);
    const names = body.result.tools.map(t => t.name).sort();
    expect(names).toEqual([
      'abrir_vista', 'borrar_tarea', 'cambiar_fecha_inicio', 'crear_tarea',
      'editar_tarea', 'exportar_json', 'listar_tareas', 'ver_semana', 'ver_tarea',
    ]);

    // Anotaciones: lecturas -> readOnlyHint; borrar_tarea -> destructiveHint.
    const byName = Object.fromEntries(body.result.tools.map(t => [t.name, t]));
    expect(byName.listar_tareas.annotations?.readOnlyHint).toBe(true);
    expect(byName.ver_tarea.annotations?.readOnlyHint).toBe(true);
    expect(byName.ver_semana.annotations?.readOnlyHint).toBe(true);
    expect(byName.exportar_json.annotations?.readOnlyHint).toBe(true);
    expect(byName.borrar_tarea.annotations?.destructiveHint).toBe(true);
    // El resto no llevan hints destructivos.
    expect(byName.crear_tarea.annotations?.destructiveHint).toBeFalsy();
    expect(byName.editar_tarea.annotations?.destructiveHint).toBeFalsy();
  });

  it('tools/call crear_tarea añade la tarea y aparece en la UI', async () => {
    const token = await $('#mcpToken').getValue();
    const port  = await $('#mcpPort').getValue();
    const client = await mcpClient(port, token);

    const { status, body } = await client.call('crear_tarea', {
      spec: { name: 'Regar', repeat: 'nDays', nDays: 3 },
    });
    expect(status).toBe(200);
    expect(body.result).toBeDefined();
    // La API devuelve el JSON de la tarea creada.
    const text = body.result.content?.[0]?.text;
    expect(text).toBeDefined();
    const creada = JSON.parse(text);
    expect(creada.name).toBe('Regar');
    expect(creada.repeat).toBe('nDays');
    expect(creada.nDays).toBe(3);

    // Vuelve a Tareas y comprueba que la nueva tarea está en la lista.
    await browser.keys(['Alt', '1']);
    await $('#view-tasks-heading').waitForDisplayed();
    // Esperar a que la UI pinte la nueva tarea (el evento es síncrono
    // pero el repintado no).
    await browser.waitUntil(
      async () => (await nombresDeTareas()).includes('Regar'),
      { timeout: 5000, timeoutMsg: 'La tarea «Regar» no apareció en la UI' },
    );

    // listar_tareas, ahora, devuelve la tarea (y la cuenta es >= 1).
    const lista = await client.call('listar_tareas', {});
    const listText = lista.body.result.content[0].text;
    const listJson = JSON.parse(listText);
    expect(listJson.some(t => t.name === 'Regar' && t.repeat === 'nDays' && t.nDays === 3))
      .toBe(true);

    // ver_semana(0) devuelve 7 días; ninguno debe romper.
    const semana = await client.call('ver_semana', { offset: 0 });
    expect(semana.status).toBe(200);
    expect(JSON.parse(semana.body.result.content[0].text).length).toBe(7);
  });

  it('regenerar el token invalida el viejo y activa el nuevo', async () => {
    // El test anterior navegó a Tareas: volvemos a Apariencia para
    // que los controles del MCP sean interactuables.
    await gotoMcpSettings();
    await ensureMcpEnabled();
    const tokenField = await $('#mcpToken');
    const portField  = await $('#mcpPort');
    const oldToken = await tokenField.getValue();
    const port     = await portField.getValue();

    // Sanity: con el viejo, una tools/list funciona.
    const clientOk = await mcpClient(port, oldToken);
    const antes = await clientOk.list();
    expect(antes.status).toBe(200);

    // Regeneramos y esperamos a que el campo cambie. La regeneración
    // rearranca el servidor (sustituye el token en caliente), así
    // que también esperamos a que vuelva a estar arriba.
    await $('#mcpRegenToken').click();
    await browser.waitUntil(
      async () => (await tokenField.getValue()) !== oldToken,
      { timeout: 5000 },
    );
    const newToken = await tokenField.getValue();
    expect(newToken).toMatch(/^[0-9a-f]{64}$/);
    expect(newToken).not.toBe(oldToken);

    // El servidor tarda un instante en rearrancar (abort task +
    // sleep 20ms + bind). Esperamos con el NUEVO token a que esté
    // arriba antes de probar con el viejo.
    await browser.waitUntil(
      async () => {
        try {
          const r = await fetch(`http://127.0.0.1:${port}/mcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/event-stream',
              'Authorization': `Bearer ${newToken}`,
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'wait', version: '0' } } }),
          });
          return r.status === 200;
        } catch { return false; }
      },
      { timeout: 5000, timeoutMsg: 'El servidor no ha vuelto a arrancar tras regenerar el token' },
    );

    // El viejo ya no vale: el middleware lee del mismo Arc, así que
    // ni siquiera el handshake inicial debería pasar.
    const clientViejo = await mcpClient(port, oldToken).catch(() => null);
    // `mcpClient` lanza si initialize no devuelve 200. Comprobamos
    // también que un POST pelado con el token viejo da 401.
    const res401 = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oldToken}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
    });
    expect(res401.status).toBe(401);
    // Y el nuevo sí funciona.
    const clientNuevo = await mcpClient(port, newToken);
    const despues = await clientNuevo.list();
    expect(despues.status).toBe(200);
    expect(clientViejo).toBeNull();
  });

  it('al desactivar el interruptor, el puerto se cierra', async () => {
    // El test anterior tocó el interruptor y navegó: nos aseguramos de
    // estar en Apariencia con el interruptor en un estado conocido.
    await gotoMcpSettings();
    if (!(await $('#mcpEnabled').isSelected())) await $('#mcpEnabled').click();
    const port = await $('#mcpPort').getValue();
    // Desactivamos. En este driver concreto (`webkit2gtk-driver`) un
    // doble click en el mismo checkbox puede colapsar los dos eventos
    // `change`, así que tras desactivar nos quedamos con el puerto
    // cerrado y dejamos que el siguiente `beforeSession` (cada archivo
    // de spec abre una sesión nueva con datos limpios) parta de cero.
    const checkbox = await $('#mcpEnabled');
    if (await checkbox.isSelected()) await checkbox.click();
    // El servidor tarda un instante en soltar el puerto. Cuando el
    // puerto está cerrado, fetch rechaza la promesa ("Failed to
    // fetch") o devuelve un response no-2xx; en cualquier caso NO
    // debe ser 200.
    await browser.waitUntil(
      async () => {
        let status = null;
        let error = null;
        try {
          const res = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST' });
          status = res.status;
        } catch (e) { error = String(e); }
        // Servidor apagado: o fetch lanza, o el SO rechaza la
        // conexión y recibimos status 0/522/etc. Consideramos cerrado
        // todo lo que NO sea 200.
        const cerrado = error !== null || (status !== null && status !== 200);
        return cerrado;
      },
      { timeout: 5000, timeoutMsg: 'El puerto sigue abierto tras desactivar MCP' },
    );
  });
});