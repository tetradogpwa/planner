// Pruebas de la capa de preferencias de apariencia (ui/settings/preferences.js).
// Lógica pura: nada toca el DOM. preferences.js usa `window.matchMedia`
// al importarse (línea 158) y `resolveAutoTarget` consulta
// `localStorage` (vía `getSavedThemes`) cuando el destino es de un tema
// guardado por el usuario. Por eso montamos un stub mínimo antes del
// import dinámico. Solo preparamos entorno; no imitamos lógica.

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
// `prefers-color-scheme` por defecto en claro: el supervisor no necesita
// distinguir los temas oficiales por esquema en estos tests.
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};

const {
  contrastRatio,
  isHexColor,
  suggestContrastFixes,
  resolveAutoTarget,
  savedThemeScheme,
  BASES,
  CONTRAST_CHECKS,
  SAVED_PREFIX,
} = await import('../../ui/settings/preferences.js');

beforeEach(() => storage.clear());

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
