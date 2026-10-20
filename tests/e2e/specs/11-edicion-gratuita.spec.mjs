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
    // documentos. WRY puede responder 404 o, en algunos montajes,
    // redirigir a index.html; en cualquier caso el cuerpo no debe ser el
    // del fichero buscado. Comprobamos código + longitud/tipo del
    // cuerpo para descartar el falso positivo del SPA fallback.
    const resultados = await browser.execute(async () => {
      const out = {};
      for (const url of ['./legal/ADS_DISCLOSURE.md', './legal/REFUNDS.md']) {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          const txt = await r.text();
          out[url] = {
            status: r.status,
            ok: r.ok,
            len: txt.length,
            looksLikeAppShell:
              txt.trim().startsWith('<!DOCTYPE') ||
              txt.includes('<div id="view-'),
          };
        } catch (e) {
          out[url] = { status: 0, ok: false, error: e.message };
        }
      }
      return out;
    });
    for (const [url, info] of Object.entries(resultados)) {
      // La app no debe servir el contenido del documento. Si el status
      // fuera 200, el cuerpo tiene que ser claramente el de otra cosa
      // (no el del .md que estamos buscando).
      if (info.status === 200 && info.ok && !info.looksLikeAppShell) {
        throw new Error(
          `${url} devolvió 200 con un cuerpo que parece un documento legal: ` +
          `status=${info.status} len=${info.len}`,
        );
      }
      // Cualquier otro resultado (404, redirect a app shell, error) es
      // aceptable: demuestra que el archivo no se distribuye.
      expect(info.status === 200 ? info.looksLikeAppShell : true)
        .toBe(true);
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
