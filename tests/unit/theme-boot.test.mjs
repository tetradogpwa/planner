// Pruebas de theme-boot.js: el script clásico que aplica el tema antes
// del primer pintado.
//
// theme-boot.js no es un módulo (se carga en <head> con un <script> sin
// `type="module"`), así que no se puede importar. Para probarlo se lee
// su texto y se ejecuta con `vm.runInNewContext`, con dobles de
// `localStorage`, `window.matchMedia` y `document.documentElement`.
//
// Lo que se mira es lo que vería quien abre la app: el valor que queda
// en el atributo `data-theme` de la raíz con el primer pintado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const CODIGO = readFileSync(join(RAIZ, 'theme-boot.js'), 'utf8');

/**
 * Ejecuta theme-boot.js como lo hace el navegador y devuelve el tema
 * que queda puesto en `data-theme` (null si no se puso ninguno).
 *
 * @param {object} opciones
 * @param {string|null} opciones.guardado  lo que hay en localStorage.
 * @param {boolean} opciones.sistemaOscuro  lo que dice prefers-color-scheme.
 */
function arrancar({ guardado = null, sistemaOscuro = false } = {}) {
  const atributos = {};
  const consultas = [];

  const contexto = {
    localStorage: { getItem: () => guardado },
    window: {
      matchMedia: (consulta) => {
        consultas.push(consulta);
        return { matches: sistemaOscuro };
      },
    },
    document: {
      documentElement: {
        setAttribute: (nombre, valor) => { atributos[nombre] = valor; },
        style: { setProperty() {}, fontSize: '' },
      },
    },
  };

  vm.runInNewContext(CODIGO, contexto);
  return { tema: atributos['data-theme'] ?? null, consultas };
}

/** Las preferencias guardadas, como las deja `setPreferences`. */
const guardadas = (prefs) => JSON.stringify(prefs);

// ── En automático, el primer pintado sigue al sistema ────────────────

test('en automático, el primer pintado sigue al sistema aunque el esquema guardado sea otro', () => {
  // El `scheme` guardado es el que tenía el sistema cuando se guardó
  // las preferencias. Si el sistema cambió después, el arranque con el
  // `scheme` guardado pintaba el color contrario (parpadeo) hasta que
  // preferences.js aplicaba el tema de verdad.
  const { tema } = arrancar({
    guardado: guardadas({ theme: 'auto', scheme: 'light' }),
    sistemaOscuro: true,
  });

  assert.equal(tema, 'dark', 'el sistema está en oscuro: el arranque tiene que ser oscuro');
});

test('en automático con el sistema en claro, el primer pintado es claro', () => {
  const { tema } = arrancar({
    guardado: guardadas({ theme: 'auto', scheme: 'light' }),
    sistemaOscuro: false,
  });

  assert.equal(tema, 'light');
});

test('en automático, el arranque pregunta al sistema por su esquema', () => {
  const { consultas } = arrancar({
    guardado: guardadas({ theme: 'auto', scheme: 'light' }),
    sistemaOscuro: true,
  });

  assert.ok(
    consultas.includes('(prefers-color-scheme: dark)'),
    `se preguntó por: ${JSON.stringify(consultas)}`,
  );
});

// ── Los temas que no son automáticos ────────────────────────────────

test('un tema de alto contraste no sigue al sistema', () => {
  const { tema } = arrancar({
    guardado: guardadas({ theme: 'contrast-light', scheme: 'light' }),
    sistemaOscuro: true,
  });

  assert.equal(tema, 'light', 'el alto contraste claro se queda claro aunque el sistema esté oscuro');
});

test('un tema propio usa el esquema guardado', () => {
  const { tema } = arrancar({
    guardado: guardadas({ theme: 'custom', scheme: 'dark' }),
    sistemaOscuro: false,
  });

  assert.equal(tema, 'dark', 'el tema propio es oscuro aunque el sistema esté claro');
});

test('un tema claro u oscuro explícito se respeta', () => {
  assert.equal(arrancar({
    guardado: guardadas({ theme: 'dark' }), sistemaOscuro: false,
  }).tema, 'dark');

  assert.equal(arrancar({
    guardado: guardadas({ theme: 'light' }), sistemaOscuro: true,
  }).tema, 'light');
});

// ── Sin preferencias (o ilegibles) ───────────────────────────────────

test('sin preferencias guardadas, el arranque sigue al sistema', () => {
  assert.equal(arrancar({ guardado: null, sistemaOscuro: true }).tema, 'dark');
  assert.equal(arrancar({ guardado: null, sistemaOscuro: false }).tema, 'light');
});

test('unas preferencias ilegibles no rompen el arranque: se sigue al sistema', () => {
  const { tema } = arrancar({ guardado: '{esto no es json', sistemaOscuro: true });

  assert.equal(tema, 'dark');
});
