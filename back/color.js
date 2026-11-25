// ────────────────────────────────────────────────────────────────────
// color.js — Matemática de color.
//
//   hexToRgb/rgbToHex   conversión entre #rrggbb y [r, g, b]
//   mix/alpha           mezcla de dos colores y color con transparencia
//   hexToHsl/hslToHex   conversión HSL ↔ hex
//   luminance           luminosidad relativa (WCAG)
//   contrastRatio       relación de contraste entre dos colores
//   isHexColor          validación de un color #rrggbb
//   suggestContrastFixes sugerencias de color que cumplen un mínimo
//
// Esta lógica estaba dentro de ui/settings/preferences.js. Vive aquí
// porque no toca el navegador: así se puede probar sin DOM y la capa de
// preferencias se queda con lo que es de verdad preferencias.
// ────────────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;

// ── Utilidades de color ─────────────────────────────────────────────

function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}
function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
/** Mezcla `a` con `b` en proporción `t` (0 = a, 1 = b). */
export function mix(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t));
}
export function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// HSL ↔ hex. Mantener tono y saturación y ajustar solo la luminosidad
// es la forma más predecible de pedirle al usuario "un poco más claro"
// o "un poco más oscuro" sin que el color resultante parezca otro distinto.
function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let H = 0, S = 0;
  if (max !== min) {
    const d = max - min;
    S = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      H = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) H = ((b - r) / d + 2) / 6;
    else                H = ((r - g) / d + 4) / 6;
  }
  return { h: H, s: S, l };
}
function hslToHex({ h, s, l }) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const tc = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = tc(h + 1 / 3);
    g = tc(h);
    b = tc(h - 1 / 3);
  }
  return rgbToHex([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]);
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Relación de contraste WCAG entre dos colores #rrggbb. */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const isHexColor = (value) => HEX.test(value);

/** Encuentra, en HSL, el color más cercano a `hex` que cumple
 *  `contrast(candidate, other) >= min` modificando solo la luminosidad
 *  (mantiene tono y saturación). `direction` indica hacia qué lado
 *  buscar: `'lighter'` aumenta L, `'darker'` lo reduce.
 *  Devuelve el hex o `null` si ni siquiera en el extremo se llega a `min`. */
function nearestValidLuminance(hex, other, min, direction) {
  const hsl = hexToHsl(hex);
  const origL = hsl.l;
  const extremeL = direction === 'lighter' ? 1 : 0;
  const extremeHex = hslToHex({ ...hsl, l: extremeL });
  if (contrastRatio(extremeHex, other) < min) return null;

  let lo, hi;
  if (direction === 'lighter') { lo = origL; hi = 1; }
  else                         { lo = 0;    hi = origL; }

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const candidate = hslToHex({ ...hsl, l: mid });
    const r = contrastRatio(candidate, other);
    if (direction === 'lighter') {
      // Queremos el menor L (≥ origL) que cumple: si cumple, baja el techo.
      if (r >= min) hi = mid; else lo = mid;
    } else {
      // Queremos el mayor L (≤ origL) que cumple: si cumple, sube el suelo.
      if (r >= min) lo = mid; else hi = mid;
    }
  }
  // Devolvemos el candidato del lado que cumple (hi para lighter, lo
  // para darker) en vez del midpoint, y si al redondear a #rrggbb el
  // contraste cae por debajo de `min` avanzamos hacia el extremo en
  // pasos discretos de luminosidad hasta que el hex final cumpla.
  let l = direction === 'lighter' ? hi : lo;
  const step = 1 / 256; // un bit del canal (0..255 → 0..1)
  for (let n = 0; n <= 256; n++) {
    if (l < 0 || l > 1) return null;
    const candidate = hslToHex({ ...hsl, l });
    if (contrastRatio(candidate, other) >= min) return candidate;
    l = direction === 'lighter' ? l + step : l - step;
  }
  return null;
}

/** Para un par (fg, bg) con contraste < min, devuelve hasta dos
 *  sugerencias de "color correcto más cercano":
 *    - `lighter`: el cambio que empuja el par hacia el lado claro
 *      (aclaramos el color que ya es el más claro)
 *    - `darker`:  el cambio que lo empuja hacia el lado oscuro
 *      (oscurecemos el color que ya es el más oscuro)
 *  Cada sugerencia es `{ target: 'fg'|'bg', value: '#rrggbb',
 *  ratio: nuevoContraste }` o `null` si no es posible llegar a `min`. */
export function suggestContrastFixes(fg, bg, min) {
  const L_fg = luminance(fg);
  const L_bg = luminance(bg);
  const fgIsLighter = L_fg >= L_bg;

  // Lado claro: aclaramos el color que ya es el más claro del par.
  const lightColor = fgIsLighter ? fg : bg;
  const lightKey   = fgIsLighter ? 'fg' : 'bg';
  const lightOther = fgIsLighter ? bg : fg;
  const lighterFix = nearestValidLuminance(lightColor, lightOther, min, 'lighter');
  // Lado oscuro: oscurecemos el color que ya es el más oscuro del par.
  const darkColor = fgIsLighter ? bg : fg;
  const darkKey   = fgIsLighter ? 'bg' : 'fg';
  const darkOther = fgIsLighter ? fg : bg;
  const darkerFix = nearestValidLuminance(darkColor, darkOther, min, 'darker');

  const toEntry = (target, value, other) => ({
    target,
    value: value.toLowerCase(),
    ratio: contrastRatio(value, other),
  });

  return {
    lighter: lighterFix ? toEntry(lightKey, lighterFix, lightOther) : null,
    darker:  darkerFix  ? toEntry(darkKey,  darkerFix,  darkOther)  : null,
  };
}
