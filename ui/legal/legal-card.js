// ────────────────────────────────────────────────────────────────────
// legal-card.js
//
// Muestra los textos legales dentro de la app.
//
// Estrategia:
//   1. El frontend intenta leer cada archivo .md del directorio `legal/`
//      desde el WebView (rutas relativas). Esto funciona en Tauri porque
//      `bundle.resources` los incluye en el binario.
//   2. Si la lectura falla (por ejemplo, en PWA sin bundle), se
//      muestra un mensaje claro y un enlace a la URL pública.
// ────────────────────────────────────────────────────────────────────

const DOCS = {
  PRIVACY:               { title: 'Política de privacidad',   file: './legal/PRIVACY.md' },
  TERMS:                 { title: 'Términos de uso',          file: './legal/TERMS.md' },
  EULA:                  { title: 'Contrato de licencia',     file: './legal/EULA.md' },
  COOKIES:               { title: 'Política de cookies',      file: './legal/COOKIES.md' },
  ADS_DISCLOSURE:        { title: 'Aviso de publicidad',      file: './legal/ADS_DISCLOSURE.md' },
  REFUNDS:               { title: 'Reembolsos',               file: './legal/REFUNDS.md' },
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
        await this.openDoc(a.dataset.doc);
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

  async openDoc(key) {
    const doc = DOCS[key];
    if (!doc) return;
    this.modalTitle.textContent = doc.title;
    this.modalBody.innerHTML    = '<p>Cargando…</p>';
    this.modal.hidden = false;
    document.body.classList.add('legal-modal-open');

    try {
      const text = this.cache[key] ?? await (await fetch(doc.file)).text();
      this.cache[key] = text;
      this.modalBody.innerHTML = renderMarkdown(text);
    } catch (err) {
      this.modalBody.innerHTML =
        `<p style="color:var(--danger)">No se ha podido cargar el documento (${err.message}).</p>
         <p>Si estás usando una versión muy antigua de la app, descarga la última desde
         el sitio oficial.</p>`;
    }
  }

  closeModal() {
    this.modal.hidden = true;
    document.body.classList.remove('legal-modal-open');
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