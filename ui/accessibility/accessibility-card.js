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
import { cargarFragmentos, inyectarHtml } from '../base-card.js';

export class AccessibilityCard {
  constructor(root, { withFontSizes = false } = {}) {
    this.root = root;
    this.withFontSizes = withFontSizes;
  }

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar, o si no se montó el bloque de tamaños de letra:
   *  en ese caso la vista ya muestra el aviso. */
  async init() {
    const partes = await cargarFragmentos([
      './ui/accessibility/accessibility-card.html',
      './ui/accessibility/accessibility-card.css',
      './ui/shortcuts/shortcuts-list.html',
      './ui/shortcuts/shortcuts-list.css',
    ], this.root);
    if (!partes) return false;
    const [html, css, listHtml, listCss] = partes;
    inyectarHtml(this.root, html, [
      './ui/accessibility/accessibility-card.css',
      './ui/shortcuts/shortcuts-list.css',
    ], [css, listCss]);
    return await this.mount(listHtml);
  }

  /** Devuelve false si alguna parte de la tarjeta no se montó. */
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
        // Si el bloque no se monta, el fallo se propaga: Ajustes no
        // cachea la tarjeta y la vuelve a montar al cambiar de
        // pestaña (si no, se quedaría rota para siempre, con el
        // aviso a medias).
        return await new AccessibilityFontSizesCard(mount).init();
      }
    }
    return true;
  }
}