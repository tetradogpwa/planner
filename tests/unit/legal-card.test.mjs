// T-061: la tarjeta de los documentos legales.
//
// La tarjeta enseña los textos legales: los publicados se abren en el
// navegador del sistema y, si no se puede abrir, se muestra la copia
// local dentro de un modal. Aquí se prueba con dobles mínimos del DOM
// (sin jsdom, como en el resto de unitarias): lo que se mira es lo
// que vería la persona que usa la app.
//
// También comprueba que el modal enseña el documento ya renderizado
// (el renderizador de Markdown vive ahora en `ui/legal/legal-markdown.js`).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { LegalCard } from '../../ui/legal/legal-card.js';

// ── Dobles mínimos del navegador ─────────────────────────────────────

/** Un elemento de mentira: lo mínimo que usa la tarjeta legal. */
function elemento({ id = '', tag = 'DIV', atributos = {} } = {}) {
  const attrs = new Map(Object.entries(atributos));
  const listeners = new Map();
  return {
    id,
    tagName: tag,
    textContent: '',
    innerHTML: '',
    hidden: false,
    dataset: {},
    // Para la trampa de foco: un elemento visible tiene `offsetParent`.
    offsetParent: {},
    hasAttribute(nombre) { return attrs.has(nombre); },
    getAttribute(nombre) { return attrs.has(nombre) ? attrs.get(nombre) : null; },
    setAttribute(nombre, valor) { attrs.set(nombre, String(valor)); },
    addEventListener(tipo, fn) { listeners.set(tipo, fn); },
    removeEventListener(tipo, fn) {
      if (listeners.get(tipo) === fn) listeners.delete(tipo);
    },
    querySelectorAll() { return []; },
    focus() { documento.activeElement = this; },
    /** Pulsa el elemento, como haría una persona. */
    async pulsa() {
      const fn = listeners.get('click');
      assert.ok(fn, `el elemento ${id || tag} no tiene listener de click`);
      await fn({ preventDefault() {}, target: this });
    },
  };
}

/** El `document` de mentira: el foco, las clases del body y las teclas. */
function crearDocumento() {
  const listeners = new Map();
  const clases = new Set();
  return {
    activeElement: null,
    clases,
    body: {
      classList: {
        add(clase) { clases.add(clase); },
        remove(clase) { clases.delete(clase); },
        contains(clase) { return clases.has(clase); },
      },
    },
    addEventListener(tipo, fn) { listeners.set(tipo, fn); },
    /** Pulsa una tecla, como haría una persona. */
    pulsaTecla(evento) {
      const fn = listeners.get('keydown');
      assert.ok(fn, 'el documento no tiene ningún listener de teclado');
      fn(evento);
    },
  };
}

let documento;

/** El `root` de la tarjeta con los elementos que la tarjeta busca. */
function crearRaiz() {
  const porId = new Map();
  const enlaces = [];

  const nuevo = (id, tag = 'DIV') => {
    const el = elemento({ id, tag });
    porId.set(id, el);
    return el;
  };

  nuevo('legal-modal');
  nuevo('legal-modal-title', 'H3');
  nuevo('legal-modal-body', 'ARTICLE');
  nuevo('legal-modal-close', 'BUTTON');
  nuevo('legal-app-name', 'DD');
  nuevo('legal-app-version', 'DD');
  nuevo('legal-app-id', 'DD');
  nuevo('legal-app-frontend-hash', 'DD');
  // El modal empieza escondido, como en el HTML de la tarjeta.
  porId.get('legal-modal').hidden = true;

  for (const clave of ['PRIVACY', 'TERMS', 'THIRD_PARTY_LICENSES']) {
    const enlace = elemento({ tag: 'A' });
    enlace.dataset.doc = clave;
    enlaces.push(enlace);
  }

  return {
    innerHTML: '',
    querySelector(sel) {
      return sel.startsWith('#') ? (porId.get(sel.slice(1)) ?? null) : null;
    },
    querySelectorAll(sel) {
      return sel === 'a[data-doc]' ? enlaces : [];
    },
    porId,
    enlaces,
  };
}

/** Los documentos que la tarjeta puede pedir (y el texto que traen). */
const DOCUMENTOS = {
  './legal/PRIVACY.md': '# Privacidad\n\nDatos **protegidos** y [un enlace](https://ejemplo.com).',
  './legal/TERMS.md':   '# Términos\n\nTexto de los términos.',
  './legal/THIRD_PARTY_LICENSES.md': '# Licencias\n\nMIT, Apache-2.0.',
};

/** Las URLs que la app ha pedido abrir en el navegador. */
let abiertas = [];
/** Lo que devuelve el comando nativo de los datos de la app. */
let infoApp = null;

beforeEach(() => {
  documento = crearDocumento();
  globalThis.document = documento;
  globalThis.window = {
    __TAURI__: {
      core: { invoke: async () => infoApp },
      shell: { open: async (url) => { abiertas.push(url); } },
    },
  };
  globalThis.fetch = async (url) => ({
    ok: true,
    text: async () => DOCUMENTOS[url] ?? `contenido de ${url}`,
  });
  abiertas = [];
  infoApp = null;
});

// ── La tarjeta ────────────────────────────────────────────────────────

test('al montarse, la tarjeta pinta su HTML y su CSS', async () => {
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);

  await tarjeta.init();

  assert.match(raiz.innerHTML, /^<style>.*legal-card\.css<\/style>/,
    'el CSS no se ha inyectado');
  assert.match(raiz.innerHTML, /legal-card\.html$/,
    'el HTML no se ha inyectado');
});

test('al montarse, la tarjeta busca los elementos del modal', async () => {
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);

  await tarjeta.init();

  assert.ok(tarjeta.modal, 'no ha encontrado el modal');
  assert.ok(tarjeta.modalTitle, 'no ha encontrado el título');
  assert.ok(tarjeta.modalBody, 'no ha encontrado el cuerpo');
  assert.ok(tarjeta.closeBtn, 'no ha encontrado el botón de cerrar');
});

test('al montarse, la tarjeta enseña los datos de la app', async () => {
  infoApp = {
    product_name: 'Planificador Semanal',
    version: '0.1.0',
    identifier: 'com.ejemplo.planner',
    frontend_hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);

  await tarjeta.init();

  assert.equal(raiz.porId.get('legal-app-name').textContent, 'Planificador Semanal');
  assert.equal(raiz.porId.get('legal-app-version').textContent, '0.1.0');
  assert.equal(raiz.porId.get('legal-app-id').textContent, 'com.ejemplo.planner');
  // El hash se enseña corto: el entero no le dice nada a nadie.
  assert.equal(raiz.porId.get('legal-app-frontend-hash').textContent, '0123456789ab');
});

test('sin Tauri, la tarjeta se monta igual', async () => {
  globalThis.window = {};
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);

  await tarjeta.init();

  assert.ok(tarjeta.modal, 'no ha encontrado el modal');
});

// ── Un documento publicado ────────────────────────────────────────────

test('un documento publicado se abre en el navegador y no enseña el modal', async () => {
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  await raiz.enlaces[0].pulsa();   // PRIVACY

  assert.deepEqual(abiertas, [
    'https://gabrielcatdeveloper.github.io/papeleo/planner/PRIVACY',
  ]);
  assert.equal(tarjeta.modal.hidden, true, 'el modal no debería enseñarse');
});

test('si el navegador no puede abrir, se enseña la copia local', async () => {
  globalThis.window.__TAURI__.shell.open = async () => { throw new Error('sin navegador'); };
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  await raiz.enlaces[0].pulsa();   // PRIVACY

  assert.equal(tarjeta.modal.hidden, false, 'el modal debería enseñarse');
  assert.equal(tarjeta.modalTitle.textContent, 'Política de privacidad');
  // Avisa de que es la copia incluida en la app.
  assert.match(tarjeta.modalBody.innerHTML, /copia del documento incluida en la app/);
  // Y trae el documento ya renderizado.
  assert.match(tarjeta.modalBody.innerHTML, /<h1>Privacidad<\/h1>/);
  assert.match(tarjeta.modalBody.innerHTML, /<strong>protegidos<\/strong>/);
  assert.match(tarjeta.modalBody.innerHTML, /<a href="https:\/\/ejemplo\.com"/);
});

test('un documento que no se publica se enseña siempre en el modal', async () => {
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  await raiz.enlaces[2].pulsa();   // THIRD_PARTY_LICENSES

  assert.deepEqual(abiertas, [], 'no hay que abrir nada en el navegador');
  assert.equal(tarjeta.modal.hidden, false);
  assert.match(tarjeta.modalBody.innerHTML, /<h1>Licencias<\/h1>/);
});

test('el foco va al título del modal y vuelve al enlace al cerrarlo', async () => {
  globalThis.window.__TAURI__.shell.open = async () => { throw new Error('sin navegador'); };
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  await raiz.enlaces[0].pulsa();   // PRIVACY

  assert.equal(documento.activeElement?.id, 'legal-modal-title',
    'el foco debería estar en el título del modal');
  assert.equal(tarjeta.modalTitle.getAttribute('tabindex'), '-1',
    'el título debería poder enfocarse con script');

  tarjeta.closeModal();

  assert.equal(tarjeta.modal.hidden, true);
  assert.equal(documento.body.classList.contains('legal-modal-open'), false);
});

test('el botón de cerrar y la tecla Escape cierran el modal', async () => {
  globalThis.window.__TAURI__.shell.open = async () => { throw new Error('sin navegador'); };
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  await raiz.enlaces[0].pulsa();   // PRIVACY
  assert.equal(tarjeta.modal.hidden, false);

  await tarjeta.closeBtn.pulsa();
  assert.equal(tarjeta.modal.hidden, true, 'el botón de cerrar no cerró el modal');

  await raiz.enlaces[0].pulsa();   // PRIVACY
  assert.equal(tarjeta.modal.hidden, false);
  documento.pulsaTecla({ key: 'Escape' });
  assert.equal(tarjeta.modal.hidden, true, 'la tecla Escape no cerró el modal');
});

test('un clic en el fondo del modal también lo cierra', async () => {
  globalThis.window.__TAURI__.shell.open = async () => { throw new Error('sin navegador'); };
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  await raiz.enlaces[0].pulsa();   // PRIVACY
  assert.equal(tarjeta.modal.hidden, false);

  await tarjeta.modal.pulsa();

  assert.equal(tarjeta.modal.hidden, true, 'el clic en el fondo no cerró el modal');
});

test('si el documento no se puede cargar, el modal lo explica', async () => {
  globalThis.window.__TAURI__.shell.open = async () => { throw new Error('sin navegador'); };
  // Solo falla la descarga del documento: la tarjeta ya está montada.
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url === './legal/PRIVACY.md') throw new Error('sin red');
    return fetchReal(url);
  };
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  await raiz.enlaces[0].pulsa();   // PRIVACY

  assert.match(tarjeta.modalBody.innerHTML, /No se ha podido cargar el documento/);
});

// ── Las direcciones ───────────────────────────────────────────────────

test('la app solo abre direcciones https', async () => {
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  const abierto = await tarjeta.abrirEnNavegador('http://ejemplo.com');

  assert.equal(abierto, false);
  assert.deepEqual(abiertas, [], 'no hay que abrir nada que no sea https');
});

test('una dirección que no es una URL no se abre', async () => {
  const raiz = crearRaiz();
  const tarjeta = new LegalCard(raiz);
  await tarjeta.init();

  const abierto = await tarjeta.abrirEnNavegador('esto no es una URL');

  assert.equal(abierto, false);
  assert.deepEqual(abiertas, []);
});
