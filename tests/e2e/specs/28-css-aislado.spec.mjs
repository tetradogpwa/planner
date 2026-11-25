// T-063: el CSS de cada tarjeta va aislado.
//
// Cada tarjeta inyecta su CSS en el documento (una etiqueta <style> por
// tipo de tarjeta, en ui/base-card.js), así que las reglas de dos
// tarjetas conviven en la misma hoja de estilos. Antes de T-063, la de
// Tareas (.switch, .slider, .switch-row en
// ui/taskManager/taskManager-card.css) y la de Ajustes (las mismas
// clases, con otros valores, en ui/settings/settings-card.css) se
// pisaban: el interruptor "Gestionar" de la vista Tareas cambiaba de
// aspecto (de tamaño y de color) según si antes se había pasado por
// Ajustes › Apariencia.
//
// Aquí se mide el interruptor como lo ve la persona: su tamaño, el
// color de la pista y el de la perilla, y el desplazamiento de la
// perilla. Se mide en la vista Tareas, se visita Ajustes › Apariencia,
// se vuelve a Tareas y se mide otra vez: las dos mediciones tienen que
// ser idénticas.

import { Key } from 'webdriverio';
import { abrirAppNueva, navegarVistaAlt, recargar } from '../helpers.mjs';

/** Lo que se ve del interruptor "Gestionar" de la vista Tareas. */
const medirInterruptor = () => browser.execute(() => {
  const caja = document.querySelector('#view-tasks .switch');
  const slider = caja?.querySelector('.slider');
  if (!caja || !slider) return null;
  const rc = caja.getBoundingClientRect();
  const cs = getComputedStyle(slider);
  const perilla = getComputedStyle(slider, '::before');
  return {
    caja:    { ancho: rc.width, alto: rc.height },
    slider:  { fondo: cs.backgroundColor, radio: cs.borderTopLeftRadius },
    perilla: {
      ancho: perilla.width ?? null,
      alto: perilla.height ?? null,
      fondo: perilla.backgroundColor ?? null,
      desplazamiento: perilla.transform ?? null,
    },
  };
});

/** Espera a que el interruptor deje de animarse.
 *
 *  El color y el desplazamiento de la perilla tienen transición (la
 *  pone el CSS), así que medirlos en mitad de la transición daría dos
 *  cifras distintas que no signifiquen nada. En vez de esperar un
 *  tiempo fijo, se espera a que dos lecturas seguidas coincidan. */
async function esperarAqueSeAsiente() {
  let anterior = null;
  await browser.waitUntil(
    async () => {
      const actual = await browser.execute(() => {
        const slider = document.querySelector('#view-tasks #editToggle + .slider');
        if (!slider) return null;
        const cs = getComputedStyle(slider);
        const perilla = getComputedStyle(slider, '::before');
        return `${cs.backgroundColor}|${perilla.transform}|${perilla.width}`;
      });
      const estable = actual !== null && actual === anterior;
      anterior = actual;
      return estable;
    },
    { timeout: 5_000, timeoutMsg: 'El interruptor no dejó de animarse' },
  );
}

/** Mide el interruptor y comprueba que la medición sale. */
async function medirYaAsentado() {
  await esperarAqueSeAsiente();
  const medida = await medirInterruptor();
  expect(medida).not.toBeNull();
  return medida;
}

describe('El CSS de cada tarjeta va aislado', () => {

  before(async () => {
    await abrirAppNueva();
  });

  it('el interruptor "Gestionar" mide lo mismo antes y después de visitar Ajustes › Apariencia', async () => {
    const antes = await medirYaAsentado();

    // Se visita Ajustes › Apariencia (su tarjeta inyecta su CSS en el
    // documento) y se vuelve a Tareas.
    await navegarVistaAlt(6);
    await navegarVistaAlt(1);

    const despues = await medirYaAsentado();

    expect(despues).toEqual(antes);
  });

  it('el interruptor "Gestionar" encendido se ve igual antes y después de visitar Ajustes › Apariencia', async () => {
    // La app se recarga para empezar de cero: el CSS de Ajustes no
    // puede estar ya en el documento (si lo estuviera, la medición "de
    // antes" mediría un interruptor al que ya le han aplicado las
    // reglas de Ajustes y no se compararía nada).
    await recargar();

    // Se enciende el interruptor (clic en el slider, como una persona:
    // el <input> está oculto y lo que se pulsa es la perilla).
    const slider = await $('#editToggle + .slider');
    await slider.scrollIntoView();
    await slider.click();
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.getElementById('editToggle')?.checked === true,
      ),
      { timeout: 5_000, timeoutMsg: 'El interruptor "Gestionar" no se encendió' },
    );

    const antes = await medirYaAsentado();

    await navegarVistaAlt(6);
    await navegarVistaAlt(1);

    const despues = await medirYaAsentado();

    expect(despues).toEqual(antes);
  });

  it('las teclas de la intro del diálogo se ven como tecla', async () => {
    // La intro del diálogo de ayuda ("La tecla ? abre esta ayuda desde
    // cualquier pantalla; Esc la cierra") está en
    // ui/shortcuts/shortcuts-card.html. Con la regla global `kbd` de
    // index.css sus dos <kbd> se ven encuadradas como tecla, igual
    // que las de la lista. Aquí se mide el aspecto real de esa tecla
    // para que el cambio no se cuele sin que nadie lo mire: si la
    // regla global se quitara, el <kbd> saldría como texto plano
    // (display: inline, sin borde, sin fondo) y esta prueba fallaría.
    await browser.execute(() => {
      document.querySelector('button.nav-item[data-view="tasks"]')?.focus();
    });
    await browser.keys([Key.Shift, '/']);
    await $('#shortcuts-modal').waitForDisplayed();

    const intro = await browser.execute(() => {
      const kbd = document.querySelector('#shortcuts-modal .shortcuts-intro kbd');
      if (!kbd) return null;
      const cs = getComputedStyle(kbd);
      return {
        texto:   kbd.textContent.trim(),
        display: cs.display,
        borde:   cs.borderTopStyle,
        grosor:  cs.borderTopWidth,
        fondo:   cs.backgroundColor,
        fuente:  cs.fontFamily,
      };
    });

    expect(intro).not.toBeNull();
    expect(intro.texto).toBe('?');
    expect(intro.display).toBe('inline-block');
    expect(intro.borde).toBe('solid');
    expect(intro.grosor).toBe('1px');
    expect(intro.fondo).not.toBe('rgba(0, 0, 0, 0)');
    expect(intro.fuente).toContain('ui-monospace');

    // Se cierra el diálogo (como una persona, con Escape) para no
    // dejar nada encima de la app.
    await browser.keys(Key.Escape);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.getElementById('shortcuts-modal')?.hidden === true,
      ),
      { timeout: 3_000, timeoutMsg: 'El diálogo de ayuda no se cerró con Escape' },
    );
  });
});
