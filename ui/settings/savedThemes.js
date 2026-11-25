// ────────────────────────────────────────────────────────────────────
// savedThemes.js — Temas guardados por el usuario.
//
//   Lista de { id, name, base, scheme, colors, navIconSize, createdAt }.
//   Permite al usuario recuperar combinaciones personalizadas sin tener
//   que rehacerlas (incluye el esquema claro/oscuro y el tamaño del
//   icono del menú lateral).
//
//   Usa las preferencias (tema y tamaño del icono) de preferences.js.
// ────────────────────────────────────────────────────────────────────

import { BASES, NAV_ICON_MIN, NAV_ICON_MAX, getPreferences, setPreferences } from './preferences.js';
import { isHexColor } from '../../back/color.js';

const SAVED_THEMES_KEY = 'savedCustomThemes';

/** Esquema de un tema guardado: el suyo propio o, si no, el de su base. */
export function savedThemeScheme(t) {
  return t.scheme ?? BASES[t.base]?.scheme ?? null;
}

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
