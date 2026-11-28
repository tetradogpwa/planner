// ────────────────────────────────────────────────────────────────────
// settings-card.js — Pestaña "Apariencia" de Ajustes (T-022): tema
// (incluido uno propio con guardado) y las acciones que lo cambian.
// Antes era la vista completa de ui/settings; ahora solo cubre esto.
// Los tamaños de letra (general y por partes) y el tamaño del icono
// del menú contraído están en ui/accessibility/fontSizes-card; la
// sección "Control por asistente (MCP)" está en ui/mcp/mcp-card.
// El panel de colores y contraste: ui/settings/contrastPanel. Las
// listas de temas: ui/settings/savedThemesList.
// ────────────────────────────────────────────────────────────────────

import {
  getPreferences,
  setPreferences,
  customColors,
  getSavedThemes,
  addSavedTheme,
  applySavedTheme,
  deleteSavedTheme,
  saveSavedThemes,
  BASES,
  SAVED_PREFIX,
} from './preferences.js';
import { montarTarjeta } from '../base-card.js';
import { mostrarAviso } from '../avisos.js';
import {
  renderColorRows,
  renderContrast as renderContrastPanel,
  syncColorInputs as syncColorInputsPanel,
} from './contrastPanel.js';
import {
  renderBaseOptions as renderBaseOptionsList,
  renderSavedThemes as renderSavedThemesList,
  syncAutoMapping as syncAutoMappingPanel,
} from './savedThemesList.js';

export class SettingsCard {
  constructor(root) {
    this.root = root;
  }

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const html = await montarTarjeta(
      this.root,
      './ui/settings/settings-card.html',
      './ui/settings/settings-shared.css',
      './ui/settings/settings-card.css',
    );
    if (!html) return false;
    this.mount();
    return true;
  }

  $(selector) {
    return this.root.querySelector(selector);
  }

  mount() {
    const prefs = getPreferences();

    this.editMode = false;

    this.renderBaseOptions();
    renderColorRows(this.$('#colorGroups'), {
      onColor: (clave, valor, opciones) => this.setColor(clave, valor, opciones),
    });
    this.renderSavedThemes();

    this.markActiveThemeRadio();
    this.$('#customBase').value = prefs.custom.base;
    this.syncAutoMapping();
    this.syncCustomTheme();
    this.syncDraftStatus();

    this.root.addEventListener('change', (e) => {
      if (e.target.name === 'theme') {
        const value = e.target.value;
        if (value.startsWith(SAVED_PREFIX)) {
          const result = applySavedTheme(value.slice(SAVED_PREFIX.length));
          if (!result) {
            const { custom } = getPreferences();
            setPreferences({ theme: 'custom', custom: { ...custom, savedId: null } });
          } else {
            setPreferences({ theme: 'custom' });
          }
        } else {
          setPreferences({ theme: value });
        }
        this.syncAutoMapping();
        this.syncCustomTheme();
        this.syncDraftStatus();
      }
    });

    this.$('#autoLight').addEventListener('change', () => {
      setPreferences({ autoLight: this.$('#autoLight').value });
    });
    this.$('#autoDark').addEventListener('change', () => {
      setPreferences({ autoDark: this.$('#autoDark').value });
    });

    // Modo edición: muestra u oculta el editor de temas personalizados
    // y la vista previa.
    this.$('#customEditToggle').addEventListener('change', (e) => {
      this.editMode = e.target.checked;
      this.syncEditorVisibility();
      this.renderSavedThemes();
    });

    this.$('#customBaseApply').addEventListener('click', () => this.loadBase());
    this.$('#customRestore').addEventListener('click', () => this.restoreTheme());
    this.$('#customSave').addEventListener('click', () => this.saveCurrentTheme());
    this.$('#customName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveCurrentTheme();
      }
    });

    // Sugerencias automáticas de la lista de contraste (delegación).
    this.$('#contrastList').addEventListener('click', (e) => {
      const btn = e.target.closest('.contrast-fix');
      if (!btn) return;
      this.setColor(btn.dataset.target, btn.dataset.value);
    });

    // Estado inicial de visibilidad.
    this.syncEditorVisibility();
  }

  // ── Tema propio ───────────────────────────────────────────────────

  /** Pinta el desplegable «Empezar desde»: estilos base y temas guardados. */
  renderBaseOptions() {
    renderBaseOptionsList(this.$('#customBase'), getSavedThemes());
  }

  setColor(key, value, { fromHex = false } = {}) {
    const { theme, custom } = getPreferences();
    // Si el tema activo es uno de los predefinidos, el cambio se hace
    // sobre un borrador: pasamos a «custom» sin tema guardad.
    if (theme !== 'custom') {
      setPreferences({ theme: 'custom', custom: { ...custom, savedId: null } });
      this.enterDraft();
    } else {
      setPreferences({ custom: { ...custom, colors: { ...custom.colors, [key]: value } } });
    }
    if (fromHex) this.$(`#color-${key}`).value = value;
    else this.$(`#hex-${key}`).value = value;
    this.renderContrast();
  }

  loadBase() {
    const value = this.$('#customBase').value;
    const { theme, custom } = getPreferences();
    if (value.startsWith(SAVED_PREFIX)) {
      const themeId = value.slice(SAVED_PREFIX.length);
      const themeEntry = getSavedThemes().find(t => t.id === themeId);
      if (themeEntry) {
        if (theme !== 'custom') {
          setPreferences({ theme: 'custom', custom: { ...custom, savedId: null } });
        } else {
          setPreferences({
            custom: {
              base: themeEntry.base,
              colors: { ...themeEntry.colors },
              scheme: themeEntry.scheme ?? null,
              savedId: null,
            },
          });
        }
        this.$('#customBase').value = themeEntry.base;
        this.syncColorInputs();
        this.syncCustomScheme();
        this.renderContrast();
        this.renderSavedThemes();
        this.enterDraft();
        this.$('#customBaseStatus').textContent = `Cargado «${themeEntry.name}» como punto de partida.`;
        return;
      }
    }
    const base = value;
    if (theme !== 'custom') {
      setPreferences({ theme: 'custom', custom: { ...custom, savedId: null } });
    } else {
      setPreferences({ custom: { base, colors: {}, savedId: null } });
    }
    this.syncColorInputs();
    this.renderContrast();
    this.renderSavedThemes();
    this.enterDraft();
    this.$('#customBaseStatus').textContent = `Colores de «${BASES[base].label}» cargados.`;
  }

  /** Revierte todos los colores personalizados al estado original del base. */
  restoreTheme() {
    const { theme, custom } = getPreferences();
    const base = custom.base;
    if (theme !== 'custom') {
      setPreferences({ theme: 'custom', custom: { ...custom, base, colors: {}, savedId: null } });
    } else {
      setPreferences({ custom: { base, colors: {}, savedId: null } });
    }
    this.syncColorInputs();
    this.renderContrast();
    this.renderSavedThemes();
    this.enterDraft();
    this.$('#customBaseStatus').textContent =
      `Tema restaurado a «${BASES[base].label}».`;
    const btn = this.$('#customRestore');
    btn.classList.add('is-flashing');
    setTimeout(() => btn.classList.remove('is-flashing'), 350);
  }

  /** Guarda el estado actual con el nombre que haya en el input. */
  saveCurrentTheme() {
    const input = this.$('#customName');
    const name = input.value.trim();
    const status = this.$('#customSaveStatus');
    if (!name) {
      status.textContent = 'Escribe un nombre antes de guardar.';
      input.focus();
      return;
    }
    const scheme = this.root.querySelector('input[name="customScheme"]:checked')?.value;
    try {
      addSavedTheme(name, undefined, scheme);
      input.value = '';
      this.renderBaseOptions();
      this.renderSavedThemes();
      this.markActiveThemeRadio();
      this.syncDraftStatus();
      status.textContent = `Tema «${name}» guardado.`;
    } catch (err) {
      status.textContent = err.message ?? 'No se pudo guardar el tema.';
    }
  }

  /** Elimina el tema guardado cuyo botón «Eliminar» se ha pulsado.
   *
   *  El borrado se puede deshacer: sale un aviso con «Deshacer» que
   *  vuelve a guardar el tema tal como estaba (T-053). Por eso no
   *  hace falta la pregunta de confirmación del navegador (que además
   *  no se puede teñir con el tema). */
  removeSavedTheme(button) {
    const id = button.dataset.id;
    if (!id) return;
    const theme = getSavedThemes().find(t => t.id === id);
    if (!theme) {
      this.$('#savedThemesStatus').textContent = 'Ese tema ya no está disponible.';
      this.renderBaseOptions();
      this.renderSavedThemes();
      return;
    }
    deleteSavedTheme(id);
    this.renderBaseOptions();
    this.renderSavedThemes();
    this.syncAutoMapping();
    this.syncCustomTheme();
    this.markActiveThemeRadio();
    this.syncDraftStatus();
    this.$('#savedThemesStatus').textContent = `Tema «${theme.name}» eliminado.`;
    mostrarAviso({
      texto: `Tema «${theme.name}» eliminado`,
      alPulsarAccion: () => this.#restaurarTema(theme),
    });
    const firstRadio = this.$('input[name="theme"]');
    if (firstRadio) firstRadio.focus();
    else this.$('#customEditToggle')?.focus();
  }

  /** Vuelve a guardar un tema que se había borrado (T-053): con su
   *  id, sus colores y su base, tal como estaba. */
  #restaurarTema(theme) {
    const lista = getSavedThemes();
    if (lista.some(t => t.id === theme.id)) return;   // ya está
    saveSavedThemes([...lista, theme]);
    this.renderBaseOptions();
    this.renderSavedThemes();
    this.syncAutoMapping();
    this.syncCustomTheme();
    this.markActiveThemeRadio();
    this.syncDraftStatus();
    this.$('#savedThemesStatus').textContent = `Tema «${theme.name}» restaurado.`;
    // El aviso ya no está: el foco vuelve al tema restaurado.
    const radios = Array.from(this.root.querySelectorAll('input[name="theme"]'));
    const radio  = radios.find(r => r.value === SAVED_PREFIX + theme.id);
    if (radio) radio.focus();
    else this.$('#customEditToggle')?.focus();
  }

  /** Pinta los temas guardados como radios del fieldset «Tema». */
  renderSavedThemes() {
    const container = this.$('#savedThemeOptions');
    if (!container) return;
    renderSavedThemesList(container, getSavedThemes(), {
      editable: this.editMode,
      onRemove: btn => this.removeSavedTheme(btn),
    });
    this.syncAutoMapping();
  }

  syncCustomTheme() {
    this.syncCustomScheme();
    this.syncColorInputs();
    this.renderContrast();
    this.syncEditorVisibility();
    this.markActiveThemeRadio();
    this.syncDraftStatus();
  }

  /** Marca el radio del fieldset «Tema» según el estado actual. */
  markActiveThemeRadio() {
    const prefs = getPreferences();
    const radios = this.root.querySelectorAll('input[name="theme"]');
    let targetValue = null;
    if (prefs.theme === 'custom' && prefs.custom.savedId) {
      targetValue = SAVED_PREFIX + prefs.custom.savedId;
    } else if (prefs.theme !== 'custom') {
      targetValue = prefs.theme;
    }
    radios.forEach(r => { r.checked = targetValue !== null && r.value === targetValue; });
  }

  /** Pasa al estado de borrador: desmarca todos los radios. */
  enterDraft() {
    this.root.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = false; });
    this.syncDraftStatus();
  }

  /** Muestra u oculta el aviso «Tema sin guardar». */
  syncDraftStatus() {
    const prefs = getPreferences();
    const isDraft = prefs.theme === 'custom' && !prefs.custom.savedId;
    const draft = this.$('#draftStatus');
    if (draft) draft.hidden = !isDraft;
  }

  /** Muestra u oculta los bloques que dependen del modo edición. */
  syncEditorVisibility() {
    const edit = this.editMode;
    const showEditor = edit;
    const showPreview = edit;
    const editor   = this.$('#customTheme');
    const saveForm = this.$('#customSaveFieldset');
    const preview  = this.$('#settingsPreview');
    const hidingSomething = !showEditor || !showPreview;
    if (hidingSomething) {
      const active = document.activeElement;
      const insideEditor =
        active && active !== document.body && (
          (editor   && editor.contains(active)) ||
          (saveForm && saveForm.contains(active))
        );
      const insidePreview =
        active && active !== document.body && (preview && preview.contains(active));
      if ((!showEditor && insideEditor) || (!showPreview && insidePreview)) {
        const toggle = this.$('#customEditToggle');
        if (toggle) toggle.focus();
      }
    }
    if (editor)   editor.hidden   = !showEditor;
    if (saveForm) saveForm.hidden = !showEditor;
    if (preview)  preview.hidden  = !showPreview;
  }

  /** Marca el radio de esquema (Claro/Oscuro) según el borrador. */
  syncCustomScheme() {
    const prefs = getPreferences();
    const scheme = prefs.custom.scheme
      ?? BASES[prefs.custom.base]?.scheme
      ?? 'dark';
    this.root.querySelectorAll('input[name="customScheme"]').forEach(input => {
      input.checked = input.value === scheme;
    });
  }

  /** Sincroniza el bloque de mapeo del modo automático. */
  syncAutoMapping() {
    const prefs = getPreferences();
    syncAutoMappingPanel(this.$('#autoMapping'), {
      isAuto: prefs.theme === 'auto',
      autoLight: prefs.autoLight,
      autoDark: prefs.autoDark,
    });
  }

  syncColorInputs() {
    syncColorInputsPanel(this.$('#colorGroups'));
  }

  renderContrast() {
    renderContrastPanel(this.$('.contrast-panel'), customColors());
  }
}
