// ────────────────────────────────────────────────────────────────────
// ajustes-card.js — Vista "Ajustes": barra de pestañas con todas las
// preferencias y secciones de configuración de la app.
//
// Las pestañas, en este orden, son:
//   1. Apariencia       (ui/settings, sin MCP ni tamaños de letra)
//   2. Accesibilidad    (ui/accessibility + tamaños de letra e icono)
//   3. Datos            (ui/dataManager)
//   4. Imprimir y PDF   (ui/print)
//   5. Asistente (MCP)  (ui/mcp; oculta en Android)
//   6. Legal            (ui/legal)
//
// Cada pestaña reutiliza su tarjeta original: NO copiamos HTML, CSS
// ni JS — instanciamos la clase correspondiente dentro del
// .ajustes-panel que le toca. El título (h2 "Ajustes") lo pone esta
// tarjeta; las tarjetas internas ya no llevan h2/h3 de vista propia.
//
// La navegación por teclado es la del patrón ARIA tablist: flechas
// izquierda/derecha, Inicio y Fin. Solo la pestaña activa tiene
// tabindex=0; las demás, -1. El foco se mueve a la pestaña al
// tabular desde fuera y se restaura con Flecha al cambiar de pestaña.
// ────────────────────────────────────────────────────────────────────

import { Context }                          from '../../context.js';
import { montarTarjeta }                    from '../base-card.js';
import { DataManagerCard }                  from '../dataManager/dataManager-card.js';
import { PrintCard }                        from '../print/print-card.js';
import { LegalCard }                        from '../legal/legal-card.js';
import { SettingsCard }                     from '../settings/settings-card.js';
import { AccessibilityCard }                from '../accessibility/accessibility-card.js';
import { McpCard }                          from '../mcp/mcp-card.js';

// Pestañas en el orden pedido por la tarea. El id se usa para
// aria-labelledby, aria-controls y como clave en el mapa de atajos
// Alt+4…8 de index.js (settings→ajustes se abre en 'appearance').
const TABS = ['appearance', 'accessibility', 'data', 'print', 'mcp', 'legal'];

export class AjustesCard {
  constructor(root, { tab = null } = {}) {
    this.root = root;
    // La pestaña que pidió abrir el llamador (Alt+4…8 o
    // navigate('data'|'print'|...)). Si es null, usamos appearance.
    this.requestedTab = tab && TABS.includes(tab) ? tab : null;
    // Cache de tarjetas ya montadas, para no reinicializar al
    // cambiar de pestaña (los ajustes viven en localStorage y
    // reinicializar rompería el foco del usuario).
    this.cards = {};
  }

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const html = await montarTarjeta(
      this.root,
      './ui/ajustes/ajustes-card.html',
      './ui/ajustes/ajustes-card.css',
    );
    if (!html) return false;
    await this.mount();
    return true;
  }

  async mount() {
    this.tabs   = Array.from(this.root.querySelectorAll('[role="tab"]'));
    this.panels = Object.fromEntries(
      this.tabs.map(t => [t.dataset.tab, this.root.querySelector(`#ajustes-panel-${t.dataset.tab}`)])
    );

    // Pestaña "Asistente (MCP)" no se muestra en Android (no hay
    // backend que arranque el servidor). El criterio dice: "En las
    // plataformas donde la sección no está disponible (Android), no
    // aparece la pestaña." Lo ocultamos con el atributo hidden.
    if (/android/i.test(navigator.userAgent)) {
      this.root.querySelector('#ajustes-tab-mcp').hidden = true;
      this.root.querySelector('#ajustes-panel-mcp').hidden = true;
    }

    // Click sobre una pestaña: la activa y enfoca su panel. Usamos
    // mousedown/click para que sea interactuable como un botón.
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.showTab(tab.dataset.tab, { focusTab: true }));
    });

    // Navegación por teclado del tablist (patrón ARIA): flechas
    // izquierda/derecha cambian de pestaña, Inicio/Fin van a la
    // primera/última. El foco va al tab y se actualiza el panel.
    this.root.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
      const idx = this.tabs.indexOf(document.activeElement);
      if (idx < 0) return;
      let target = -1;
      // Solo consideramos pestañas visibles (no ocultas con hidden).
      const visible = this.tabs.filter(t => !t.hidden);
      const vIdx = visible.indexOf(document.activeElement);
      if (vIdx < 0) return;
      switch (e.key) {
        case 'ArrowLeft':  target = (vIdx - 1 + visible.length) % visible.length; break;
        case 'ArrowRight': target = (vIdx + 1) % visible.length; break;
        case 'Home':       target = 0; break;
        case 'End':        target = visible.length - 1; break;
      }
      if (target < 0) return;
      e.preventDefault();
      this.showTab(visible[target].dataset.tab, { focusTab: true });
    });

    // Pestaña inicial. Si el llamador pidió una concreta y existe,
    // la usamos; si no, abrimos 'appearance'.
    const initial = this.requestedTab ?? 'appearance';
    await this.showTab(initial, { focusTab: false });
  }

  /** Activa la pestaña `name`, monta la tarjeta dentro de su panel si
   *  todavía no estaba, y (opcionalmente) lleva el foco a la pestaña
   *  activa. Los demás paneles se ocultan con hidden. */
  async showTab(name, { focusTab = false } = {}) {
    const tab = this.tabs.find(t => t.dataset.tab === name && !t.hidden);
    if (!tab) return;

    // Tabindex itinerante: solo la activa.
    this.tabs.forEach(t => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.setAttribute('tabindex', selected ? '0' : '-1');
    });

    // Mostramos el panel de la pestaña activa y ocultamos los demás.
    Object.entries(this.panels).forEach(([k, panel]) => {
      panel.hidden = k !== name;
    });

    // Montamos la sub-tarjeta perezosamente. Esperamos a que esté
    // lista antes de enfocar la pestaña, para que el lector de
    // pantallas anuncie el panel al recibir el foco.
    await this.#ensureCard(name);

    if (focusTab) tab.focus();
  }

  async #ensureCard(name) {
    const panel = this.panels[name];
    if (!panel) return;
    if (this.cards[name]) return;
    if (panel.dataset.mounted === '1') return;

    let card;
    switch (name) {
      case 'appearance':
        card = new SettingsCard(panel, { appearanceOnly: true });
        break;
      case 'accessibility':
        card = new AccessibilityCard(panel, { withFontSizes: true });
        break;
      case 'data':
        card = new DataManagerCard(panel, Context);
        break;
      case 'print':
        card = new PrintCard(panel, Context);
        break;
      case 'mcp':
        card = new McpCard(panel);
        break;
      case 'legal':
        card = new LegalCard(panel);
        break;
      default:
        return;
    }
    // La tarjeta se cachea SOLO si se ha montado bien. Si su HTML no se
    // pudo cargar, avisó en el panel y se vuelve a montar al cambiar de
    // pestaña: cacheándola antes de esperar, se quedaría rota para
    // siempre (sin contenido y sin poder reintentarse).
    if (!await card.init()) return;
    this.cards[name] = card;
    panel.dataset.mounted = '1';
  }

  /** Devuelve la pestaña activa actual. Lo usa index.js para saber en
   *  qué pestaña quedó Ajustes tras un Alt+N y mover el foco al
   *  heading cuando corresponde. */
  getActiveTab() {
    const sel = this.tabs.find(t => t.getAttribute('aria-selected') === 'true');
    return sel?.dataset.tab ?? null;
  }
}