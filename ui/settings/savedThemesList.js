// ────────────────────────────────────────────────────────────────────
// savedThemesList.js — Listas de temas de la pestaña «Apariencia»
// (T-075).
//
// Pinta los sitios donde se elige un tema: los radios de los temas que
// el usuario ha guardado, el desplegable «Empezar desde» (que también
// los incluye) y los desplegables del modo automático (que ofrecen los
// temas guardados del esquema que corresponde).
//
// Solo pinta: qué hacer con el tema que elige el usuario lo decide
// ui/settings/settings-card.js.
// ────────────────────────────────────────────────────────────────────

import { BASES, SAVED_PREFIX, autoTargetOptions } from './preferences.js';
import { savedThemeScheme } from './savedThemes.js';
import { escapeHtml, escapeAttr } from '../html.js';

/** Pinta los temas guardados como radios del fieldset «Tema».
 *
 *  `contenedor` es el <div id="savedThemeOptions"> y `temas` la lista
 *  de temas guardados. `editable` decide si cada tema lleva su botón
 *  «Eliminar» (solo en modo edición) y `onRemove` recibe ese botón
 *  cuando el usuario lo pulsa. */
export function renderSavedThemes(contenedor, temas, { editable, onRemove } = {}) {
  if (temas.length === 0) {
    contenedor.innerHTML = '';
    return;
  }

  contenedor.innerHTML = temas.map(theme => {
    const scheme = savedThemeScheme(theme);
    const icon = scheme === 'light' ? '☀' : '🌙';
    // El `id` de un tema guardado viene del `localStorage`: se escapa
    // como el nombre (el HTML lo vuelve a decodificar al leer el
    // atributo, así que `dataset.id` sigue siendo el mismo id).
    const deleteBtn = editable
      ? `<button type="button" class="settings-btn saved-theme-delete" data-id="${escapeAttr(theme.id)}"
                 aria-label="Eliminar el tema «${escapeAttr(theme.name)}»">Eliminar</button>`
      : '';
    return `
        <div class="saved-theme-row">
          <label class="settings-option saved-theme-option">
            <input type="radio" name="theme" value="${SAVED_PREFIX}${escapeAttr(theme.id)}">
            <span aria-hidden="true">${icon}</span>
            <span class="saved-theme-name">${escapeHtml(theme.name)} <small>(creado por ti)</small></span>
          </label>
          ${deleteBtn}
        </div>`;
  }).join('');

  // Cada botón «Eliminar» avisa a la tarjeta, que es quien sabe qué
  // hacer con el tema (borrarlo y avisar, para poder deshacerlo).
  if (onRemove) {
    contenedor.querySelectorAll('.saved-theme-delete').forEach(btn => {
      btn.addEventListener('click', () => onRemove(btn));
    });
  }
}

/** Pinta las opciones del desplegable «Empezar desde»: los estilos
 *  base y, si el usuario tiene, sus temas guardados. */
export function renderBaseOptions(contenedor, temas) {
  const baseOptions = Object.entries(BASES)
    .map(([id, base]) => `<option value="${id}">${base.label}</option>`)
    .join('');
  const savedOptions = temas.length === 0 ? '' :
    `<optgroup label="Tus temas guardados">${
      temas.map(t => {
        const scheme = savedThemeScheme(t);
        const icon = scheme === 'light' ? '☀' : '🌙';
        return `<option value="${SAVED_PREFIX}${escapeAttr(t.id)}">${icon} ${escapeHtml(t.name)}</option>`;
      }).join('')
    }</optgroup>`;
  contenedor.innerHTML = baseOptions + savedOptions;
}

/** Muestra u oculta el bloque «Sistema en claro/oscuro» y llena sus
 *  desplegables con los temas de cada esquema.
 *
 *  `contenedor` es el <div id="autoMapping">: dentro están los dos
 *  <select>. */
export function syncAutoMapping(contenedor, { isAuto, autoLight, autoDark }) {
  contenedor.hidden = !isAuto;
  if (!isAuto) return;
  fillThemeSelect(contenedor.querySelector('#autoLight'), autoTargetOptions('light'), autoLight);
  fillThemeSelect(contenedor.querySelector('#autoDark'),  autoTargetOptions('dark'),  autoDark);
}

/** Llena un desplegable con los temas de un esquema y deja marcado el
 *  que está en uso (o el primero, si el guardado ya no existe). */
function fillThemeSelect(select, options, currentValue) {
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
