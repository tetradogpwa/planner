// T-050: marcar las apariciones de una tarea como hechas en la vista
// Semana.
//
// Cada aparición (una tarea en un día, y su número de vez si la tarea
// tiene más de una vez al día) tiene una casilla: al marcarla, la
// tarea queda hecha, el día cuenta cuántas lo están ("2/5 hechas") y
// la hecha se ve tachada. La marca se guarda (sobrevive a recargar la
// app) y se puede quitar.
//
// El recorrido:
//   1. Marcar la casilla del día de hoy: el contador del día sube, la
//      insignia se tacha y el cambio se anuncia en una región
//      role="status".
//   2. Recargar la app: la tarea sigue hecha.
//   3. Desmarcar: la tarea vuelve a estar pendiente (y sigue así
//      después de recargar).
//   4. Una tarea con dos veces al día tiene dos casillas y cada una
//      tiene su propia marca.
//   5. La tarea hecha se ve tachada y mantiene el contraste AA en los
//      temas claro, oscuro y de alto contraste.

import {
  abrirAppNueva,
  crearTarea,
  irASemana,
  irATareas,
  navegarVistaAlt,
  recargar,
} from '../helpers.mjs';

/** La celda del día de hoy en la vista Semana. */
const celdaDeHoy = () => $('#view-week .day-cell.is-today');

/** Las casillas de una celda (una por aparición). */
const casillasDe = (celda) => celda.$$('.task-check');

/** El texto del contador de hechas de una celda ("2/5 hechas"). */
const progresoDe = async (celda) => (await celda.$('.day-progress').getText()).trim();

/** Lo que la app ha dejado en la región role="status" global. */
const anuncio = () => browser.execute(
  () => document.getElementById('plannerStatus')?.textContent?.trim() ?? '',
);

/** Elige un tema de la lista de Ajustes › Apariencia (como una
 *  persona: clic sobre el radio). */
async function elegirTema(radioValue) {
  await navegarVistaAlt(6);
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelectorAll('input[name="theme"]').length > 0,
    ),
    { timeout: 5_000, timeoutMsg: 'Los radios de Tema no se han pintado' },
  );
  await $(`input[name="theme"][value="${radioValue}"]`).click();
  await browser.waitUntil(
    async () => await browser.execute(
      (v) => document.querySelector(`input[name="theme"][value="${v}"]`)?.checked === true,
      radioValue,
    ),
    { timeout: 5_000, timeoutMsg: `El tema ${radioValue} no quedó marcado` },
  );
}

/** El contraste (WCAG) entre el texto de un elemento y su fondo real
 *  (componiendo las capas translúcidas) y si se ve tachado. */
const aspectoDe = (selector) => browser.execute((sel) => {
  const analizar = (color) => {
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const encima = (capa, fondo) => {
    const a = capa.a;
    return {
      r: capa.r * a + fondo.r * (1 - a),
      g: capa.g * a + fondo.g * (1 - a),
      b: capa.b * a + fondo.b * (1 - a),
      a: 1,
    };
  };
  const luminancia = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };

  const el = document.querySelector(sel);
  if (!el) return null;
  const estilos = getComputedStyle(el);

  // El fondo real: se componen las capas desde el <html> hacia abajo
  // (la del elemento está encima).
  const cadena = [];
  for (let nodo = el; nodo; nodo = nodo.parentElement) cadena.push(nodo);
  let fondo = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = cadena.length - 1; i >= 0; i--) {
    const capa = analizar(getComputedStyle(cadena[i]).backgroundColor);
    if (!capa || capa.a === 0) continue;
    fondo = encima(capa, fondo);
  }

  const texto = analizar(estilos.color);
  const l1 = luminancia(texto);
  const l2 = luminancia(fondo);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return {
    ratio: (hi + 0.05) / (lo + 0.05),
    tachado: estilos.textDecorationLine,
    texto: estilos.color,
  };
}, selector);

describe('Marcar las tareas como hechas en la vista Semana (T-050)', () => {

  before(async () => {
    await abrirAppNueva();
    await crearTarea('Leer', 'daily');
  });

  it('la casilla del día marca la tarea como hecha y la cabecera cuenta las hechas', async () => {
    await irASemana();

    const celda = await celdaDeHoy();
    const casillas = await casillasDe(celda);
    expect(casillas.length).toBe(1);

    // Antes de marcar, el día no tiene ninguna hecha.
    expect(await progresoDe(celda)).toBe('0/1 hechas');

    await casillas[0].click();

    await browser.waitUntil(
      async () => (await progresoDe(celda)) === '1/1 hechas',
      { timeout: 5_000, timeoutMsg: 'El día no llegó a "1/1 hechas"' },
    );

    // La casilla está marcada.
    expect(await casillas[0].isSelected()).toBe(true);
  });

  it('la hecha se ve tachada y el cambio se anuncia en una región role="status"', async () => {
    // El tachón: el estado no depende solo del color.
    const insignia = await aspectoDe('#view-week .day-cell.is-today .task-badge');
    expect(insignia.tachado).toContain('line-through');

    // El contador del día es una región role="status": al cambiar, se
    // anuncia.
    const rol = await browser.execute(
      () => document.querySelector('#view-week .day-cell.is-today .day-progress')
        ?.getAttribute('role') ?? '',
    );
    expect(rol).toBe('status');

    // Y la app deja el aviso del cambio en la región role="status"
    // global (lo que lee el lector de pantalla).
    const rolGlobal = await browser.execute(
      () => document.getElementById('plannerStatus')?.getAttribute('role') ?? '',
    );
    expect(rolGlobal).toBe('status');
    await browser.waitUntil(
      async () => (await anuncio()).includes('marcada como hecha'),
      { timeout: 5_000, timeoutMsg: 'El cambio no se ha anunciado en la región role="status"' },
    );
  });

  it('la marca sobrevive a recargar la app', async () => {
    expect(await recargar()).toBe('app');
    await irASemana();

    const celda = await celdaDeHoy();
    const casillas = await casillasDe(celda);
    expect(casillas.length).toBe(1);
    expect(await casillas[0].isSelected()).toBe(true);
    expect(await progresoDe(celda)).toBe('1/1 hechas');
  });

  it('desmarcar la devuelve a pendiente (y sigue así tras recargar)', async () => {
    await irASemana();
    const celda = await celdaDeHoy();
    const casillas = await casillasDe(celda);

    await casillas[0].click();
    await browser.waitUntil(
      async () => (await progresoDe(celda)) === '0/1 hechas',
      { timeout: 5_000, timeoutMsg: 'El día no llegó a "0/1 hechas"' },
    );
    expect(await casillas[0].isSelected()).toBe(false);

    // Y recargar no la vuelve a poner como hecha.
    expect(await recargar()).toBe('app');
    await irASemana();
    const trasRecargar = await celdaDeHoy();
    expect(await (await casillasDe(trasRecargar))[0].isSelected()).toBe(false);
    expect(await progresoDe(trasRecargar)).toBe('0/1 hechas');
  });

  it('borrar la tarea borra también sus marcas', async () => {
    // La marca vive con la tarea: si la tarea no está, su marca tampoco.
    await irASemana();
    let celda = await celdaDeHoy();
    await (await casillasDe(celda))[0].click();
    await browser.waitUntil(
      async () => (await progresoDe(celda)) === '1/1 hechas',
      { timeout: 5_000, timeoutMsg: 'No se pudo marcar la tarea antes de borrarla' },
    );

    // El id de la tarea marcada (para comprobar que su marca se va).
    const id = await browser.execute(() => window.PlannerApi.listTasks()[0]?.id ?? '');
    expect(id).not.toBe('');

    // Se borra la tarea desde la lista de Tareas (con "Gestionar" encendido,
    // que es lo que deja ver el botón de eliminar).
    await irATareas();
    if (!(await $('#editToggle').isSelected())) {
      const slider = await $('#editToggle + .slider');
      await slider.scrollIntoView();
      await slider.click();
    }
    await browser.waitUntil(
      async () => await browser.execute(() => {
        const btn = document.querySelector('#taskListMount .btn-trash');
        return !!btn && getComputedStyle(btn).display !== 'none';
      }),
      { timeout: 5_000, timeoutMsg: 'El botón de eliminar no apareció' },
    );
    await $('#taskListMount .btn-trash').click();

    // La vista Semana solo pinta los siete días si hay tareas: sin
    // ninguna muestra el estado vacío (T-056). Creamos una tarea que
    // cae en otro día (una sola vez, en el futuro) para que la semana
    // siga pintando los días y se pueda comprobar que el de hoy queda
    // vacío.
    await $('#taskName').setValue('Más tarde');
    await $('input[name="repeat"][value="no-repeat"]').click();
    await $('#taskDate').setValue('2099-01-01');
    await $('#addTaskBtn').click();

    // El día ya no tiene esa tarea...
    await irASemana();
    celda = await celdaDeHoy();
    expect((await casillasDe(celda)).length).toBe(0);
    expect(await progresoDe(celda)).toBe('');

    // ...y su marca se ha borrado con ella (si se quedara, la tarea
    // volvería como ya hecha al importarla otra vez).
    const marcas = await browser.execute(() => localStorage.getItem('Context_MARKS'));
    expect(marcas === null || !marcas.includes(id)).toBe(true);
  });

  describe('una tarea con más de una vez al día', () => {
    before(async () => {
      await irATareas();
      await $('#taskName').setValue('Doble');
      await $('#timesPerDay').setValue('2');
      await $('input[name="repeat"][value="daily"]').click();
      await $('#addTaskBtn').click();
    });

    it('cada vez tiene su propia casilla y su propia marca', async () => {
      await irASemana();
      const celda = await celdaDeHoy();
      const casillas = await casillasDe(celda);

      // Dos apariciones de «Doble» (la vez 1/2 y la vez 2/2).
      expect(casillas.length).toBe(2);
      expect(await progresoDe(celda)).toBe('0/2 hechas');

      await casillas[0].click();
      await browser.waitUntil(
        async () => (await progresoDe(celda)) === '1/2 hechas',
        { timeout: 5_000, timeoutMsg: 'El día no llegó a "1/2 hechas"' },
      );

      // La otra vez sigue sin marcar: son marcas distintas.
      expect(await casillas[0].isSelected()).toBe(true);
      expect(await casillas[1].isSelected()).toBe(false);

      // Y tras recargar, la marca de la primera vez sigue ahí.
      expect(await recargar()).toBe('app');
      await irASemana();
      const trasRecargar = await celdaDeHoy();
      const casillas2 = await casillasDe(trasRecargar);
      expect(await casillas2[0].isSelected()).toBe(true);
      expect(await casillas2[1].isSelected()).toBe(false);
      expect(await progresoDe(trasRecargar)).toBe('1/2 hechas');
    });
  });

  describe('la tarea hecha con contraste AA en cada tema', () => {
    const TEMAS = ['dark', 'light', 'contrast-light', 'contrast-dark'];

    for (const tema of TEMAS) {
      it(`la tarea hecha mantiene el contraste AA en el tema "${tema}"`, async () => {
        await elegirTema(tema);
        await irASemana();

        const celda = await celdaDeHoy();
        const casillas = await casillasDe(celda);
        expect(casillas.length).toBeGreaterThan(0);
        if (!(await casillas[0].isSelected())) await casillas[0].click();

        // La insignia de la hecha: tachada y con contraste AA (4.5:1)
        // sobre su fondo real.
        const hecha = await aspectoDe('#view-week .day-cell.is-today .task-item.is-done .task-badge');
        expect(hecha).not.toBeNull();
        expect(hecha.tachado).toContain('line-through');
        expect(hecha.ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});
