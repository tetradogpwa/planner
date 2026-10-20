// ────────────────────────────────────────────────────────────────────
// mcp-card.js
//
// Pestaña "Asistente (MCP)" dentro de Ajustes. Antigua sección de
// ui/settings/settings-card.{html,js} que se movió aquí para que la
// pestaña Apariencia se centre solo en tema y colores (criterio de
// T-022).
//
// Lee y guarda el estado en localStorage con la clave "planner_mcp"
// para que la app lo restaure al rearrancar; el servidor se arranca
// al final de index.js si está activado. En Android no se monta (el
// índice de la pestaña se oculta en ajustes-card.js).
// ────────────────────────────────────────────────────────────────────

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
    this.mount();
  }

  $(sel) { return this.root.querySelector(sel); }

  mount() {
    const isMobile = /android/i.test(navigator.userAgent);
    const androidNotice = this.$('#mcpAndroidNotice');
    if (isMobile) {
      androidNotice.hidden = false;
      this.$('#mcpEnabled').closest('.settings-option').hidden = true;
      this.$('#mcpConfig').hidden = true;
      return;
    }

    const saved = this.#readMcpState();
    if (!saved.token) {
      saved.token = this.#generateToken();
      this.#writeMcpState(saved);
    }
    this.$('#mcpToken').value = saved.token;
    this.$('#mcpPort').value  = saved.port ?? 41237;
    this.$('#mcpEnabled').checked = !!saved.enabled;
    this.#updateMcpUi();

    this.$('#mcpEnabled').addEventListener('change', () => this.#applyMcp());
    this.$('#mcpPort').addEventListener('change', () => this.#applyMcp());
    this.$('#mcpRegenToken').addEventListener('click', () => {
      const s = this.#readMcpState();
      s.token = this.#generateToken();
      this.#writeMcpState(s);
      this.$('#mcpToken').value = s.token;
      this.#updateMcpUi();
      this.#applyMcp();
    });
    this.$('#mcpCopyToken').addEventListener('click', () =>
      this.#copyField(this.$('#mcpToken'), 'Token')
    );
    this.$('#mcpCopyCmd').addEventListener('click', () =>
      this.#copyField(this.$('#mcpCmd'), 'Comando')
    );

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
    try {
      return JSON.parse(localStorage.getItem('planner_mcp') || '{}');
    } catch { return {}; }
  }

  #writeMcpState(s) {
    localStorage.setItem('planner_mcp', JSON.stringify(s));
  }

  #generateToken() {
    // 32 bytes hex = 64 chars. `crypto.getRandomValues` está en
    // navegadores modernos y Tauri 2 (webview webkit/edge).
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  async #applyMcp() {
    const s = this.#readMcpState();
    s.enabled = this.$('#mcpEnabled').checked;
    s.port    = Number(this.$('#mcpPort').value) || 41237;
    s.token   = this.$('#mcpToken').value;
    this.#writeMcpState(s);
    this.#updateMcpUi();

    if (!window.__TAURI__?.core?.invoke) {
      this.#mcpStatus('Solo disponible dentro de la app Tauri.');
      return;
    }
    try {
      if (s.enabled) {
        await window.__TAURI__.core.invoke('mcp_start', { port: s.port, token: s.token });
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