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
//
// La última parte comprueba dónde vive el token (T-033): lo genera y
// lo guarda la capa nativa en un fichero con permisos 0600, y NO en el
// `localStorage` del webview. Además, el token sobrevive a un reinicio
// de la app (si no, el `claude mcp add` del usuario dejaría de
// funcionar).

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { aceptarTerminos, esperarArranque, nombresDeTareas, recargar } from '../helpers.mjs';

// tests/e2e/specs/ → tests/e2e/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

/** Identificador de la app: el directorio de datos que usa Tauri. */
const IDENTIFICADOR = JSON.parse(
  readFileSync(join(RAIZ, 'src-tauri', 'tauri.conf.json'), 'utf8'),
).identifier;

/** Ruta del fichero donde la capa nativa guarda el token del MCP.
 *  `PLANNER_E2E_DATOS` es el `XDG_DATA_HOME` aislado de los E2E, así
 *  que nunca se tocan los datos reales del usuario. */
function rutaTokenMcp() {
  const datos = process.env.PLANNER_E2E_DATOS;
  if (!datos) {
    throw new Error('Falta PLANNER_E2E_DATOS: lanza los E2E con "bash tools/test.sh e2e".');
  }
  return join(datos, IDENTIFICADOR, 'mcp-token');
}

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

/** Estado REAL del servidor MCP según la capa nativa (el comando
 *  `mcp_status` de src-tauri/src/lib.rs). Devuelve
 *  `{ ok: true, estado }` con el estado (`{ active, port }`) o
 *  `{ ok: false, error }` si el comando no existe o falla. */
async function estadoMcpNativo() {
  return browser.execute(async () => {
    try {
      return { ok: true, estado: await window.__TAURI__.core.invoke('mcp_status') };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}

async function gotoMcpSettings() {
  // La sección "Control por asistente (MCP)" vive ahora en la pestaña
  // "Asistente (MCP)" dentro de Ajustes (T-022). No hay atajo
  // directo: abrimos Ajustes con Alt+6 (pestaña Apariencia) y luego
  // clicamos la pestaña Asistente (MCP). En Android la pestaña no
  // existe; este spec solo se ejecuta en escritorio donde sí está.
  await browser.keys(['Alt', '6']);
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelector('#ajustes-panel-appearance')?.hidden === false,
    ),
    { timeout: 5_000, timeoutMsg: 'Ajustes no se abrió en Apariencia' },
  );
  await browser.execute(() => {
    const tab = document.querySelector('.ajustes-tab[data-tab="mcp"]');
    tab?.click();
  });
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelector('#ajustes-panel-mcp')?.hidden === false,
    ),
    { timeout: 5_000, timeoutMsg: 'La pestaña Asistente (MCP) no quedó visible' },
  );
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

  it('tools/list expone las 11 herramientas con sus hints', async () => {
    const token = await $('#mcpToken').getValue();
    const port  = await $('#mcpPort').getValue();
    const client = await mcpClient(port, token);

    const { status, body } = await client.list();
    expect(status).toBe(200);
    const names = body.result.tools.map(t => t.name).sort();
    expect(names).toEqual([
      'abrir_vista', 'borrar_tarea', 'cambiar_fecha_inicio', 'crear_tarea',
      'desmarcar_tarea', 'editar_tarea', 'exportar_json', 'listar_tareas',
      'marcar_tarea', 'ver_semana', 'ver_tarea',
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
      spec: { name: 'Regar', repeat: 'nDays', nDays: 3, startDate: '2026-11-25' },
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
    // Y la fecha de inicio de la tarea (T-045).
    expect(creada.startDate).toBe('2026-11-25');

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
    // La fecha de inicio también viaja por el MCP.
    expect(listJson.find(t => t.name === 'Regar').startDate).toBe('2026-11-25');

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

  it('las herramientas aceptan el id de la tarea', async () => {
    const token = await $('#mcpToken').getValue();
    const port  = await $('#mcpPort').getValue();
    const client = await mcpClient(port, token);

    // Crear una tarea y quedarse con su id.
    const creada = await client.call('crear_tarea', {
      spec: { name: 'Por id', repeat: 'daily' },
    });
    const tarea = JSON.parse(creada.body.result.content[0].text);
    expect(typeof tarea.id).toBe('string');
    expect(tarea.id.length).toBeGreaterThan(0);

    // listar_tareas la devuelve con su id.
    const lista = await client.call('listar_tareas', {});
    const tareas = JSON.parse(lista.body.result.content[0].text);
    const encontrada = tareas.find(t => t.id === tarea.id);
    expect(encontrada).toBeDefined();
    expect(encontrada.name).toBe('Por id');

    // ver_tarea por id.
    const vista = await client.call('ver_tarea', { id: tarea.id });
    expect(JSON.parse(vista.body.result.content[0].text).name).toBe('Por id');

    // editar_tarea por id: cambia la tarea y NO su id.
    const editada = await client.call('editar_tarea', {
      id: tarea.id,
      spec: { name: 'Por id editada', repeat: 'daily' },
    });
    const editadaJson = JSON.parse(editada.body.result.content[0].text);
    expect(editadaJson.name).toBe('Por id editada');
    expect(editadaJson.id).toBe(tarea.id);

    // borrar_tarea por id.
    const borrada = await client.call('borrar_tarea', { id: tarea.id });
    expect(JSON.parse(borrada.body.result.content[0].text)).toBe('Por id editada');

    // Ya no está.
    const despues = await client.call('ver_tarea', { id: tarea.id });
    expect(JSON.parse(despues.body.result.content[0].text)).toBeNull();
  });

  it('marcar_tarea y desmarcar_tarea marcan una aparición de una tarea', async () => {
    const token = await $('#mcpToken').getValue();
    const port  = await $('#mcpPort').getValue();
    const client = await mcpClient(port, token);

    const creada = await client.call('crear_tarea', {
      spec: { name: 'Marcable', repeat: 'daily' },
    });
    const tarea = JSON.parse(creada.body.result.content[0].text);

    // La marca se indexa por la fecha REAL del día.
    const hoy = await browser.execute(() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });

    const marcada = await client.call('marcar_tarea', { id: tarea.id, date: hoy });
    expect(marcada.status).toBe(200);
    const marca = JSON.parse(marcada.body.result.content[0].text);
    expect(marca.done).toBe(true);
    expect(marca.id).toBe(tarea.id);
    expect(marca.date).toBe(hoy);
    expect(marca.slot).toBe(0);

    // Y se puede quitar.
    const desmarcada = await client.call('desmarcar_tarea', { id: tarea.id, date: hoy });
    expect(desmarcada.status).toBe(200);
    expect(JSON.parse(desmarcada.body.result.content[0].text).done).toBe(false);
  });

  it('al desactivar el interruptor, el puerto se cierra', async () => {
    // El test anterior tocó el interruptor y navegó: nos aseguramos de
    // estar en Apariencia con el interruptor en un estado conocido.
    await gotoMcpSettings();
    if (!(await $('#mcpEnabled').isSelected())) await $('#mcpEnabled').click();
    const port = Number(await $('#mcpPort').getValue());

    // ANTES de desactivar: la capa nativa tiene que decir que el
    // servidor está ACTIVO y en el puerto que muestra la UI. Sin esta
    // comprobación, un fetch que rechaza más abajo no probaría nada:
    // el servidor puede que no hubiera arrancado nunca.
    const antes = await browser.waitUntil(
      async () => {
        const r = await estadoMcpNativo();
        return r.ok && r.estado.active ? r : false;
      },
      {
        timeout: 5000,
        timeoutMsg: 'El servidor MCP no estaba activo antes de desactivar el interruptor',
      },
    );
    expect(antes.estado.active).toBe(true);
    expect(antes.estado.port).toBe(port);

    // Desactivamos. En este driver concreto (`webkit2gtk-driver`) un
    // doble click en el mismo checkbox puede colapsar los dos eventos
    // `change`, así que tras desactivar nos quedamos con el puerto
    // cerrado y dejamos que el siguiente `beforeSession` (cada archivo
    // de spec abre una sesión nueva con datos limpios) parta de cero.
    const checkbox = await $('#mcpEnabled');
    if (await checkbox.isSelected()) await checkbox.click();

    // DESPUÉS de desactivar: la app tiene que CONFIRMAR que paró
    // (`mcp_status` dice `active: false`). Un fetch que rechaza no
    // basta: si el servidor nunca hubiera arrancado, también
    // rechazaría.
    await browser.waitUntil(
      async () => {
        const r = await estadoMcpNativo();
        return r.ok && r.estado.active === false;
      },
      {
        timeout: 5000,
        timeoutMsg: 'La app seguía con el MCP activo tras desactivar el interruptor',
      },
    );

    // Y con el servidor parado, el puerto está cerrado de verdad: el
    // POST tiene que RECHAZAR. Si siguiera escuchando contestaría
    // (401 sin token), así que "no es 200" no vale: tiene que fallar
    // la conexión.
    let ultimoStatus = null;
    await browser.waitUntil(
      async () => {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST' });
          ultimoStatus = res.status;
          return false;
        } catch {
          ultimoStatus = null;
          return true;
        }
      },
      {
        timeout: 5000,
        interval: 200,
        timeoutMsg: () => `El puerto ${port} sigue abierto: el POST respondió HTTP ${ultimoStatus}`,
      },
    );
  });

  // ── Dónde vive el token (T-033) ───────────────────────────────────

  it('el token no está en el localStorage: lo guarda la capa nativa', async () => {
    const token = await $('#mcpToken').getValue();
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // 1) El estado del MCP guardado en el navegador no lleva token.
    const estado = await browser.execute(() => localStorage.getItem('planner_mcp'));
    expect(estado).not.toBeNull();
    expect(estado).not.toContain(token);
    const parsed = JSON.parse(estado);
    expect(Object.keys(parsed).sort()).toEqual(['enabled', 'port']);
    expect(parsed.token).toBeUndefined();

    // 2) Ningún valor del localStorage contiene el token.
    const conToken = await browser.execute((t) => {
      const claves = [];
      for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        const valor = localStorage.getItem(clave);
        if (valor && valor.includes(t)) claves.push(clave);
      }
      return claves;
    }, token);
    expect(conToken).toEqual([]);

    // 3) El token está en un fichero de la capa nativa, con permisos 0600.
    const ruta = rutaTokenMcp();
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta, 'utf8').trim()).toBe(token);
    const modo = statSync(ruta).mode & 0o777;
    expect(modo).toBe(0o600);
  });

  it('el token sigue ahí después de reiniciar la app', async () => {
    const token = await $('#mcpToken').getValue();
    const ruta  = rutaTokenMcp();

    // Reiniciamos la app de verdad: se cierra el proceso y se vuelve
    // a abrir. El token tiene que seguir siendo el mismo, porque el
    // usuario lo pegó en un `claude mcp add`.
    await browser.reloadSession();
    expect(await esperarArranque()).toBe('app');

    // El fichero de la capa nativa sigue ahí y con el mismo token.
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta, 'utf8').trim()).toBe(token);

    // Y la UI vuelve a mostrar ese mismo token (no uno nuevo).
    await gotoMcpSettings();
    await browser.waitUntil(
      async () => (await $('#mcpToken').getValue()).length === 64,
      { timeout: 5000, timeoutMsg: 'El token no volvió a aparecer tras reiniciar' },
    );
    expect(await $('#mcpToken').getValue()).toBe(token);
  });

  it('migración: el token antiguo del localStorage se borra y se ignora', async () => {
    // Simulamos una instalación de la versión anterior, que guardaba
    // el token en claro en el navegador.
    const tokenViejo = 'f'.repeat(64);
    await browser.execute((t) => {
      localStorage.setItem('planner_mcp', JSON.stringify({
        enabled: false, port: 41237, token: t,
      }));
    }, tokenViejo);

    // Al arrancar, el frontend lee el estado y migra el formato viejo.
    await recargar();
    await gotoMcpSettings();

    // El token antiguo desaparece del almacenamiento…
    const estado = await browser.execute(() => localStorage.getItem('planner_mcp'));
    expect(estado).not.toContain(tokenViejo);
    expect(JSON.parse(estado).token).toBeUndefined();

    // …y el token que se muestra es el de la capa nativa.
    await browser.waitUntil(
      async () => /^[0-9a-f]{64}$/.test(await $('#mcpToken').getValue()),
      { timeout: 5000, timeoutMsg: 'El token no apareció tras la migración' },
    );
    const token = await $('#mcpToken').getValue();
    expect(token).not.toBe(tokenViejo);
    expect(readFileSync(rutaTokenMcp(), 'utf8').trim()).toBe(token);
  });
});