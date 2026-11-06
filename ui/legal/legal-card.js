// ────────────────────────────────────────────────────────────────────
// legal-card.js
//
// Muestra los textos legales dentro de la app.
//
// Estrategia:
//   1. Los documentos que están publicados (ver `legal-urls.js`) se
//      abren en el navegador del sistema, en su dirección pública.
//      La app no descarga nada: solo pide al sistema que abra la URL.
//   2. Si no se puede abrir el navegador (no hay Tauri, el sistema no
//      tiene navegador, etc.), se muestra la copia local del documento
//      —la que va incluida en la app— dentro del modal.
//   3. `THIRD_PARTY_LICENSES` no se publica: siempre se muestra su
//      copia local en el modal.
//   4. La copia local se lee del directorio `legal/` del WebView
//      (rutas relativas). Esto funciona en Tauri porque
//      `bundle.resources` los incluye en el binario.
// ────────────────────────────────────────────────────────────────────

import { trapFocus } from '../a11y.js';
import { publicUrlFor, isHttpsUrl } from './legal-urls.js';

const DOCS = {
  PRIVACY:               { title: 'Política de privacidad',   file: './legal/PRIVACY.md' },
  TERMS:                 { title: 'Términos de uso',          file: './legal/TERMS.md' },
  EULA:                  { title: 'Contrato de licencia',     file: './legal/EULA.md' },
  COOKIES:               { title: 'Política de cookies',      file: './legal/COOKIES.md' },
  ACCESSIBILITY:         { title: 'Accesibilidad',            file: './legal/ACCESSIBILITY.md' },
  ACCEPTABLE_USE:        { title: 'Uso aceptable',            file: './legal/ACCEPTABLE_USE.md' },
  DMCA:                  { title: 'Propiedad intelectual',    file: './legal/DMCA.md' },
  THIRD_PARTY_LICENSES:  { title: 'Licencias de terceros',    file: './legal/THIRD_PARTY_LICENSES.md' },
  CONTACT:               { title: 'Contacto y responsable',   file: './legal/CONTACT.md' },
};

export class LegalCard {
  constructor(root) {
    this.root = root;
    this.cache = {};
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/legal/legal-card.html').then(r => r.text()),
      fetch('./ui/legal/legal-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.mount();
  }

  async mount() {
    this.modal      = this.root.querySelector('#legal-modal');
    this.modalTitle = this.root.querySelector('#legal-modal-title');
    this.modalBody  = this.root.querySelector('#legal-modal-body');
    this.closeBtn   = this.root.querySelector('#legal-modal-close');

    this.closeBtn.addEventListener('click', () => this.closeModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.hidden) this.closeModal();
    });

    this.root.querySelectorAll('a[data-doc]').forEach(a => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.onDocClick(a, a.dataset.doc);
      });
    });

    // Rellenar info de la app desde Tauri si está disponible.
    try {
      const info = await window.__TAURI__?.core?.invoke('get_app_info');
      if (info) {
        this.root.querySelector('#legal-app-name').textContent    = info.product_name;
        this.root.querySelector('#legal-app-version').textContent  = info.version;
        this.root.querySelector('#legal-app-id').textContent       = info.identifier;
      }
    } catch { /* sin Tauri; dejamos placeholders */ }
  }

  /** Clic en un documento de la lista.
   *
   *  - Si el documento está publicado, se pide al sistema que abra su
   *    dirección pública en el navegador. La app no descarga nada.
   *  - Si no se publica (THIRD_PARTY_LICENSES) o si el navegador no
   *    se puede abrir, se muestra la copia local en el modal.
   */
  async onDocClick(triggerEl, key) {
    const url = publicUrlFor(key);
    if (url) {
      const abierto = await this.abrirEnNavegador(url);
      if (abierto) return;
    }
    // O el documento no se publica, o el navegador no se pudo abrir:
    // en ambos casos mostramos la copia local incluida en la app.
    await this.openDoc(triggerEl, key, true);
  }

  /** Abre `url` en el navegador del sistema.
   *
   * Devuelve `true` si el navegador aceptó abrirla, `false` si no
   * hay Tauri, si la URL no es https o si el sistema falló.
   */
  async abrirEnNavegador(url) {
    // Solo https: ni siquiera una URL manipulada podría abrir otro
    // tipo de esquema (file:, javascript:…).
    if (!isHttpsUrl(url)) return false;
    const shell = window.__TAURI__?.shell;
    if (!shell?.open) return false;
    try {
      await shell.open(url);
      return true;
    } catch {
      return false;
    }
  }

  /** Muestra la copia local del documento en el modal.
   *
   * `copiaLocal` marca que el texto es la copia incluida en la app
   * (porque no se pudo abrir la versión publicada).
   */
  async openDoc(triggerEl, key, copiaLocal = false) {
    const doc = DOCS[key];
    if (!doc) return;
    this.modalTitle.textContent = doc.title;
    this.modalBody.innerHTML    = '<p>Cargando…</p>';
    this.modal.hidden = false;
    document.body.classList.add('legal-modal-open');

    // Trampa de foco en el modal. Devolvemos el foco al enlace que
    // lo abrió al cerrar. Reanclamos en cada apertura (Escape del
    // cierre llama a releaseTrap y vacía _releaseTrap).
    if (this._releaseTrap) this._releaseTrap();
    this._releaseTrap = trapFocus(this.modal, { onEscape: () => this.closeModal() });
    // Foco en el título del modal: lo hacemos enfocable por script
    // sin que sea alcanzable con Tab.
    if (!this.modalTitle.hasAttribute('tabindex')) this.modalTitle.setAttribute('tabindex', '-1');
    this.modalTitle.focus({ preventScroll: true });

    try {
      const text = this.cache[key] ?? await (await fetch(doc.file)).text();
      this.cache[key] = text;
      const aviso = copiaLocal
        ? '<p class="legal-modal-note">Esta es la copia del documento incluida en la app.</p>'
        : '';
      this.modalBody.innerHTML = aviso + renderMarkdown(text);
    } catch (err) {
      this.modalBody.innerHTML =
        `<p style="color:var(--danger)">No se ha podido cargar el documento (${err.message}).</p>
         <p>Si estás usando una versión muy antigua de la app, descarga la última desde
         el sitio oficial.</p>`;
    }
  }

  closeModal() {
    if (!this.modal || this.modal.hidden) return;
    if (this._releaseTrap) { this._releaseTrap(); this._releaseTrap = null; }
    this.modal.hidden = true;
    document.body.classList.remove('legal-modal-open');
    // trapFocus devuelve el foco al elemento previamente enfocado
    // (el enlace que abrió el modal) al hacer release().
  }
}

// ── Mini-render de Markdown → HTML ─────────────────────────────────
// Suficiente para los textos legales (encabezados, listas, tablas,
// código, links, énfasis). Sin dependencias externas para no
// añadir peso al bundle.
// ────────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderMarkdown(md) {
  // 1. Escapar HTML.
  let text = escapeHtml(md);

  // 2. Código en bloque ``` … ```.
  text = text.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.replace(/^\n+|\n+$/g, '')}</code></pre>`);

  // 3. Títulos (h1, h2, h3).
  text = text.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
             .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
             .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
             .replace(/^### (.*)$/gm, '<h3>$1</h3>')
             .replace(/^## (.*)$/gm, '<h2>$1</h2>')
             .replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // 3b. Separadores horizontales.
  text = text.replace(/^-{3,}$/gm, '<hr>');

  // 4. Negrita y cursiva.
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
             .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // 5. Listas (muy simple).
  text = text.replace(/(^|\n)(- .+(?:\n- .+)*)/g, (_, lead, block) => {
    const items = block.split('\n').map(l => `<li>${l.slice(2)}</li>`).join('');
    return `${lead}<ul>${items}</ul>`;
  });
  text = text.replace(/(^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, (_, lead, block) => {
    const items = block.split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `${lead}<ol>${items}</ol>`;
  });

  // 6. Enlaces [texto](url).
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');

  // 7. Tablas (simple).
  text = text.replace(/((?:\|[^\n]+\|\n)+)/g, (block) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return block;
    const headers = lines[0].split('|').slice(1, -1).map(s => s.trim());
    const align   = lines[1].split('|').slice(1, -1).map(s => s.trim());
    if (!align.every(c => /^:?-+:?$/.test(c))) return block;
    const rows = lines.slice(2).map(l => l.split('|').slice(1, -1).map(s => s.trim()));
    const th = headers.map(h => `<th>${h}</th>`).join('');
    const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
  });

  // 8. Párrafos (líneas sueltas separadas por doble salto).
  text = text
    .split(/\n{2,}/)
    .map(p => /^<(h\d|ul|ol|pre|table|hr)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return text;
}