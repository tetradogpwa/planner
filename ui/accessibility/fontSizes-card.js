// ────────────────────────────────────────────────────────────────────
// accessibility/fontSizes-card.js
//
// Bloque "Tamaños de letra" (general + por partes) + "Tamaño de los
// iconos del menú contraído en pantallas táctiles" dentro de la
// pestaña Accesibilidad de Ajustes (T-022). Antes vivía en
// ui/settings/settings-card.{js,html,css}; se movió aquí porque la
// pestaña Apariencia ahora solo cubre tema y colores. La lógica de
// preferencias (leer/escribir localStorage, aplicar al DOM) sigue
// en ui/settings/preferences.js.
// ────────────────────────────────────────────────────────────────────

import { montarTarjeta } from '../base-card.js';
import {
  getPreferences,
  setPreferences,
  TEXT_SCALES,
  SIZE_ROLES,
  SIZE_MIN,
  SIZE_MAX,
  SIZE_STEP,
  NAV_ICON_MIN,
  NAV_ICON_MAX,
} from '../settings/preferences.js';

const SCALE_LABELS = {
  100: 'Normal',
  115: 'Grande',
  130: 'Más grande',
  150: 'Muy grande',
  175: 'Enorme',
  200: 'Máximo',
};

export class AccessibilityFontSizesCard {
  constructor(root) {
    this.root = root;
  }

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const html = await montarTarjeta(
      this.root,
      './ui/accessibility/fontSizes-card.html',
      './ui/settings/settings-shared.css',
      './ui/accessibility/fontSizes-card.css',
    );
    if (!html) return false;
    this.mount();
    return true;
  }

  $(selector) { return this.root.querySelector(selector); }

  mount() {
    const prefs = getPreferences();

    this.renderTextScales();
    this.renderSizeRows();

    this.$(`input[name="textScale"][value="${prefs.textScale}"]`).checked = true;
    this.syncSizes();
    this.syncNavIconSize();

    this.root.addEventListener('change', (e) => {
      if (e.target.name === 'textScale') {
        setPreferences({ textScale: Number(e.target.value) });
      }
    });

    // Tamaños por partes.
    this.root.querySelectorAll('[data-size]').forEach(input =>
      input.addEventListener('input', () => {
        const { sizes } = getPreferences();
        setPreferences({ sizes: { ...sizes, [input.dataset.size]: Number(input.value) } });
        this.$(`#size-${input.dataset.size}-value`).textContent = `${input.value} %`;
        input.setAttribute('aria-valuetext', `${input.value} por ciento`);
      })
    );

    this.$('#sizesReset').addEventListener('click', () => {
      setPreferences({ sizes: {} });
      this.syncSizes();
    });

    // Tamaño del icono del menú lateral (solo tema personalizado).
    this.$('#navIconSize').addEventListener('input', () => this.setNavIconSize());
  }

  // ── Tamaño general ────────────────────────────────────────────────

  renderTextScales() {
    this.$('#textScaleOptions').innerHTML = TEXT_SCALES.map(scale => `
      <label class="settings-option">
        <input type="radio" name="textScale" value="${scale}">
        <span>${SCALE_LABELS[scale]} <small>(${scale}%)</small></span>
      </label>`).join('');
  }

  // ── Tamaño por partes ─────────────────────────────────────────────

  renderSizeRows() {
    this.$('#sizeRows').innerHTML = SIZE_ROLES.map(role => `
      <div class="size-row">
        <div class="size-row-head">
          <label for="size-${role.id}">${role.label}</label>
          <output id="size-${role.id}-value" for="size-${role.id}">100 %</output>
        </div>
        <input type="range" id="size-${role.id}" data-size="${role.id}"
               min="${SIZE_MIN}" max="${SIZE_MAX}" step="${SIZE_STEP}" value="100">
        <span class="size-sample${role.upper ? ' is-upper' : ''}"
              style="font-size: calc(${role.base}rem * var(--fs-${role.id}))">${role.sample}</span>
      </div>`).join('');
  }

  syncSizes() {
    const { sizes } = getPreferences();
    for (const role of SIZE_ROLES) {
      const value = sizes[role.id] ?? 100;
      const input = this.$(`#size-${role.id}`);
      input.value = value;
      input.setAttribute('aria-valuetext', `${value} por ciento`);
      this.$(`#size-${role.id}-value`).textContent = `${value} %`;
    }
  }

  // ── Tamaño del icono del menú ─────────────────────────────────────

  /** Sincroniza el slider del tamaño de icono del menú lateral. */
  syncNavIconSize() {
    const prefs = getPreferences();
    const value = prefs.custom.navIconSize ?? 64;
    const input = this.$('#navIconSize');
    const out   = this.$('#navIconSizeValue');
    if (input.value !== String(value)) input.value = String(value);
    out.textContent = `${value} px`;
    out.setAttribute('aria-valuetext', `${value} píxeles`);
  }

  /** Cambia el tamaño del icono del menú lateral en el tema personalizado. */
  setNavIconSize() {
    const input = this.$('#navIconSize');
    const value = Math.min(NAV_ICON_MAX, Math.max(NAV_ICON_MIN, Number(input.value) || 64));
    const { theme, custom } = getPreferences();
    if (theme !== 'custom') {
      setPreferences({ theme: 'custom', custom: { ...custom, navIconSize: value, savedId: null } });
    } else {
      setPreferences({ custom: { ...custom, navIconSize: value } });
    }
    this.$('#navIconSizeValue').textContent = `${value} px`;
  }
}