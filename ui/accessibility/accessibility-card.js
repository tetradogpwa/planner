// ────────────────────────────────────────────────────────────────────
// accessibility-card.js
//
// Pestaña "Accesibilidad" de Ajustes (T-022): la lista completa de
// atajos de teclado como contenido de la página y, si
// Ajustes pasa withFontSizes=true, también los tamaños de letra y
// el tamaño del icono del menú contraído en pantallas táctiles
// (ui/accessibility/fontSizes-card).
//
// La lista en sí se carga desde ui/shortcuts/shortcuts-list.html y
// sus estilos de ui/shortcuts/shortcuts-list.css para no duplicar
// HTML: el mismo archivo lo usa el diálogo modal
// (ui/shortcuts/shortcuts-card.js).
// ────────────────────────────────────────────────────────────────────

import { shortcuts } from '../shortcuts/shortcuts-card.js';
import { AccessibilityFontSizesCard } from './fontSizes-card.js';

export class AccessibilityCard {
  constructor(root, { withFontSizes = false } = {}) {
    this.root = root;
    this.withFontSizes = withFontSizes;
  }

  async init() {
    const [html, css, listHtml, listCss] = await Promise.all([
      fetch('./ui/accessibility/accessibility-card.html').then(r => r.text()),
      fetch('./ui/accessibility/accessibility-card.css').then(r => r.text()),
      fetch('./ui/shortcuts/shortcuts-list.html').then(r => r.text()),
      fetch('./ui/shortcuts/shortcuts-list.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}${listCss}</style>${html}`;
    await this.mount(listHtml);
  }

  async mount(listHtml) {
    this.root.querySelector('#accessibility-shortcuts').innerHTML = listHtml;

    // Enlace para abrir la ayuda como diálogo modal.
    const openHelp = this.root.querySelector('#accessibility-open-help');
    if (openHelp) {
      openHelp.addEventListener('click', (e) => {
        e.preventDefault();
        shortcuts.open(openHelp);
      });
    }

    // Bloque de tamaños de letra. Lo monta una tarjeta aparte para no
    // duplicar lógica ni HTML entre Apariencia (vieja ubicación) y
    // Accesibilidad (nueva). Solo se monta si Ajustes lo pidió.
    if (this.withFontSizes) {
      const mount = this.root.querySelector('#accessibility-fontsizes-mount');
      if (mount) {
        await new AccessibilityFontSizesCard(mount).init();
      }
    }
  }
}