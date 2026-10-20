// Recorrido de la vista Ajustes y sus pestañas (T-022):
//
//   1. El menú lateral tiene solo "Ajustes" (icono ⚙️ aria-hidden)
//      tras el divisor. Desaparecen "Gestión datos", "Imprimir / PDF",
//      "Apariencia", "Legal y privacidad" y "Accesibilidad".
//
//   2. Al pulsar el botón Ajustes del menú, se abre la pestaña
//      Apariencia y el foco va al encabezado #view-ajustes-heading.
//
//   3. Las pestañas tienen el patrón ARIA tablist: role=tablist en
//      la barra, role=tab con aria-selected en cada pestaña, role=tabpanel
//      con aria-labelledby en cada panel. tabindex itinerante: solo la
//      pestaña activa tiene tabindex=0.
//
//   4. Cada pestaña muestra un contenido distinto: al menos un
//      elemento propio (el selector que comprueba cada pestaña se ha
//      elegido del HTML interno de la tarjeta correspondiente, no del
//      tablist).
//
//   5. Flecha izquierda/derecha, Inicio y Fin cambian de pestaña y
//      mueven el foco al tab nuevo (no al panel).
//
//   6. Alt+4…Alt+8 abren Ajustes directamente en la pestaña correcta
//      y enfocan la pestaña activa (no el encabezado).
//
//   7. PlannerApi.navigate acepta los alias heredados (data, print,
//      legal, accessibility, settings) y abre Ajustes en la pestaña
//      correspondiente. listViews devuelve los nombres canónicos.
//
//   8. La pestaña Asistente (MCP) expone #mcpTitle, #mcpEnabled,
//      #mcpToken y los mismos selectores que la antigua sección de
//      ui/settings; el server sigue funcionando con el mismo flujo.

import { Key } from 'webdriverio';
import {
  abrirAppNueva,
  recargar,
  navegarVistaAlt,
} from '../helpers.mjs';

describe('Vista Ajustes con pestañas', () => {

  before(async () => {
    await abrirAppNueva();
  });

  // ── 1. Menú lateral: solo Ajustes tras el divisor ──────────────────

  it('el menú lateral tiene "Ajustes" tras el divisor y no las entradas antiguas', async () => {
    const items = await $$('.nav-item[data-view]').map(b => b.getAttribute('data-view'));
    expect(items).toContain('tasks');
    expect(items).toContain('week');
    expect(items).toContain('allWeeks');
    expect(items).toContain('ajustes');
    expect(items).not.toContain('data');
    expect(items).not.toContain('print');
    expect(items).not.toContain('settings');
    expect(items).not.toContain('legal');
    expect(items).not.toContain('accessibility');
    // Icono decorativo.
    const navBtn = await $('button.nav-item[data-view="ajustes"]');
    await expect(navBtn.$('.nav-icon')).toHaveAttribute('aria-hidden', 'true');
    // Etiqueta "Ajustes": el icono lleva aria-hidden y WebdriverIO
    // getText() lo salta, así que leemos el textContent del .nav-label
    // directamente. El botón sigue mostrando "Ajustes" como etiqueta
    // accesible y visual.
    const labelText = await browser.execute(() => {
      const btn = document.querySelector('button.nav-item[data-view="ajustes"]');
      return btn?.querySelector('.nav-label')?.textContent?.trim() ?? '';
    });
    expect(labelText).toBe('Ajustes');
  });

  // ── 2. Abrir Ajustes desde el menú enfoca el encabezado ────────────

  it('abrir Ajustes desde el menú muestra Apariencia y enfoca #view-ajustes-heading', async () => {
    // Volvemos a Tareas para que setView("ajustes") desde el menú
    // sea un cambio real de vista.
    await browser.keys([Key.Alt, '1']);
    await $('#view-tasks-heading').waitForDisplayed();

    const navBtn = await $('button.nav-item[data-view="ajustes"]');
    await navBtn.click();
    await $('#view-ajustes-heading').waitForDisplayed();

    // aria-current="page" en el botón del menú.
    const ariaCurrent = await navBtn.getAttribute('aria-current');
    expect(ariaCurrent).toBe('page');

    // El encabezado de la vista recibe el foco.
    const focusedId = await browser.execute(() => document.activeElement?.id);
    expect(focusedId).toBe('view-ajustes-heading');

    // La pestaña Apariencia está seleccionada por defecto.
    const selected = await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="appearance"]');
      return tab?.getAttribute('aria-selected');
    });
    expect(selected).toBe('true');
  });

  // ── 3. Patrón ARIA tablist y tabindex itinerante ──────────────────

  it('la barra de pestañas sigue el patrón ARIA tablist', async () => {
    const tablist = await $('[role="tablist"]');
    await expect(tablist).toHaveAttribute('aria-label');

    // Cada pestaña tiene role=tab, aria-selected, aria-controls, tabindex.
    const tabs = await $$('.ajustes-tab');
    expect(tabs.length).toBeGreaterThanOrEqual(4);
    for (const tab of tabs) {
      await expect(tab).toHaveAttribute('role', 'tab');
      const controls = await tab.getAttribute('aria-controls');
      expect(controls).toMatch(/^ajustes-panel-/);
      const sel = await tab.getAttribute('aria-selected');
      expect(['true', 'false']).toContain(sel);
    }

    // Solo la pestaña activa tiene tabindex=0.
    const tabindexes = await browser.execute(() => {
      const tabs = Array.from(document.querySelectorAll('.ajustes-tab'));
      return tabs.map(t => ({
        tab:     t.dataset.tab,
        tabindex: t.getAttribute('tabindex'),
        selected: t.getAttribute('aria-selected'),
      }));
    });
    const activos = tabindexes.filter(t => t.tabindex === '0');
    expect(activos).toHaveLength(1);
    expect(activos[0].selected).toBe('true');

    // Cada panel tiene role=tabpanel y aria-labelledby apuntando a
    // su pestaña.
    const paneles = await browser.execute(() => {
      const ps = Array.from(document.querySelectorAll('.ajustes-panel'));
      return ps.map(p => ({
        id:       p.id,
        labelledby: p.getAttribute('aria-labelledby'),
        hidden:   p.hidden,
      }));
    });
    for (const p of paneles) {
      expect(p.labelledby).toBe(`ajustes-tab-${p.id.replace('ajustes-panel-', '')}`);
    }
    // Solo un panel está visible.
    const visibles = paneles.filter(p => !p.hidden);
    expect(visibles).toHaveLength(1);
  });

  // ── 4. Cada pestaña tiene contenido propio ─────────────────────────

  const checksPestanas = [
    { tab: 'appearance',   marker: 'input[name="theme"]',     titulo: 'Apariencia' },
    { tab: 'accessibility', marker: '#accessibility-shortcuts', titulo: 'Accesibilidad' },
    { tab: 'data',         marker: '#importJsonInput',         titulo: 'Datos' },
    { tab: 'print',        marker: '#printWeekBtn',            titulo: 'Imprimir y PDF' },
    { tab: 'legal',        marker: 'a[data-doc="PRIVACY"]',    titulo: 'Legal' },
  ];

  for (const { tab, marker, titulo } of checksPestanas) {
    it(`la pestaña "${titulo}" muestra su contenido propio`, async () => {
      await navegarVistaAlt(6); // Ajustes › Apariencia
      // Clic sobre la pestaña destino.
      await browser.execute(t => {
        const tabEl = document.querySelector(`.ajustes-tab[data-tab="${t}"]`);
        tabEl?.click();
      }, tab);
      await browser.waitUntil(
        async () => await browser.execute(
          t => !document.getElementById(`ajustes-panel-${t}`).hidden,
          tab,
        ),
        { timeout: 5_000, timeoutMsg: `La pestaña ${tab} no quedó visible` },
      );
      // El selector característico existe en el panel.
      const existe = await browser.execute(
        ({ tab, sel }) => document.querySelector(`#ajustes-panel-${tab} ${sel}`) !== null,
        { tab, sel: marker },
      );
      expect(existe).toBe(true);
    });
  }

  it('Borrar tareas está como último bloque de la pestaña Datos', async () => {
    await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="data"]');
      tab?.click();
    });
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-data')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Datos no se abrió' },
    );
    // El botón #clearAllBtn está dentro del último bloque (.export-row-danger)
    // de la pestaña Datos: comprobamos que viene después de #exportJsonBtn
    // y de #importJsonInput en el orden del DOM.
    const orden = await browser.execute(() => {
      const panel = document.getElementById('ajustes-panel-data');
      const ids = ['importJsonInput', 'exportJsonBtn', 'clearAllBtn'];
      return ids
        .map(id => ({ id, idx: panel.querySelector(`#${id}`)
          ? Array.from(panel.querySelectorAll('*')).indexOf(panel.querySelector(`#${id}`))
          : -1 }));
    });
    expect(orden[0].idx).toBeGreaterThanOrEqual(0);
    expect(orden[1].idx).toBeGreaterThanOrEqual(0);
    expect(orden[2].idx).toBeGreaterThanOrEqual(0);
    expect(orden[0].idx).toBeLessThan(orden[1].idx);
    expect(orden[1].idx).toBeLessThan(orden[2].idx);
  });

  it('la pestaña Accesibilidad contiene los tamaños de letra Y los atajos de teclado', async () => {
    await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="accessibility"]');
      tab?.click();
    });
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-accessibility')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Accesibilidad no se abrió' },
    );
    const tieneEscala = await browser.execute(() =>
      document.querySelectorAll('#ajustes-panel-accessibility input[name="textScale"]').length > 0
    );
    expect(tieneEscala).toBe(true);
    const tienePartes  = await browser.execute(() =>
      !!document.querySelector('#ajustes-panel-accessibility #sizesReset')
    );
    expect(tienePartes).toBe(true);
    const tieneIconos = await browser.execute(() =>
      !!document.querySelector('#ajustes-panel-accessibility #navIconSize')
    );
    expect(tieneIconos).toBe(true);
    const tieneAtajos  = await browser.execute(() =>
      document.querySelectorAll('#ajustes-panel-accessibility kbd').length > 0
    );
    expect(tieneAtajos).toBe(true);
  });

  it('la pestaña Apariencia NO contiene los tamaños de letra ni los atajos', async () => {
    await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="appearance"]');
      tab?.click();
    });
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-appearance')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Apariencia no se abrió' },
    );
    const noEscala = await browser.execute(() =>
      document.querySelectorAll('#ajustes-panel-appearance input[name="textScale"]').length === 0
    );
    expect(noEscala).toBe(true);
    const noAtajos = await browser.execute(() =>
      document.querySelectorAll('#ajustes-panel-appearance kbd').length === 0
    );
    expect(noAtajos).toBe(true);
  });

  // ── 5. Navegación por teclado entre pestañas ───────────────────────

  it('flechas izquierda/derecha, Inicio y Fin cambian de pestaña y mueven el foco', async () => {
    // Empezamos en Apariencia (pestaña por defecto al abrir Ajustes).
    await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="appearance"]');
      tab?.focus();
    });
    const inicio = await browser.execute(
      () => document.activeElement?.dataset?.tab || '',
    );
    expect(inicio).toBe('appearance');

    // Flecha derecha → Accesibilidad.
    await browser.keys(Key.ArrowRight);
    const trasDerecha = await browser.execute(
      () => document.activeElement?.dataset?.tab || '',
    );
    expect(trasDerecha).toBe('accessibility');
    await expect($('#ajustes-tab-accessibility')).toHaveAttribute('aria-selected', 'true');
    await expect($('#ajustes-panel-accessibility')).toBeDisplayed();

    // Inicio → primera pestaña visible (Apariencia, oculta la
    // Asistente MCP solo en esa build).
    await browser.keys(Key.Home);
    const trasInicio = await browser.execute(
      () => document.activeElement?.dataset?.tab || '',
    );
    expect(trasInicio).toBe('appearance');

    // Fin → última pestaña visible.
    await browser.keys(Key.End);
    const trasFin = await browser.execute(
      () => document.activeElement?.dataset?.tab || '',
    );
    const idxUltima = await browser.execute(() => {
      const tabs = Array.from(document.querySelectorAll('.ajustes-tab')).filter(t => !t.hidden);
      const t = tabs[tabs.length - 1];
      return t?.dataset.tab;
    });
    expect(trasFin).toBe(idxUltima);

    // Flecha izquierda desde la última vuelve hacia atrás.
    await browser.keys(Key.ArrowLeft);
    const trasIzquierda = await browser.execute(
      () => document.activeElement?.dataset?.tab || '',
    );
    expect(trasIzquierda).not.toBe(idxUltima);
  });

  // ── 6. Alt+4…Alt+8 abren la pestaña correcta y enfocan la pestaña ───

  const atajosPestana = [
    { n: 4, tab: 'data' },
    { n: 5, tab: 'print' },
    { n: 6, tab: 'appearance' },
    { n: 7, tab: 'legal' },
    { n: 8, tab: 'accessibility' },
  ];

  for (const { n, tab } of atajosPestana) {
    it(`Alt+${n} abre Ajustes en la pestaña "${tab}" y enfoca la pestaña`, async () => {
      // Volvemos a Tareas para que el atajo mueva de vista.
      await browser.keys([Key.Alt, '1']);
      await $('#view-tasks-heading').waitForDisplayed();
      await browser.keys([Key.Alt, String(n)]);

      await browser.waitUntil(
        async () => await browser.execute(
          t => !document.getElementById(`ajustes-panel-${t}`).hidden,
          tab,
        ),
        { timeout: 5_000, timeoutMsg: `Alt+${n} no abrió la pestaña ${tab}` },
      );
      // La pestaña está seleccionada.
      await expect($(`#ajustes-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
      // El foco está en la pestaña, no en el encabezado de la vista.
      const focusedTab = await browser.execute(t => {
        const tabEl = document.querySelector(`.ajustes-tab[data-tab="${t}"]`);
        return document.activeElement === tabEl;
      }, tab);
      expect(focusedTab).toBe(true);
    });
  }

  // ── 7. PlannerApi.navigate y listViews ─────────────────────────────

  it('PlannerApi.listViews devuelve las 4 vistas canónicas y listAjustesTabs las pestañas', async () => {
    const result = await browser.execute(() => ({
      views: window.PlannerApi.listViews(),
      tabs:  window.PlannerApi.listAjustesTabs(),
    }));
    expect(result.views).toEqual(
      expect.arrayContaining(['tasks', 'week', 'allWeeks', 'ajustes']),
    );
    expect(result.views).not.toContain('accessibility');
    expect(result.views).not.toContain('data');
    expect(result.tabs).toEqual(
      expect.arrayContaining(['data', 'print', 'legal', 'accessibility', 'appearance']),
    );
    expect(result.tabs).not.toContain('ajustes');
  });

  const aliasesNavigate = [
    { alias: 'data',         tab: 'data' },
    { alias: 'print',        tab: 'print' },
    { alias: 'legal',        tab: 'legal' },
    { alias: 'accessibility', tab: 'accessibility' },
    { alias: 'settings',     tab: 'appearance' },
  ];

  for (const { alias, tab } of aliasesNavigate) {
    it(`PlannerApi.navigate("${alias}") abre Ajustes en la pestaña "${tab}"`, async () => {
      // Volvemos a Tareas.
      await browser.execute(() => window.PlannerApi.navigate('tasks'));
      await $('#view-tasks-heading').waitForDisplayed();
      await browser.execute(a => window.PlannerApi.navigate(a), alias);
      await browser.waitUntil(
        async () => await browser.execute(
          t => !document.getElementById(`ajustes-panel-${t}`).hidden,
          tab,
        ),
        { timeout: 5_000, timeoutMsg: `navigate("${alias}") no abrió ${tab}` },
      );
      await expect($(`#ajustes-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
    });
  }

  it('PlannerApi.navigate("ajustes") abre Ajustes en la pestaña Apariencia (defecto)', async () => {
    await browser.execute(() => window.PlannerApi.navigate('tasks'));
    await $('#view-tasks-heading').waitForDisplayed();
    await browser.execute(() => window.PlannerApi.navigate('ajustes'));
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-appearance')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'navigate("ajustes") no abrió Apariencia' },
    );
    await expect($('#ajustes-tab-appearance')).toHaveAttribute('aria-selected', 'true');
  });

  it('PlannerApi.navigate("no-existe") lanza "Vista inválida"', async () => {
    await browser.execute(() => {
      try {
        window.PlannerApi.navigate('no-existe');
        window.__navigateOk = true;
        window.__navigateErr = null;
      } catch (e) {
        window.__navigateOk = false;
        window.__navigateErr = e.message;
      }
    });
    const result = await browser.execute(() => ({
      ok:  window.__navigateOk,
      err: window.__navigateErr,
    }));
    expect(result.ok).toBe(false);
    expect(result.err).toMatch(/Vista inválida/);
  });

  // ── 8. La pestaña Asistente (MCP) expone los mismos controles ──────

  it('la pestaña Asistente (MCP) expone #mcpTitle y los controles del servidor', async () => {
    await browser.execute(() => {
      const tab = document.querySelector('.ajustes-tab[data-tab="mcp"]');
      tab?.click();
    });
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-mcp')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Asistente (MCP) no se abrió' },
    );
    // #mcpTitle, #mcpEnabled, #mcpToken, #mcpPort existen dentro del panel.
    const ids = ['mcpTitle', 'mcpEnabled', 'mcpToken', 'mcpPort'];
    for (const id of ids) {
      const existe = await browser.execute(i =>
        document.querySelector(`#ajustes-panel-mcp #${i}`) !== null,
        id,
      );
      expect(existe).toBe(true);
    }
    // El comando para conectar está formado con el token y el puerto.
    const port  = await $('#mcpPort').getValue();
    const token = await $('#mcpToken').getValue();
    const cmd   = await $('#mcpCmd').getValue();
    expect(cmd).toContain(`http://127.0.0.1:${port}/mcp`);
    expect(cmd).toContain(token);
  });

  // ── Atajo '?' muestra la ayuda con los nuevos nombres ──────────────

  it('la ayuda "?" empareja cada tecla con su pestaña ("Alt+N" → "Ajustes › …")', async () => {
    // Salimos de Ajustes para que '?' no esté enfocado en una pestaña.
    await browser.execute(() => {
      const btn = document.querySelector('button.nav-item[data-view="tasks"]');
      btn?.focus();
    });
    await browser.keys([Key.Shift, '/']);
    await $('#shortcuts-modal').waitForDisplayed();
    // Emparejamos cada <dt> con su <dd> hermano (dt.nextElementSibling)
    // y comprobamos que "Alt + N" mapea al destino correcto. El
    // textContent del dt incluye espacios y separadores entre <kbd>;
    // los normalizamos para no acoplarnos al formato exacto.
    const pares = await browser.execute(() => {
      const dts = Array.from(document.querySelectorAll('#shortcuts-modal dt'));
      const out = [];
      for (const dt of dts) {
        const dd = dt.nextElementSibling;
        // Normaliza espacios: juntar/rtrim deja el texto en una forma
        // estable independiente de cómo se partan los <kbd>.
        const tecla = (dt.textContent || '').replace(/\s+/g, ' ').trim();
        const desc  = (dd?.textContent || '').replace(/\s+/g, ' ').trim();
        out.push({ tecla, desc });
      }
      return out;
    });
    // Comprobamos las cinco entradas Alt+4..Alt+8 de la sección
    // "Navegación" del diálogo. Usamos matches para que el texto sea
    // robusto a cambios menores en el formato del dt.
    const esperados = [
      { tecla: /Alt\s*\+\s*4\b/, desc: /Ir a Ajustes › Datos\b/ },
      { tecla: /Alt\s*\+\s*5\b/, desc: /Ir a Ajustes › Imprimir y PDF\b/ },
      { tecla: /Alt\s*\+\s*6\b/, desc: /Ir a Ajustes › Apariencia\b/ },
      { tecla: /Alt\s*\+\s*7\b/, desc: /Ir a Ajustes › Legal\b/ },
      { tecla: /Alt\s*\+\s*8\b/, desc: /Ir a Ajustes › Accesibilidad\b/ },
    ];
    for (const { tecla, desc } of esperados) {
      const encontrado = pares.some(p => tecla.test(p.tecla) && desc.test(p.desc));
      expect(encontrado).toBe(true);
    }
    // Cierra el diálogo para no contaminar el resto de la suite.
    await browser.keys(Key.Escape);
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.getElementById('shortcuts-modal').hidden,
      )) === true,
      { timeout: 3_000, timeoutMsg: 'La ayuda no se cerró con Escape' },
    );
  });

  // ── Limpieza: cerramos cualquier diálogo abierto por si acaso ──────
  afterEach(async () => {
    await browser.execute(() => {
      const help = document.getElementById('shortcuts-modal');
      if (help) help.hidden = true;
      const legal = document.getElementById('legal-modal');
      if (legal) legal.hidden = true;
    });
  });
});