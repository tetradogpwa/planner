// T-042 — El PDF no puede ejecutar el HTML del nombre de una tarea.
//
// El nombre de una tarea lo escribe el usuario: lo teclea, lo importa
// de un JSON o lo crea un asistente por MCP. El PDF se genera
// volcando al DOM el HTML de un contenedor; si el nombre se mete ahí
// sin escapar, `<img src=x onerror=…>` deja de ser texto y pasa a ser
// una etiqueta viva con su manejador `onerror`.
//
// Aquí se comprueba el comportamiento observable:
//
//   1. La tarea se guarda con el nombre tal cual (control: si aquí no
//      aparece literal, el PDF no podría mostrarlo).
//   2. Lo que se imprime es el TEXTO del nombre: del nombre no sale
//      ninguna etiqueta viva en el contenedor que se convierte en PDF.
//   3. El payload no se ejecuta: `window.__xss` sigue sin definirse.
//
// Aviso sobre el punto 3: la CSP que sirve Tauri es
// `script-src 'self' 'unsafe-inline' 'sha256-…'`, y cuando hay hashes
// en la lista, 'unsafe-inline' deja de aplicarse (regla de CSP 3), así
// que en este WebView los manejadores en línea ni siquiera llegan a
// registrarse. Por eso la prueba hace de navegador: cuando el nombre
// ha salido como elemento vivo, ejecuta su manejador de 'error' (lo
// que el navegador haría al fallar la carga de la imagen) y comprueba
// que el payload no ha hecho nada. Si el nombre se escapa (el
// arreglo), no hay ningún elemento vivo y el payload no tiene por qué
// ejecutarse.

import {
  abrirAppNueva,
  crearTarea,
  nombresDeTareas,
  irAImprimir,
  esperarStatus,
} from '../helpers.mjs';

const NOMBRE = '<img src=x onerror="window.__xss=1">';

describe('El PDF no ejecuta el HTML del nombre de una tarea', () => {
  before(async () => {
    await abrirAppNueva();

    // La tarea con el nombre malicioso, escrita en el formulario como
    // lo haría la persona usuaria. Es «diaria», así que sale en el
    // PDF de la semana actual.
    await crearTarea(NOMBRE, 'daily');

    // Antes de exportar, se apunta qué nodos se añaden al <body> (el
    // contenedor que se convierte en PDF está entre ellos) y se limpia
    // la marca que dejaría el payload si llegara a ejecutarse.
    await browser.execute(() => {
      window.__xss = undefined;
      window.__nodos = [];
      const obs = new MutationObserver(muts => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) window.__nodos.push(n);
          }
        }
      });
      obs.observe(document.body, { childList: true });
    });
  });

  it('la tarea se guarda con el nombre tal cual', async () => {
    // El nombre no se filtra al escribirlo: si aquí no aparece
    // literal, el PDF no podría mostrarlo y la prueba mediría otra cosa.
    expect(await nombresDeTareas()).toEqual([NOMBRE]);
  });

  it('exportar el PDF no ejecuta nada y muestra el nombre literal', async () => {
    await irAImprimir();
    await $('#printWeekBtn').click();
    await esperarStatus('#printStatus', '✅ PDF generado', 30_000);

    const impreso = await browser.execute((nombre) => {
      const nodos = window.__nodos ?? [];

      // Etiquetas vivas creadas a partir del nombre: un <img> con el
      // onerror del payload es la inyección.
      const vivos = [];
      for (const n of nodos) {
        for (const el of n.querySelectorAll('*')) {
          for (const attr of el.attributes) {
            if (attr.value.includes(nombre) || attr.value.includes('window.__xss')) {
              vivos.push(el);
            }
          }
        }
      }

      // El texto literal: el nombre tal cual en algún nodo pintado.
      const conTexto = nodos.find(n => (n.textContent ?? '').includes(nombre));

      // De navegador: el <img> que hubiera salido del nombre ejecuta
      // su manejador de 'error' cuando la imagen no se puede cargar.
      for (const el of vivos) {
        if (el.tagName === 'IMG' && el.hasAttribute('onerror')) {
          el.addEventListener('error', () => { window.__xss = 1; });
          el.dispatchEvent(new Event('error'));
        }
      }

      return {
        vivas: vivos.map(el => el.outerHTML),
        texto: conTexto ? conTexto.textContent : null,
        ejecutado: window.__xss !== undefined,
      };
    }, NOMBRE);

    // 1. El payload no se ha ejecutado: la marca sigue sin definirse.
    //    Se compara un objeto para que el fallo diga qué marca es.
    expect({ 'window.__xss': impreso.ejecutado }).toEqual({ 'window.__xss': false });

    // 2. Y lo que se ha impreso es el TEXTO del nombre: ninguna
    //    etiqueta (ni ningún manejador en línea) sale de él.
    expect(impreso.vivas).toEqual([]);
    expect(impreso.texto).toContain(NOMBRE);
  });

});
