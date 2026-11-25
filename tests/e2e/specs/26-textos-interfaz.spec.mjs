// Textos coherentes en la interfaz (T-057): el nombre de la app y las
// etiquetas del menú.
//
// Lo que se comprueba es lo que ve la persona: el título de la
// ventana, el encabezado de la barra superior (con el emoji como
// elemento decorativo, para que el lector de pantalla solo lea
// «Planificador»), las etiquetas del menú lateral y los sitios que
// nombran esas mismas entradas por escrito (la ayuda de atajos y la
// muestra del tamaño de letra del menú). El manifest se le pide a la
// propia app, que es donde se empaqueta.

import { Key } from 'webdriverio';
import { abrirAppNueva, navegarVistaAlt } from '../helpers.mjs';

describe('Textos de la interfaz', () => {

  before(async () => {
    await abrirAppNueva();
  });

  it('el título de la ventana es «Planificador»', async () => {
    expect(await browser.getTitle()).toBe('Planificador');
  });

  it('el encabezado dice «Planificador» y el emoji es decorativo', async () => {
    const h1 = await browser.execute(() => {
      const el = document.querySelector('.topbar h1');
      if (!el) return null;
      const emoji = el.querySelector('span[aria-hidden="true"]');
      // Lo que lee un lector de pantalla: todo menos lo que va con
      // aria-hidden.
      const accesible = Array.from(el.childNodes)
        .filter(n => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true'))
        .map(n => n.textContent)
        .join('')
        .trim();
      return {
        texto: el.textContent.trim(),
        emoji: emoji?.textContent.trim() ?? '',
        accesible,
      };
    });

    expect(h1).not.toBe(null);
    expect(h1.texto).toBe('📅 Planificador');
    expect(h1.emoji).toBe('📅');
    expect(h1.accesible).toBe('Planificador');
  });

  it('el menú dice «Tareas», «Semana» y «Próximas semanas»', async () => {
    const etiquetas = await browser.execute(() => {
      const salida = {};
      document.querySelectorAll('.nav-item[data-view]').forEach(b => {
        salida[b.dataset.view] = b.querySelector('.nav-label')?.textContent?.trim() ?? '';
      });
      return salida;
    });

    expect(etiquetas.tasks).toBe('Tareas');
    expect(etiquetas.week).toBe('Semana');
    expect(etiquetas.allWeeks).toBe('Próximas semanas');
  });

  it('la etiqueta del menú es también el texto de la etiqueta emergente', async () => {
    // Con el menú contraído solo se ve el icono: el nombre de la
    // opción tiene que estar en el `title` (lo copia la etiqueta).
    const titulos = await browser.execute(() => {
      const salida = {};
      document.querySelectorAll('.nav-item[data-view]').forEach(b => {
        salida[b.dataset.view] = b.getAttribute('title') ?? '';
      });
      return salida;
    });

    expect(titulos.tasks).toBe('Tareas');
    expect(titulos.week).toBe('Semana');
    expect(titulos.allWeeks).toBe('Próximas semanas');
  });

  it('el manifest de la app se llama «Planificador»', async () => {
    const manifest = await browser.execute(async () => {
      const r = await fetch('./manifest.json');
      return r.ok ? await r.json() : null;
    });

    expect(manifest).not.toBe(null);
    expect(manifest.name).toBe('Planificador');
  });

  it('la ayuda de atajos llama a las vistas como las llama el menú', async () => {
    // La ayuda ("?") inyecta ui/shortcuts/shortcuts-list.html tal cual:
    // sus descripciones tienen que usar los nombres del menú.
    await browser.execute(() => {
      const btn = document.querySelector('button.nav-item[data-view="tasks"]');
      btn?.focus();
    });
    await browser.keys([Key.Shift, '/']);
    await $('#shortcuts-modal').waitForDisplayed();

    const pares = await browser.execute(() => {
      const salida = {};
      for (const dt of document.querySelectorAll('#shortcuts-modal dt')) {
        const dd = dt.nextElementSibling;
        // Normaliza espacios: el textContent del dt incluye los
        // separadores entre <kbd>.
        const tecla = (dt.textContent || '').replace(/\s+/g, ' ').trim();
        const desc  = (dd?.textContent || '').replace(/\s+/g, ' ').trim();
        salida[tecla] = desc;
      }
      return salida;
    });

    expect(pares['Alt + 1']).toBe('Ir a Tareas');
    expect(pares['Alt + 2']).toBe('Ir a Semana');
    expect(pares['Alt + 3']).toBe('Ir a Próximas semanas');

    // Cerramos la ayuda para no dejar el diálogo abierto.
    await browser.keys(Key.Escape);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.getElementById('shortcuts-modal').hidden,
      ),
      { timeout: 3_000, timeoutMsg: 'La ayuda no se cerró con Escape' },
    );
  });

  it('la muestra del tamaño de letra del menú es una entrada del menú', async () => {
    // Ajustes › Accesibilidad: la fila "Menú lateral" enseña un texto
    // de ejemplo con el tamaño de letra del menú; tiene que ser una
    // entrada que exista en el menú de verdad.
    await navegarVistaAlt(8);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('#sizeRows .size-row').length > 0,
      ),
      { timeout: 5_000, timeoutMsg: 'No se pintaron las filas de tamaño por partes' },
    );

    const muestra = await browser.execute(() => {
      const filas = Array.from(document.querySelectorAll('#sizeRows .size-row'));
      const fila = filas.find(
        f => f.querySelector('.size-row-head label')?.textContent?.trim() === 'Menú lateral',
      );
      return fila?.querySelector('.size-sample')?.textContent?.trim() ?? null;
    });

    expect(muestra).not.toBe(null);

    const etiquetas = await browser.execute(() =>
      Array.from(document.querySelectorAll('.nav-item[data-view] .nav-label'))
        .map(el => el.textContent.trim()),
    );
    expect(etiquetas).toContain(muestra);
  });

});
