// T-032 — Permisos que la app no usa.
//
// Comprueba, contra la app REAL, que el WebView se queda sin acceso
// al disco y sin los hosts remotos de los anuncios:
//
//   1. `window.__TAURI__` ya no expone los plugins `fs` ni `dialog`
//      (los que la app no usa: la importación y la exportación van con
//      Blob/FileReader y el PDF con html2pdf). `core` y `shell`, que sí
//      se usan, siguen ahí.
//   2. Invocar un comando de `fs` o de `dialog` desde el WebView falla:
//      aunque alguien lograra colar una llamada, no hay permiso.
//   3. La CSP que recibe el WebView NO deja cargar el script de
//      AdSense: esta build se compila sin claves de anuncios, así que
//      los hosts de Google no están permitidos. Se comprueba de forma
//      funcional (el navegador dispara `securitypolicyviolation`), no
//      leyendo la cabecera.
//   4. Lo que sí usa la app sigue funcionando: el comando del MCP
//      responde (o sea, la API de Tauri y los permisos que quedan
//      siguen en pie).

import { abrirAppNueva } from '../helpers.mjs';

describe('Permisos del WebView: sin disco y sin hosts de anuncios', () => {

  it('la webview no expone los plugins fs ni dialog', async () => {
    await abrirAppNueva();

    const tipos = await browser.execute(() => ({
      fs: typeof window.__TAURI__?.fs,
      dialog: typeof window.__TAURI__?.dialog,
      core: typeof window.__TAURI__?.core,
      shell: typeof window.__TAURI__?.shell,
    }));

    // Los que la app no usa: ni están.
    expect(tipos.fs).toBe('undefined');
    expect(tipos.dialog).toBe('undefined');
    // Los que sí usa: siguen.
    expect(tipos.core).toBe('object');
    expect(tipos.shell).toBe('object');
  });

  it('invocar un comando de fs o de dialog falla', async () => {
    const resultado = await browser.execute(async () => {
      const invocar = async (comando) => {
        try {
          await window.__TAURI__.core.invoke(comando, {
            path: '/etc/passwd',
            contents: 'x',
          });
          return 'ok';
        } catch (err) {
          return String(err);
        }
      };
      return {
        lectura: await invocar('plugin:fs|read_text_file'),
        escritura: await invocar('plugin:fs|write_text_file'),
        dialogo: await invocar('plugin:dialog|open'),
      };
    });

    expect(resultado.lectura).not.toBe('ok');
    expect(resultado.escritura).not.toBe('ok');
    expect(resultado.dialogo).not.toBe('ok');
  });

  it('la CSP bloquea el script de AdSense (build sin anuncios)', async () => {
    // El aviso de la CSP se registra en la página y se espera a que
    // llegue: no se espera un plazo dentro de la página (si el
    // evento no llegara, la espera de WebdriverIO falla con un
    // mensaje claro).
    await browser.execute(() => {
      window.__violacionCsp = null;
      document.addEventListener('securitypolicyviolation', event => {
        window.__violacionCsp = {
          directiva: event.violatedDirective,
          bloqueado: event.blockedURI,
        };
      }, { once: true });
    });

    await browser.execute(() => {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      document.head.append(script);
    });

    await browser.waitUntil(
      async () => await browser.execute(() => window.__violacionCsp !== null),
      { timeout: 10_000, timeoutMsg: 'El navegador no avisó de que la CSP bloqueó el script' },
    );
    const violacion = await browser.execute(() => window.__violacionCsp);

    // El navegador bloquea el script antes de pedirlo: eso solo pasa si
    // la CSP no permite el host de AdSense.
    expect(violacion).toBeTruthy();
    expect(violacion.bloqueado).toContain('googlesyndication');
  });

  it('el MCP sigue respondiendo (los permisos que quedan sirven)', async () => {
    const estado = await browser.execute(async () => {
      try {
        return { ok: true, estado: await window.__TAURI__.core.invoke('mcp_status') };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    });

    expect(estado.ok).toBe(true);
    expect(estado.estado).toHaveProperty('active');
    expect(estado.estado).toHaveProperty('port');
  });

});
