// Recorrido de la pestaña "Accesibilidad" de Ajustes (T-022): se
// llega desde el menú (Ajustes) y con Alt+8 (que abre directamente la
// pestaña Accesibilidad). La pestaña monta la lista compartida de
// atajos (ui/shortcuts/shortcuts-list.html) por debajo de los bloques
// de letra general, tamaños por partes y tamaño de los iconos del
// menú contraído en pantallas táctiles. También comprueba que abrir
// el diálogo "?" sobre la pestaña no duplica ids en el documento.

import { Key } from 'webdriverio';
import { aceptarTerminos } from '../helpers.mjs';

describe('Pestaña Accesibilidad de Ajustes', () => {
  before(async () => {
    await aceptarTerminos();
  });

  it('el menú lateral tiene la opción "Ajustes" tras Todas semanas', async () => {
    const items = await $$('.nav-item[data-view]').map(b => b.getAttribute('data-view'));
    const idxTasks = items.indexOf('tasks');
    expect(idxTasks).toBeGreaterThanOrEqual(0);
    // Ajustes es la única entrada del menú tras el divisor.
    expect(items).toContain('ajustes');
    expect(items).not.toContain('data');
    expect(items).not.toContain('print');
    expect(items).not.toContain('settings');
    expect(items).not.toContain('legal');
    expect(items).not.toContain('accessibility');
    // El icono de "Ajustes" es decorativo.
    const navBtn = await $('button.nav-item[data-view="ajustes"]');
    await expect(navBtn.$('.nav-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('al pulsar Alt+8 con el diálogo aún sin abrir, la pestaña Accesibilidad se ve con estilos', async () => {
    // Nos aseguramos de no tener el diálogo de ayuda abierto (si un
    // test anterior lo hubiera dejado, su CSS taparía los selectores
    // que queremos comprobar ahora).
    await browser.execute(() => {
      const help = document.getElementById('shortcuts-modal');
      if (help) help.hidden = true;
    });

    await browser.keys([Key.Alt, '8']);
    // La pestaña activa debe ser "accessibility" y su panel visible.
    await browser.waitUntil(
      async () => await browser.execute(
        () => {
          const tab = document.querySelector('.ajustes-tab[data-tab="accessibility"]');
          const panel = document.getElementById('ajustes-panel-accessibility');
          return tab?.getAttribute('aria-selected') === 'true'
            && panel && !panel.hidden;
        },
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Accesibilidad no quedó activa tras Alt+8' },
    );

    // aria-current="page" en el botón del menú Ajustes.
    const ariaCurrent = await $('button.nav-item[data-view="ajustes"]').getAttribute('aria-current');
    expect(ariaCurrent).toBe('page');

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
      const root = document.getElementById('ajustes-panel-accessibility');
      const dtTexts = Array.from(root.querySelectorAll('dt')).map(el => el.textContent.trim());
      return dtTexts.join('\n');
    });
    for (let n = 1; n <= 8; n++) {
      expect(items).toContain(`Alt + ${n}`);
    }
    expect(items).toContain('?');
  });

  it('los tamaños de letra están en Accesibilidad y NO en Apariencia', async () => {
    // Pestaña Accesibilidad: textScale presente.
    const enAccesibilidad = await browser.execute(() => {
      const panel = document.getElementById('ajustes-panel-accessibility');
      return panel?.querySelectorAll('input[name="textScale"]').length > 0;
    });
    expect(enAccesibilidad).toBe(true);

    // Cambiamos a Apariencia y comprobamos que NO está.
    await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="appearance"]');
      tab?.click();
    });
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-appearance')?.hidden === false,
      ),
      { timeout: 3_000, timeoutMsg: 'La pestaña Apariencia no quedó visible' },
    );
    const enApariencia = await browser.execute(() => {
      const panel = document.getElementById('ajustes-panel-appearance');
      return panel?.querySelectorAll('input[name="textScale"]').length > 0;
    });
    expect(enApariencia).toBe(false);
  });

  it('abrirla desde el menú lateral funciona igual', async () => {
    // Volvemos a Tareas y luego clicamos el botón del menú Ajustes.
    await browser.keys([Key.Alt, '1']);
    await $('#view-tasks-heading').waitForDisplayed();
    const navBtn = await $('button.nav-item[data-view="ajustes"]');
    await navBtn.click();
    // La pestaña por defecto al abrir Ajustes desde el menú es
    // Apariencia; saltamos a Accesibilidad con clic.
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-appearance')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'Ajustes no se abrió en Apariencia al clicar el menú' },
    );
    await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="accessibility"]');
      tab?.click();
    });
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-accessibility')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Accesibilidad no se abrió al clicar su pestaña' },
    );
    const ariaCurrent = await navBtn.getAttribute('aria-current');
    expect(ariaCurrent).toBe('page');
  });

  it('la vista Legal ya no tiene el botón "Atajos de teclado"', async () => {
    // Saltamos a la pestaña Legal y comprobamos que el botón se ha
    // eliminado (el atajo se quedó en la pestaña Accesibilidad, no
    // en Legal).
    await browser.keys([Key.Alt, '7']);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-legal')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Legal no se abrió tras Alt+7' },
    );
    const boton = await $('#legal-shortcuts-btn');
    expect(await boton.isExisting()).toBe(false);
  });

  it('con la pestaña abierta, abrir "?" monta el diálogo sin ids duplicados', async () => {
    // Saltamos a Accesibilidad para tener la lista inyectada y,
    // sobre ella, abrimos el diálogo modal con '?'. El HTML
    // compartido (shortcuts-list.html) NO debe llevar ids en los <h4>
    // ni aria-labelledby en los <section>: si los llevara, quedarían
    // duplicados y los aria-labelledby apuntarían al primer nodo, no
    // al del propio diálogo.
    await browser.keys([Key.Alt, '8']);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-accessibility')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Accesibilidad no se abrió tras Alt+8' },
    );
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('#accessibility-shortcuts dt').length > 0,
      ),
      { timeout: 5_000, timeoutMsg: 'La lista de atajos no se inyectó en la pestaña' },
    );

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