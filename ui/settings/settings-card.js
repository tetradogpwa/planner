// ────────────────────────────────────────────────────────────────────
// settings-card.js — Vista "Apariencia": tema (incluido uno propio),
// tamaño general y tamaño por partes de la interfaz.
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
  TEXT_SCALES,
  SIZE_ROLES,
  SIZE_MIN,
  SIZE_MAX,
  SIZE_STEP,
  COLOR_GROUPS,
  BASES,
  CONTRAST_CHECKS,
  NAV_ICON_MIN,
  NAV_ICON_MAX,
} from './preferences.js';

const SCALE_LABELS = {
  100: 'Normal',
  115: 'Grande',
  130: 'Más grande',
  150: 'Muy grande',
  175: 'Enorme',
  200: 'Máximo',
};

const formatRatio = (r) => r.toFixed(2).replace('.', ',');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export class SettingsCard {
  constructor(root) {
    this.root = root;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/settings/settings-card.html').then(r => r.text()),
      fetch('./ui/settings/settings-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.mount();
  }

  $(selector) {
    return this.root.querySelector(selector);
  }

  mount() {
    const prefs = getPreferences();

    this.editMode = false;

    this.renderTextScales();
    this.renderBaseOptions();
    this.renderColorRows();
    this.renderSizeRows();
    this.renderSavedThemes();

    this.markActiveThemeRadio();
    this.$(`input[name="textScale"][value="${prefs.textScale}"]`).checked = true;
    this.$('#customBase').value = prefs.custom.base;
    this.syncAutoMapping();
    this.syncCustomTheme();
    this.syncSizes();
    this.syncDraftStatus();

    this.root.addEventListener('change', (e) => {
      if (e.target.name === 'theme') {
        const value = e.target.value;
        if (value.startsWith('saved:')) {
          // Tema guardado: lo aplicamos y marcamos el estado «custom»
          // sin repintar la lista (así el navegador mantiene el foco
          // del teclado sobre el radio). Si el id ya no existe
          // (huérfano), limpiamos savedId para no dejar un estado raro.
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
      if (e.target.name === 'textScale') setPreferences({ textScale: Number(e.target.value) });
    });

    // Botón Eliminar de cada tema guardado (delegado en la raíz del
    // card). Solo aparece si el modo edición está activo.
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

    // Modo edición (muestra u oculta el editor de temas personalizados y
    // las secciones de tamaño de letra y vista previa).
    this.$('#customEditToggle').addEventListener('change', (e) => {
      this.editMode = e.target.checked;
      this.syncEditorVisibility();
      // Repintamos para mostrar u ocultar el botón Eliminar de cada
      // tema guardado (solo se ve con modo edición).
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

    // Tamaño del icono del menú lateral (solo aplica al tema personalizado).
    this.$('#navIconSize').addEventListener('input', () => this.setNavIconSize());

    // Sugerencias automáticas de la lista de contraste (delegación).
    this.$('#contrastList').addEventListener('click', (e) => {
      const btn = e.target.closest('.contrast-fix');
      if (!btn) return;
      this.setColor(btn.dataset.target, btn.dataset.value);
    });

    this.$('#sizesReset').addEventListener('click', () => {
      setPreferences({ sizes: {} });
      this.syncSizes();
    });

    // Diálogo de atajos de teclado. Disponible siempre (no depende
    // del modo edición) para que también se pueda consultar antes de
    // tocar nada en Apariencia. Se importa aquí (no en el import de
    // cabecera) para no penalizar el arranque si el usuario no llega
    // a abrir este diálogo. Como la carga es HTML+CSS perezosos, el
    // coste hasta entonces es despreciable.
    const shortcutsBtn = this.$('#settings-shortcuts-btn');
    if (shortcutsBtn) {
      shortcutsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        import('../shortcuts/shortcuts-card.js').then(m => {
          m.shortcuts.open(shortcutsBtn);
        });
      });
    }

    // Estado inicial de visibilidad (ver JSDoc de syncEditorVisibility).
    this.syncEditorVisibility();
  }

  // ── Tamaño general ────────────────────────────────────────────────

  renderTextScales() {
    this.$('#textScaleOptions').innerHTML = TEXT_SCALES.map(scale => `
      <label class="settings-option">
        <input type="radio" name="textScale" value="${scale}">
        <span>${SCALE_LABELS[scale]} <small>(${scale}%)</small></span>
      </label>`).join('');
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
    // Si el usuario eligió uno de sus temas guardados (formato
    // `saved:<id>`) partimos de sus colores en lugar de los de un base
    // predefinido. Tras cargar, el selector vuelve a mostrar el base
    // real para que sea fácil re-empezar desde otro.
    if (value.startsWith('saved:')) {
      const themeId = value.slice('saved:'.length);
      const themeEntry = getSavedThemes().find(t => t.id === themeId);
      if (themeEntry) {
        // Pasamos a borrador (theme=custom, savedId=null) para que el
        // cambio se vea reflejado al instante en los radios.
        if (theme !== 'custom') {
          setPreferences({ theme: 'custom', custom: { ...custom, savedId: null } });
        } else {
          setPreferences({
            custom: {
              base: themeEntry.base,
              colors: { ...themeEntry.colors },
              navIconSize: themeEntry.navIconSize ?? null,
              scheme: themeEntry.scheme ?? null,
              savedId: null,
            },
          });
        }
        this.$('#customBase').value = themeEntry.base;
        this.syncColorInputs();
        this.syncNavIconSize();
        this.syncCustomScheme();
        this.renderContrast();
        this.renderSavedThemes();
        this.enterDraft();
        this.$('#customBaseStatus').textContent = `Cargado «${themeEntry.name}» como punto de partida.`;
        return;
      }
    }
    const base = value;
    // El borrador pasa a tener este base y se desmarcan los radios de
    // temas guardados.
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
    // Pasamos a borrador (sin tema guardado) para que los radios se
    // desmarquen al instante.
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
    // Pequeña sacudida visual en el botón para confirmar la acción.
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

  /** Elimina el tema guardado cuyo botón «Eliminar» se ha pulsado. Se
   *  llama desde un click delegado en la raíz, así que no necesita
   *  ningún id pasado como argumento: lo lee del `data-id` del
   *  botón. Si era el tema activo, preferences.js lo cambia a
   *  «Automático» y limpia savedId al borrar. Tras repintar, mueve
   *  el foco al primer radio de la lista o, si está vacía, al
   *  interruptor «Modo edición», y anuncia el resultado en
   *  #savedThemesStatus. */
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
    // Mueve el foco: al primer radio del fieldset «Tema», o si ya no
    // hay ninguno, al interruptor «Modo edición» para no perder el
    // recorrido de teclado.
    const firstRadio = this.$('input[name="theme"]');
    if (firstRadio) firstRadio.focus();
    else this.$('#customEditToggle')?.focus();
  }

  /** Pinta los temas guardados como radios del fieldset «Tema», después
   *  de los oficiales. Cada uno es un <label class="settings-option">
   *  con `name="theme"`, `value="saved:<id>"` y la marca
   *  «(creado por ti)». En modo edición se le añade un botón
   *  Eliminar hermano del label, dentro de un
   *  <div class="saved-theme-row">, visible solo con el modo edición
   *  activo. La marca `checked` la gestiona markActiveThemeRadio()
   *  según prefs.theme y custom.savedId.
   *  Tras repintar, también sincroniza los desplegables del modo
   *  automático para que incluyan (o excluyan) los temas creados. */
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
    this.syncNavIconSize();
    this.syncCustomScheme();
    this.syncColorInputs();
    this.renderContrast();
    this.syncEditorVisibility();
    this.markActiveThemeRadio();
    this.syncDraftStatus();
  }

  /** Marca el radio del fieldset «Tema» según el estado actual:
   *  - Si `theme === 'custom'` y hay un `custom.savedId` válido,
   *    marca el radio `value="saved:<savedId>"`.
   *  - Si `theme === 'custom'` y no hay `savedId` (borrador), no
   *    marca ninguno.
   *  - En cualquier otro caso, marca el radio del tema oficial. */
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

  /** Pasa al estado de borrador: desmarca todos los radios del
   *  fieldset «Tema» (sin repintar, para no romper el foco del
   *  editor) y enseña el aviso de borrador. */
  enterDraft() {
    this.root.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = false; });
    this.syncDraftStatus();
  }

  /** Muestra u oculta el aviso «Tema sin guardar» según el estado:
   *  solo si `theme === 'custom'` y no hay `custom.savedId`. */
  syncDraftStatus() {
    const prefs = getPreferences();
    const isDraft = prefs.theme === 'custom' && !prefs.custom.savedId;
    const draft = this.$('#draftStatus');
    if (draft) draft.hidden = !isDraft;
  }

  /** Muestra u oculta los bloques que dependen del modo edición.
   *  - El editor de temas (sección «Crea tu tema» y formulario «Crear
   *    un tema nuevo») se ve solo con modo edición activo, sea cual
   *    sea el tema elegido.
   *  - Las secciones de tamaño de letra (general y por partes) y la
   *    vista previa se ven con modo edición activo en cualquier tema.
   *  Antes de ocultar, si el foco del teclado está dentro de lo que se
   *  va a ocultar, lo mueve al interruptor «Modo edición» para no
   *  perderlo. El atributo `hidden` se usa (no una clase CSS) para que
   *  los lectores de pantalla también lo oculten. Los botones Eliminar
   *  de cada tema guardado se muestran/ocultan dentro de cada fila,
   *  no aquí: ver renderSavedThemes(). */
  syncEditorVisibility() {
    const edit       = this.editMode;
    const showEditor = edit;                          // Crea tu tema + Crear un tema nuevo
    const showSizes  = edit;                          // Tamaño general / por partes / vista previa
    const editor   = this.$('#customTheme');
    const saveForm = this.$('#customSaveFieldset');
    const textScaleGroup = this.$('#textScaleGroup');
    const sizesGroup     = this.$('#sizesGroup');
    const preview        = this.$('#settingsPreview');
    // Si vamos a ocultar algo y el foco está dentro de ello, lo movemos
    // al interruptor «Modo edición» para no perderlo.
    const hidingSomething = !showEditor || !showSizes;
    if (hidingSomething) {
      const active = document.activeElement;
      const insideEditor =
        active && active !== document.body && (
          (editor   && editor.contains(active)) ||
          (saveForm && saveForm.contains(active))
        );
      const insideSizes =
        active && active !== document.body && (
          (textScaleGroup && textScaleGroup.contains(active)) ||
          (sizesGroup     && sizesGroup.contains(active)) ||
          (preview        && preview.contains(active))
        );
      if ((!showEditor && insideEditor) || (!showSizes && insideSizes)) {
        const toggle = this.$('#customEditToggle');
        if (toggle) toggle.focus();
      }
    }
    if (editor)   editor.hidden   = !showEditor;
    if (saveForm) saveForm.hidden = !showEditor;
    if (textScaleGroup) textScaleGroup.hidden = !showSizes;
    if (sizesGroup)     sizesGroup.hidden     = !showSizes;
    if (preview)        preview.hidden        = !showSizes;
  }

  /** Marca el radio de esquema (Claro/Oscuro) según el borrador actual.
   *  Si el usuario ya marcó un esquema explícito (custom.scheme), se
   *  respeta; si no, se usa el del `base` seleccionado. */
  syncCustomScheme() {
    const prefs = getPreferences();
    const scheme = prefs.custom.scheme
      ?? BASES[prefs.custom.base]?.scheme
      ?? 'dark';
    this.root.querySelectorAll('input[name="customScheme"]').forEach(input => {
      input.checked = input.value === scheme;
    });
  }

  /** Sincroniza el bloque de mapeo del modo automático (visible solo
   *  cuando el tema activo es «Automático»). Repinta las <option> de
   *  los desplegables con los oficiales del esquema correspondiente y,
   *  tras ellas, los temas guardados cuyo esquema coincida. Así, tras
   *  guardar, sobrescribir o eliminar un tema, las opciones reflejan
   *  al instante el estado real. */
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

  /** Rellena un <select> del modo automático con las opciones dadas
   *  (oficiales + temas guardados), usando createElement + textContent
   *  para que los nombres de usuario se escapen automáticamente y
   *  queden a salvo de <, >, & y comillas. Conserva la selección si
   *  el valor sigue disponible; si no, deja la primera opción. */
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
      this.enterDraft();
    } else {
      setPreferences({ custom: { ...custom, navIconSize: value } });
    }
    this.$('#navIconSizeValue').textContent = `${value} px`;
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

    this.root.querySelectorAll('[data-size]').forEach(input =>
      input.addEventListener('input', () => {
        const { sizes } = getPreferences();
        setPreferences({ sizes: { ...sizes, [input.dataset.size]: Number(input.value) } });
        this.$(`#size-${input.dataset.size}-value`).textContent = `${input.value} %`;
        input.setAttribute('aria-valuetext', `${input.value} por ciento`);
      })
    );
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
}
