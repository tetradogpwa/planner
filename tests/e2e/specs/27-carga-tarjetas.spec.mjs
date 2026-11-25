// T-062: las tarjetas avisan si no pueden cargar y no repiten descargas.
//
// Aquí se mira lo que ve la persona:
//
//   1. Si falta un asset (una plantilla que no se puede descargar), la
//      vista avisa "No se pudo cargar esta sección" en vez de quedar
//      en blanco.
//   2. Al pintar "Todas semanas" (12 semanas × 7 días) cada plantilla
//      se descarga una sola vez y no se inyecta más de una etiqueta
//      <style> por tipo de tarjeta.
//   3. Al repintar una vista, el CSS de su tarjeta sigue en la página
//      (si no, la vista se queda sin estilo).
//   4. Si una parte de una tarjeta no se puede cargar, al volver a su
//      pestaña se reintenta (no se queda el aviso a medias para
//      siempre).

import { abrirAppNueva, esperarPintado } from '../helpers.mjs';

describe('Las tarjetas: avisos de carga y plantillas en caché', () => {

  before(async () => {
    await abrirAppNueva();

    // Se cuentan las descargas y se puede romper un asset: el fetch
    // delega en el de verdad salvo que se le pida que falle (como un
    // 404: la respuesta llega, pero no es una plantilla).
    await browser.execute(() => {
      window.__descargas = [];
      window.__roto = null;
      const original = window.fetch;
      window.fetch = (url, ...resto) => {
        const ruta = String(url);
        window.__descargas.push(ruta);
        if (window.__roto && ruta.includes(window.__roto)) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: async () => 'no encontrado',
          });
        }
        return original(url, ...resto);
      };
    });
  });

  it('pintar "Todas semanas" descarga cada plantilla una sola vez', async () => {
    await browser.execute(() => { window.__descargas = []; });

    await esperarPintado(async () => {
      await $('button.nav-item[data-view="allWeeks"]').click();
    });
    // Las semanas están pintadas de verdad: las celdas de día, con su
    // cabecera (la tarjeta de cada día se inyecta de forma asíncrona).
    await browser.waitUntil(
      async () => await browser.execute(() => {
        const celdas = document.querySelectorAll('#view-allWeeks .day-cell');
        return celdas.length > 0
          && [...celdas].every(c => !!c.querySelector('.day-header'));
      }),
      { timeout: 10_000, timeoutMsg: 'La vista completa no pintó sus celdas de día' },
    );

    const descargas = await browser.execute(() => window.__descargas);
    const veces = (ruta) => descargas.filter(u => u.endsWith(ruta)).length;

    // Cada plantilla se descarga UNA sola vez, aunque haya 12 semanas
    // y 84 días: las tarjetas que la piden a la vez la comparten.
    expect(veces('week-card.html')).toBe(1);
    expect(veces('week-card.css')).toBe(1);
    expect(veces('taskItem-card.html')).toBe(1);
    expect(veces('taskItem-card.css')).toBe(1);
  });

  it('pintar "Todas semanas" no inyecta más de un <style> por tipo de tarjeta', async () => {
    const estilos = await browser.execute(() =>
      Array.from(document.querySelectorAll('style')).map(s => s.textContent));

    // El CSS de la semana y el del día: una etiqueta <style> cada uno
    // (no una por semana y una por día).
    expect(estilos.filter(t => t.includes('.week-card')).length).toBe(1);
    expect(estilos.filter(t => t.includes('.day-cell')).length).toBe(1);
  });

  it('con un asset que falta, la vista avisa en vez de quedar en blanco', async () => {
    // Se rompe el CSS de la tarjeta de imprimir. Esa tarjeta todavía
    // no se ha descargado (su pestaña de Ajustes se monta al abrirla).
    await browser.execute(() => { window.__roto = 'print-card.css'; });

    await esperarPintado(async () => {
      await $('button.nav-item[data-view="ajustes"]').click();
    });
    // Clic sobre la pestaña "Imprimir y PDF" (como hace el resto de
    // las pruebas de Ajustes).
    await browser.execute(() => {
      document.querySelector('.ajustes-tab[data-tab="print"]')?.click();
    });

    await browser.waitUntil(
      async () => await browser.execute(() =>
        !!document.querySelector('#ajustes-panel-print .aviso-carga')),
      { timeout: 5_000, timeoutMsg: 'La vista no avisó de que no se pudo cargar' },
    );

    // La vista dice qué ha pasado...
    const texto = await browser.execute(() =>
      document.getElementById('ajustes-panel-print').textContent);
    expect(texto).toContain('No se pudo cargar esta sección');

    // ...y no está en blanco: el aviso está a la vista.
    await expect($('#ajustes-panel-print .aviso-carga')).toBeDisplayed();
  });

  it('si una parte de la tarjeta no se carga, al volver a la pestaña se reintenta', async () => {
    // Se rompe el bloque de tamaños de letra: es una sub-tarjeta de la
    // pestaña Accesibilidad (ui/accessibility/fontSizes-card.html).
    await browser.execute(() => { window.__roto = 'fontSizes-card.html'; });

    await esperarPintado(async () => {
      await $('button.nav-item[data-view="ajustes"]').click();
    });
    await browser.execute(() => {
      document.querySelector('.ajustes-tab[data-tab="accessibility"]')?.click();
    });

    // El bloque avisa de que no se pudo cargar (en vez de quedarse en
    // blanco).
    await browser.waitUntil(
      async () => await browser.execute(() =>
        !!document.querySelector('#accessibility-fontsizes-mount .aviso-carga')),
      { timeout: 5_000, timeoutMsg: 'La vista no avisó de que no se pudo cargar' },
    );

    const antes = await browser.execute(() =>
      window.__descargas.filter(u => u.endsWith('fontSizes-card.html')).length);

    // Salir de la pestaña y volver a ella: la carga se reintenta (no se
    // queda el aviso a medias para siempre).
    await browser.execute(() => {
      document.querySelector('.ajustes-tab[data-tab="appearance"]')?.click();
    });
    await browser.execute(() => {
      document.querySelector('.ajustes-tab[data-tab="accessibility"]')?.click();
    });

    await browser.waitUntil(
      async () => await browser.execute(
        n => window.__descargas.filter(u => u.endsWith('fontSizes-card.html')).length > n,
        antes),
      { timeout: 5_000, timeoutMsg: 'No se reintentó la carga del bloque de tamaños de letra' },
    );

    // Y cuando el asset vuelve a estar disponible, el bloque se monta.
    await browser.execute(() => { window.__roto = null; });
    await browser.execute(() => {
      document.querySelector('.ajustes-tab[data-tab="appearance"]')?.click();
    });
    await browser.execute(() => {
      document.querySelector('.ajustes-tab[data-tab="accessibility"]')?.click();
    });
    await browser.waitUntil(
      async () => await browser.execute(() =>
        !!document.querySelector('#accessibility-fontsizes-mount input[name="textScale"]')),
      { timeout: 5_000, timeoutMsg: 'El bloque de tamaños de letra no se montó al reintentar' },
    );
  });

  it('al repintar la lista de tareas, su CSS sigue en la página', async () => {
    // La vista Tareas se repinta cada vez que se añade una tarea. El
    // CSS de la tarjeta no puede perderse por el camino: si se pierde,
    // la insignia del resumen se sale de la pantalla con letra
    // grande (es lo que mide la prueba 04-apariencia).
    await esperarPintado(async () => {
      await $('button.nav-item[data-view="tasks"]').click();
    });
    await $('#taskName').waitForDisplayed();

    await $('#taskName').setValue('Tarea con CSS');
    await $('input[name="repeat"][value="daily"]').click();
    await $('#addTaskBtn').click();
    await browser.waitUntil(
      async () => await browser.execute(() =>
        document.querySelectorAll('#taskListMount .task-row').length === 1),
      { timeout: 5_000, timeoutMsg: 'La tarea no llegó a la lista' },
    );

    const estado = await browser.execute(() => {
      const insignia = document.querySelector('#taskListMount .task-row .task-type');
      return {
        // ¿Sigue el CSS de la lista en la página?
        cssEnPagina: Array.from(document.querySelectorAll('style'))
          .some(s => s.textContent.includes('.task-type')),
        overflowWrap: insignia ? getComputedStyle(insignia).overflowWrap : null,
      };
    });

    expect(estado.cssEnPagina).toBe(true,
      'el CSS de la tarjeta se ha perdido al repintar la lista');
    expect(estado.overflowWrap).toBe('anywhere');
  });
});
