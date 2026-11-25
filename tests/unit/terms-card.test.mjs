// T-062: la pantalla de términos no puede bloquear el arranque.
//
// Es lo primero que ve la persona. Si su plantilla no se puede
// descargar, no hay botones para aceptar ni para rechazar… pero la app
// NO puede quedarse colgada: index.js espera a esta promesa antes de
// quitar "booting" del body (index.css:860) y, con "booting", toda la
// app queda en `visibility: hidden`.
//
// Aquí se comprueba lo que ve la persona:
//   1. Si la plantilla falta, el arranque termina igual y la vista
//      avisa de que no se pudo cargar (no queda en blanco).
//   2. Si la plantilla está, el arranque sigue esperando a que se
//      acepte (los términos no se pueden saltar por un fallo).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { TermsCard, termsAccepted } from '../../ui/terms/terms-card.js';
import { limpiarCache } from '../../ui/base-card.js';

// ── Dobles mínimos del navegador ─────────────────────────────────────

/** Un elemento de mentira: lo mínimo que usa la pantalla de términos. */
function elemento({ id = '', tag = 'DIV' } = {}) {
  const listeners = new Map();
  const atributos = new Map();
  return {
    id,
    tagName: tag,
    innerHTML: '',
    textContent: '',
    scrollTop: 0,
    hidden: false,
    dataset: {},
    getAttribute: (n) => (atributos.has(n) ? atributos.get(n) : null),
    setAttribute: (n, v) => atributos.set(n, String(v)),
    addEventListener: (tipo, fn) => listeners.set(tipo, fn),
    focus() {},
    /** Pulsa el elemento, como haría una persona. */
    async pulsa() {
      const fn = listeners.get('click');
      assert.ok(fn, `el elemento ${id || tag} no tiene listener de click`);
      await fn({ preventDefault() {} });
    },
  };
}

/** El `root` de la pantalla de términos, con lo que la tarjeta busca. */
function crearRaiz() {
  const doc = elemento({ id: 'terms-doc' });
  const tabs = ['TERMS', 'EULA', 'PRIVACY'].map(clave => {
    const tab = elemento({ tag: 'BUTTON' });
    tab.dataset.doc = clave;
    return tab;
  });
  const tablist  = elemento();
  const aceptar  = elemento({ tag: 'BUTTON' });
  const rechazar = elemento({ tag: 'BUTTON' });
  const titulo   = elemento({ tag: 'H2' });

  const porSelector = {
    '.terms-doc':            doc,
    '[role="tablist"]':      tablist,
    '[data-action="accept"]':  aceptar,
    '[data-action="reject"]':  rechazar,
    'h2':                    titulo,
  };

  return {
    innerHTML: '',
    doc, tabs, tablist, aceptar, rechazar, titulo,
    querySelector(sel) { return porSelector[sel] ?? null; },
    querySelectorAll(sel) { return sel === '.terms-tab' ? tabs : []; },
  };
}

/** Un `localStorage` de mentira (lo que guarda la aceptación). */
function crearAlmacen() {
  const datos = new Map();
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  };
}

/** Los ficheros que la pantalla de términos puede pedir. */
const RECURSOS = {
  './ui/terms/terms-card.html': '<div class="terms-gate">términos</div>',
  './ui/terms/terms-card.css':  '.terms-gate { color: red; }',
  './legal/TERMS.md':   '# Términos\n\n**Última actualización:** 2026-01-01\n\nTexto.',
  './legal/EULA.md':    '# Licencia\n\n**Última actualización:** 2026-01-01\n\nTexto.',
  './legal/PRIVACY.md': '# Privacidad\n\nTexto.',
};

/** La ruta que está rota (como un asset que falta). */
let roto = null;

beforeEach(() => {
  // La base común cachea los fragmentos por sesión: aquí cada prueba
  // parte de cero (si no, una plantilla ya descargada taparía el
  // fallo que la prueba quiere ver).
  limpiarCache();
  roto = null;
  globalThis.localStorage = crearAlmacen();
  globalThis.document = { activeElement: null };
  globalThis.fetch = async (url) => {
    if (url === roto) {
      // Como un 404: la respuesta llega, pero no es el fichero.
      return { ok: false, status: 404, text: async () => 'no encontrado' };
    }
    const texto = RECURSOS[url];
    if (texto === undefined) {
      return { ok: false, status: 404, text: async () => 'no encontrado' };
    }
    return { ok: true, status: 200, text: async () => texto };
  };
});

/** Espera a `promesa` un rato: si no se resuelve, la app está colgada. */
function resolverOColgar(promesa, ms = 500) {
  return Promise.race([
    promesa,
    new Promise(resolve => setTimeout(() => resolve('COLGADO'), ms)),
  ]);
}

// ── La pantalla no se puede cargar ────────────────────────────────────

test('si la plantilla de los términos no se puede cargar, el arranque termina y avisa', async () => {
  roto = './ui/terms/terms-card.html';
  const raiz = crearRaiz();

  // El arranque de la app (index.js: requireTerms): primero se mira si
  // los términos ya se aceptaron y, si no, se enseña la pantalla.
  const arranque = (async () => {
    if (await termsAccepted()) return 'ya aceptados';
    await new TermsCard(raiz).init();
    return 'arranque terminado';
  })();

  const resultado = await resolverOColgar(arranque);

  assert.equal(resultado, 'arranque terminado',
    'la pantalla de términos no puede dejar la app colgada: el arranque tiene que terminar');

  // Y la vista no queda en blanco: dice qué ha pasado.
  assert.match(raiz.innerHTML, /No se pudo cargar esta sección/);
  assert.match(raiz.innerHTML, /role="status"/);
});

test('si la plantilla de los términos no se puede cargar, se siguen pidiendo en el siguiente arranque', async () => {
  roto = './ui/terms/terms-card.html';
  const raiz = crearRaiz();

  await resolverOColgar(new TermsCard(raiz).init());

  // No se ha guardado ninguna aceptación: la próxima vez se vuelven a
  // pedir (no vale la pena fingir que se aceptaron).
  assert.equal(globalThis.localStorage.getItem('termsAccepted'), null);
  assert.equal(await termsAccepted(), false);
});

// ── La pantalla se puede cargar ───────────────────────────────────────

test('si la plantilla se carga, el arranque espera a que se acepte', async () => {
  const raiz = crearRaiz();
  const tarjeta = new TermsCard(raiz);

  let terminado = false;
  const arranque = tarjeta.init().then(() => { terminado = true; return 'terminado'; });

  // La pantalla se ha pintado: hay botones de aceptar y de rechazar.
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(terminado, false,
    'la app no puede arrancar antes de que la persona acepte (o rechace) los términos');

  // La persona acepta.
  await raiz.aceptar.pulsa();

  assert.equal(await resolverOColgar(arranque), 'terminado');
  assert.equal(terminado, true);
  // La aceptación queda guardada con la versión de los documentos.
  assert.ok(globalThis.localStorage.getItem('termsAccepted'));
});
