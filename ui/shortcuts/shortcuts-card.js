// ────────────────────────────────────────────────────────────────────
// ui/shortcuts/shortcuts-card.js
//
// Diálogo modal con la lista de atajos de teclado de la aplicación.
// Se abre desde el botón "Atajos de teclado" del lateral o desde el
// atajo global `?` (gestionado en index.js). Traba el foco mientras
// está abierto y lo devuelve al elemento que lo abrió al cerrarse.
// ────────────────────────────────────────────────────────────────────

import { trapFocus } from '../a11y.js';

export class ShortcutsCard {
  constructor() {
    this.root       = null;       // se inyecta la primera vez
    this.content    = null;
    this.closeBtn   = null;
    this.releaseTrap = null;
    this._isOpen    = false;
  }

  /** Carga el HTML y CSS perezosamente (la primera vez que se abre).
   *  El cuerpo de la lista de atajos se carga aparte (./shortcuts-list.html)
   *  y sus estilos de ui/shortcuts/shortcuts-list.css para no duplicar
   *  HTML: el mismo HTML y CSS los inyecta la vista Accesibilidad
   *  (ui/accessibility/accessibility-card.js). */
  async ensureMounted() {
    if (this.root && document.body.contains(this.root)) return;
    const [html, css, listHtml, listCss] = await Promise.all([
      fetch('./ui/shortcuts/shortcuts-card.html').then(r => r.text()),
      fetch('./ui/shortcuts/shortcuts-card.css').then(r => r.text()),
      fetch('./ui/shortcuts/shortcuts-list.html').then(r => r.text()),
      fetch('./ui/shortcuts/shortcuts-list.css').then(r => r.text()),
    ]);
    const wrap = document.createElement('div');
    wrap.innerHTML = `<style>${css}${listCss}</style>${html}`;
    document.body.appendChild(wrap);
    this.root     = wrap.querySelector('#shortcuts-modal');
    this.content  = wrap.querySelector('.shortcuts-content');
    this.closeBtn = wrap.querySelector('#shortcuts-close');
    this.body     = wrap.querySelector('#shortcuts-body');
    // Detrás de la intro propia del diálogo (shortcuts-card.html).
    this.body.insertAdjacentHTML('beforeend', listHtml);

    this.closeBtn.addEventListener('click', () => this.close());
    // Clic fuera del panel también cierra, igual que el modal legal.
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
  }

  async open(trigger = null) {
    await this.ensureMounted();
    if (trigger) this._trigger = trigger;
    if (this._isOpen) return;           // ya abierto: no re-trabar el foco
    this.root.hidden = false;
    this._isOpen = true;
    // Hay que esperar al siguiente frame para que el modal sea visible
    // antes de mover el foco y bloquear el scroll.
    requestAnimationFrame(() => {
      document.body.classList.add('shortcuts-modal-open');
      this.releaseTrap = trapFocus(this.content, { onEscape: () => this.close() });
      // Foco explícito en el contenido para lectores de pantalla
      // (`role=dialog` no enfoca automáticamente).
      this.content.focus({ preventScroll: true });
    });
  }

  close() {
    if (!this.root || !this._isOpen) return;
    this.root.hidden = true;
    this._isOpen = false;
    document.body.classList.remove('shortcuts-modal-open');
    if (this.releaseTrap) { this.releaseTrap(); this.releaseTrap = null; }
    if (this._trigger && typeof this._trigger.focus === 'function') {
      this._trigger.focus();
    }
    this._trigger = null;
  }
}

// Instancia compartida: si cada llamador creara una nueva, cada modal se
// inyectaría de nuevo en <body> (ids #shortcuts-modal duplicados y nodos
// acumulados). Compartiendo la misma, garantizamos un único nodo.
export const shortcuts = new ShortcutsCard();
