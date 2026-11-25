// ────────────────────────────────────────────────────────────────────
// ui/shortcuts/shortcuts-card.js
//
// Diálogo modal con la lista de atajos de teclado de la aplicación.
// Se abre desde el botón "Atajos de teclado" del lateral o desde el
// atajo global `?` (gestionado en index.js). Traba el foco mientras
// está abierto y lo devuelve al elemento que lo abrió al cerrarse.
// ────────────────────────────────────────────────────────────────────

import { trapFocus } from '../a11y.js';
import { cargarFragmentos, inyectarHtml } from '../base-card.js';

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
    const wrap = document.createElement('div');
    const partes = await cargarFragmentos([
      './ui/shortcuts/shortcuts-card.html',
      './ui/shortcuts/shortcuts-card.css',
      './ui/shortcuts/shortcuts-list.html',
      './ui/shortcuts/shortcuts-list.css',
    ], wrap);
    if (!partes) {
      // No se han podido descargar los recursos del diálogo: el aviso
      // ya está en el wrap, que se deja en la página para que se vea.
      document.body.appendChild(wrap);
      return;
    }
    const [html, css, listHtml, listCss] = partes;
    inyectarHtml(wrap, html, [
      './ui/shortcuts/shortcuts-card.css',
      './ui/shortcuts/shortcuts-list.css',
    ], [css, listCss]);
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
    if (!this.root) return;   // el diálogo no se ha podido cargar
    if (trigger) this._trigger = trigger;
    if (this._isOpen) return;           // ya abierto: no re-trabar el foco
    this.root.hidden = false;
    this._isOpen = true;
    // La trampa de foco (y con ella el manejador de Escape) se registra
    // AL ABRIR, no en el siguiente frame: si se registrara más tarde,
    // el Escape que se pulsa nada más abrir se perdería (el modal ya
    // está visible, pero todavía no escucha y el foco sigue fuera de
    // él, así que el keydown ni siquiera le llega al contenedor).
    this.releaseTrap = trapFocus(this.content, { onEscape: () => this.close() });
    requestAnimationFrame(() => {
      if (!this._isOpen) return;   // se cerró antes del siguiente frame
      document.body.classList.add('shortcuts-modal-open');
      // Foco explícito en el contenido para lectores de pantalla
      // (`role=dialog` no enfoca automáticamente), en el siguiente
      // frame, cuando el modal ya está pintado.
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
