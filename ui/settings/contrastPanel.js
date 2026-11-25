// ────────────────────────────────────────────────────────────────────
// contrastPanel.js — Panel de colores y contraste del editor de tema
// (T-075).
//
// Pinta los campos con los que se elige cada color del tema propio y
// la comprobación de contraste (WCAG AA) que se hace con ellos. Solo
// pinta: qué hacer con el color que cambia el usuario lo decide
// ui/settings/settings-card.js.
// ────────────────────────────────────────────────────────────────────

import {
  customColors,
  contrastRatio,
  isHexColor,
  suggestContrastFixes,
  COLOR_GROUPS,
  CONTRAST_CHECKS,
} from './preferences.js';

const formatRatio = (r) => r.toFixed(2).replace('.', ',');

/** Pinta los campos de color: el selector visual y el código
 *  hexadecimal de cada color del tema.
 *
 *  `onColor` se llama con (clave, valor, { fromHex }) cuando el
 *  usuario cambia un color. */
export function renderColorRows(contenedor, { onColor }) {
  contenedor.innerHTML = COLOR_GROUPS.map(group => `
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
  contenedor.querySelectorAll('[data-color]').forEach(input =>
    input.addEventListener('input', () => onColor(input.dataset.color, input.value))
  );
  // Código hexadecimal: para teclado y para sistemas sin selector de color.
  contenedor.querySelectorAll('[data-hex]').forEach(input => {
    input.addEventListener('input', () => {
      let value = input.value.trim();
      if (value && !value.startsWith('#')) value = `#${value}`;
      const valid = isHexColor(value);
      input.setAttribute('aria-invalid', String(!valid && value.length > 0));
      if (valid) onColor(input.dataset.hex, value.toLowerCase(), { fromHex: true });
    });
    input.addEventListener('blur', () => syncColorInputs(contenedor));
  });
}

/** Escribe los colores del tema actual en los campos del editor. */
export function syncColorInputs(contenedor) {
  const colors = customColors();
  for (const [key, value] of Object.entries(colors)) {
    const picker = contenedor.querySelector(`#color-${key}`);
    const hex = contenedor.querySelector(`#hex-${key}`);
    if (picker) picker.value = value;
    if (hex) { hex.value = value; hex.removeAttribute('aria-invalid'); }
  }
}

/** Pinta la lista de contraste y su resumen.
 *
 *  `contenedor` es la <section class="contrast-panel"> del editor: ahí
 *  dentro están el <ul id="contrastList"> y el <p id="contrastSummary">.
 *  `colores` son los colores del tema que se está editando. */
export function renderContrast(contenedor, colores) {
  const lista = contenedor.querySelector('#contrastList');
  const resumen = contenedor.querySelector('#contrastSummary');
  let failures = 0;
  lista.innerHTML = CONTRAST_CHECKS.map(check => {
    const fg = colores[check.fg];
    const bg = colores[check.bg];
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
  resumen.textContent = failures === 0
    ? 'Todos los textos se leen con contraste suficiente.'
    : `${failures} ${failures === 1 ? 'combinación tiene' : 'combinaciones tienen'} poco contraste. Cambia alguno de sus colores.`;
}
