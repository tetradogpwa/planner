// ────────────────────────────────────────────────────────────────────
// legal-markdown.js
//
// Mini-render de Markdown → HTML para los textos legales.
//
// Suficiente para los textos legales (encabezados, listas, tablas,
// código, enlaces, énfasis). Sin dependencias externas para no
// añadir peso al bundle.
//
// Seguridad:
//   · El texto del documento se escapa entero con `escapeHtml`: un
//     documento es un archivo de texto, pero nada garantiza que no
//     traiga algo que parezca HTML.
//   · La URL de un enlace se escapa con `escapeAttr`, porque va
//     dentro de un atributo: una comilla suelta cerraría el
//     atributo y el resto de la URL se volvería en atributos
//     inventados.
//   · Solo se hacen enlaces con esquemas seguros (http, https,
//     mailto). Un `javascript:` no se convierte en un `<a>`: se
//     muestra su texto, pero no es un enlace.
// ────────────────────────────────────────────────────────────────────

import { escapeHtml, escapeAttr } from '../html.js';

/** Los únicos esquemas que pueden acabar en un `href`. */
const ESQUEMAS_SEGUROS = new Set(['http:', 'https:', 'mailto:']);

/** Lo que deja el enlace en el texto hasta el último paso. Es un
 *  carácter de uso privado: no aparece en los documentos y no es un
 *  carácter de control. */
const MARCA = '\uE000';

/** ¿Se puede poner esta URL en el `href` de un enlace?
 *
 *  Sin esquema es una ruta relativa o un ancla del documento: vale.
 *  Con esquema, solo los de la lista: un `javascript:` (o un
 *  `data:`, un `vbscript:`…) ejecutaría código al pulsarlo. */
function urlSegura(url) {
  // Los espacios y los caracteres de control no pueden ir en una URL:
  // "java<TAB>script:..." es un javascript: disfrazado.
  // eslint-disable-next-line no-control-regex -- aquí se buscan LOS caracteres de control
  const limpia = String(url ?? '').replace(/[\u0000-\u0020\u007f]/g, '');
  if (limpia === '') return false;
  const esquema = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(limpia);
  // Sin esquema: ruta relativa o ancla.
  if (!esquema) return true;
  return ESQUEMAS_SEGUROS.has(`${esquema[1].toLowerCase()}:`);
}

/** Negrita y cursiva dentro de un texto. */
function enfasis(texto) {
  return texto.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
}

export function renderMarkdown(md) {
  // 1. Los enlaces se sacan ANTES de escapar el texto: la URL va
  //    cruda al `href` (y allí se escapa una sola vez, con
  //    `escapeAttr`). El texto del enlace se escapa y recibe el
  //    énfasis como el resto del documento, en el último paso.
  const enlaces = [];
  let text = String(md ?? '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, etiqueta, url) => {
    enlaces.push({ etiqueta, url: url.trim() });
    // Un marcador con el número del enlace: el último paso lo cambia
    // por su `<a>`.
    return `${MARCA}${enlaces.length - 1}${MARCA}`;
  });

  // 2. Escapar el HTML.
  text = escapeHtml(text);

  // 3. Código en bloque ``` … ```.
  text = text.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.replace(/^\n+|\n+$/g, '')}</code></pre>`);

  // 4. Títulos (h1, h2, h3).
  text = text.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
             .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
             .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
             .replace(/^### (.*)$/gm, '<h3>$1</h3>')
             .replace(/^## (.*)$/gm, '<h2>$1</h2>')
             .replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // 4b. Separadores horizontales.
  text = text.replace(/^-{3,}$/gm, '<hr>');

  // 5. Negrita y cursiva.
  text = enfasis(text);

  // 6. Listas (muy simple).
  text = text.replace(/(^|\n)(- .+(?:\n- .+)*)/g, (_, lead, block) => {
    const items = block.split('\n').map(l => `<li>${l.slice(2)}</li>`).join('');
    return `${lead}<ul>${items}</ul>`;
  });
  text = text.replace(/(^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, (_, lead, block) => {
    const items = block.split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `${lead}<ol>${items}</ol>`;
  });

  // 7. Tablas (simple).
  text = text.replace(/((?:\|[^\n]+\|\n)+)/g, (block) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return block;
    const headers = lines[0].split('|').slice(1, -1).map(s => s.trim());
    const align   = lines[1].split('|').slice(1, -1).map(s => s.trim());
    if (!align.every(c => /^:?-+:?$/.test(c))) return block;
    const rows = lines.slice(2).map(l => l.split('|').slice(1, -1).map(s => s.trim()));
    const th = headers.map(h => `<th>${h}</th>`).join('');
    const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
  });

  // 8. Párrafos (líneas sueltas separadas por doble salto).
  text = text
    .split(/\n{2,}/)
    .map(p => /^<(h\d|ul|ol|pre|table|hr)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  // 9. Enlaces: solo los de esquema seguro. La URL va escapada para
  //    el atributo (`escapeAttr`); un `javascript:` no es un enlace:
  //    se muestra su texto y ya está.
  text = text.replace(/\uE000(\d+)\uE000/g, (_, i) => {
    const { etiqueta, url } = enlaces[Number(i)];
    const visible = enfasis(escapeHtml(etiqueta));
    if (!urlSegura(url)) return visible;
    return `<a href="${escapeAttr(url)}" rel="noopener noreferrer" target="_blank">${visible}</a>`;
  });

  return text;
}
