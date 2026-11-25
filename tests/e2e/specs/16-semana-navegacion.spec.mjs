// Navegación entre semanas de la vista "Semana actual" (T-046).
//
// La app saca "hoy" de `new Date()`, así que la prueba fija la fecha
// con un reloj falso (sustituye el constructor Date de la página)
// para que el recorrido no dependa del día en que se ejecuta: la
// semana que se espera es siempre la del lunes 09/03/2026 al domingo
// 15/03/2026.
//
// Se recorre:
//   1. La vista Semana abre en la semana que contiene hoy, con hoy
//      resaltado y desplegado.
//   2. Anterior / Siguiente / Hoy cambian de semana y el título lo
//      anuncia en una región role="status".
//   3. Los controles se activan con teclado y hay atajos
//      (Alt+← / Alt+→ / Alt+H) para cambiar de semana.
//   4. Las tareas que empiezan hoy salen en la semana de hoy.
//   5. "Todas las semanas" y el PDF empiezan en la semana de hoy.
//   6. Con letra al 200 % y la ventana a 390 px los controles no
//      desbordan.

import { Key } from 'webdriverio';
import {
  abrirAppNueva,
  celdasCon,
  crearTarea,
  esperarCeldasSemana,
  esperarPintado,
  esperarStatus,
  irAImprimir,
  navegarVistaAlt,
  ventanaMovil,
} from '../helpers.mjs';

// Miércoles 11/03/2026.
const HOY = '2026-03-11';
const SEMANA_HOY = ['09/03/2026', '15/03/2026'];
const SEMANA_ANT = ['02/03/2026', '08/03/2026'];
const SEMANA_SIG = ['16/03/2026', '22/03/2026'];

/** Sustituye el constructor Date de la página por uno que siempre
 *  devuelve la fecha fijada (un reloj falso). La app usa `new Date()`
 *  para saber qué día es hoy, así que con esto la semana que pinta
 *  no depende del día real en que se ejecuta la prueba. */
async function fijarFecha(iso) {
  await browser.execute((fecha) => {
    const [a, m, d] = fecha.split('-').map(Number);
    const fija = new Date(a, m - 1, d);
    const Real = Date;
    window.Date = new Proxy(Real, {
      construct: (target, args) =>
        args.length === 0 ? new target(fija.getTime()) : new target(...args),
      get: (target, prop) =>
        prop === 'now' ? () => fija.getTime() : Reflect.get(target, prop),
    });
  }, iso);
}

/** Texto del título de la semana (el que anuncia el cambio). */
const tituloSemana = () => browser.execute(
  () => document.getElementById('view-week-body-title')?.textContent?.trim() ?? '',
);

/** Espera a que el título de la semana contenga el texto dado. */
async function esperarTitulo(texto) {
  await browser.waitUntil(
    async () => (await tituloSemana()).includes(texto),
    { timeout: 5_000, timeoutMsg: `El título de la semana no contiene "${texto}"` },
  );
}

/** Comprueba que el título anuncia la semana esperada y no otra. */
async function esperarSemana(esperada, noEsperada = []) {
  await browser.waitUntil(
    async () => {
      const titulo = await tituloSemana();
      return esperada.every(t => titulo.includes(t))
        && noEsperada.every(t => !titulo.includes(t));
    },
    {
      timeout: 5_000,
      timeoutMsg: `El título no anuncia la semana ${esperada.join(' – ')}`,
    },
  );
}

describe('Vista Semana: la semana de hoy y la navegación entre semanas', () => {

  before(async () => {
    await abrirAppNueva();
    // Reloj falso: a partir de aquí la app cree que hoy es el
    // 11/03/2026.
    await fijarFecha(HOY);
    // Una tarea diaria: sin ninguna tarea la vista Semana muestra el
    // estado vacío en vez de los siete días (T-056), y este recorrido
    // necesita los días pintados.
    await crearTarea('Tarea de prueba', 'daily');
  });

  it('al abrir la vista Semana se ve la semana que contiene hoy, con hoy resaltado y desplegado', async () => {
    // La navegación espera al aviso de pintado de la app
    // ('planner:painted'): sin ella se puede leer el título (y las
    // celdas) del pintado anterior.
    await esperarPintado(async () => {
      await $('button.nav-item[data-view="week"]').click();
    });
    await esperarTitulo('09/03/2026');
    // Las celdas de día se inyectan de forma asíncrona: se espera a
    // que estén todas pintadas antes de leerlas.
    await esperarCeldasSemana();

    // El título dice qué semana es, de lunes a domingo.
    const titulo = await tituloSemana();
    expect(titulo).toContain('09/03/2026');
    expect(titulo).toContain('15/03/2026');

    // Hoy (miércoles 11/03) está resaltado y desplegado.
    const hoy = await browser.execute(() => {
      const celdas = Array.from(document.querySelectorAll('#view-week .day-cell'));
      const marcadas = celdas.filter(c => c.classList.contains('is-today'));
      if (marcadas.length !== 1) return { total: marcadas.length };
      const celda = marcadas[0];
      return {
        total:     marcadas.length,
        dia:       celda.querySelector('.day-name')?.textContent?.trim() ?? '',
        fecha:     celda.querySelector('.day-date')?.textContent?.trim() ?? '',
        abierta:   celda.classList.contains('open'),
        expandida: celda.querySelector('.day-header')?.getAttribute('aria-expanded') ?? '',
      };
    });
    expect(hoy.total).toBe(1);
    expect(hoy.dia).toBe('Miércoles');   // el 11/03/2026 es miércoles
    expect(hoy.fecha).toMatch(/^11\//);   // y es el día 11
    expect(hoy.abierta).toBe(true);
    expect(hoy.expandida).toBe('true');
  });

  it('Anterior y Siguiente cambian de semana y Hoy vuelve a la de hoy', async () => {
    // El título vive dentro de una región role="status": el cambio de
    // semana se anuncia a los lectores de pantalla.
    const rol = await browser.execute(() => {
      const titulo = document.getElementById('view-week-body-title');
      return titulo?.closest('[role="status"]')?.getAttribute('role') ?? '';
    });
    expect(rol).toBe('status');

    // Anterior → la semana previa (lunes 02/03 – domingo 08/03).
    await esperarPintado(async () => {
      await $('#week-nav-prev').click();
    });
    await esperarSemana(SEMANA_ANT, SEMANA_HOY);

    // Siguiente → la siguiente (de la previa, la de hoy: lunes 09/03 –
    // domingo 15/03).
    await esperarPintado(async () => {
      await $('#week-nav-next').click();
    });
    await esperarSemana(SEMANA_HOY, SEMANA_ANT);

    // Siguiente otra vez → la siguiente (lunes 16/03 – domingo 22/03).
    await esperarPintado(async () => {
      await $('#week-nav-next').click();
    });
    await esperarSemana(SEMANA_SIG, SEMANA_HOY);

    // Hoy → vuelve a la semana que contiene hoy.
    await esperarPintado(async () => {
      await $('#week-nav-today').click();
    });
    await esperarSemana(SEMANA_HOY, SEMANA_SIG);
  });

  it('los controles se activan con teclado y hay atajos para cambiar de semana', async () => {
    // Volvemos a la semana de hoy para empezar el recorrido.
    await esperarPintado(async () => {
      await $('#week-nav-today').click();
    });
    await esperarSemana(SEMANA_HOY);

    // El botón "Siguiente" con el foco se activa con Enter.
    await browser.execute(() => document.getElementById('week-nav-next').focus());
    await esperarPintado(async () => {
      await browser.keys([Key.Enter]);
    });
    await esperarSemana(SEMANA_SIG, SEMANA_HOY);

    // Alt+Flecha izquierda: la semana anterior.
    await esperarPintado(async () => {
      await browser.keys([Key.Alt, Key.ArrowLeft]);
    });
    await esperarSemana(SEMANA_HOY, SEMANA_SIG);

    // Alt+Flecha derecha: la siguiente.
    await esperarPintado(async () => {
      await browser.keys([Key.Alt, Key.ArrowRight]);
    });
    await esperarSemana(SEMANA_SIG, SEMANA_HOY);

    // Alt+H: la semana que contiene hoy.
    await esperarPintado(async () => {
      await browser.keys([Key.Alt, 'h']);
    });
    await esperarSemana(SEMANA_HOY, SEMANA_SIG);
  });

  it('las tareas que empiezan hoy salen en la semana de hoy', async () => {
    // La tarea se crea con la fecha de hoy (la fijada): si la vista
    // pintara otra semana, no saldría en la que se ve.
    await navegarVistaAlt(1);
    await $('#taskName').waitForDisplayed();
    await crearTarea('Tarea de hoy', 'daily');

    await esperarPintado(async () => {
      await $('button.nav-item[data-view="week"]').click();
    });
    await esperarTitulo('09/03/2026');
    await esperarCeldasSemana();

    // Empieza el miércoles 11/03: sale de miércoles a domingo.
    const celdas = await celdasCon('Tarea de hoy');
    expect(celdas).toEqual([false, false, true, true, true, true, true]);
  });

  it('"Todas las semanas" empieza en la semana de hoy', async () => {
    // Se espera al pintado: las 12 semanas se pintan una a una.
    // (navegarVistaAlt ya espera al aviso de pintado de la app.)
    await navegarVistaAlt(3);

    const titulos = await browser.execute(() =>
      Array.from(document.querySelectorAll('#view-allWeeks .week-title'))
        .map(t => t.textContent.trim())
    );
    // 12 semanas, y la primera es la que contiene hoy.
    expect(titulos.length).toBe(12);
    expect(titulos[0]).toContain('09/03/2026');
    expect(titulos[0]).toContain('15/03/2026');
    // La última es 11 semanas después (lunes 25/05/2026).
    expect(titulos[11]).toContain('25/05/2026');
  });

  it('el PDF de "Semana actual" parte de la semana de hoy', async () => {
    // html2pdf se sustituye por una sonda: lo que importa es el
    // contenido que se convierte en PDF, no el fichero que sale.
    await browser.execute(() => {
      window.__pdfHTML = null;
      window.html2pdf = () => {
        const api = {
          set: () => api,
          from: (contenedor) => { window.__pdfHTML = contenedor.innerHTML; return api; },
          save: async () => {},
        };
        return api;
      };
    });

    await irAImprimir();
    await $('#printWeekBtn').click();
    await esperarStatus('#printStatus', '✅ PDF generado', 10_000);

    const html = await browser.execute(() => window.__pdfHTML ?? '');
    expect(html).toContain('09/03/2026');
    expect(html).toContain('15/03/2026');
  });

  it('con letra al 200 % y la ventana a 390 px los controles no desbordan', async () => {
    // Letra al 200 % (Ajustes › Accesibilidad).
    await navegarVistaAlt(8);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('input[name="textScale"]').length > 0,
      ),
      { timeout: 5_000, timeoutMsg: 'Los radios de Tamaño de letra general no se han pintado' },
    );
    await $('input[name="textScale"][value="200"]').click();
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.documentElement.style.fontSize,
      )) === '200%',
      { timeout: 5_000, timeoutMsg: 'No se pudo aplicar la letra al 200 %' },
    );

    // Ventana de móvil.
    await ventanaMovil(390, 844);

    // Vuelta a la vista Semana (con el atajo, que no depende de que
    // el menú lateral esté plegado en móvil).
    await navegarVistaAlt(2);
    await esperarTitulo('09/03/2026');

    // Ni la página ni la columna de contenido desbordan (el cuerpo
    // tiene overflow-x:hidden, así que el que de verdad desplaza es
    // .content).
    const medidas = await browser.execute(() => {
      const doc = document.documentElement;
      const content = document.querySelector('.content');
      return {
        doc:      doc.scrollWidth - doc.clientWidth,
        content:  content ? content.scrollWidth - content.clientWidth : 0,
        viewport: window.innerWidth,
      };
    });
    expect(medidas.doc).toBeLessThanOrEqual(1);
    expect(medidas.content).toBeLessThanOrEqual(1);

    // Los tres controles se ven enteros (ninguno se sale de la
    // ventana).
    const botones = await browser.execute(() => {
      return Array.from(document.querySelectorAll('#view-week .week-nav-btn')).map(b => {
        const r = b.getBoundingClientRect();
        return {
          texto: b.textContent.trim(),
          left:  Math.round(r.left),
          right: Math.round(r.right),
        };
      });
    });
    expect(botones.length).toBe(3);
    for (const b of botones) {
      expect(b.right).toBeLessThanOrEqual(medidas.viewport + 1);
      expect(b.left).toBeGreaterThanOrEqual(-1);
    }
  });
});
