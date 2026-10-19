// ────────────────────────────────────────────────────────────────────
// accessibility-card.js
//
// Vista "Accesibilidad": la lista completa de atajos de teclado como
// contenido de la página (no en un diálogo). Se abre desde el menú
// lateral o con Alt+8; también está disponible como diálogo con la
// tecla "?" en cualquier parte.
//
// La lista en sí se carga desde ui/shortcuts/shortcuts-list.html y sus
// estilos de ui/shortcuts/shortcuts-list.css para no duplicar HTML: el
// mismo archivo lo usa el diálogo modal (ui/shortcuts/shortcuts-card.js).
// ────────────────────────────────────────────────────────────────────

import { shortcuts } from '../shortcuts/shortcuts-card.js';

export class AccessibilityCard {
  constructor(root) {
    this.root = root;
  }

  async init() {
    const [html, css, listHtml, listCss] = await Promise.all([
      fetch('./ui/accessibility/accessibility-card.html').then(r => r.text()),
      fetch('./ui/accessibility/accessibility-card.css').then(r => r.text()),
      fetch('./ui/shortcuts/shortcuts-list.html').then(r => r.text()),
      fetch('./ui/shortcuts/shortcuts-list.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}${listCss}</style>${html}`;
    this.mount(listHtml);
  }

  mount(listHtml) {
    // Inyectamos la lista compartida dentro del contenedor de la vista.
    this.root.querySelector('#accessibility-shortcuts').innerHTML = listHtml;

    // Enlace para abrir la ayuda como diálogo modal.
    const openHelp = this.root.querySelector('#accessibility-open-help');
    if (openHelp) {
      openHelp.addEventListener('click', (e) => {
        e.preventDefault();
        shortcuts.open(openHelp);
      });
    }
  }
}