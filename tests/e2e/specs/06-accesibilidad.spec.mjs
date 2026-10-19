// Recorrido de la vista "Accesibilidad": se llega desde el menú y con
// Alt+8, el encabezado recibe el foco, lleva aria-current, la lista
// contiene los atajos Alt+1…Alt+8 y '?', la lista sale con estilos
// aunque no se haya abierto antes el diálogo '?' y, al abrir el diálogo
// con la vista montada, no quedan ids duplicados en el documento.
// También comprueba que la vista Legal ya no tiene el botón "Atajos
// de teclado".

import { Key } from 'webdriverio';
import { aceptarTerminos } from '../helpers.mjs';

describe('Vista Accesibilidad', () => {
  before(async () => {
    await aceptarTerminos();
  });

  it('el menú lateral tiene la opción "Accesibilidad" tras "Legal y privacidad"', async () => {
    const items = await $$('.nav-item[data-view]').map(b => b.getAttribute('data-view'));
    const idxLegal = items.indexOf('legal');
    expect(idxLegal).toBeGreaterThanOrEqual(0);
    expect(items[idxLegal + 1]).toBe('accessibility');
    // El icono es decorativo (los lectores de pantalla no lo leen).
    const navBtn = await $('button.nav-item[data-view="accessibility"]');
    await expect(navBtn.$('.nav-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('al pulsar Alt+8 con el diálogo aún sin abrir, la vista se ve con estilos', async () => {
    // Nos aseguramos de no tener el diálogo de ayuda abierto (si un
    // test anterior lo hubiera dejado, su CSS taparía los selectores
    // que queremos comprobar ahora).
    await browser.execute(() => {
      const help = document.getElementById('shortcuts-modal');
      if (help) help.hidden = true;
    });

    await browser.keys([Key.Alt, '8']);
    await $('#view-accessibility').waitForDisplayed();

    // aria-current="page" en el botón del menú.
    const ariaCurrent = await $('button.nav-item[data-view="accessibility"]').getAttribute('aria-current');
    expect(ariaCurrent).toBe('page');

    // El encabezado de la vista activa queda enfocado.
    const heading = await $('#view-accessibility-heading');
    await expect(heading).toBeDisplayed();
    const focusedId = await browser.execute(() => document.activeElement?.id);
    expect(focusedId).toBe('view-accessibility-heading');

    // Lista en cuadrícula (reglas de ui/shortcuts/shortcuts-list.css
    // inyectadas por accessibility-card.js aunque el diálogo '?' aún
    // no se haya abierto).
    const displayList = await browser.execute(() => {
      const el = document.querySelector('#accessibility-shortcuts .shortcuts-list');
      return el ? getComputedStyle(el).display : '';
    });
    expect(displayList).toBe('grid');

    // Los <kbd> llevan borde (regla de .shortcuts-list kbd en
    // shortcuts-list.css). Si la lista no tuviera estilos, sería 'none'.
    const kbdBorder = await browser.execute(() => {
      const el = document.querySelector('#accessibility-shortcuts kbd');
      if (!el) return '';
      const s = getComputedStyle(el);
      return s.borderTopStyle || s.borderStyle || '';
    });
    expect(kbdBorder).toBe('solid');
  });

  it('la lista contiene los atajos Alt+1…Alt+8 y "?"', async () => {
    // El HTML de la lista lo carga el accessibility-card desde
    // shortcuts-list.html (compartido con el diálogo de ayuda).
    const items = await browser.execute(() => {
      const root = document.getElementById('view-accessibility');
      const dtTexts = Array.from(root.querySelectorAll('dt')).map(el => el.textContent.trim());
      // Concatenamos para admitir combinaciones como "Alt + 1" sin
      // depender del orden de los nodos <kbd>.
      return dtTexts.join('\n');
    });
    for (let n = 1; n <= 8; n++) {
      expect(items).toContain(`Alt + ${n}`);
    }
    expect(items).toContain('?');
  });

  it('abrirla desde el menú lateral funciona igual', async () => {
    // Volvemos a otra vista y luego clicamos el botón del menú.
    await browser.keys([Key.Alt, '1']);
    await $('#view-tasks-heading').waitForDisplayed();
    const navBtn = await $('button.nav-item[data-view="accessibility"]');
    await navBtn.click();
    await $('#view-accessibility-heading').waitForDisplayed();
    const ariaCurrent = await navBtn.getAttribute('aria-current');
    expect(ariaCurrent).toBe('page');
  });

  it('la vista Legal ya no tiene el botón "Atajos de teclado"', async () => {
    // Volvemos a Legal y comprobamos que el botón se ha eliminado
    // (el atajo se ha movido al menú Accesibilidad, no a otro sitio).
    await browser.keys([Key.Alt, '7']);
    await $('#view-legal-heading').waitForDisplayed();
    const boton = await $('#legal-shortcuts-btn');
    expect(await boton.isExisting()).toBe(false);
  });

  it('con la vista abierta, abrir "?" monta el diálogo sin ids duplicados', async () => {
    // Volvemos a la vista Accesibilidad para tener la lista inyectada
    // y, sobre ella, abrimos el diálogo modal con '?'. El HTML
    // compartido (shortcuts-list.html) NO debe llevar ids en los <h4>
    // ni aria-labelledby en los <section>: si los llevara, quedarían
    // duplicados y los aria-labelledby apuntarían al primer nodo, no
    // al del propio diálogo.
    await browser.keys([Key.Alt, '8']);
    await $('#view-accessibility-heading').waitForDisplayed();
    await $('#accessibility-shortcuts').waitForDisplayed();

    // Abrimos el diálogo de ayuda.
    await browser.keys([Key.Shift, '/']);
    await $('#shortcuts-modal').waitForDisplayed();

    // Comprobamos que todos los ids del documento son únicos.
    const dup = await browser.execute(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map(e => e.id);
      const counts = {};
      ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      return Object.entries(counts).filter(([, n]) => n > 1).map(([id]) => id);
    });
    expect(dup).toEqual([]);

    // El diálogo también contiene la lista compartida, incluido Alt+8.
    const items = await browser.execute(() => {
      const dtTexts = Array.from(document.querySelectorAll('#shortcuts-modal dt')).map(el => el.textContent.trim());
      return dtTexts.join('\n');
    });
    expect(items).toContain('Alt + 8');

    // Cerramos con Escape para no contaminar otras specs.
    await browser.keys(Key.Escape);
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.getElementById('shortcuts-modal').hidden,
      )) === true,
      { timeout: 3_000, timeoutMsg: 'El diálogo de ayuda no se cerró con Escape' },
    );
  });
});