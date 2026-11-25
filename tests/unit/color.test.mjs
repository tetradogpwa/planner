// Pruebas de la matemática de color (back/color.js).
//
// back/color.js no toca el navegador: se importa tal cual, sin stubs
// de ventana ni de documento. Estas pruebas comprueban los números que
// la app muestra en el comprobador de contraste de «Apariencia».

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  contrastRatio,
  isHexColor,
  suggestContrastFixes,
  mix,
  alpha,
} from '../../back/color.js';

// ── contrastRatio ───────────────────────────────────────────────────────

test('contrastRatio: negro sobre blanco = 21', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
});

test('contrastRatio: un color consigo mismo = 1', () => {
  assert.equal(contrastRatio('#7c8698', '#7c8698'), 1);
  assert.equal(contrastRatio('#000000', '#000000'), 1);
});

test('contrastRatio: el verde puro sobre negro da 15,3:1', () => {
  // El canal verde pesa 0,7152 en la luminosidad: si ese peso cambia,
  // este número cambia (y con él el contraste que ve el usuario).
  assert.ok(Math.abs(contrastRatio('#00ff00', '#000000') - 15.304) < 0.001);
});

// ── isHexColor ──────────────────────────────────────────────────────────

test('isHexColor: acepta #rrggbb', () => {
  assert.equal(isHexColor('#a1b2c3'), true);
  assert.equal(isHexColor('#A1B2C3'), true);
});

test('isHexColor: rechaza lo que no es #rrggbb', () => {
  assert.equal(isHexColor('red'), false);      // nombre de color
  assert.equal(isHexColor('#abc'), false);     // forma corta
  assert.equal(isHexColor('a1b2c3'), false);   // sin #
});

// ── suggestContrastFixes ───────────────────────────────────────────────

// Par que NO cumple 4,5:1 (1,35:1) pero del que se puede salir: el
// blanco sobre #767676 da 4,54:1 y el negro sobre #8c8c8c da 6,25:1.
const FG = '#8c8c8c';
const BG = '#767676';

test('suggestContrastFixes: sugiere un color más claro que llega al mínimo', () => {
  assert.ok(contrastRatio(FG, BG) < 4.5, 'el par de partida no cumple 4,5:1');

  const { lighter } = suggestContrastFixes(FG, BG, 4.5);
  assert.ok(lighter, 'tiene que haber una sugerencia más clara');
  assert.equal(lighter.target, 'fg');
  assert.ok(contrastRatio(lighter.value, BG) >= 4.5,
    `la sugerencia ${lighter.value} no llega a 4,5:1 sobre ${BG}`);
  assert.ok(Math.abs(lighter.ratio - contrastRatio(lighter.value, BG)) < 1e-9,
    'el ratio de la sugerencia es el contraste real del color propuesto');
});

test('suggestContrastFixes: sugiere un color más oscuro que llega al mínimo', () => {
  const { darker } = suggestContrastFixes(FG, BG, 4.5);
  assert.ok(darker, 'tiene que haber una sugerencia más oscura');
  assert.equal(darker.target, 'bg');
  assert.ok(contrastRatio(darker.value, FG) >= 4.5,
    `la sugerencia ${darker.value} no llega a 4,5:1 sobre ${FG}`);
  assert.ok(Math.abs(darker.ratio - contrastRatio(darker.value, FG)) < 1e-9,
    'el ratio de la sugerencia es el contraste real del color propuesto');
});

test('suggestContrastFixes: sin sugerencia más clara si aclararla no llega', () => {
  // fg y bg tan claros que ni el blanco llega a 4,5:1 sobre ninguno:
  // aclararlos más no arregla el par. Oscurecer el fondo sí.
  const fixes = suggestContrastFixes('#f0f0f0', '#e0e0e0', 4.5);
  assert.equal(fixes.lighter, null);
  assert.ok(fixes.darker, 'oscurecer el fondo sí llega a 4,5:1');
  assert.equal(fixes.darker.target, 'bg');
});

// ── mix y alpha ────────────────────────────────────────────────────────
// Los usa buildColorVars() de ui/settings/preferences.js para las
// variables CSS del tema.

test('mix: mezcla dos colores en la proporción pedida', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});

test('alpha: un color con transparencia', () => {
  assert.equal(alpha('#ff0000', 0.12), 'rgba(255, 0, 0, 0.12)');
});
