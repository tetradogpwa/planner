// T-029 — Ajustes › Legal: abrir los documentos en su URL pública.
//
// Comprueba el comportamiento observable desde fuera de la app real:
//
//   1. Cada documento publicado (PRIVACY, TERMS, EULA, COOKIES,
//      ACCESSIBILITY, ACCEPTABLE_USE, DMCA, CONTACT) pide al sistema
//      que abra SU URL pública exacta en el navegador, y no aparece
//      ningún modal.
//   2. Si la apertura del navegador falla, se muestra la copia local
//      del documento en el modal (con su foco y su trampa de foco) y
//      el texto avisa de que es la copia incluida en la app.
//   3. THIRD_PARTY_LICENSES no se publica: se muestra siempre la copia
//      local en el modal, sin pedir abrir nada.
//
// El "abridor" (`window.__TAURI__.shell.open`) se sustituye con un
// doble de prueba mediante browser.execute: así se puede comprobar la
// URL exacta sin abrir de verdad un navegador en el servidor de
// pruebas, y sin tocar la red.

import {
  abrirAppNueva,
  aspectoDe,
  elegirTema,
  navegarVistaAlt,
} from '../helpers.mjs';

const BASE = 'https://gabrielcatdeveloper.github.io/papeleo/planner/';

/** Documentos que la app abre en el navegador, con su URL exacta. */
const PUBLICOS = {
  PRIVACY:        `${BASE}PRIVACY`,
  TERMS:          `${BASE}TERMS`,
  EULA:           `${BASE}EULA`,
  COOKIES:        `${BASE}COOKIES`,
  ACCESSIBILITY:  `${BASE}ACCESSIBILITY`,
  ACCEPTABLE_USE: `${BASE}ACCEPTABLE_USE`,
  DMCA:           `${BASE}DMCA`,
  CONTACT:        `${BASE}CONTACT`,
};

/** Sustituye el abridor del sistema por un doble que registra la URL.
 *  - `fallar: true` → el doble rechaza (como si no hubiera navegador).
 *  Devuelve la lista de URLs registradas. */
async function ponerAbridor({ fallar = false } = {}) {
  return browser.execute((fallar) => {
    const registro = [];
    window.__abridorLegal = registro;
    const stub = async (url) => {
      registro.push(url);
      if (fallar) throw new Error('sin navegador');
    };
    // `withGlobalTauri` expone window.__TAURI__.shell; se sustituye
    // solo la función `open` y se guarda la original para restaurarla.
    window.__shellOpenOriginal = window.__TAURI__?.shell?.open;
    if (window.__TAURI__?.shell) window.__TAURI__.shell.open = stub;
    else window.__TAURI__ = { ...(window.__TAURI__ || {}), shell: { open: stub } };
    return registro.length;
  }, fallar);
}

/** Restaura el abridor original. */
async function restaurarAbridor() {
  await browser.execute(() => {
    if (window.__shellOpenOriginal && window.__TAURI__?.shell) {
      window.__TAURI__.shell.open = window.__shellOpenOriginal;
    }
    delete window.__shellOpenOriginal;
    delete window.__abridorLegal;
  });
}

/** URLs que el doble del abridor ha registrado. */
async function urlsRegistradas() {
  return browser.execute(() => window.__abridorLegal ?? []);
}

/** Estado del modal de documentos. */
async function estadoModal() {
  return browser.execute(() => {
    const modal = document.getElementById('legal-modal');
    if (!modal) return { existe: false };
    const body = document.getElementById('legal-modal-body');
    const titulo = document.getElementById('legal-modal-title');
    return {
      existe: true,
      oculto: modal.hidden,
      texto: (body?.textContent ?? '').trim(),
      titulo: (titulo?.textContent ?? '').trim(),
      focoDentro: !!(modal.contains(document.activeElement)),
      focoEsTitulo: document.activeElement?.id === 'legal-modal-title',
    };
  });
}

describe('Legal: URL pública de los documentos (T-029)', () => {

  before(async () => {
    await abrirAppNueva();
    // Ajustes › Legal (atajo Alt+7).
    await navegarVistaAlt(7);
    await $('a[data-doc="PRIVACY"]').waitForDisplayed();
  });

  afterEach(async () => {
    await restaurarAbridor();
    await browser.execute(() => {
      const legal = document.getElementById('legal-modal');
      if (legal) legal.hidden = true;
      document.body.classList.remove('legal-modal-open');
    });
  });

  // ── 1. Cada documento publicado abre SU URL pública ───────────────

  it('cada documento publicado pide abrir su URL pública exacta y no abre el modal', async () => {
    for (const [clave, urlEsperada] of Object.entries(PUBLICOS)) {
      await ponerAbridor();
      await $(`a[data-doc="${clave}"]`).click();
      // El doble se llama de forma asíncrona: esperamos a que registre.
      await browser.waitUntil(
        async () => (await urlsRegistradas()).length > 0,
        { timeout: 5_000, timeoutMsg: `No se intentó abrir ${clave} en el navegador` },
      );
      const registradas = await urlsRegistradas();
      expect(registradas).toEqual([urlEsperada]);

      // Y no debe aparecer el modal con el documento.
      const modal = await estadoModal();
      expect(modal.oculto).toBe(true);
    }
  });

  // ── 2. Si la apertura falla, se muestra la copia local ────────────

  it('si el navegador falla, se muestra la copia local en el modal con foco y trampa de foco', async () => {
    await ponerAbridor({ fallar: true });
    await $('a[data-doc="PRIVACY"]').click();

    await browser.waitUntil(
      async () => (await estadoModal()).oculto === false,
      { timeout: 5_000, timeoutMsg: 'El modal no se abrió al fallar el navegador' },
    );

    const modal = await estadoModal();
    // El título es el del documento.
    expect(modal.titulo).toContain('privacidad');
    // El texto avisa de que es la copia incluida en la app.
    expect(modal.texto).toMatch(/copia del documento incluida en la app/i);
    // Y trae el texto real del documento local (no un error).
    expect(modal.texto.length).toBeGreaterThan(200);
    expect(modal.texto).not.toMatch(/No se ha podido cargar/i);

    // El foco está dentro del modal, en el título, y no se puede salir
    // con el tabulador (trampa de foco).
    expect(modal.focoDentro).toBe(true);
    expect(modal.focoEsTitulo).toBe(true);

    // La trampa de foco: con el foco en el último elemento enfocable
    // del modal, Tab debe volver al primero (sigue dentro).
    await browser.execute(() => {
      const modal = document.getElementById('legal-modal');
      const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
      const items = Array.from(modal.querySelectorAll(sel))
        .filter(el => el.offsetParent !== null);
      items[items.length - 1]?.focus();
    });
    await browser.keys('Tab');
    const focoTrasTab = await browser.execute(() => {
      const modal = document.getElementById('legal-modal');
      return {
        dentro: modal.contains(document.activeElement),
        id: document.activeElement?.id ?? '',
      };
    });
    expect(focoTrasTab.dentro).toBe(true);
  });

  // ── 3. THIRD_PARTY_LICENSES se queda en la copia local ────────────

  it('THIRD_PARTY_LICENSES no se publica: se muestra la copia local sin abrir el navegador', async () => {
    await ponerAbridor();
    await $('a[data-doc="THIRD_PARTY_LICENSES"]').click();

    await browser.waitUntil(
      async () => (await estadoModal()).oculto === false,
      { timeout: 5_000, timeoutMsg: 'El modal de licencias no se abrió' },
    );

    // No se ha pedido abrir ninguna URL.
    expect(await urlsRegistradas()).toEqual([]);

    const modal = await estadoModal();
    expect(modal.titulo).toContain('terceros');
    expect(modal.texto).toMatch(/copia del documento incluida en la app/i);
    expect(modal.focoDentro).toBe(true);
  });

  // ── 4. La app no descarga nada de la URL pública ──────────────────

  it('la app no hace fetch a la URL pública', async () => {
    // Interceptamos fetch y comprobamos que ninguna petición va a
    // gabrielcatdeveloper.github.io (ni a ningún otro sitio).
    //
    // No se espera un plazo fijo: se espera a que la app termine de
    // gestionar el clic, que es cuando pide al sistema que abra la
    // URL pública (la última cosa que hace el clic). El doble del
    // abridor va contando las aperturas: ese contador es la señal.
    await browser.execute(() => {
      window.__peticionesFetch = [];
      window.__fetchOriginal = window.fetch;
      window.fetch = function (entrada, ...resto) {
        const url = typeof entrada === 'string' ? entrada : (entrada?.url ?? '');
        window.__peticionesFetch.push(url);
        return window.__fetchOriginal.call(this, entrada, ...resto);
      };
      // Un clic real en un documento publicado: el doble del
      // abridor evita abrir el navegador.
      window.__shellOpenOriginal = window.__TAURI__?.shell?.open;
      window.__TAURI__ && (window.__TAURI__.shell = window.__TAURI__.shell || {});
      window.__TAURI__.shell.open = async () => {
        window.__aperturas = (window.__aperturas ?? 0) + 1;
      };
      document.querySelector('a[data-doc="TERMS"]').click();
    });

    await browser.waitUntil(
      async () => await browser.execute(() => (window.__aperturas ?? 0) > 0),
      { timeout: 5_000, timeoutMsg: 'La app no pidió abrir el documento en el navegador' },
    );

    const peticiones = await browser.execute(() => {
      window.fetch = window.__fetchOriginal;
      if (window.__shellOpenOriginal && window.__TAURI__?.shell) {
        window.__TAURI__.shell.open = window.__shellOpenOriginal;
      }
      return window.__peticionesFetch ?? [];
    });
    const externas = peticiones.filter(u => /^https?:/i.test(u));
    expect(externas).toEqual([]);
    for (const u of peticiones) {
      expect(u).not.toMatch(/gabrielcatdeveloper\.github\.io/i);
    }
  });

  // ── 5. Los enlaces avisan de que se abren en el navegador ─────────

  it('los enlaces avisan de forma accesible de que se abren en el navegador', async () => {
    const info = await browser.execute(() => {
      const panel = document.getElementById('ajustes-panel-legal');
      const hint = panel?.querySelector('.legal-hint');
      const enlaces = Array.from(panel?.querySelectorAll('a[data-doc]') ?? []);
      return {
        textoAviso: (hint?.textContent ?? '').trim(),
        avisoVisible: !!hint && getComputedStyle(hint).display !== 'none',
        enlaces: enlaces.map(a => ({
          clave: a.dataset.doc,
          texto: a.textContent.trim(),
          aria: a.getAttribute('aria-label') ?? '',
        })),
      };
    });
    // Hay un aviso visible para toda la lista.
    expect(info.textoAviso).toMatch(/navegador/i);
    expect(info.avisoVisible).toBe(true);

    // Cada enlace anuncia de forma accesible si se abre en el
    // navegador o si se muestra dentro de la app. El texto visible
    // está contenido en el nombre accesible (WCAG 2.5.3).
    for (const e of info.enlaces) {
      const publicado = e.clave in PUBLICOS;
      const esperado = publicado ? /se abre en tu navegador/i : /se muestra en la app/i;
      expect(e.aria).toMatch(esperado);
      // El texto visible sigue siendo el principio del nombre accesible.
      expect(e.aria.startsWith(e.texto)).toBe(true);
    }
  });

  // El aviso no basta con existir: tiene que LEERSE. Se mide su
  // contraste WCAG contra su fondo real (4,5:1, nivel AA) en el tema
  // claro y en el oscuro: comprobar que «no es negro» no dice nada de
  // si se ve o no.

  describe('el aviso del navegador se lee en cada tema', () => {
    for (const tema of ['light', 'dark']) {
      it(`mantiene el contraste AA en el tema "${tema}"`, async () => {
        // Elegir el tema deja la vista en Apariencia: se vuelve a Legal.
        await elegirTema(tema);
        await navegarVistaAlt(7);
        await $('#ajustes-panel-legal .legal-hint').waitForDisplayed();

        const aviso = await aspectoDe('#ajustes-panel-legal .legal-hint');
        expect(aviso).not.toBeNull();
        expect(aviso.ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  });

  // ── 6. En móvil con letra al 200 % no se sale de la pantalla ───────

  it('en móvil con letra al 200 % la lista de documentos no se sale de la pantalla', async () => {
    const { ventanaMovil } = await import('../helpers.mjs');
    await ventanaMovil(390, 844);
    // Letra al 200 %: así lo aplica la app (applyPreferences pone
    // root.style.fontSize = '200%').
    await browser.execute(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.documentElement.style.fontSize,
      )) === '200%',
      { timeout: 5_000, timeoutMsg: 'No se pudo aplicar la letra al 200 %' },
    );
    // Alt+7 deja visible Ajustes › Legal.
    await navegarVistaAlt(7);
    await $('a[data-doc="PRIVACY"]').waitForDisplayed();

    const desborde = await browser.execute(() => {
      const doc = document.documentElement;
      const content = document.querySelector('.content');
      const ancho = doc.clientWidth;
      const malos = [];
      for (const el of document.querySelectorAll(
        '#ajustes-panel-legal .legal-links a, #ajustes-panel-legal .legal-hint'
      )) {
        const r = el.getBoundingClientRect();
        if (r.right > ancho + 1 || r.left < -1) {
          malos.push({ texto: el.textContent.trim().slice(0, 30), left: r.left, right: r.right });
        }
      }
      return {
        ancho,
        malos,
        overflowDoc: doc.scrollWidth - doc.clientWidth,
        overflowContent: content ? content.scrollWidth - content.clientWidth : 0,
      };
    });
    // Ningún enlace ni el aviso se salen de la ventana.
    expect(desborde.malos).toEqual([]);
    // Y la vista no tiene desbordamiento horizontal.
    expect(desborde.overflowDoc).toBeLessThanOrEqual(1);
    expect(desborde.overflowContent).toBeLessThanOrEqual(1);

    await browser.execute(() => {
      document.documentElement.style.fontSize = '100%';
    });
    await ventanaMovil(1280, 800);
  });

  // ── 7. El documento se enseña como Markdown (T-061) ──────────────────

  it('el documento del modal enseña sus enlaces como enlaces', async () => {
    // Sin navegador: se muestra la copia local, ya renderizada.
    await ponerAbridor({ fallar: true });
    await $('a[data-doc="ACCESSIBILITY"]').click();

    await browser.waitUntil(
      async () => (await estadoModal()).oculto === false,
      { timeout: 5_000, timeoutMsg: 'El modal no se abrió' },
    );

    const enlaces = await browser.execute(() => {
      const cuerpo = document.getElementById('legal-modal-body');
      return Array.from(cuerpo?.querySelectorAll('a[href]') ?? []).map(a => ({
        href: a.getAttribute('href'),
        rel: a.getAttribute('rel'),
        target: a.getAttribute('target'),
        texto: a.textContent.trim(),
      }));
    });

    // El documento de accesibilidad enlaza con el protocolo MCP: en el
    // modal tiene que ser un enlace de verdad, con su URL entera.
    const mcp = enlaces.find(e => e.texto.includes('Model Context Protocol'));
    expect(mcp).toBeDefined();
    expect(mcp.href).toBe('https://modelcontextprotocol.io/');
    expect(mcp.rel).toBe('noopener noreferrer');
    expect(mcp.target).toBe('_blank');
  });
});
