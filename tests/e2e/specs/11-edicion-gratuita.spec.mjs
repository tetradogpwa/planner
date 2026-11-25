// Regresión de T-023 — Edición gratuita sin anuncios.
//
// Comprueba que, en la build sin claves (provider "none"):
//   - no aparece la pantalla de consentimiento de cookies
//     (#consent-gate queda siempre vacío y nunca visible);
//   - el botón #removeAdsBtn está oculto (el sidebar lo crea con
//     `hidden` y nada lo desoculta);
//   - la lista de documentos de la pestaña Legal de Ajustes no
//     contiene ADS_DISCLOSURE ni REFUNDS.
//
// Se ejecuta contra el binario real de Tauri (sin claves de Ads),
// manejado como lo haría un usuario. No se compara HTML, solo el
// comportamiento observable desde fuera.

import {
  abrirAppNueva,
  navegarVistaAlt,
} from '../helpers.mjs';

describe('Edición gratuita sin anuncios (T-023)', () => {

  before(async () => {
    await abrirAppNueva();
  });

  // ── 1. Consent-gate invisible desde el primer arranque ───────────────

  it('la pantalla de consentimiento de cookies no se muestra (provider "none")', async () => {
    // En la build sin claves, #consent-gate existe en el DOM pero
    // nunca llega a tener contenido: index.js solo monta
    // ConsentCard si needsConsent() devuelve true, y con
    // provider="none" siempre es false.
    const estado = await browser.execute(() => {
      const gate = document.getElementById('consent-gate');
      if (!gate) return { exists: false };
      // El innerHTML queda vacío tras initMonetization porque
      // ConsentCard nunca se inicializa.
      const visible = !gate.hidden
        && getComputedStyle(gate).display !== 'none'
        && gate.innerHTML.trim() !== '';
      // role/aria-modal/textContent que un lector de pantalla leería.
      return {
        exists: true,
        visible,
        empty:  gate.innerHTML.trim() === '',
        hidden: gate.hidden,
        textContent: gate.textContent.trim(),
      };
    });
    expect(estado.exists).toBe(true);
    // La pantalla no debe ser visible para el usuario.
    expect(estado.visible).toBe(false);
    // Y no debe tener texto reconocible de consentimiento.
    expect(estado.textContent).toBe('');
  });

  // ── 2. Botón "Quitar anuncios" oculto ────────────────────────────────

  it('el botón "Quitar anuncios" está oculto (hasAds()=false)', async () => {
    const estado = await $('#removeAdsBtn').getAttribute('hidden');
    // El atributo HTML `hidden` se serializa a la cadena vacía si
    // está presente; `null` si no está. La app lo aplica con
    // `removeAdsBtn.hidden = !hasAds()` en index.js.
    expect(estado).not.toBeNull();
    // El botón, además, no debe ocupar sitio en el sidebar.
    const enSidebar = await browser.execute(() => {
      const btn = document.getElementById('removeAdsBtn');
      if (!btn) return null;
      return getComputedStyle(btn).display !== 'none';
    });
    expect(enSidebar).toBe(false);
  });

  // ── 3. La pestaña Legal no enlaza ADS_DISCLOSURE ni REFUNDS ─────────

  it('la pestaña Legal no contiene enlaces a ADS_DISCLOSURE ni REFUNDS', async () => {
    // Abrir Ajustes en la pestaña Legal con el atajo Alt+7 (T-022).
    await navegarVistaAlt(7);
    await $('a[data-doc="PRIVACY"]').waitForDisplayed();

    const enlaces = await browser.execute(() =>
      Array.from(document.querySelectorAll('#ajustes-panel-legal a[data-doc]'))
        .map(a => a.getAttribute('data-doc'))
    );
    // El resto de los documentos debe seguir presente.
    expect(enlaces).toEqual(expect.arrayContaining([
      'PRIVACY', 'TERMS', 'EULA', 'COOKIES', 'ACCESSIBILITY',
      'ACCEPTABLE_USE', 'DMCA', 'THIRD_PARTY_LICENSES', 'CONTACT',
    ]));
    expect(enlaces).not.toContain('ADS_DISCLOSURE');
    expect(enlaces).not.toContain('REFUNDS');
  });

  it('los archivos ADS_DISCLOSURE.md y REFUNDS.md ya no están en la app distribuida', async () => {
    // Tras T-023 estos dos .md se mueven a docs/publicacion-comercial/legal/
    // (fuera de WEB_ASSETS y de bundle.resources), así que un fetch desde
    // el WebView NO debe devolver un 200 con el contenido de esos
    // documentos.
    //
    // Solo valen dos respuestas: 404 (el archivo no está) o 200 con el
    // cuerpo del index.html (el fallback del SPA, que no es el documento
    // buscado). WRY puede responder de las dos formas según el montaje.
    //
    // Un fetch que LANZA no dice nada del documento: también rechazaría
    // una URL mal escrita o un problema de protocolo. Por eso su error
    // se guarda y hace FALLAR la prueba, nunca se cuenta como «no se
    // distribuye».
    //
    // Como control positivo se pide con el MISMO fetch
    // ./legal/PRIVACY.md: tiene que servirse con 200 y con el texto del
    // documento (no con el app shell). Así se demuestra que este mismo
    // fetch sí encuentra un documento que sí existe.
    const resultados = await browser.execute(async () => {
      const esAppShell = (txt) =>
        txt.trim().startsWith('<!DOCTYPE') || txt.includes('<div id="view-');
      const pedir = async (url, tituloEsperado) => {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          const txt = await r.text();
          return {
            status: r.status,
            len: txt.length,
            looksLikeAppShell: esAppShell(txt),
            // ¿El cuerpo es el del documento (y no una página cualquiera)?
            tieneTitulo: tituloEsperado ? txt.includes(tituloEsperado) : null,
            error: null,
          };
        } catch (e) {
          return {
            status: null,
            len: 0,
            looksLikeAppShell: false,
            tieneTitulo: false,
            error: String(e && e.message ? e.message : e),
          };
        }
      };
      const out = {};
      out['./legal/PRIVACY.md'] =
        await pedir('./legal/PRIVACY.md', 'Política de Privacidad');
      for (const url of ['./legal/ADS_DISCLOSURE.md', './legal/REFUNDS.md']) {
        out[url] = await pedir(url, null);
      }
      return out;
    });

    // ── Control positivo: este mismo fetch sí sirve un documento ──────
    const control = resultados['./legal/PRIVACY.md'];
    if (control.error) {
      throw new Error(
        `El fetch de ./legal/PRIVACY.md falló (${control.error}): ` +
        `no se ha podido comprobar nada`,
      );
    }
    expect(control.status).toBe(200);
    expect(control.looksLikeAppShell).toBe(false);
    expect(control.tieneTitulo).toBe(true);

    // ── Lo que no debe distribuirse ───────────────────────────────────
    for (const url of ['./legal/ADS_DISCLOSURE.md', './legal/REFUNDS.md']) {
      const info = resultados[url];
      // Un fetch que lanza no prueba nada: la prueba falla con su error.
      if (info.error) {
        throw new Error(
          `El fetch de ${url} falló (${info.error}): un fetch fallido no ` +
          `prueba que el documento no se distribuya`,
        );
      }
      // Solo se aceptan 404 o el 200 con el cuerpo del index.html.
      const noDistribuido =
        info.status === 404 || (info.status === 200 && info.looksLikeAppShell);
      expect(noDistribuido).toBe(true);
    }
  });

  it('los documentos que sí se distribuyen devuelven 200 desde el WebView', async () => {
    // Complemento del test anterior: los documentos que aparecen en la
    // pestaña Legal deben estar disponibles en la app. Antes lo validaba
    // junto al test anterior, pero el supervisor pidió separar la
    // comprobación para no mezclar "qué falta" con "qué está".
    const resultados = await browser.execute(async () => {
      const docs = [
        'PRIVACY', 'TERMS', 'EULA', 'COOKIES', 'ACCESSIBILITY',
        'ACCEPTABLE_USE', 'DMCA', 'THIRD_PARTY_LICENSES', 'CONTACT',
      ];
      const out = {};
      for (const key of docs) {
        const url = {
          PRIVACY:              './legal/PRIVACY.md',
          TERMS:                './legal/TERMS.md',
          EULA:                 './legal/EULA.md',
          COOKIES:              './legal/COOKIES.md',
          ACCESSIBILITY:        './legal/ACCESSIBILITY.md',
          ACCEPTABLE_USE:       './legal/ACCEPTABLE_USE.md',
          DMCA:                 './legal/DMCA.md',
          THIRD_PARTY_LICENSES: './legal/THIRD_PARTY_LICENSES.md',
          CONTACT:              './legal/CONTACT.md',
        }[key];
        try {
          const r = await fetch(url);
          out[key] = r.status;
        } catch (e) {
          out[key] = `error: ${e.message}`;
        }
      }
      return out;
    });
    for (const [key, status] of Object.entries(resultados)) {
      expect(status).toBe(200);
      if (status !== 200) {
        throw new Error(`El documento ${key} debería estar disponible (devolvió ${status})`);
      }
    }
  });

  // ── 4. Limpieza por si quedaron diálogos abiertos ────────────────────
  afterEach(async () => {
    await browser.execute(() => {
      const help = document.getElementById('shortcuts-modal');
      if (help) help.hidden = true;
      const legal = document.getElementById('legal-modal');
      if (legal) legal.hidden = true;
    });
  });
});
