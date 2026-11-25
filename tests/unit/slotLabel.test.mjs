// T-051: la etiqueta de la «vez» de una tarea que se repite varias
// veces al día.
//
// Con Veces/día = 3, cada vez tiene que salir con su propia etiqueta
// ("1/3", "2/3", "3/3"). Antes se ponían franjas horarias ("0–12H" y
// "12–24H"), así que la segunda vez y la tercera salían con la misma
// etiqueta y no se distinguían.
//
// La etiqueta la comparten la vista Semana y el PDF: viven en
// `ui/slotLabel.js`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { slotLabel } from '../../ui/slotLabel.js';

test('con tres veces al día, cada vez tiene su propia etiqueta', () => {
  assert.equal(slotLabel(3, 0), '1/3');
  assert.equal(slotLabel(3, 1), '2/3');
  assert.equal(slotLabel(3, 2), '3/3');
});

test('las etiquetas de un día son distintas entre sí', () => {
  const etiquetas = [0, 1, 2].map(i => slotLabel(3, i));
  assert.equal(new Set(etiquetas).size, 3);
});

test('con dos veces al día sale "1/2" y "2/2"', () => {
  assert.equal(slotLabel(2, 0), '1/2');
  assert.equal(slotLabel(2, 1), '2/2');
});

test('con una sola vez al día no hay etiqueta', () => {
  assert.equal(slotLabel(1, 0), '');
});

test('una vez que no existe (fuera del rango) no tiene etiqueta', () => {
  assert.equal(slotLabel(3, 3), '');
  assert.equal(slotLabel(3, -1), '');
});
