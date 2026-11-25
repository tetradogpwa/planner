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
import { cargarFragmento, montarTarjeta } from '../base-card.js';
import { publicUrlFor, isHttpsUrl } from './legal-urls.js';
import { renderMarkdown } from './legal-markdown.js';

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
  }

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const html = await montarTarjeta(
      this.root,
      './ui/legal/legal-card.html',
      './ui/legal/legal-card.css',
    );
    if (!html) return false;
    this.mount();
    return true;
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
        // El hash del frontend incrustado: dice qué frontend lleva esta
        // build (T-040). Se muestra corto (los primeros 12 caracteres)
        // porque el entero no le dice nada a nadie.
        const hash = info.frontend_hash ?? '';
        this.root.querySelector('#legal-app-frontend-hash').textContent =
          hash ? hash.slice(0, 12) : '—';
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
      // El texto se descarga con la base común (comprueba que la
      // descarga sea OK y lo guarda en caché: cada documento, una sola
      // vez por sesión).
      const text = await cargarFragmento(doc.file);
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