// Pruebas de la capa de preferencias de apariencia (ui/settings/preferences.js).
// preferences.js usa `window.matchMedia` al importarse (línea 158) y
// `resolveAutoTarget` consulta `localStorage` (vía `getSavedThemes`)
// cuando el destino es de un tema guardado por el usuario. Además,
// `applyPreferences` toca el documento: el atributo `data-theme` de la
// raíz, las variables CSS y el color de la barra del navegador. Por eso
// montamos stubs mínimos antes del import dinámico. Solo preparamos
// entorno; no imitamos lógica.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Stubs de navegador ──────────────────────────────────────────────────

class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k)    { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear()       { this.m.clear(); }
  key(i)        { return [...this.m.keys()][i] ?? null; }
  get length()  { return this.m.size; }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

// `prefers-color-scheme`: por defecto el sistema está en claro (los
// tests que no lo dicen no necesitan distinguir los temas oficiales por
// esquema). El objeto es el mismo que guarda preferences.js, así que
// estos tests pueden cambiar `matches` para simular el sistema en
// oscuro.
const mediaQuery = {
  matches: false,
  listeners: new Map(),
  addEventListener(tipo, fn) { this.listeners.set(tipo, fn); },
  removeEventListener(tipo, fn) {
    if (this.listeners.get(tipo) === fn) this.listeners.delete(tipo);
  },
};
globalThis.window = { matchMedia: () => mediaQuery };

// El `document` de mentira: lo mínimo que usa `applyPreferences` (el
// atributo `data-theme` de la raíz, las variables CSS y el color de la
// barra del navegador).
class Estilo {
  constructor() { this.propiedades = new Map(); }
  setProperty(nombre, valor) { this.propiedades.set(nombre, valor); }
  removeProperty(nombre) { this.propiedades.delete(nombre); }
  get(nombre) { return this.propiedades.get(nombre); }
  [Symbol.iterator]() { return this.propiedades.keys(); }
}

const raiz = { dataset: {}, style: new Estilo() };
const metaThemeColor = { atributos: {}, setAttribute(n, v) { this.atributos[n] = v; } };
globalThis.document = {
  documentElement: raiz,
  querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? metaThemeColor : null),
};

const {
  contrastRatio,
  isHexColor,
  suggestContrastFixes,
  resolveAutoTarget,
  savedThemeScheme,
  autoTargetOptions,
  getPreferences,
  sanitizePreferences,
  setPreferences,
  customColors,
  resolvedTheme,
  applyPreferences,
  getSavedThemes,
  saveSavedThemes,
  addSavedTheme,
  applySavedTheme,
  deleteSavedTheme,
  BASES,
  CONTRAST_CHECKS,
  SAVED_PREFIX,
  THEMES,
  AUTO_TARGETS,
  SIZE_MIN,
  SIZE_MAX,
  NAV_ICON_MIN,
  NAV_ICON_MAX,
} = await import('../../ui/settings/preferences.js');

beforeEach(() => {
  storage.clear();
  mediaQuery.matches = false;
  raiz.dataset = {};
  raiz.style = new Estilo();
  metaThemeColor.atributos = {};
});

// Luminosidad HSL (mismo cálculo que preferences.js:hexToHsl) para
// medir la cercanía entre una sugerencia y el color original.
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { h: 0, s: 0, l: (max + min) / 2 };
}

// ── contrastRatio ───────────────────────────────────────────────────────

test('contrastRatio: negro sobre blanco = 21', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
});

test('contrastRatio: mismo color = 1', () => {
  assert.equal(contrastRatio('#7c8698', '#7c8698'), 1);
  assert.equal(contrastRatio('#000000', '#000000'), 1);
});

test('contrastRatio: 4.5:1 para texto AA y 3:1 para bordes', () => {
  // CASO real: gris #595959 sobre blanco = 7.0 aprox (mayor que AA).
  assert.ok(contrastRatio('#595959', '#ffffff') >= 4.5);
  // AA NO: #777777 sobre blanco = 4.48, no llega a 4.5:1.
  assert.ok(contrastRatio('#777777', '#ffffff') < 4.5);
  // Bordes: #777777 sobre blanco sí cumple 3:1 aunque falle 4.5:1.
  assert.ok(contrastRatio('#777777', '#ffffff') >= 3);
});

// ── isHexColor ──────────────────────────────────────────────────────────

test('isHexColor: acepta #rrggbb en mayúsculas y minúsculas', () => {
  assert.equal(isHexColor('#0f172a'), true);
  assert.equal(isHexColor('#FFFFFF'), true);
  assert.equal(isHexColor('#aB12cD'), true);
});

test('isHexColor: rechaza cualquier otro formato', () => {
  assert.equal(isHexColor('0f172a'),  false); // sin #
  assert.equal(isHexColor('#fff'),    false); // shorthand
  assert.equal(isHexColor('#zzzzzz'), false); // no hex
  assert.equal(isHexColor('#0f172'),  false); // 5 dígitos
  assert.equal(isHexColor('#0f172ab'),false); // 7 dígitos (alpha)
  assert.equal(isHexColor('rgb(15,23,42)'), false);
  assert.equal(isHexColor(''),        false);
  assert.equal(isHexColor(null),      false);
  assert.equal(isHexColor(undefined), false);
});

// ── suggestContrastFixes ────────────────────────────────────────────────
// Cada sugerencia (si existe) debe alcanzar el `min` pedido contra el
// otro color del par. Usamos pares que de verdad NO cumplen `min` (ratio
// inicial < min) para que la función tenga que corregir (con un par
// que ya cumple el `min`, la app no sugiere nada y la prueba no
// ejercita corrección).

// Par conocido que SÍ llega a 4.5:1 en ambas direcciones (sin revelar
// el fallo real de la app): útil para el resto de las aserciones de
// forma/target/cercanía. Inicio 4.14, lighter 4.56, darker 4.53.
const PAR_BUENO = ['#181818', '#7a7a7a', 4.5];   // ratio inicial 4.14

test('suggestContrastFixes: ambas sugerencias cumplen el mínimo pedido', () => {
  // Par de grises con contraste bajo y recorrido en las dos direcciones
  // (claro: aclara el más claro, oscuro: oscurece el más oscuro). El
  // par ya está por debajo de `min` y la función tiene que corregir.
  assert.ok(contrastRatio(...PAR_BUENO) < PAR_BUENO[2],
    `el par bueno ya cumple ${PAR_BUENO[2]}:1 → no hay nada que corregir`);

  const [fg, bg, min] = PAR_BUENO;
  const { lighter, darker } = suggestContrastFixes(fg, bg, min);
  assert.ok(lighter, 'debería proponer un lado claro');
  assert.ok(darker,  'debería proponer un lado oscuro');

  // Tras aplicar `lighter` se aclara el más claro del par; el valor se
  // compara con el otro color que queda fijo.
  const otherForLighter = lighter.target === 'fg' ? bg : fg;
  const otherForDarker  = darker.target  === 'fg' ? bg : fg;
  assert.ok(contrastRatio(lighter.value, otherForLighter) + 1e-9 >= min,
    `la sugerencia lighter (${lighter.value}) no alcanza ${min}:1 → ${contrastRatio(lighter.value, otherForLighter)}`);
  assert.ok(contrastRatio(darker.value, otherForDarker) + 1e-9 >= min,
    `la sugerencia darker (${darker.value}) no alcanza ${min}:1 → ${contrastRatio(darker.value, otherForDarker)}`);
});

test('suggestContrastFixes: el target de la sugerencia es fg o bg', () => {
  const { lighter, darker } = suggestContrastFixes(...PAR_BUENO);
  assert.ok(['fg', 'bg'].includes(lighter.target));
  assert.ok(['fg', 'bg'].includes(darker.target));
  // Cada sugerencia modifica un lado distinto del par.
  assert.notEqual(lighter.target, darker.target);
});

test('suggestContrastFixes: ratio incluido en cada sugerencia cumple min', () => {
  // La función acompaña cada sugerencia con un `ratio` ya medido: ese
  // número, declarado por la función, debe ser ≥ min.
  const { lighter, darker } = suggestContrastFixes(...PAR_BUENO);
  assert.ok(lighter.ratio + 1e-9 >= PAR_BUENO[2]);
  assert.ok(darker.ratio  + 1e-9 >= PAR_BUENO[2]);
});

// La búsqueda binaria devuelve el color "más cercano" al original que
// cumple `min` (ver comentario de nearestValidLuminance). Comprobamos
// que la sugerencia no se va mucho más allá del mínimo: o el `ratio`
// declarado no supera `min + 0.3`, o el color sugerido está a menos de
// ~3 % de luminosidad HSL del original. (Las dos condiciones son
// alternativas: con pares muy alejados del mínimo solo se cumple la
// primera; con pares muy cercanos solo se cumple la segunda.)
test('suggestContrastFixes: la sugerencia es la más cercana al original', () => {
  // Par cuyas sugerencias quedan junto al mínimo (init 4.19 < 4.5):
  // lighter = #b0b0b0 (ratio 4.49, ΔL 0.024 ≈ 2 %; por debajo de 4.5 por
  // el mismo fallo de las pruebas de abajo), darker = #3f3f3f (ratio
  // 4.53, ΔL 0.020 ≈ 2 %). Aquí solo se mide la cercanía, con dos
  // criterios alternativos (OR): ratio ≤ min+0.3 o ΔL ≤ 0.03.
  const par = ['#444444', '#aaaaaa', 4.5];
  assert.ok(contrastRatio(...par) < par[2],
    `el par ya cumple ${par[2]}:1 → no hay nada que corregir`);

  const [fg, bg, min] = par;
  const { lighter, darker } = suggestContrastFixes(fg, bg, min);

  // El color original sobre el que actúa cada sugerencia.
  const origLighter = lighter.target === 'fg' ? fg : bg;
  const origDarker  = darker.target  === 'fg' ? fg : bg;
  const L = hex => hexToHsl(hex).l;

  // Para cada sugerencia basta UNA de las dos: ratio ≤ min+0.3
  // (cercanía por contraste) o ΔL ≤ 0.03 (cercanía por luminosidad).
  const okCerca = (origHex, sugg) =>
    sugg.ratio < min + 0.3 + 1e-9
    || Math.abs(L(sugg.value) - L(origHex)) < 0.03 + 1e-9;
  assert.ok(okCerca(origLighter, lighter),
    `lighter se aleja: ratio ${lighter.ratio.toFixed(3)} >= min+0.3 (${(min + 0.3).toFixed(3)}) y |ΔL| = ${Math.abs(L(lighter.value) - L(origLighter)).toFixed(3)}`);
  assert.ok(okCerca(origDarker, darker),
    `darker se aleja: ratio ${darker.ratio.toFixed(3)} >= min+0.3 (${(min + 0.3).toFixed(3)}) y |ΔL| = ${Math.abs(L(darker.value) - L(origDarker)).toFixed(3)}`);
});

// ── Fallos reales de la app (suggestContrastFixes) ─────────────────────
// La función nearestValidLuminance deja a veces la sugerencia
// ligeramente por debajo del mínimo pedido. Estos pares se quedan en
// rojo a propósito: describen un bug real que Claude tiene que
// registrar como corrección.

test('suggestContrastFixes: par #777777/#888888 con min 3 (la sugerencia lighter debe alcanzar 3:1)', () => {
  // El par inicial da 1.26:1; pedimos 3:1. La sugerencia darker
  // (#3e3e3e) sí llega (3.02) pero la lighter (#d3d3d3) se queda en
  // 2.99:1, ligeramente por debajo del mínimo.
  assert.ok(contrastRatio('#777777', '#888888') < 3);
  const { lighter, darker } = suggestContrastFixes('#777777', '#888888', 3);
  assert.ok(lighter, 'debería proponer un lado claro');
  assert.ok(darker,  'debería proponer un lado oscuro');
  const otherForLighter = lighter.target === 'fg' ? '#888888' : '#777777';
  const otherForDarker  = darker.target  === 'fg' ? '#888888' : '#777777';
  assert.ok(contrastRatio(lighter.value, otherForLighter) + 1e-9 >= 3,
    `la sugerencia lighter (${lighter.value}) no alcanza 3:1 → ${contrastRatio(lighter.value, otherForLighter).toFixed(3)}`);
  assert.ok(contrastRatio(darker.value, otherForDarker) + 1e-9 >= 3,
    `la sugerencia darker (${darker.value}) no alcanza 3:1 → ${contrastRatio(darker.value, otherForDarker).toFixed(3)}`);
});

test('suggestContrastFixes: par #0f172a/#334155 con min 4.5 (la sugerencia lighter debe alcanzar 4.5:1)', () => {
  // El par inicial da 1.72:1; pedimos 4.5:1. La sugerencia lighter
  // (#6981a5) se queda en 4.49:1, ligeramente por debajo del mínimo.
  assert.ok(contrastRatio('#0f172a', '#334155') < 4.5);
  const { lighter } = suggestContrastFixes('#0f172a', '#334155', 4.5);
  assert.ok(lighter, 'debería proponer un lado claro');
  const other = lighter.target === 'fg' ? '#334155' : '#0f172a';
  assert.ok(contrastRatio(lighter.value, other) + 1e-9 >= 4.5,
    `la sugerencia lighter (${lighter.value}) no alcanza 4.5:1 → ${contrastRatio(lighter.value, other).toFixed(3)}`);
});

// ── resolveAutoTarget ───────────────────────────────────────────────────

test('resolveAutoTarget: oficial del esquema correcto devuelve sus colores', () => {
  const r = resolveAutoTarget('light', 'light');
  assert.equal(r.scheme, 'light');
  assert.equal(r.colors.bg, BASES.light.colors.bg);
  assert.equal(r.navIconSize, null);
});

test('resolveAutoTarget: oficial de OTRO esquema devuelve null', () => {
  // 'dark' en claro no encaja.
  assert.equal(resolveAutoTarget('dark', 'light'), null);
  // 'light' en oscuro tampoco.
  assert.equal(resolveAutoTarget('light', 'dark'), null);
});

test('resolveAutoTarget: "saved:<id>" del esquema correcto devuelve sus colores', () => {
  // Guardamos un tema claro y resolvemos.
  const theme = {
    id: 'a1',
    name: 'Mi tema',
    base: 'light',
    scheme: 'light',
    colors: { text: '#123456' },
    navIconSize: 72,
  };
  storage.setItem('savedCustomThemes', JSON.stringify([theme]));

  const r = resolveAutoTarget(SAVED_PREFIX + 'a1', 'light');
  assert.ok(r);
  assert.equal(r.scheme, 'light');
  // Los colores propios se mezclan sobre los de la base.
  assert.equal(r.colors.text, '#123456');
  assert.equal(r.colors.bg,   BASES.light.colors.bg);
  assert.equal(r.navIconSize, 72);
});

test('resolveAutoTarget: "saved:<id>" del esquema contrario devuelve null', () => {
  storage.setItem('savedCustomThemes', JSON.stringify([{
    id: 'a1', name: 'Oscuro', base: 'dark', scheme: 'dark',
    colors: {}, navIconSize: null,
  }]));
  assert.equal(resolveAutoTarget(SAVED_PREFIX + 'a1', 'light'), null);
});

test('resolveAutoTarget: id inexistente devuelve null', () => {
  storage.setItem('savedCustomThemes', JSON.stringify([]));
  assert.equal(resolveAutoTarget(SAVED_PREFIX + 'no-existe', 'light'), null);
  assert.equal(resolveAutoTarget('valor-raro', 'light'), null);
});

// ── savedThemeScheme ────────────────────────────────────────────────────

test('savedThemeScheme: usa el scheme propio si está definido', () => {
  assert.equal(savedThemeScheme({ scheme: 'light', base: 'dark' }), 'light');
  assert.equal(savedThemeScheme({ scheme: 'dark',  base: 'light' }), 'dark');
});

test('savedThemeScheme: cae al scheme del base si no hay propio', () => {
  assert.equal(savedThemeScheme({ scheme: null, base: 'dark' }), 'dark');
  assert.equal(savedThemeScheme({                  base: 'light' }), 'light');
  assert.equal(savedThemeScheme({ scheme: null, base: 'contrast-light' }), 'light');
});

test('savedThemeScheme: tema sin base conocida devuelve null', () => {
  assert.equal(savedThemeScheme({ scheme: null, base: 'fantasma' }), null);
  assert.equal(savedThemeScheme({}), null);
});

// ── Protección de contraste de los temas oficiales ──────────────────────
// Para cada tema de BASES y cada par de CONTRAST_CHECKS, el contraste
// real debe cumplir el `min` que pide el par. Si esto fallase sería un
// fallo real de la app y NO debe rebajarse la prueba.

for (const baseName of Object.keys(BASES)) {
  test(`protección de contraste: tema "${baseName}" cumple WCAG AA en los pares definidos`, () => {
    const colors = BASES[baseName].colors;
    for (const check of CONTRAST_CHECKS) {
      const ratio = contrastRatio(colors[check.fg], colors[check.bg]);
      assert.ok(
        ratio + 1e-9 >= check.min,
        `${baseName}: ${check.label} → ${ratio.toFixed(2)}:1 (mínimo ${check.min}:1). ` +
        `fg=${check.fg}=${colors[check.fg]} sobre bg=${check.bg}=${colors[check.bg]}`,
      );
    }
  });
}

// ── Lectura de las preferencias ────────────────────────────────────────

test('getPreferences: sin nada guardado sale la configuración por defecto', () => {
  const prefs = getPreferences();
  assert.equal(prefs.theme, 'auto');
  assert.equal(prefs.textScale, 100);
  assert.deepEqual(prefs.sizes, {});
  assert.equal(prefs.autoLight, 'light');
  assert.equal(prefs.autoDark, 'dark');
  assert.deepEqual(prefs.custom, {
    base: 'dark', colors: {}, navIconSize: null, scheme: null, savedId: null,
  });
});

test('getPreferences: lo que está guardado se devuelve', () => {
  storage.setItem('a11yPrefs', JSON.stringify({
    theme: 'dark', textScale: 130, sizes: { title: 120 },
  }));

  const prefs = getPreferences();
  assert.equal(prefs.theme, 'dark');
  assert.equal(prefs.textScale, 130);
  assert.deepEqual(prefs.sizes, { title: 120 });
});

test('getPreferences: unas preferencias guardadas que no se pueden leer no rompen la app', () => {
  storage.setItem('a11yPrefs', '{esto no es json');
  assert.equal(getPreferences().theme, 'auto');
});

// ── Saneado de las preferencias ────────────────────────────────────────

test('sanitizePreferences: un tema que no existe se descarta', () => {
  assert.equal(sanitizePreferences({ theme: 'fantasma' }).theme, 'auto');
  assert.equal(sanitizePreferences({ theme: 'dark' }).theme, 'dark');
  assert.ok(THEMES.includes(sanitizePreferences({ theme: 'fantasma' }).theme));
});

test('sanitizePreferences: un tamaño de letra que no está en la lista se descarta', () => {
  assert.equal(sanitizePreferences({ textScale: 120 }).textScale, 100);
  assert.equal(sanitizePreferences({ textScale: 130 }).textScale, 130);
});

test('sanitizePreferences: los tamaños por parte fuera de rango se descartan', () => {
  const prefs = sanitizePreferences({
    sizes: { title: SIZE_MIN - 1, label: SIZE_MAX + 1, nav: 120 },
  });
  assert.deepEqual(prefs.sizes, { nav: 120 });
});

test('sanitizePreferences: una base de tema que no existe cae en la de por defecto', () => {
  assert.equal(sanitizePreferences({ custom: { base: 'fantasma' } }).custom.base, 'dark');
  assert.equal(sanitizePreferences({ custom: { base: 'light' } }).custom.base, 'light');
});

test('sanitizePreferences: solo se guardan los colores que son hex válidos', () => {
  const prefs = sanitizePreferences({
    custom: { colors: { text: '#AABBCC', bg: 'no es un color', inventado: '#ffffff' } },
  });
  assert.deepEqual(prefs.custom.colors, { text: '#aabbcc' });
});

test('sanitizePreferences: el tamaño del icono fuera de rango se descarta', () => {
  assert.equal(sanitizePreferences({ custom: { navIconSize: NAV_ICON_MIN - 4 } }).custom.navIconSize, null);
  assert.equal(sanitizePreferences({ custom: { navIconSize: NAV_ICON_MAX + 4 } }).custom.navIconSize, null);
  assert.equal(sanitizePreferences({ custom: { navIconSize: 64 } }).custom.navIconSize, 64);
});

test('sanitizePreferences: el esquema del tema propio solo acepta claro u oscuro', () => {
  assert.equal(sanitizePreferences({ custom: { scheme: 'light' } }).custom.scheme, 'light');
  assert.equal(sanitizePreferences({ custom: { scheme: 'fantasma' } }).custom.scheme, null);
});

test('sanitizePreferences: un savedId que no existe se descarta', () => {
  assert.equal(sanitizePreferences({ custom: { savedId: 'no-existe' } }).custom.savedId, null);

  storage.setItem('savedCustomThemes', JSON.stringify([
    { id: 'a1', name: 'Mío', base: 'dark' },
  ]));
  assert.equal(sanitizePreferences({ custom: { savedId: 'a1' } }).custom.savedId, 'a1');
});

test('sanitizePreferences: un destino automático que no vale cae en el de por defecto', () => {
  const prefs = sanitizePreferences({ autoLight: 'fantasma', autoDark: 'fantasma' });
  assert.equal(prefs.autoLight, 'light');
  assert.equal(prefs.autoDark, 'dark');
  assert.ok(AUTO_TARGETS.includes(prefs.autoLight));
  assert.ok(AUTO_TARGETS.includes(prefs.autoDark));
});

test('sanitizePreferences: un destino automático que apunta a un tema guardado se conserva', () => {
  storage.setItem('savedCustomThemes', JSON.stringify([
    { id: 'a1', name: 'Claro', base: 'light', scheme: 'light' },
  ]));
  assert.equal(sanitizePreferences({ autoLight: SAVED_PREFIX + 'a1' }).autoLight, SAVED_PREFIX + 'a1');
});

// ── Escritura de las preferencias ──────────────────────────────────────

test('setPreferences: guarda las preferencias y las aplica', () => {
  setPreferences({ theme: 'dark' });

  assert.equal(getPreferences().theme, 'dark');
  assert.equal(raiz.dataset.theme, 'dark', 'el tema se aplica a la raíz');
});

test('setPreferences: lo que no se cambia se conserva', () => {
  setPreferences({ theme: 'dark' });
  setPreferences({ textScale: 130 });

  const prefs = getPreferences();
  assert.equal(prefs.theme, 'dark');
  assert.equal(prefs.textScale, 130);
});

test('setPreferences: en el almacenamiento quedan el esquema y las variables CSS', () => {
  setPreferences({ theme: 'contrast-dark' });

  const guardado = JSON.parse(storage.getItem('a11yPrefs'));
  assert.equal(guardado.scheme, 'dark');
  assert.equal(guardado.vars['--bg'], BASES['contrast-dark'].colors.bg);
});

// ── Los colores del tema propio ───────────────────────────────────────

test('customColors: son los colores de la base con los cambios del usuario', () => {
  const colores = customColors({ base: 'light', colors: { text: '#123456' } });
  assert.equal(colores.text, '#123456');
  assert.equal(colores.bg, BASES.light.colors.bg);
});

// ── El tema que se aplica ──────────────────────────────────────────────

test('resolvedTheme: un tema claro u oscuro se queda como está', () => {
  assert.equal(resolvedTheme('light'), 'light');
  assert.equal(resolvedTheme('dark'), 'dark');
});

test('resolvedTheme: el alto contraste devuelve su esquema', () => {
  assert.equal(resolvedTheme('contrast-dark'), 'dark');
  assert.equal(resolvedTheme('contrast-light'), 'light');
});

test('resolvedTheme: en automático sigue al sistema', () => {
  mediaQuery.matches = false;
  assert.equal(resolvedTheme('auto'), 'light');
  mediaQuery.matches = true;
  assert.equal(resolvedTheme('auto'), 'dark');
});

test('resolvedTheme: en automático, el esquema es el del sistema', () => {
  // El destino automático NO puede cambiar el esquema: solo puede ser un
  // tema del esquema del sistema (es lo que comprueba el saneado de las
  // preferencias, ver la prueba siguiente). Por eso el esquema que se
  // aplica es siempre el del sistema; lo que el destino sí cambia son
  // los colores (prueba de más abajo).
  storage.setItem('a11yPrefs', JSON.stringify({
    theme: 'auto', autoLight: 'contrast-light', autoDark: 'contrast-dark',
  }));

  mediaQuery.matches = false;
  assert.equal(resolvedTheme('auto'), 'light');
  mediaQuery.matches = true;
  assert.equal(resolvedTheme('auto'), 'dark');
});

test('sanitizePreferences: el destino automático siempre es del esquema del sistema', () => {
  // Un destino del esquema contrario no vale (si valiera, el tema que se
  // aplica en automático podría no ser el del sistema).
  const prefs = sanitizePreferences({ autoLight: 'contrast-dark', autoDark: 'contrast-light' });
  assert.equal(prefs.autoLight, 'light', 'un destino oscuro no vale para el sistema en claro');
  assert.equal(prefs.autoDark, 'dark', 'un destino claro no vale para el sistema en oscuro');
});

test('en automático, el destino elegido es el que se aplica', () => {
  // El destino automático se nota en los COLORES: con el sistema en
  // claro y el destino «alto contraste claro», se aplican los colores
  // del alto contraste, no los del tema claro normal.
  mediaQuery.matches = false;
  applyPreferences(prefsDePrueba({
    theme: 'auto', autoLight: 'contrast-light', autoDark: 'contrast-dark',
  }));

  assert.equal(raiz.dataset.theme, 'light');
  assert.equal(raiz.style.get('--bg'), BASES['contrast-light'].colors.bg,
    'se aplican los colores del destino automático');
  assert.notEqual(raiz.style.get('--bg'), BASES.light.colors.bg,
    'no son los colores del tema claro normal');
});

test('en automático, se puede seguir un tema guardado por el usuario', () => {
  storage.setItem('savedCustomThemes', JSON.stringify([
    { id: 'a1', name: 'Mío claro', base: 'light', scheme: 'light', colors: { text: '#123456' } },
  ]));

  mediaQuery.matches = false;
  applyPreferences(prefsDePrueba({
    theme: 'auto', autoLight: SAVED_PREFIX + 'a1', autoDark: 'dark',
  }));

  assert.equal(raiz.style.get('--text'), '#123456',
    'se aplican los colores del tema guardado por el usuario');
  assert.equal(raiz.style.get('--bg'), BASES.light.colors.bg,
    'y los de su base');
});

// ── La aplicación de las preferencias ──────────────────────────────────

/** unas preferencias válidas, para las pruebas de `applyPreferences`. */
const prefsDePrueba = (cambios = {}) => ({
  theme: 'dark', textScale: 100, sizes: {}, autoLight: 'light', autoDark: 'dark',
  custom: { base: 'dark', colors: {}, navIconSize: null, scheme: null, savedId: null },
  ...cambios,
});

test('applyPreferences: aplica el esquema, el tamaño de letra y las variables', () => {
  applyPreferences(prefsDePrueba({ theme: 'contrast-dark', textScale: 130, sizes: { title: 120 } }));

  assert.equal(raiz.dataset.theme, 'dark');
  assert.equal(raiz.style.fontSize, '130%');
  assert.equal(raiz.style.get('--fs-title'), '1.2');
  assert.equal(raiz.style.get('--bg'), BASES['contrast-dark'].colors.bg);
});

test('applyPreferences: quita las variables que había puesto el arranque', () => {
  raiz.style.setProperty('--fs-title', '2');

  applyPreferences(prefsDePrueba({ theme: 'light' }));

  assert.equal(raiz.style.get('--fs-title'), undefined, 'la variable vieja está quitada');
});

test('applyPreferences: el color de la barra del navegador es el del panel del tema', () => {
  applyPreferences(prefsDePrueba({ theme: 'contrast-dark' }));
  assert.equal(metaThemeColor.atributos.content, BASES['contrast-dark'].colors.panel);
});

// ── Los temas guardados por el usuario ─────────────────────────────────

test('getSavedThemes: sin nada guardado no hay ninguno', () => {
  assert.deepEqual(getSavedThemes(), []);
});

test('getSavedThemes: una lista que no se puede leer se ignora', () => {
  storage.setItem('savedCustomThemes', '{esto no es json');
  assert.deepEqual(getSavedThemes(), []);

  storage.setItem('savedCustomThemes', '{"no":"es una lista"}');
  assert.deepEqual(getSavedThemes(), []);
});

test('getSavedThemes: los temas sin nombre se descartan', () => {
  storage.setItem('savedCustomThemes', JSON.stringify([
    { id: 'a1', name: '   ' },
    { id: 'a2', name: 'Mío' },
  ]));

  const temas = getSavedThemes();
  assert.equal(temas.length, 1);
  assert.equal(temas[0].name, 'Mío');
});

test('saveSavedThemes: guarda la lista y la devuelve', () => {
  const lista = [{ id: 'a1', name: 'Mío', base: 'dark', colors: {} }];

  assert.equal(saveSavedThemes(lista), lista);
  assert.equal(JSON.parse(storage.getItem('savedCustomThemes')).length, 1);
});

test('addSavedTheme: guarda un tema nuevo con sus colores', () => {
  const lista = addSavedTheme('Mío', { text: '#123456' }, 'light');

  assert.equal(lista.length, 1);
  assert.equal(lista[0].name, 'Mío');
  assert.equal(lista[0].colors.text, '#123456');
  assert.equal(lista[0].scheme, 'light');
  assert.equal(getSavedThemes().length, 1);
});

test('addSavedTheme: un nombre vacío se rechaza', () => {
  assert.throws(() => addSavedTheme('   ', {}, null), /no puede estar vacío/);
});

test('addSavedTheme: guardar un tema con el mismo nombre lo sobreescribe', () => {
  const primero = addSavedTheme('Mío', { text: '#111111' }, 'light');
  const segundo = addSavedTheme('Mío', { text: '#222222' }, 'light');

  assert.equal(segundo.length, 1);
  assert.equal(segundo[0].id, primero[0].id, 'conserva el identificador');
  assert.equal(segundo[0].colors.text, '#222222');
});

test('addSavedTheme: el tema guardado pasa a ser el activo', () => {
  const lista = addSavedTheme('Mío', {}, 'dark');
  assert.equal(getPreferences().custom.savedId, lista[0].id);
});

test('applySavedTheme: aplica el tema guardado', () => {
  const lista = addSavedTheme('Mío', { text: '#123456' }, 'light');

  const tema = applySavedTheme(lista[0].id);
  assert.equal(tema.id, lista[0].id);

  const prefs = getPreferences();
  assert.equal(prefs.custom.savedId, lista[0].id);
  assert.equal(prefs.custom.colors.text, '#123456');
  assert.equal(prefs.custom.base, tema.base);
});

test('applySavedTheme: un id que no existe no hace nada', () => {
  assert.equal(applySavedTheme('no-existe'), null);
});

test('deleteSavedTheme: borra el tema', () => {
  const lista = addSavedTheme('Mío', {}, 'dark');

  const siguiente = deleteSavedTheme(lista[0].id);
  assert.equal(siguiente.length, 0);
  assert.deepEqual(getSavedThemes(), []);
});

test('deleteSavedTheme: al borrar el tema activo se quita su referencia', () => {
  const lista = addSavedTheme('Mío', {}, 'dark');
  // El tema guardado pasa a ser el activo (como cuando el usuario lo
  // elige en la lista de temas guardados).
  setPreferences({
    theme: 'custom',
    custom: { ...getPreferences().custom, savedId: lista[0].id },
  });
  assert.equal(getPreferences().custom.savedId, lista[0].id, 'el tema guardado es el activo');

  deleteSavedTheme(lista[0].id);

  assert.deepEqual(getSavedThemes(), [], 'el tema ya no está en la lista');
  assert.equal(getPreferences().custom.savedId, null,
    'las preferencias ya no apuntan a un tema que no existe');
  // Y el tema activo no cambia. OJO: preferences.js tiene un bloque que,
  // al borrar el tema activo, devuelve la app a «Automático» (líneas
  // 718-720), pero no se puede llegar a él: al leer las preferencias se
  // descarta el identificador de un tema que ya no está en la lista
  // (sanitizePreferences), así que la comparación `savedId === id` nunca
  // es cierta. Devolver la app a «Automático» es un cambio de la app, no
  // de sus pruebas: aquí se deja constancia de lo que hay hoy.
  assert.equal(getPreferences().theme, 'custom',
    'el tema activo sigue siendo el que había');
});

// ── Las opciones del modo automático ───────────────────────────────────

test('autoTargetOptions: en claro salen los temas claros', () => {
  const valores = autoTargetOptions('light').map(o => o.value);

  assert.ok(valores.includes('light'));
  assert.ok(valores.includes('contrast-light'));
  assert.ok(!valores.includes('dark'), 'los oscuros no son para el sistema en claro');
});

test('autoTargetOptions: los temas guardados aparecen con su nombre', () => {
  storage.setItem('savedCustomThemes', JSON.stringify([
    { id: 'a1', name: 'Mío claro', base: 'light', scheme: 'light' },
    { id: 'a2', name: 'Mío oscuro', base: 'dark', scheme: 'dark' },
  ]));

  const opciones = autoTargetOptions('light');
  const guardado = opciones.find(o => o.value === SAVED_PREFIX + 'a1');

  assert.ok(guardado, 'el tema guardado aparece en las opciones');
  assert.match(guardado.label, /Mío claro/);
  assert.ok(!opciones.some(o => o.value === SAVED_PREFIX + 'a2'), 'el oscuro no');
});

// ── El sistema cambia de tema ──────────────────────────────────────────

test('cuando el sistema pasa a oscuro, se aplican las preferencias si el tema es automático', () => {
  const alCambiar = mediaQuery.listeners.get('change');
  assert.ok(alCambiar, 'preferences.js tiene que enterarse de los cambios del sistema');

  storage.setItem('a11yPrefs', JSON.stringify({ theme: 'auto' }));
  mediaQuery.matches = true;
  alCambiar();

  assert.equal(raiz.dataset.theme, 'dark');
});

test('si el tema no es automático, un cambio del sistema no toca nada', () => {
  storage.setItem('a11yPrefs', JSON.stringify({ theme: 'light' }));

  mediaQuery.matches = true;
  mediaQuery.listeners.get('change')();

  assert.equal(raiz.dataset.theme, undefined, 'no se ha aplicado ningún tema');
});

test('autoTargetOptions: en oscuro salen los temas oscuros', () => {
  const valores = autoTargetOptions('dark').map(o => o.value);

  assert.ok(valores.includes('dark'));
  assert.ok(valores.includes('contrast-dark'));
  assert.ok(!valores.includes('light'), 'los claros no son para el sistema en oscuro');
});

test('applyPreferences: un tema propio se aplica con su esquema y sus colores', () => {
  applyPreferences(prefsDePrueba({
    theme: 'custom',
    custom: { base: 'light', colors: { text: '#123456' }, navIconSize: 72, scheme: null, savedId: null },
  }));

  assert.equal(raiz.dataset.theme, 'light', 'el esquema sale de la base del tema');
  assert.equal(raiz.style.get('--text'), '#123456', 'los colores del usuario se aplican');
  assert.equal(raiz.style.get('--nav-icon-size'), '72px');
});

test('applyPreferences: un tema propio con esquema elegido manda sobre el de su base', () => {
  applyPreferences(prefsDePrueba({
    theme: 'custom',
    custom: { base: 'light', colors: {}, navIconSize: null, scheme: 'dark', savedId: null },
  }));

  assert.equal(raiz.dataset.theme, 'dark');
});

test('applyPreferences: un tema que no existe sigue al sistema', () => {
  mediaQuery.matches = true;
  applyPreferences(prefsDePrueba({ theme: 'fantasma' }));
  assert.equal(raiz.dataset.theme, 'dark');
});
