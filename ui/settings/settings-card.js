// ────────────────────────────────────────────────────────────────────
// settings-card.js — Pestaña "Apariencia" de Ajustes (T-022): tema
// (incluido uno propio con guardado), comprobación de contraste y
// vista previa. Antes era la vista completa de ui/settings; ahora
// solo cubre esto. Los tamaños de letra (general y por partes) y el
// tamaño del icono del menú contraído están en
// ui/accessibility/fontSizes-card; la sección "Control por asistente
// (MCP)" está en ui/mcp/mcp-card.
// ────────────────────────────────────────────────────────────────────

import {
  getPreferences,
  setPreferences,
  customColors,
  contrastRatio,
  isHexColor,
  suggestContrastFixes,
  getSavedThemes,
  addSavedTheme,
  applySavedTheme,
  deleteSavedTheme,
  autoTargetOptions,
  COLOR_GROUPS,
  BASES,
  CONTRAST_CHECKS,
} from './preferences.js';

const formatRatio = (r) => r.toFixed(2).replace('.', ',');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export class SettingsCard {
  constructor(root) {
    this.root = root;
  }

  async init() {
    const [html, css, sharedCss] = await Promise.all([
      fetch('./ui/settings/settings-card.html').then(r => r.text()),
      fetch('./ui/settings/settings-card.css').then(r => r.text()),
      fetch('./ui/settings/settings-shared.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${sharedCss}${css}</style>${html}`;
    this.mount();
  }

  $(selector) {
    return this.root.querySelector(selector);
  }

  mount() {
    const prefs = getPreferences();

    this.editMode = false;

    this.renderBaseOptions();
    this.renderColorRows();
    this.renderSavedThemes();

    this.markActiveThemeRadio();
    this.$('#customBase').value = prefs.custom.base;
    this.syncAutoMapping();
    this.syncCustomTheme();
    this.syncDraftStatus();

    this.root.addEventListener('change', (e) => {
      if (e.target.name === 'theme') {
        const value = e.target.value;
        if (value.startsWith('saved:')) {
          const result = applySavedTheme(value.slice('saved:'.length));
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

    // Botón Eliminar de cada tema guardado (delegado en la raíz).
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('.saved-theme-delete');
      if (!btn) return;
      this.removeSavedTheme(btn);
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

  renderBaseOptions() {
    const baseOptions = Object.entries(BASES)
      .map(([id, base]) => `<option value="${id}">${base.label}</option>`)
      .join('');
    const savedThemes = getSavedThemes();
    const savedOptions = savedThemes.length === 0 ? '' :
      `<optgroup label="Tus temas guardados">${
        savedThemes.map(t => {
          const scheme = t.scheme ?? BASES[t.base]?.scheme ?? 'dark';
          const icon = scheme === 'light' ? '☀' : '🌙';
          return `<option value="saved:${escapeHtml(t.id)}">${icon} ${escapeHtml(t.name)}</option>`;
        }).join('')
      }</optgroup>`;
    this.$('#customBase').innerHTML = baseOptions + savedOptions;
  }

  renderColorRows() {
    this.$('#colorGroups').innerHTML = COLOR_GROUPS.map(group => `
      <fieldset class="color-group">
        <legend>${group.title}</legend>
        ${group.items.map(item => `
          <div class="color-row">
            <label for="color-${item.id}">${item.label}</label>
            <input type="color" id="color-${item.id}" data-color="${item.id}">
            <input type="text" id="hex-${item.id}" data-hex="${item.id}" class="hex-input"
                   inputmode="text" maxlength="7" spellcheck="false" autocomplete="off"
                   aria-label="Código de color: ${item.label}">
          </div>`).join('')}
      </fieldset>`).join('');

    // Selector visual: cambio inmediato.
    this.root.querySelectorAll('[data-color]').forEach(input =>
      input.addEventListener('input', () => this.setColor(input.dataset.color, input.value))
    );
    // Código hexadecimal: para teclado y para sistemas sin selector de color.
    this.root.querySelectorAll('[data-hex]').forEach(input => {
      input.addEventListener('input', () => {
        let value = input.value.trim();
        if (value && !value.startsWith('#')) value = `#${value}`;
        const valid = isHexColor(value);
        input.setAttribute('aria-invalid', String(!valid && value.length > 0));
        if (valid) this.setColor(input.dataset.hex, value.toLowerCase(), { fromHex: true });
      });
      input.addEventListener('blur', () => this.syncColorInputs());
    });
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
    if (value.startsWith('saved:')) {
      const themeId = value.slice('saved:'.length);
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

  /** Elimina el tema guardado cuyo botón «Eliminar» se ha pulsado. */
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
    const ok = confirm(`¿Eliminar el tema guardado «${theme.name}»?`);
    if (!ok) return;
    deleteSavedTheme(id);
    this.renderBaseOptions();
    this.renderSavedThemes();
    this.syncAutoMapping();
    this.syncCustomTheme();
    this.markActiveThemeRadio();
    this.syncDraftStatus();
    this.$('#savedThemesStatus').textContent = `Tema «${theme.name}» eliminado.`;
    const firstRadio = this.$('input[name="theme"]');
    if (firstRadio) firstRadio.focus();
    else this.$('#customEditToggle')?.focus();
  }

  /** Pinta los temas guardados como radios del fieldset «Tema». */
  renderSavedThemes() {
    const container = this.$('#savedThemeOptions');
    if (!container) return;
    const themes = getSavedThemes();

    if (themes.length === 0) {
      container.innerHTML = '';
      this.syncAutoMapping();
      return;
    }

    container.innerHTML = themes.map(theme => {
      const scheme = theme.scheme ?? BASES[theme.base]?.scheme ?? 'dark';
      const icon = scheme === 'light' ? '☀' : '🌙';
      const deleteBtn = this.editMode
        ? `<button type="button" class="settings-btn saved-theme-delete" data-id="${theme.id}"
                 aria-label="Eliminar el tema «${escapeHtml(theme.name)}»">Eliminar</button>`
        : '';
      return `
        <div class="saved-theme-row">
          <label class="settings-option saved-theme-option">
            <input type="radio" name="theme" value="saved:${theme.id}">
            <span aria-hidden="true">${icon}</span>
            <span class="saved-theme-name">${escapeHtml(theme.name)} <small>(creado por ti)</small></span>
          </label>
          ${deleteBtn}
        </div>`;
    }).join('');
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
      targetValue = `saved:${prefs.custom.savedId}`;
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
    const isAuto = getPreferences().theme === 'auto';
    const section = this.$('#autoMapping');
    section.hidden = !isAuto;
    if (isAuto) {
      const prefs = getPreferences();
      this.populateAutoSelect(this.$('#autoLight'), autoTargetOptions('light'), prefs.autoLight);
      this.populateAutoSelect(this.$('#autoDark'),  autoTargetOptions('dark'),  prefs.autoDark);
    }
  }

  populateAutoSelect(select, options, currentValue) {
    select.replaceChildren();
    for (const { value, label } of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    }
    const hasCurrent = options.some(o => o.value === currentValue);
    select.value = hasCurrent ? currentValue : options[0]?.value ?? '';
  }

  syncColorInputs() {
    const colors = customColors();
    for (const [key, value] of Object.entries(colors)) {
      const picker = this.$(`#color-${key}`);
      const hex = this.$(`#hex-${key}`);
      if (picker) picker.value = value;
      if (hex) { hex.value = value; hex.removeAttribute('aria-invalid'); }
    }
  }

  renderContrast() {
    const colors = customColors();
    let failures = 0;
    this.$('#contrastList').innerHTML = CONTRAST_CHECKS.map(check => {
      const fg = colors[check.fg];
      const bg = colors[check.bg];
      const ratio = contrastRatio(fg, bg);
      const ok = ratio >= check.min;
      if (!ok) failures++;

      let fixesHtml = '';
      if (!ok) {
        const fixes = suggestContrastFixes(fg, bg, check.min);
        const buttons = [];
        if (fixes.lighter) {
          const f = fixes.lighter;
          const what = f.target === 'fg' ? 'texto' : 'fondo';
          buttons.push(`
            <button type="button" class="contrast-fix" data-target="${f.target}" data-value="${f.value}"
                    title="Aplicar ${f.value} (contraste ${formatRatio(f.ratio)}:1)"
                    aria-label="Aclarar ${what} a ${f.value} para que se lea mejor">
              <span class="contrast-fix-preview"
                    style="background:${bg};color:${f.value}" aria-hidden="true">Aa</span>
              <span class="contrast-fix-info">
                <span class="contrast-fix-action">↗ Aclarar ${what}</span>
                <span class="contrast-fix-value">${f.value} · ${formatRatio(f.ratio)}:1</span>
              </span>
            </button>`);
        }
        if (fixes.darker) {
          const f = fixes.darker;
          const what = f.target === 'fg' ? 'texto' : 'fondo';
          buttons.push(`
            <button type="button" class="contrast-fix" data-target="${f.target}" data-value="${f.value}"
                    title="Aplicar ${f.value} (contraste ${formatRatio(f.ratio)}:1)"
                    aria-label="Oscurecer ${what} a ${f.value} para que se lea mejor">
              <span class="contrast-fix-preview"
                    style="background:${f.value};color:${fg}" aria-hidden="true">Aa</span>
              <span class="contrast-fix-info">
                <span class="contrast-fix-action">↘ Oscurecer ${what}</span>
                <span class="contrast-fix-value">${f.value} · ${formatRatio(f.ratio)}:1</span>
              </span>
            </button>`);
        }
        if (buttons.length > 0) {
          fixesHtml = `<div class="contrast-fixes" role="group" aria-label="Sugerencias para corregir el contraste">${buttons.join('')}</div>`;
        }
      }

      return `
        <li class="contrast-item ${ok ? 'is-ok' : 'is-bad'}">
          <span class="contrast-swatch" style="background:${bg};color:${fg}" aria-hidden="true">Aa</span>
          <span class="contrast-label">${check.label}</span>
          <span class="contrast-ratio">${formatRatio(ratio)}:1</span>
          <span class="contrast-verdict">${ok ? '✓ Se lee bien' : `✗ Poco contraste (mín. ${formatRatio(check.min)}:1)`}</span>
          ${fixesHtml}
        </li>`;
    }).join('');
    this.$('#contrastSummary').textContent = failures === 0
      ? 'Todos los textos se leen con contraste suficiente.'
      : `${failures} ${failures === 1 ? 'combinación tiene' : 'combinaciones tienen'} poco contraste. Cambia alguno de sus colores.`;
  }
}