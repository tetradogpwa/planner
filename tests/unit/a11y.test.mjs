// Pruebas de las utilidades de accesibilidad (ui/a11y.js).
//
// Sin jsdom: se hacen dobles mínimos de lo que usan estas funciones
// (un elemento con sus atributos y su foco, un contenedor con sus
// elementos enfocables y su listener de teclado, y el `document` con el
// elemento que tiene el foco). Las pruebas miran lo que vería quien
// usa la app: dónde queda el foco, qué atributos se escriben y qué
// pasa al pulsar una tecla.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { isEditable, trapFocus, bindRovingTabindex, focusHeading } from '../../ui/a11y.js';

// ── Dobles mínimos ─────────────────────────────────────────────────────

/** El `document` de mentira: solo hace falta `activeElement`. */
const documento = { activeElement: null };
globalThis.document = documento;

/** Un elemento de mentira: lo mínimo que usan las utilidades de a11y. */
function elemento({ tag = 'BUTTON', atributos = {}, visible = true } = {}) {
  const attrs = new Map(Object.entries(atributos));
  return {
    tagName: tag,
    type: undefined,
    isContentEditable: false,
    // Un elemento visible tiene `offsetParent`; uno oculto, no.
    offsetParent: visible ? {} : null,
    hasAttribute(nombre) { return attrs.has(nombre); },
    getAttribute(nombre) { return attrs.has(nombre) ? attrs.get(nombre) : null; },
    setAttribute(nombre, valor) { attrs.set(nombre, String(valor)); },
    focus() { documento.activeElement = this; },
  };
}

/** Un contenedor de mentira: sus elementos y el listener de teclado. */
function contenedor(elementos = []) {
  const listeners = new Map();
  return {
    elementos,
    listeners,
    // El doble no sabe de selectores: devuelve los elementos que se le
    // han dado (que son los que cumplen el selector del código).
    querySelectorAll() { return this.elementos; },
    addEventListener(tipo, fn) { this.listeners.set(tipo, fn); },
    removeEventListener(tipo, fn) {
      if (this.listeners.get(tipo) === fn) this.listeners.delete(tipo);
    },
    focus() { documento.activeElement = this; },
    /** Pulsa una tecla en el contenedor (como haría el usuario). */
    pulsaTecla(evento) {
      const fn = this.listeners.get('keydown');
      assert.ok(fn, 'el contenedor no tiene ningún listener de teclado');
      fn(evento);
    },
  };
}

/** Un evento de teclado de mentira. */
function tecla(key, extra = {}) {
  return {
    key,
    code: extra.code ?? key,
    shiftKey: false,
    prevented: false,
    preventDefault() { this.prevented = true; },
    ...extra,
  };
}

beforeEach(() => { documento.activeElement = null; });

// ── isEditable ─────────────────────────────────────────────────────────

test('isEditable: los campos donde se escribe sí son editables', () => {
  assert.equal(isEditable({ tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isEditable({ tagName: 'INPUT', type: 'SEARCH' }), true);
  assert.equal(isEditable({ tagName: 'INPUT', type: 'date' }), true);
  assert.equal(isEditable({ tagName: 'TEXTAREA' }), true);
  assert.equal(isEditable({ tagName: 'SELECT' }), true);
});

test('isEditable: un input sin type se trata como un campo de texto', () => {
  assert.equal(isEditable({ tagName: 'INPUT' }), true);
});

test('isEditable: los botones y las casillas no son campos de escritura', () => {
  assert.equal(isEditable({ tagName: 'INPUT', type: 'button' }), false);
  assert.equal(isEditable({ tagName: 'INPUT', type: 'submit' }), false);
  assert.equal(isEditable({ tagName: 'INPUT', type: 'checkbox' }), false);
  assert.equal(isEditable({ tagName: 'INPUT', type: 'radio' }), false);
  assert.equal(isEditable({ tagName: 'INPUT', type: 'file' }), false);
  assert.equal(isEditable({ tagName: 'BUTTON' }), false);
  assert.equal(isEditable({ tagName: 'A' }), false);
});

test('isEditable: un elemento editable sí lo es', () => {
  assert.equal(isEditable({ tagName: 'DIV', isContentEditable: true }), true);
});

test('isEditable: sin elemento no es editable', () => {
  assert.equal(isEditable(null), false);
  assert.equal(isEditable(undefined), false);
});

// ── trapFocus ──────────────────────────────────────────────────────────

test('trapFocus: al abrir el diálogo el foco va al primer elemento', () => {
  const primero = elemento();
  const segundo = elemento();
  const cont = contenedor([primero, segundo]);

  const release = trapFocus(cont);

  assert.equal(documento.activeElement, primero);
  release();
});

test('trapFocus: si no hay nada enfocable, el foco se queda en el contenedor', () => {
  const cont = contenedor([]);

  const release = trapFocus(cont);

  assert.equal(documento.activeElement, cont);
  release();
});

test('trapFocus: Tab en el último elemento vuelve al primero', () => {
  const primero = elemento();
  const ultimo = elemento();
  const cont = contenedor([primero, ultimo]);
  const release = trapFocus(cont);

  documento.activeElement = ultimo;
  const evento = tecla('Tab');
  cont.pulsaTecla(evento);

  assert.equal(evento.prevented, true, 'el Tab no puede salir del diálogo');
  assert.equal(documento.activeElement, primero);
  release();
});

test('trapFocus: Shift+Tab en el primer elemento vuelve al último', () => {
  const primero = elemento();
  const ultimo = elemento();
  const cont = contenedor([primero, ultimo]);
  const release = trapFocus(cont);

  documento.activeElement = primero;
  const evento = tecla('Tab', { shiftKey: true });
  cont.pulsaTecla(evento);

  assert.equal(evento.prevented, true);
  assert.equal(documento.activeElement, ultimo);
  release();
});

test('trapFocus: Tab en un elemento del medio deja el foco donde está', () => {
  const primero = elemento();
  const medio = elemento();
  const ultimo = elemento();
  const cont = contenedor([primero, medio, ultimo]);
  const release = trapFocus(cont);

  documento.activeElement = medio;
  const evento = tecla('Tab');
  cont.pulsaTecla(evento);

  assert.equal(evento.prevented, false, 'el Tab sigue su curso normal');
  assert.equal(documento.activeElement, medio);
  release();
});

test('trapFocus: el foco que está fuera del diálogo vuelve a entrar', () => {
  const primero = elemento();
  const cont = contenedor([primero]);
  const release = trapFocus(cont);

  // El foco está en el título del diálogo (tabindex="-1"), que no es
  // uno de los elementos enfocables: al tabular tiene que volver al
  // primero, no quedarse fuera.
  documento.activeElement = elemento({ tag: 'H2' });
  const evento = tecla('Tab');
  cont.pulsaTecla(evento);

  assert.equal(evento.prevented, true);
  assert.equal(documento.activeElement, primero);
  release();
});

test('trapFocus: Escape llama al manejador y no mueve el foco', () => {
  const primero = elemento();
  const cont = contenedor([primero]);
  let cerrado = 0;
  const release = trapFocus(cont, { onEscape: () => { cerrado++; } });

  const evento = tecla('Escape');
  cont.pulsaTecla(evento);

  assert.equal(cerrado, 1, 'se ha llamado al manejador de Escape');
  assert.equal(evento.prevented, true);
  assert.equal(documento.activeElement, primero, 'el foco no se mueve');
  release();
});

test('trapFocus: Escape sin manejador no hace nada', () => {
  const cont = contenedor([elemento()]);
  const release = trapFocus(cont);

  const evento = tecla('Escape');
  cont.pulsaTecla(evento);

  assert.equal(evento.prevented, false);
  release();
});

test('trapFocus: release() quita el listener y devuelve el foco al de antes', () => {
  const antes = elemento();
  documento.activeElement = antes;
  const dentro = elemento();
  const cont = contenedor([dentro]);

  const release = trapFocus(cont);
  assert.equal(documento.activeElement, dentro, 'el foco ha entrado en el diálogo');

  release();

  assert.equal(cont.listeners.has('keydown'), false, 'el listener se ha quitado');
  assert.equal(documento.activeElement, antes, 'el foco vuelve a donde estaba');
});

test('trapFocus: sin contenedor no hace nada', () => {
  const release = trapFocus(null);

  assert.equal(documento.activeElement, null, 'el foco no se ha movido');
  release();
  assert.equal(documento.activeElement, null);
});

test('trapFocus: un elemento deshabilitado o invisible no es enfocable', () => {
  const deshabilitado = elemento({ atributos: { disabled: '' } });
  const invisible = elemento({ visible: false });
  const visible = elemento();
  const cont = contenedor([deshabilitado, invisible, visible]);

  const release = trapFocus(cont);

  assert.equal(documento.activeElement, visible, 'el foco se salta lo que no se puede enfocar');
  release();
});

// ── bindRovingTabindex ────────────────────────────────────────────────

test('bindRovingTabindex: la flecha abajo mueve el foco al siguiente', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const b = elemento({ atributos: { tabindex: '-1' } });
  const cont = contenedor([a, b]);
  documento.activeElement = a;

  bindRovingTabindex(cont);
  const evento = tecla('ArrowDown');
  cont.pulsaTecla(evento);

  assert.equal(evento.prevented, true);
  assert.equal(documento.activeElement, b, 'el foco ha ido al siguiente');
  assert.equal(a.getAttribute('tabindex'), '-1', 'solo el elemento activo es tabulable');
  assert.equal(b.getAttribute('tabindex'), '0');
});

test('bindRovingTabindex: la flecha arriba da la vuelta al último', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const b = elemento({ atributos: { tabindex: '-1' } });
  const cont = contenedor([a, b]);
  documento.activeElement = a;

  bindRovingTabindex(cont);
  cont.pulsaTecla(tecla('ArrowUp'));

  assert.equal(documento.activeElement, b, 'el foco ha dado la vuelta');
  assert.equal(a.getAttribute('tabindex'), '-1');
  assert.equal(b.getAttribute('tabindex'), '0');
});

test('bindRovingTabindex: Inicio va al primero y Fin al último', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const b = elemento({ atributos: { tabindex: '-1' } });
  const c = elemento({ atributos: { tabindex: '-1' } });
  const cont = contenedor([a, b, c]);
  documento.activeElement = a;

  bindRovingTabindex(cont);

  cont.pulsaTecla(tecla('End'));
  assert.equal(documento.activeElement, c, 'Fin va al último');
  assert.equal(c.getAttribute('tabindex'), '0');
  assert.equal(a.getAttribute('tabindex'), '-1');

  cont.pulsaTecla(tecla('Home'));
  assert.equal(documento.activeElement, a, 'Inicio va al primero');
  assert.equal(a.getAttribute('tabindex'), '0');
  assert.equal(c.getAttribute('tabindex'), '-1');
});

test('bindRovingTabindex: Enter llama a onSelect con el elemento enfocado', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const cont = contenedor([a]);
  documento.activeElement = a;
  let elegido = null;
  let eventoRecibido = null;

  bindRovingTabindex(cont, { onSelect: (el, e) => { elegido = el; eventoRecibido = e; } });
  const evento = tecla('Enter');
  cont.pulsaTecla(evento);

  assert.equal(elegido, a, 'se ha elegido el elemento que tenía el foco');
  assert.equal(eventoRecibido, evento);
  assert.equal(evento.prevented, true);
});

test('bindRovingTabindex: el espacio también elige', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const cont = contenedor([a]);
  documento.activeElement = a;
  let elegido = null;

  bindRovingTabindex(cont, { onSelect: (el) => { elegido = el; } });
  cont.pulsaTecla(tecla(' '));

  assert.equal(elegido, a);
});

test('bindRovingTabindex: en horizontal son las flechas izquierda y derecha', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const b = elemento({ atributos: { tabindex: '-1' } });
  const cont = contenedor([a, b]);
  documento.activeElement = a;

  bindRovingTabindex(cont, { orientation: 'horizontal' });

  cont.pulsaTecla(tecla('ArrowRight'));
  assert.equal(documento.activeElement, b, 'la flecha derecha va al siguiente');

  documento.activeElement = a;
  cont.pulsaTecla(tecla('ArrowLeft'));
  assert.equal(documento.activeElement, b, 'la flecha izquierda da la vuelta');
});

test('bindRovingTabindex: con orientación "both" valen las cuatro flechas', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const b = elemento({ atributos: { tabindex: '-1' } });
  const cont = contenedor([a, b]);
  documento.activeElement = a;

  bindRovingTabindex(cont, { orientation: 'both' });

  cont.pulsaTecla(tecla('ArrowRight'));
  assert.equal(documento.activeElement, b, 'la flecha perpendicular también mueve el foco');

  documento.activeElement = a;
  cont.pulsaTecla(tecla('ArrowLeft'));
  assert.equal(documento.activeElement, b, 'y la perpendicular hacia atrás también');
});

test('bindRovingTabindex: una tecla que no es de navegación no hace nada', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const cont = contenedor([a]);
  documento.activeElement = a;
  let elegido = null;

  bindRovingTabindex(cont, { onSelect: (el) => { elegido = el; } });
  const evento = tecla('a');
  cont.pulsaTecla(evento);

  assert.equal(elegido, null, 'una letra no elige nada');
  assert.equal(evento.prevented, false);
  assert.equal(documento.activeElement, a);
});

test('bindRovingTabindex: si el foco no está en la lista, no se mueve', () => {
  const a = elemento({ atributos: { tabindex: '0' } });
  const cont = contenedor([a]);
  documento.activeElement = elemento({ tag: 'H2' });

  bindRovingTabindex(cont);
  const evento = tecla('ArrowDown');
  cont.pulsaTecla(evento);

  assert.equal(evento.prevented, false);
  assert.notEqual(documento.activeElement, a);
});

test('bindRovingTabindex: un contenedor sin elementos no hace nada', () => {
  const cont = contenedor([]);
  bindRovingTabindex(cont);
  const evento = tecla('ArrowDown');
  cont.pulsaTecla(evento);
  assert.equal(evento.prevented, false);
});

// ── focusHeading ───────────────────────────────────────────────────────

test('focusHeading: el foco va al primer encabezado de la sección', () => {
  const h2 = elemento({ tag: 'H2' });
  const seccion = {
    ...elemento({ tag: 'MAIN' }),
    querySelector: (sel) => (sel === 'h1, h2, h3' ? h2 : null),
  };

  focusHeading(seccion);

  assert.equal(documento.activeElement, h2, 'el foco está en el encabezado');
  assert.equal(h2.getAttribute('tabindex'), '-1', 'el encabezado se puede enfocar');
});

test('focusHeading: un encabezado que ya es enfocable no se toca', () => {
  const h1 = elemento({ tag: 'H1', atributos: { tabindex: '0' } });
  const seccion = {
    ...elemento({ tag: 'MAIN' }),
    querySelector: (sel) => (sel === 'h1, h2, h3' ? h1 : null),
  };

  focusHeading(seccion);

  assert.equal(documento.activeElement, h1);
  assert.equal(h1.getAttribute('tabindex'), '0', 'no se cambia el tabindex que ya tenía');
});

test('focusHeading: si no hay encabezado, el foco se queda en la sección', () => {
  const seccion = {
    ...elemento({ tag: 'MAIN' }),
    querySelector: () => null,
  };

  focusHeading(seccion);

  assert.equal(documento.activeElement, seccion);
  assert.equal(seccion.getAttribute('tabindex'), '-1');
});

test('focusHeading: sin sección no hace nada', () => {
  focusHeading(null);
  assert.equal(documento.activeElement, null);
});
