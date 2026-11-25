// Semana en rejilla: a partir de 1024 px los 7 días se ven como
// columnas (y todos abiertos a la vez, sin abrir día a día); por debajo
// sigue el acordeón de siempre (T-055).
//
// Se recorre:
//   1. A 1280 px los 7 días son columnas y se ve el contenido de todos.
//   2. A 390 px los días se apilan (acordeón) y solo el de hoy está
//      abierto.
//   3. El teclado mueve el foco entre días en los dos modos.
//   4. Con letra al 200 % no hay desbordamiento horizontal ni a
//      1280 px ni a 390 px.

import { Key } from 'webdriverio';
import {
  abrirAppNueva,
  crearTarea,
  navegarVistaAlt,
  ventanaEscritorio,
  ventanaMovil,
} from '../helpers.mjs';

/** Geometría de los 7 días de la semana: dónde está cada celda, si su
 *  contenido se ve y qué insignias de tareas hay dentro. */
const celdas = () => browser.execute(() =>
  Array.from(document.querySelectorAll('#view-week .day-cell')).map(celda => {
    const r = celda.getBoundingClientRect();
    const cuerpo = celda.querySelector('.day-body-inner');
    return {
      left:      Math.round(r.left),
      top:       Math.round(r.top),
      // Altura del cuerpo del día: 0 si el día está plegado.
      alto:      Math.round(cuerpo ? cuerpo.getBoundingClientRect().height : 0),
      expandida: celda.querySelector('.day-header')?.getAttribute('aria-expanded') ?? '',
      insignias: Array.from(celda.querySelectorAll('.task-badge')).map(insignia => {
        const ri = insignia.getBoundingClientRect();
        return {
          ancho:  Math.round(ri.width),
          // La insignia está dentro de su columna: no se sale ni la
          // recorta el borde.
          dentro: ri.left >= r.left - 1 && ri.right <= r.right + 1,
        };
      }),
    };
  }),
);

/** El texto de los días y de las tareas, y si cabe en su caja (que se
 *  parte en varias líneas en vez de salirse). */
const textosEnSusCajas = () => browser.execute(() => {
  const dentroDe = (el, caja) => {
    const r = el.getBoundingClientRect();
    const c = caja.getBoundingClientRect();
    return r.left >= c.left - 1 && r.right <= c.right + 1;
  };
  const nombres = Array.from(document.querySelectorAll('#view-week .day-name')).map(el => ({
    dentro: dentroDe(el, el.closest('.day-header')),
  }));
  const insignias = Array.from(document.querySelectorAll('#view-week .task-badge')).map(el => ({
    dentro: dentroDe(el, el.closest('.day-cell')),
  }));
  return [...nombres, ...insignias];
});

/** El día que tiene el foco. */
const diaConFoco = () => browser.execute(
  () => document.activeElement?.querySelector('.day-name')?.textContent?.trim() ?? '',
);

/** Abre la vista Semana y espera a que sus 7 días estén pintados.
 *
 *  Se abre con el atajo Alt+2 (no con el menú lateral): en el móvil
 *  el menú está plegado y el clic no llega al botón. */
async function abrirSemana() {
  await navegarVistaAlt(2);
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelectorAll('#view-week .day-cell').length === 7,
    ),
    { timeout: 10_000, timeoutMsg: 'La vista Semana no pintó 7 días' },
  );
}

describe('Vista Semana: rejilla de 7 columnas en pantallas anchas', () => {

  before(async () => {
    await abrirAppNueva();
    // Una tarea diaria: sale todos los días desde hoy, así que las
    // columnas tienen contenido que ver.
    await crearTarea('Beber agua', 'daily');
  });

  it('a 1280 px los 7 días son columnas y se ve el contenido de todos', async () => {
    await ventanaEscritorio(1280, 800);
    await abrirSemana();

    const c = await celdas();
    expect(c.length).toBe(7);

    // Las 7 celdas están en la misma fila: la misma arriba y la
    // izquierda creciendo de día en día.
    const arriba = c[0].top;
    c.forEach((celda, i) => {
      expect(celda.top).toBe(arriba);
      if (i > 0) expect(celda.left).toBeGreaterThan(c[i - 1].left);
    });

    // Y todas están abiertas: se ve el contenido de cada día.
    c.forEach(celda => {
      expect(celda.alto).toBeGreaterThan(0);
      expect(celda.expandida).toBe('true');
    });

    // Las insignias de las tareas caben dentro de su columna.
    const insignias = c.flatMap(celda => celda.insignias);
    expect(insignias.length).toBeGreaterThan(0);
    insignias.forEach(insignia => {
      expect(insignia.ancho).toBeGreaterThan(0);
      expect(insignia.dentro).toBe(true);
    });
  });

  it('a 390 px los días se apilan: el acordeón de siempre, solo hoy abierto', async () => {
    await ventanaMovil(390, 844);
    await abrirSemana();

    const c = await celdas();
    expect(c.length).toBe(7);

    // Apilados: la misma izquierda y la arriba bajando de día en día.
    const izquierda = c[0].left;
    c.forEach((celda, i) => {
      expect(celda.left).toBe(izquierda);
      if (i > 0) expect(celda.top).toBeGreaterThan(c[i - 1].top);
    });

    // Solo el de hoy está abierto; los demás, plegados.
    const abiertos = c.filter(celda => celda.alto > 0);
    expect(abiertos.length).toBe(1);
    const expandidos = c.filter(celda => celda.expandida === 'true');
    expect(expandidos.length).toBe(1);
  });

  it('el teclado mueve el foco entre días en rejilla y en acordeón', async () => {
    // En rejilla (1280 px) los días son columnas: la flecha derecha va
    // al día siguiente y la izquierda al anterior.
    await ventanaEscritorio(1280, 800);
    await abrirSemana();
    await browser.execute(() => {
      document.querySelector('#view-week .day-header').focus();
    });
    expect(await diaConFoco()).toBe('Lunes');

    await browser.keys([Key.ArrowRight]);
    expect(await diaConFoco()).toBe('Martes');
    await browser.keys([Key.ArrowRight]);
    expect(await diaConFoco()).toBe('Miércoles');
    await browser.keys([Key.ArrowLeft]);
    expect(await diaConFoco()).toBe('Martes');

    // En acordeón (390 px) los días van uno debajo de otro: la flecha
    // abajo va al día siguiente.
    await ventanaMovil(390, 844);
    await abrirSemana();
    await browser.execute(() => {
      document.querySelector('#view-week .day-header').focus();
    });
    expect(await diaConFoco()).toBe('Lunes');

    await browser.keys([Key.ArrowDown]);
    expect(await diaConFoco()).toBe('Martes');
    await browser.keys([Key.ArrowUp]);
    expect(await diaConFoco()).toBe('Lunes');
  });

  it('con letra al 200 % no hay desbordamiento horizontal ni a 1280 ni a 390 px', async () => {
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

    for (const ancho of [1280, 390]) {
      if (ancho === 1280) await ventanaEscritorio(1280, 800);
      else                await ventanaMovil(390, 844);
      await abrirSemana();

      // Ni la página ni la columna de contenido desbordan (el cuerpo
      // tiene overflow-x:hidden, así que el que de verdad desplaza es
      // .content).
      const medidas = await browser.execute(() => {
        const doc = document.documentElement;
        const content = document.querySelector('.content');
        return {
          doc:     doc.scrollWidth - doc.clientWidth,
          content: content ? content.scrollWidth - content.clientWidth : 0,
        };
      });
      expect(medidas.doc).toBeLessThanOrEqual(1);
      expect(medidas.content).toBeLessThanOrEqual(1);

      // El texto se parte dentro de su columna: no se sale ni queda
      // recortado.
      const textos = await textosEnSusCajas();
      expect(textos.length).toBeGreaterThan(0);
      textos.forEach(t => {
        expect(t.dentro).toBe(true);
      });
    }
  });
});
