// ────────────────────────────────────────────────────────────────────
// mcp-card.js
//
// Pestaña "Asistente (MCP)" dentro de Ajustes. Antigua sección de
// ui/settings/settings-card.{html,js} que se movió aquí para que la
// pestaña Apariencia se centre solo en tema y colores (criterio de
// T-022).
//
// En el navegador solo se guarda el estado (interruptor y puerto) con
// la clave "planner_mcp", para que la app lo restaure al rearrancar;
// el servidor se arranca al final de index.js si está activado. En
// Android no se monta (el índice de la pestaña se oculta en
// ajustes-card.js).
//
// El TOKEN no lo genera ni lo guarda esta tarjeta: lo tiene la capa
// nativa (Rust), que lo escribe en un fichero con permisos 0600
// dentro del directorio de datos de la app. Aquí solo se pide con
// `invoke('mcp_token')` para poder mostrarlo (el usuario lo copia a un
// `claude mcp add`) y para arrancarlo con `mcp_start`. Así, ningún
// script del WebView puede leerlo del `localStorage` (T-033).
// ────────────────────────────────────────────────────────────────────

import { guardarEstadoMcp, leerEstadoMcp } from './mcp-state.js';

export class McpCard {
  constructor(root) {
    this.root = root;
  }

  async init() {
    const [html, css, sharedCss] = await Promise.all([
      fetch('./ui/mcp/mcp-card.html').then(r => r.text()),
      fetch('./ui/mcp/mcp-card.css').then(r => r.text()),
      fetch('./ui/settings/settings-shared.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${sharedCss}${css}</style>${html}`;
    await this.mount();
  }

  $(sel) { return this.root.querySelector(sel); }

  async mount() {
    const isMobile = /android/i.test(navigator.userAgent);
    const androidNotice = this.$('#mcpAndroidNotice');
    if (isMobile) {
      androidNotice.hidden = false;
      this.$('#mcpEnabled').closest('.settings-option').hidden = true;
      this.$('#mcpConfig').hidden = true;
      return;
    }

    // Lee el estado guardado (y migra el formato viejo, que traía el
    // token en claro: ese token se ignora y se borra).
    const saved = this.#readMcpState();
    this.$('#mcpPort').value  = saved.port ?? 41237;
    this.$('#mcpEnabled').checked = !!saved.enabled;

    this.$('#mcpEnabled').addEventListener('change', () => this.#applyMcp());
    this.$('#mcpPort').addEventListener('change', () => this.#applyMcp());
    this.$('#mcpRegenToken').addEventListener('click', async () => {
      const token = await this.#regenerateToken();
      if (!token) {
        this.#mcpStatus('No se pudo regenerar el token.');
        return;
      }
      this.$('#mcpToken').value = token;
      this.#updateMcpUi();
      // El token nuevo solo sirve si el servidor arranca con él.
      await this.#applyMcp();
    });
    this.$('#mcpCopyToken').addEventListener('click', () =>
      this.#copyField(this.$('#mcpToken'), 'Token')
    );
    this.$('#mcpCopyCmd').addEventListener('click', () =>
      this.#copyField(this.$('#mcpCmd'), 'Comando')
    );

    // El token lo pide a la capa nativa (nunca está en el navegador).
    await this.#refrescarToken();
    this.#updateMcpUi();

    // Si el estado guardado dice `enabled` pero el server no está
    // corriendo (p. ej. porque el usuario acaba de desactivar y
    // reactivar y el `change` no se procesó), lo arrancamos al montar
    // la vista. Esto evita que la UI diga "activo" mintiendo.
    if (saved.enabled && window.__TAURI__?.core?.invoke) {
      this.#syncWithBackend();
    }
  }

  /** Sincroniza el estado del checkbox con el estado real del backend:
   *  si el localStorage dice `enabled` pero el server está parado, lo
   *  levanta. Si dice `disabled` pero el server está activo, lo para. */
  async #syncWithBackend() {
    try {
      const status = await window.__TAURI__.core.invoke('mcp_status');
      const saved = this.#readMcpState();
      if (!!saved.enabled !== !!status.active) {
        await this.#applyMcp();
      }
    } catch {
      // Si `mcp_status` no existe (p. ej. en un navegador normal), no
      // hacemos nada: el `change` del checkbox ya se ocupa.
    }
  }

  async #copyField(input, label) {
    try {
      await navigator.clipboard.writeText(input.value);
      this.#mcpStatus(`${label} copiado al portapapeles.`);
    } catch {
      this.#mcpStatus(`No se pudo copiar. Selecciónalo manualmente.`);
    }
  }

  #readMcpState() {
    return leerEstadoMcp();
  }

  #writeMcpState(s) {
    guardarEstadoMcp(s);
  }

  /** Pide a la capa nativa el token vigente y lo muestra en el campo.
   *  Devuelve el token, o null si no está disponible (p. ej. en un
   *  navegador normal, donde no hay servidor MCP). */
  async #pedirToken() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return null;
    try {
      return await invoke('mcp_token');
    } catch (err) {
      console.warn('[mcp] no se pudo obtener el token:', err);
      return null;
    }
  }

  /** Pide a la capa nativa un token nuevo (el anterior deja de
   *  servir) y lo devuelve. */
  async #regenerateToken() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return null;
    try {
      return await invoke('mcp_token_regenerate');
    } catch (err) {
      console.warn('[mcp] no se pudo regenerar el token:', err);
      return null;
    }
  }

  async #refrescarToken() {
    const token = await this.#pedirToken();
    this.$('#mcpToken').value = token ?? '';
    return token;
  }

  async #applyMcp() {
    const s = this.#readMcpState();
    s.enabled = this.$('#mcpEnabled').checked;
    s.port    = Number(this.$('#mcpPort').value) || 41237;
    this.#writeMcpState(s);
    this.#updateMcpUi();

    if (!window.__TAURI__?.core?.invoke) {
      this.#mcpStatus('Solo disponible dentro de la app Tauri.');
      return;
    }
    // El token lo guarda la capa nativa: se lo pedimos para
    // arrancarlo. Nunca se guarda en el navegador.
    const token = await this.#pedirToken();
    if (!token) {
      this.#mcpStatus('No se pudo obtener el token del servidor.');
      return;
    }
    try {
      if (s.enabled) {
        await window.__TAURI__.core.invoke('mcp_start', { port: s.port, token });
        this.#mcpStatus(`Servidor activo en 127.0.0.1:${s.port}/mcp`);
      } else {
        await window.__TAURI__.core.invoke('mcp_stop');
        this.#mcpStatus('Servidor detenido.');
      }
    } catch (err) {
      this.#mcpStatus(`Error: ${err.message || err}`);
    }
  }

  #updateMcpUi() {
    const enabled = this.$('#mcpEnabled').checked;
    this.$('#mcpConfig').hidden = !enabled;
    const port  = Number(this.$('#mcpPort').value) || 41237;
    const token = this.$('#mcpToken').value;
    this.$('#mcpCmd').value =
      `claude mcp add --transport http planner http://127.0.0.1:${port}/mcp ` +
      `--header "Authorization: Bearer ${token}"`;
  }

  #mcpStatus(text) {
    const el = this.$('#mcpStatus');
    if (el) el.textContent = text;
  }
}
