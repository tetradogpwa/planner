// ────────────────────────────────────────────────────────────────────
// preferences.js — Preferencias de apariencia.
//
//   theme      'auto' | 'light' | 'dark' | 'custom'
//   textScale  tamaño general de letra (% sobre el del sistema)
//   sizes      tamaño por parte de la interfaz, { title: 130, … } en %
//              (se aplica con cualquier tema)
//   custom     tema propio: { base, colors: { bg: '#…', … } }
//
// Se guardan en localStorage junto con `scheme` y `vars` ya calculados,
// para que /theme-boot.js pueda aplicarlos antes del primer pintado sin
// repetir la lógica de este módulo.
// ────────────────────────────────────────────────────────────────────

import { mix, alpha, isHexColor } from '../../back/color.js';

// La matemática de color vive en back/color.js (no necesita el
// navegador). Aquí se vuelve a exportar para que quien ya importaba
// estas funciones desde preferences.js siga haciéndolo.
export { contrastRatio, isHexColor, suggestContrastFixes } from '../../back/color.js';

const STORAGE_KEY = 'a11yPrefs';
const SAVED_THEMES_KEY = 'savedCustomThemes';

export const THEMES = ['auto', 'light', 'dark', 'contrast-dark', 'contrast-light', 'custom'];
export const TEXT_SCALES = [100, 115, 130, 150, 175, 200];

// Temas que se pueden elegir como "qué se aplica cuando el sistema está
// en claro/oscuro" en modo automático. 'custom' y 'auto' quedan fuera
// para evitar recursión. Los temas creados por el usuario se exponen
// con el prefijo 'saved:<id>' (mismo formato que los radios de T-004) y
// se resuelven en getPreferences() / resolveAutoTarget().
export const AUTO_TARGETS = ['light', 'dark', 'contrast-light', 'contrast-dark'];
export const AUTO_TARGET_LABELS = {
  'light': 'Claro',
  'dark': 'Oscuro',
  'contrast-light': 'Alto contraste (claro)',
  'contrast-dark': 'Alto contraste (oscuro)',
};

// Sufijo que distingue los temas guardados por el usuario en cualquier
// valor guardado en disco: 'saved:<id>'. Compartido por los radios del
// fieldset «Tema» y por los desplegables del modo automático.
export const SAVED_PREFIX = 'saved:';

// ── Tamaño por partes ───────────────────────────────────────────────
// `base` es el tamaño de diseño de la muestra en Apariencia; cada parte
// usa la variable CSS --fs-<id> (ver index.css).
export const SIZE_MIN = 75;
export const SIZE_MAX = 250;
export const SIZE_STEP = 5;

export const SIZE_ROLES = [
  { id: 'title',  label: 'Títulos de sección',          sample: 'Gestión de datos',          base: 1.25 },
  { id: 'label',  label: 'Etiquetas y subtítulos',      sample: 'Tipo de repetición',        base: 0.8125, upper: true },
  { id: 'nav',    label: 'Menú lateral',                sample: 'Próximas semanas',        base: 0.9375 },
  { id: 'button', label: 'Botones',                     sample: 'Añadir tarea',              base: 1 },
  { id: 'input',  label: 'Campos de texto',             sample: 'Ej: Gym',                   base: 1 },
  { id: 'chip',   label: 'Opciones seleccionables',     sample: 'Días específicos',          base: 0.875 },
  { id: 'task',   label: 'Nombres de tareas',           sample: 'Leer 20 minutos',           base: 0.9375, upper: true },
  { id: 'meta',   label: 'Fechas, contadores y detalles', sample: '12/10 · 5 tareas',        base: 0.8125 },
  { id: 'body',   label: 'Texto de párrafos',           sample: 'Así se verá el texto general.', base: 1 },
  { id: 'doc',    label: 'Documentos legales',          sample: 'Términos de uso de la aplicación', base: 0.9375 },
];

// ── Tema personalizado ──────────────────────────────────────────────
export const COLOR_GROUPS = [
  { title: 'Fondos', items: [
    { id: 'bg',      label: 'Fondo de la aplicación' },
    { id: 'panel',   label: 'Barra superior y menú' },
    { id: 'surface', label: 'Tarjetas' },
    { id: 'field',   label: 'Campos y filas interiores' },
  ]},
  { title: 'Texto', items: [
    { id: 'text',  label: 'Texto principal' },
    { id: 'text2', label: 'Texto secundario' },
  ]},
  { title: 'Bordes', items: [
    { id: 'line',    label: 'Separadores y bordes de tarjetas' },
    { id: 'control', label: 'Bordes de campos y opciones' },
  ]},
  { title: 'Acentos y botones', items: [
    { id: 'accent',       label: 'Acento (enlaces, selección y foco)' },
    { id: 'button',       label: 'Fondo de botones' },
    { id: 'buttonText',   label: 'Texto de botones' },
    { id: 'danger',       label: 'Texto de peligro (borrar)' },
    { id: 'dangerButton', label: 'Fondo del botón Borrar' },
  ]},
  { title: 'Etiquetas de tareas', items: [
    { id: 'task1Bg', label: 'Tarea 1: fondo' },
    { id: 'task1Fg', label: 'Tarea 1: texto' },
    { id: 'task2Bg', label: 'Tarea 2: fondo' },
    { id: 'task2Fg', label: 'Tarea 2: texto' },
    { id: 'task3Bg', label: 'Tarea con horario: fondo' },
    { id: 'task3Fg', label: 'Tarea con horario: texto' },
  ]},
];

// Bases de partida. Todas cumplen WCAG AA en los pares de CONTRAST_CHECKS.
export const BASES = {
  dark: { label: 'Oscuro', scheme: 'dark', colors: {
    bg: '#0f172a', panel: '#111827', surface: '#1f2937', field: '#111827',
    text: '#e5e7eb', text2: '#a9b1bd', line: '#374151', control: '#7c8698',
    accent: '#a5b4fc', button: '#4f46e5', buttonText: '#ffffff', danger: '#f87171', dangerButton: '#dc2626',
    task1Bg: '#20264b', task1Fg: '#c7d2fe', task2Bg: '#10314a', task2Fg: '#bae6fd', task3Bg: '#3a3022', task3Fg: '#fde68a',
  }},
  light: { label: 'Claro', scheme: 'light', colors: {
    bg: '#eef2f7', panel: '#ffffff', surface: '#ffffff', field: '#f6f8fb',
    text: '#0f172a', text2: '#475569', line: '#d5dce6', control: '#7b8494',
    accent: '#4338ca', button: '#4f46e5', buttonText: '#ffffff', danger: '#b91c1c', dangerButton: '#b91c1c',
    task1Bg: '#e0e7ff', task1Fg: '#3730a3', task2Bg: '#e0f2fe', task2Fg: '#075985', task3Bg: '#fef3c7', task3Fg: '#92400e',
  }},
  'contrast-dark': { label: 'Alto contraste oscuro', scheme: 'dark', colors: {
    bg: '#000000', panel: '#000000', surface: '#0d0d0d', field: '#000000',
    text: '#ffffff', text2: '#e0e0e0', line: '#8a8a8a', control: '#ffffff',
    accent: '#ffd60a', button: '#ffd60a', buttonText: '#000000', danger: '#ff9a9a', dangerButton: '#ff9a9a',
    task1Bg: '#1f1a00', task1Fg: '#ffe066', task2Bg: '#00202b', task2Fg: '#8fe3ff', task3Bg: '#2b0019', task3Fg: '#ffa8dc',
  }},
  'contrast-light': { label: 'Alto contraste claro', scheme: 'light', colors: {
    bg: '#ffffff', panel: '#ffffff', surface: '#ffffff', field: '#ffffff',
    text: '#000000', text2: '#1f1f1f', line: '#5c5c5c', control: '#000000',
    accent: '#0033cc', button: '#0033cc', buttonText: '#ffffff', danger: '#a30000', dangerButton: '#a30000',
    task1Bg: '#e8edff', task1Fg: '#001a80', task2Bg: '#e3f6ff', task2Fg: '#003a57', task3Bg: '#fff2c2', task3Fg: '#573000',
  }},
};

// Pares que se comprueban en vivo en el editor (WCAG 2.x, nivel AA).
export const CONTRAST_CHECKS = [
  { fg: 'text',       bg: 'bg',           min: 4.5, label: 'Texto principal sobre el fondo' },
  { fg: 'text',       bg: 'surface',      min: 4.5, label: 'Texto principal sobre tarjetas' },
  { fg: 'text',       bg: 'field',        min: 4.5, label: 'Texto dentro de campos' },
  { fg: 'text',       bg: 'panel',        min: 4.5, label: 'Texto del menú' },
  { fg: 'text2',      bg: 'surface',      min: 4.5, label: 'Texto secundario sobre tarjetas' },
  { fg: 'text2',      bg: 'bg',           min: 4.5, label: 'Texto secundario sobre el fondo' },
  { fg: 'accent',     bg: 'surface',      min: 4.5, label: 'Acento y enlaces sobre tarjetas' },
  { fg: 'accent',     bg: 'panel',        min: 4.5, label: 'Acento en el menú' },
  { fg: 'buttonText', bg: 'button',       min: 4.5, label: 'Texto de botones' },
  { fg: 'buttonText', bg: 'dangerButton', min: 4.5, label: 'Texto del botón Borrar' },
  { fg: 'danger',     bg: 'surface',      min: 4.5, label: 'Texto de peligro sobre tarjetas' },
  { fg: 'control',    bg: 'surface',      min: 3,   label: 'Bordes de campos sobre tarjetas' },
  { fg: 'control',    bg: 'field',        min: 3,   label: 'Bordes de campos sobre su fondo' },
  { fg: 'task1Fg',    bg: 'task1Bg',      min: 4.5, label: 'Etiqueta de tarea 1' },
  { fg: 'task2Fg',    bg: 'task2Bg',      min: 4.5, label: 'Etiqueta de tarea 2' },
  { fg: 'task3Fg',    bg: 'task3Bg',      min: 4.5, label: 'Etiqueta de tarea con horario' },
];

const DEFAULTS = {
  theme: 'auto',
  textScale: 100,
  sizes: {},
  // En modo automático el usuario decide qué tema usar cuando el
  // sistema está en claro/oscuro. Por defecto, los clásicos.
  autoLight: 'light',
  autoDark: 'dark',
  custom: { base: 'dark', colors: {}, navIconSize: null, scheme: null, savedId: null },
};

// Rango válido del tamaño de icono (en píxeles) cuando se define desde
// el editor de tema personalizado. Por defecto hereda el valor de index.css.
export const NAV_ICON_MIN = 32;
export const NAV_ICON_MAX = 128;
export const NAV_ICON_STEP = 4;

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// ── Lectura y escritura ─────────────────────────────────────────────

/** Esquema de un tema guardado: el suyo propio o, si no, el de su base. */
export function savedThemeScheme(t) {
  return t.scheme ?? BASES[t.base]?.scheme ?? null;
}

/** Opciones que ofrecen los desplegables «Sistema en claro/oscuro»:
 *  oficiales (las del esquema adecuado) + cada tema guardado que
 *  coincide con el esquema. Pensado para pintar <option> con
 *  createElement y textContent, así que devuelve objetos { value, label }. */
export function autoTargetOptions(targetScheme) {
  const official =
    targetScheme === 'light'
      ? [
          { value: 'light',          label: AUTO_TARGET_LABELS['light'] },
          { value: 'contrast-light', label: AUTO_TARGET_LABELS['contrast-light'] },
        ]
      : [
          { value: 'dark',          label: AUTO_TARGET_LABELS['dark'] },
          { value: 'contrast-dark', label: AUTO_TARGET_LABELS['contrast-dark'] },
        ];
  const saved = getSavedThemes()
    .filter(t => savedThemeScheme(t) === targetScheme)
    .map(t => ({ value: SAVED_PREFIX + t.id, label: `${t.name} (creado por ti)` }));
  return [...official, ...saved];
}

/** Resuelve un destino del modo automático (oficial o 'saved:<id>') a
 *  la información de aplicación: scheme, colors y navIconSize.
 *  - oficial (light/dark/contrast-light/contrast-dark) → usa BASES; si
 *    el esquema no encaja con `expectedScheme`, devuelve null.
 *  - 'saved:<id>' → busca el tema guardado; si no existe o su esquema
 *    no coincide, devuelve null.
 *  - cualquier otro valor → null. */
export function resolveAutoTarget(value, expectedScheme) {
  if (BASES[value]) {
    return BASES[value].scheme === expectedScheme
      ? { scheme: BASES[value].scheme, colors: BASES[value].colors, navIconSize: null }
      : null;
  }
  if (typeof value === 'string' && value.startsWith(SAVED_PREFIX)) {
    const id = value.slice(SAVED_PREFIX.length);
    const theme = getSavedThemes().find(t => t.id === id);
    if (!theme) return null;
    if (savedThemeScheme(theme) !== expectedScheme) return null;
    const base = BASES[theme.base];
    if (!base) return null;
    return {
      scheme: expectedScheme,
      colors: { ...base.colors, ...theme.colors },
      navIconSize: theme.navIconSize ?? null,
    };
  }
  return null;
}

/** Valida y normaliza el valor guardado de autoLight / autoDark.
 *  Devuelve el valor si es válido (oficial del esquema correcto o
 *  tema guardado del esquema correcto); si no, el DEFAULT. */
function normalizeAutoTarget(value, expectedScheme, savedThemes) {
  if (BASES[value] && BASES[value].scheme === expectedScheme) return value;
  if (typeof value === 'string' && value.startsWith(SAVED_PREFIX)) {
    const id = value.slice(SAVED_PREFIX.length);
    const theme = (savedThemes ?? getSavedThemes()).find(t => t.id === id);
    if (theme && savedThemeScheme(theme) === expectedScheme) return value;
  }
  return expectedScheme === 'light' ? DEFAULTS.autoLight : DEFAULTS.autoDark;
}

export function getPreferences() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch { /* sin almacenamiento: valores por defecto */ }

  return sanitizePreferences(saved);
}

/** Unas preferencias válidas a partir de un objeto cualquiera: los
 *  valores que no valen (un tema que no existe, un tamaño fuera de
 *  rango) se descartan y se usa el valor por defecto.
 *
 *  Se usa también al importar una copia de seguridad (T-054): las
 *  preferencias del archivo pueden ser de otra versión de la app, y
 *  aplicarlas tal cual dejaría la interfaz en un estado imposible. */
export function sanitizePreferences(saved = {}) {
  const sizes = {};
  for (const { id } of SIZE_ROLES) {
    const pct = Number(saved?.sizes?.[id]);
    if (pct >= SIZE_MIN && pct <= SIZE_MAX) sizes[id] = pct;
  }
  const base = BASES[saved?.custom?.base] ? saved.custom.base : DEFAULTS.custom.base;
  const colors = {};
  for (const [key, value] of Object.entries(saved?.custom?.colors ?? {})) {
    if (key in BASES.dark.colors && isHexColor(value)) colors[key] = value.toLowerCase();
  }
  const navIconSize = (() => {
    const n = Number(saved?.custom?.navIconSize);
    return Number.isFinite(n) && n >= NAV_ICON_MIN && n <= NAV_ICON_MAX ? n : null;
  })();
  // Esquema explícito del tema personalizado. Si es null, schemeFor()
  // usará el esquema del `base` seleccionado.
  const scheme = (saved?.custom?.scheme === 'light' || saved?.custom?.scheme === 'dark')
    ? saved.custom.scheme
    : null;
  // savedId identifica al tema guardado actualmente aplicado. Solo se
  // acepta si el id existe en la lista de temas guardados (si no, es
  // un id huérfano y se descarta, dejando el botón de radio sin marcar).
  // La misma lista se reutiliza para validar autoLight/autoDark, así
  // nos ahorramos una lectura de localStorage.
  const savedThemes = getSavedThemes();
  const savedIds = new Set(savedThemes.map(t => t.id));
  const savedId = (typeof saved?.custom?.savedId === 'string' && savedIds.has(saved.custom.savedId))
    ? saved.custom.savedId
    : null;

  return {
    theme: THEMES.includes(saved?.theme) ? saved.theme : DEFAULTS.theme,
    textScale: TEXT_SCALES.includes(saved?.textScale) ? saved.textScale : DEFAULTS.textScale,
    sizes,
    autoLight: normalizeAutoTarget(saved?.autoLight, 'light', savedThemes),
    autoDark:  normalizeAutoTarget(saved?.autoDark,  'dark',  savedThemes),
    custom: { base, colors, navIconSize, scheme, savedId },
  };
}

export function setPreferences(changes) {
  const prefs = { ...getPreferences(), ...changes };
  const toStore = { ...prefs, scheme: schemeFor(prefs), vars: cssVarsFor(prefs) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch { /* sin almacenamiento: se aplica solo en esta sesión */ }
  applyPreferences(prefs);
  return prefs;
}

/** Colores del tema propio: los de su base con los cambios del usuario. */
export function customColors(custom = getPreferences().custom) {
  return { ...BASES[custom.base].colors, ...custom.colors };
}

// ── Aplicación ──────────────────────────────────────────────────────

/** Tema al que se delega cuando el activo es 'auto' y el sistema está
 *  en claro/oscuro. Tiene en cuenta las preferencias del usuario. */
function autoTarget(prefs = getPreferences()) {
  return darkQuery.matches ? prefs.autoDark : prefs.autoLight;
}

export function resolvedTheme(theme = getPreferences().theme) {
  if (theme === 'auto') {
    // Devolvemos el esquema (no el id oficial ni el 'saved:<id>') para
    // que cualquier consumidor externo pueda comparar con 'light'/
    // 'dark' sin tener que distinguir oficiales de guardados.
    const scheme = darkQuery.matches ? 'dark' : 'light';
    return resolveAutoTarget(autoTarget(), scheme)?.scheme ?? scheme;
  }
  if (theme === 'light' || theme === 'dark') return theme;
  if (BASES[theme]) return BASES[theme].scheme;
  return darkQuery.matches ? 'dark' : 'light';
}

function schemeFor(prefs) {
  if (prefs.theme === 'custom') {
    // El usuario puede haber marcado el tema como claro/oscuro al
    // guardarlo, y eso prevalece sobre el esquema del `base` desde el
    // que arrancó a editarlo.
    if (prefs.custom.scheme === 'light' || prefs.custom.scheme === 'dark') {
      return prefs.custom.scheme;
    }
    return BASES[prefs.custom.base].scheme;
  }
  if (prefs.theme === 'auto') {
    const scheme = darkQuery.matches ? 'dark' : 'light';
    return resolveAutoTarget(autoTarget(prefs), scheme)?.scheme ?? scheme;
  }
  // Los temas de alto contraste tienen su propio esquema y no siguen al sistema.
  if (BASES[prefs.theme]) return BASES[prefs.theme].scheme;
  return resolvedTheme(prefs.theme);
}

/** Devuelve los colores que deben aplicarse como variables CSS para
 *  el tema actual, o `null` si el tema usa los colores por defecto
 *  definidos en index.css (auto con destino claro/oscuro, o light/dark). */
function colorsForTheme(prefs) {
  if (prefs.theme === 'custom') return customColors(prefs.custom);
  if (isPresetTheme(prefs.theme)) return BASES[prefs.theme].colors;
  if (prefs.theme === 'auto') {
    // El destino puede ser oficial (BASES) o 'saved:<id>'.
    const scheme = darkQuery.matches ? 'dark' : 'light';
    return resolveAutoTarget(autoTarget(prefs), scheme)?.colors ?? null;
  }
  return null;
}

/** Temas predefinidos que traen sus propios colores (alto contraste). */
function isPresetTheme(theme) {
  return theme === 'contrast-dark' || theme === 'contrast-light';
}

/** Construye el conjunto de variables CSS a partir de un objeto de colores. */
function buildColorVars(c) {
  return {
    '--bg': c.bg,
    '--panel': c.panel,
    '--surface': c.surface,
    '--surface-alt': c.field,
    '--pre-bg': c.field,
    '--panel2': mix(c.surface, c.text, 0.08),
    '--text': c.text,
    '--text-secondary': c.text2,
    '--muted': c.text2,
    '--border': c.line,
    '--topbar-border': c.line,
    '--border-strong': mix(c.line, c.text, 0.3),
    '--input-border': c.control,
    '--primary': c.accent,
    '--primary-dark': c.accent,
    '--primary-light': c.accent,
    '--accent-text': c.accent,
    '--link': c.accent,
    '--focus': c.accent,
    '--btn-bg': c.button,
    '--btn-bg-hover': mix(c.button, c.bg, 0.15),
    '--on-btn': c.buttonText,
    '--danger': c.danger,
    '--danger-btn': c.dangerButton,
    '--danger-soft': alpha(c.danger, 0.12),
    '--soft': alpha(c.accent, 0.12),
    '--soft-strong': alpha(c.accent, 0.2),
    '--hover-bg': alpha(c.text, 0.06),
    '--badge-odd-bg': c.task1Bg,  '--badge-odd-fg': c.task1Fg,  '--badge-odd-bd': c.task1Fg,
    '--badge-even-bg': c.task2Bg, '--badge-even-fg': c.task2Fg, '--badge-even-bd': c.task2Fg,
    '--badge-slot-bg': c.task3Bg, '--badge-slot-fg': c.task3Fg, '--badge-slot-bd': c.task3Fg,
  };
}

/** Variables CSS que sobrescriben las de index.css. */
function cssVarsFor(prefs) {
  const vars = {};
  for (const { id } of SIZE_ROLES) {
    const pct = prefs.sizes[id];
    if (pct && pct !== 100) vars[`--fs-${id}`] = String(pct / 100);
  }
  const colors = colorsForTheme(prefs);
  if (colors) Object.assign(vars, buildColorVars(colors));
  // Tamaño del icono del menú lateral. Se aplica en dos casos:
  //  - tema personalizado activo (lo define el usuario en el editor).
  //  - modo automático cuyo destino es un tema guardado (lo trae el
  //    propio tema). Los temas oficiales usan 64 px por defecto desde
  //    index.css.
  let navIconSize = null;
  if (prefs.theme === 'custom') navIconSize = prefs.custom.navIconSize;
  else if (prefs.theme === 'auto') {
    const scheme = darkQuery.matches ? 'dark' : 'light';
    navIconSize = resolveAutoTarget(autoTarget(prefs), scheme)?.navIconSize ?? null;
  }
  if (navIconSize) vars['--nav-icon-size'] = `${navIconSize}px`;
  return vars;
}

export function applyPreferences(prefs = getPreferences()) {
  const root = document.documentElement;
  const scheme = schemeFor(prefs);
  root.dataset.theme = scheme;
  root.style.fontSize = `${prefs.textScale}%`;

  // Quitar también lo que haya puesto theme-boot.js en el arranque.
  for (const name of [...root.style]) {
    if (name.startsWith('--')) root.style.removeProperty(name);
  }
  const vars = cssVarsFor(prefs);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);

  // Color de la barra del navegador (PWA): el del panel superior del tema.
  const palette = colorsForTheme(prefs);
  const bar = palette
    ? palette.panel
    : (scheme === 'dark' ? '#111827' : '#ffffff');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar);
}

// En modo automático, seguir los cambios del sistema en vivo.
darkQuery.addEventListener('change', () => {
  if (getPreferences().theme === 'auto') setPreferences({});
});

// ── Temas guardados por el usuario ──────────────────────────────────
// Lista de { id, name, base, scheme, colors, navIconSize, createdAt }.
// Permite al usuario recuperar combinaciones personalizadas sin tener
// que rehacerlas (incluye el esquema claro/oscuro y el tamaño del
// icono del menú lateral).
function sanitizeSavedTheme(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '').trim().slice(0, 40);
  const base = BASES[raw.base] ? raw.base : 'dark';
  if (!name) return null;
  const colors = {};
  for (const [key, value] of Object.entries(raw.colors ?? {})) {
    if (key in BASES.dark.colors && isHexColor(value)) {
      colors[key] = value.toLowerCase();
    }
  }
  const navIconSize = (() => {
    const n = Number(raw.navIconSize);
    return Number.isFinite(n) && n >= NAV_ICON_MIN && n <= NAV_ICON_MAX ? n : null;
  })();
  const scheme = (raw.scheme === 'light' || raw.scheme === 'dark') ? raw.scheme : null;
  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    name,
    base,
    scheme,
    colors,
    navIconSize,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

export function getSavedThemes() {
  try {
    const list = JSON.parse(localStorage.getItem(SAVED_THEMES_KEY));
    if (!Array.isArray(list)) return [];
    return list.map(sanitizeSavedTheme).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveSavedThemes(themes) {
  try {
    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(themes));
  } catch { /* sin almacenamiento: solo en memoria */ }
  return themes;
}

export function addSavedTheme(name, colorOverrides, scheme) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error('El nombre del tema no puede estar vacío.');
  const prefs = getPreferences();
  const colors = { ...prefs.custom.colors, ...colorOverrides };
  const navIconSize = prefs.custom.navIconSize ?? null;
  // Si el usuario marca un esquema en el formulario de guardado, lo
  // guardamos. Si no, usamos el esquema del base actual como fallback.
  const finalScheme = (scheme === 'light' || scheme === 'dark')
    ? scheme
    : (BASES[prefs.custom.base]?.scheme ?? null);
  const list = getSavedThemes();
  // Si ya existe un tema con ese nombre, lo sobreescribimos.
  const existingIdx = list.findIndex(
    t => t.name.toLowerCase() === trimmed.toLowerCase()
  );
  const entry = {
    id: existingIdx >= 0 ? list[existingIdx].id : crypto.randomUUID(),
    name: trimmed,
    base: prefs.custom.base,
    scheme: finalScheme,
    colors,
    navIconSize,
    createdAt: Date.now(),
  };
  if (existingIdx >= 0) list[existingIdx] = entry;
  else list.push(entry);
  saveSavedThemes(list);
  // Si estamos en modo automático y el destino 'autoLight' o 'autoDark'
  // apuntaba a un tema que ahora cambia de esquema (sobrescritura),
  // getPreferences() lo va a descartar. Forzamos la pasada para
  // recalcular vars/scheme en disco y aplicar el cambio en vivo.
  if (prefs.theme === 'auto') setPreferences({});
  // El tema recién guardado pasa a ser el activo: su radio queda
  // marcado al volver a pintar la lista. Si el nombre ya existía,
  // seguimos apuntando a su id (el que ya estuviese marcado sigue
  // marcado).
  setPreferences({ custom: { ...prefs.custom, savedId: entry.id } });
  return list;
}

export function applySavedTheme(id) {
  const list = getSavedThemes();
  const theme = list.find(t => t.id === id);
  if (!theme) return null;
  setPreferences({
    custom: {
      base: theme.base,
      colors: { ...theme.colors },
      navIconSize: theme.navIconSize ?? null,
      scheme: theme.scheme ?? null,
      savedId: theme.id,
    },
  });
  return theme;
}

export function deleteSavedTheme(id) {
  const list = getSavedThemes();
  const next = list.filter(t => t.id !== id);
  saveSavedThemes(next);
  // Si estamos en modo automático y el destino apuntaba a este tema
  // (o al que vamos a eliminar como activo), getPreferences() lo va a
  // descartar y volverá al DEFAULT. Forzamos la pasada para recalcular
  // vars/scheme en disco y aplicar el cambio en vivo.
  const prefs = getPreferences();
  if (prefs.theme === 'auto') setPreferences({});
  // Si el tema eliminado era el activo, pasamos a «Automático» (ya no
  // podemos mantener el borrador porque sus colores ahora no coinciden
  // con ningún tema oficial y el campo "Tema" no tiene una opción
  // «Personalizado» visible: lo más seguro es un tema predefinido).
  if (prefs.custom.savedId === id) {
    setPreferences({ theme: 'auto', custom: { ...prefs.custom, savedId: null } });
  }
  return next;
}
