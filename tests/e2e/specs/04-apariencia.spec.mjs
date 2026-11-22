// Recorrido de la pestaña "Apariencia" de Ajustes (T-022). Antes era
// la vista completa ui/settings; ahora vive como pestaña dentro de
// #view-ajustes. Se llega con Alt+6 (atajo que salta directamente a
// esa pestaña). Los selectores internos (#customEditToggle, radios
// theme, etc.) siguen siendo los mismos: la pestaña reutiliza
// ui/settings/settings-card.{html,js,css}.
//
//   1. Temas predefinidos: elegir Oscuro, Claro, Alto contraste claro
//      y Alto contraste oscuro cambia `document.documentElement.dataset.theme`
//      y el `background-color` calculado del <body>, y el valor sobrevive
//      a un reload.
//
//   2. Escala general de letra al 200 %: el radio de 200 cambia
//      `document.documentElement.style.fontSize` (lo que aplica
//      applyPreferences en ui/settings/preferences.js) y el valor sigue
//      tras recargar. Desde T-022 este radio está en la pestaña
//      Accesibilidad (Alt+8 → pestaña Tamaño de letra general),
//      no en Apariencia.
//
//   3. Con la ventana a 390×844 (mínimo permitido por la app: 380) y
//      la letra al 200 %, ni Tareas (con 3 tareas), Semana y Vista
//      completa ni ninguna pestaña de Ajustes (Apariencia,
//      Accesibilidad, Datos, Imprimir y PDF, Asistente y Legal) tiene
//      desbordamiento horizontal ni en
//      documentElement ni en `.content` (que es quien de verdad
//      desplaza: body tiene overflow-x:hidden en index.css:153 y
//      .content tiene overflow:auto en index.css:604). Si alguna
//      desborda, se describe la vista, dónde se observó el
//      desbordamiento y el elemento cuyo borde derecho
//      (getBoundingClientRect().right) se sale más allá del
//      viewport.

import {
  abrirAppNueva,
  crearTarea,
  recargar,
  ventanaMovil,
  navegarVistaAlt,
} from '../helpers.mjs';

// Temas predefinidos que pinta el fieldset «Tema»:
//   radioValue  → value del input[name="theme"]
//   scheme      → dataset.theme esperado tras elegirlo
// El color de fondo esperado se lee en vivo de getComputedStyle de
// :root(--bg) en la página, no se hardcodea aquí: así la prueba no
// copia la lógica que cubre.
const TEMAS = [
  { radioValue: 'dark',           scheme: 'dark' },
  { radioValue: 'light',          scheme: 'light' },
  { radioValue: 'contrast-light', scheme: 'light' },
  { radioValue: 'contrast-dark',  scheme: 'dark' },
];

// Devuelve el dataset.theme y el backgroundColor del <body> en el
// estado actual. Lo usamos para comparar antes/después de elegir un
// tema o de recargar la app.
const leerEstadoTema = () => browser.execute(() => ({
  datasetTheme: document.documentElement.dataset.theme ?? null,
  bodyBg:       getComputedStyle(document.body).backgroundColor,
}));

// Abre la pestaña Apariencia de Ajustes. Como ahora Apariencia es una
// pestaña dentro de Ajustes (no una vista), navegamos con Alt+6 (que
// salta a la pestaña Apariencia directamente y enfoca su botón).
const irAApariencia = async () => {
  await navegarVistaAlt(6);
  // Espera a que el panel esté activo y con sus radios.
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelectorAll('input[name="theme"]').length > 0,
    ),
    { timeout: 5_000, timeoutMsg: 'Los radios de Tema no se han pintado' },
  );
};

// Abre la pestaña Accesibilidad de Ajustes (Alt+8 → Accesibilidad)
// y la bloque "Tamaño de letra general", donde están los radios de
// escala. Antes vivían en Apariencia; desde T-022 viven aquí.
const irATamanoLetraGeneral = async () => {
  await navegarVistaAlt(8);
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelectorAll('input[name="textScale"]').length > 0,
    ),
    { timeout: 5_000, timeoutMsg: 'Los radios de Tamaño de letra general no se han pintado' },
  );
};

const elegirTema = async (radioValue) => {
  // Clic sobre el <label> que envuelve el radio, como lo haría una
  // persona (WebdriverIO dispara 'click' sobre el radio aunque el
  // nodo visual sea el <span>).
  await irAApariencia();
  await $(`input[name="theme"][value="${radioValue}"]`).click();
  // Esperar a que la app haya aplicado el cambio: dataset.theme
  // distinto del inmediatamente anterior no sirve porque podría
  // coincidir al cambiar entre dos claros; mejor esperamos a que
  // matchActiveThemeRadio haya marcado el radio y la app ya haya
  // propagado a <html>.
  await browser.waitUntil(
    async () => await browser.execute(
      (v) => {
        const radio = document.querySelector(`input[name="theme"][value="${v}"]`);
        return radio && radio.checked === true;
      },
      radioValue,
    ),
    { timeout: 5_000, timeoutMsg: `El tema ${radioValue} no quedó marcado` },
  );
};

describe('Pestaña Apariencia: tema, escala de letra y desbordamiento móvil al 200 %', () => {

  before(async () => {
    await abrirAppNueva();
  });

  // ── 1. Temas predefinidos ──────────────────────────────────────────

  for (const tema of TEMAS) {
    it(`elegir tema "${tema.radioValue}" cambia dataset.theme y el fondo del body`, async () => {
      await elegirTema(tema.radioValue);
      const despues = await leerEstadoTema();

      // (1) El scheme aplicado al <html> coincide con el esperado.
      expect(despues.datasetTheme).toBe(tema.scheme);

      // (2) El fondo del <body> coincide con el --bg del tema activo
      // (leído en vivo de :root, no hardcodeado en la prueba).
      // Nos sirve para detectar cambios reales del fondo: si el
      // usuario cambió del dark al contrast-dark, tanto scheme como
      // bg son dark, pero el color de fondo varía (de #0f172a a
      // #000000). Comparar sólo con el scheme anterior no detectaría
      // eso; comparar con el bg real del BASES sí.
      const esperado = await browser.execute(() => {
        const root = document.documentElement;
        const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
        const m = bg.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (!m) return `hex:${bg}`;
        const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
        return `rgb(${r}, ${g}, ${b})`;
      });
      expect(despues.bodyBg).toBe(esperado);
    });

    it(`el tema "${tema.radioValue}" se conserva tras recargar la app`, async () => {
      expect(await recargar()).toBe('app');
      // Volvemos a Apariencia (recargar nos deja en la vista Tareas).
      await irAApariencia();
      const radio = await browser.execute(
        (v) => {
          const r = document.querySelector(`input[name="theme"][value="${v}"]`);
          return r ? { checked: r.checked } : null;
        },
        tema.radioValue,
      );
      expect(radio).not.toBeNull();
      expect(radio.checked).toBe(true);
      // Y el theme computado del <html> sigue siendo el del scheme.
      const estado = await leerEstadoTema();
      expect(estado.datasetTheme).toBe(tema.scheme);
    });
  }

  // ── 2. Escala general al 200 % (ahora en Accesibilidad) ───────────

  it('elegir tamaño de texto 200 % aplica fontSize al <html> y sobrevive al recargar', async () => {
    await irATamanoLetraGeneral();
    // Estado inicial: la app arranca con textScale=100.
    const antes = await browser.execute(
      () => document.documentElement.style.fontSize,
    );
    expect(antes).toBe('100%');

    // Clic sobre el radio 200 % (lo aplica setPreferences({textScale:200}),
    // que llama a applyPreferences ~línea 553: root.style.fontSize = '200%').
    await $('input[name="textScale"][value="200"]').click();
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.documentElement.style.fontSize,
      )) === '200%',
      { timeout: 5_000, timeoutMsg: 'El tamaño 200 % no se aplicó al <html>' },
    );

    // Al recargar, theme-boot.js lee localStorage y aplica textScale
    // antes del primer pintado; applyPreferences (al montar la tarjeta)
    // vuelve a poner root.style.fontSize = '200%'.
    expect(await recargar()).toBe('app');
    await irATamanoLetraGeneral();
    const despues = await browser.execute(
      () => document.documentElement.style.fontSize,
    );
    expect(despues).toBe('200%');

    // El radio 200 % también queda marcado tras recargar.
    const radioMarcado = await browser.execute(
      () => document.querySelector('input[name="textScale"][value="200"]')?.checked === true,
    );
    expect(radioMarcado).toBe(true);
  });

  // ── 3. Desbordamiento con 390×844 y letra al 200 % ─────────────────

  describe('con ventana 390×844 y letra al 200 %', () => {
    before(async () => {
      // Aplicamos 200 % por el test anterior; el before de describe
      // asegura 200 % incluso si este describe se ejecuta antes del
      // it de tamaño. También crea las 3 tareas para que la vista
      // Tareas tenga contenido real.
      await irATamanoLetraGeneral();
      await $('input[name="textScale"][value="200"]').click();
      await browser.waitUntil(
        async () => (await browser.execute(
          () => document.documentElement.style.fontSize,
        )) === '200%',
        { timeout: 5_000, timeoutMsg: 'No se pudo aplicar 200 % para la prueba móvil' },
      );
      // Creamos 3 tareas diarias si aún no están.
      await navegarVistaAlt(1);
      await $('#taskName').waitForDisplayed();
      const contadorAntes = Number(await $('#taskCount').getText());
      if (contadorAntes < 3) {
        for (let i = contadorAntes + 1; i <= 3; i++) {
          await crearTarea(`Tarea móvil ${i}`, 'daily');
        }
      }
      await expect($('#taskCount')).toHaveText('3');
      // Fijamos el tamaño a móvil.
      await ventanaMovil(390, 844);
    });

    // Medimos cada vista del menú (Alt+1..3) y, dentro de Ajustes,
    // cada pestaña que la app expone (Alt+4..8) abriendo antes la
    // pestaña correspondiente: la barra de pestañas y el contenido de
    // cada una tienen que caber en 390 sin scroll horizontal.
    //
    // Para la pestaña "Asistente (MCP)" la app no la muestra en
    // Android (UA contiene "android"), pero el test corre en
    // escritorio, donde sí existe: la incluimos en la lista y, si
    // llegara a no estar, el `for` espera a que esté visible.
    const VISTAS = [
      { alt: 1, nombre: 'Tareas',         id: 'view-tasks' },
      { alt: 2, nombre: 'Semana',         id: 'view-week' },
      { alt: 3, nombre: 'Vista completa', id: 'view-allWeeks' },
      { alt: 6, nombre: 'Ajustes › Apariencia',     id: 'view-ajustes', tab: 'appearance' },
      { alt: 8, nombre: 'Ajustes › Accesibilidad',  id: 'view-ajustes', tab: 'accessibility' },
      { alt: 4, nombre: 'Ajustes › Datos',          id: 'view-ajustes', tab: 'data' },
      { alt: 5, nombre: 'Ajustes › Imprimir y PDF', id: 'view-ajustes', tab: 'print' },
      { alt: 7, nombre: 'Ajustes › Legal',          id: 'view-ajustes', tab: 'legal' },
    ];

    for (const v of VISTAS) {
      it(`vista ${v.nombre} no tiene desbordamiento horizontal`, async () => {
        await navegarVistaAlt(v.alt);
        // Aseguramos que la vista está activa.
        await browser.waitUntil(
          async () => await browser.execute(
            (id) => document.getElementById(id)?.classList.contains('active'),
            v.id,
          ),
          { timeout: 5_000, timeoutMsg: `La vista ${v.nombre} no quedó activa` },
        );

        // Si la entrada corresponde a una pestaña de Ajustes, abrimos
        // esa pestaña (la última abierta Alt+4..8 deja la pestaña ya
        // visible, pero para "Ajustes › Apariencia" el atajo Alt+6
        // también la pone activa; en cualquier caso esperamos a que
        // el panel correspondiente no esté oculto).
        if (v.tab) {
          await browser.waitUntil(
            async () => await browser.execute(
              (tab) => {
                const panel = document.getElementById(`ajustes-panel-${tab}`);
                return panel && !panel.hidden;
              },
              v.tab,
            ),
            { timeout: 5_000, timeoutMsg: `La pestaña ${v.tab} no quedó visible` },
          );
        }

        // Hay dos posibles anfitriones de scroll horizontal:
        //   - documentElement (cuando body no oculta el desbordamiento).
        //   - .content (que tiene overflow:auto en index.css:604 y es
        //     quien realmente desplaza: el body tiene overflow-x:hidden
        //     en index.css:153, así que un elemento más ancho que la
        //     ventana solo aparece como overflow dentro de .content, no
        //     en documentElement.scrollWidth).
        // Comprobamos los dos y, si alguno desborda, informamos del
        // elemento cuyo borde derecho (getBoundingClientRect().right) se
        // sale de la ventana: eso es lo que realmente ve el usuario
        // como desbordamiento.
        const medidas = await browser.execute(() => {
          const doc = document.documentElement;
          const content = document.querySelector('.content');
          const docW = doc.clientWidth;
          const contentW = content ? content.clientWidth : null;
          return {
            doc: {
              scrollWidth: doc.scrollWidth,
              clientWidth: docW,
              overflow: doc.scrollWidth - docW,
            },
            content: content ? {
              scrollWidth: content.scrollWidth,
              clientWidth: contentW,
              overflow: content.scrollWidth - contentW,
            } : null,
            viewport: window.innerWidth,
          };
        });

        const desbordamientos = [];
        if (medidas.doc.overflow > 1) {
          desbordamientos.push({ donde: 'documentElement', ...medidas.doc });
        }
        if (medidas.content && medidas.content.overflow > 1) {
          desbordamientos.push({ donde: '.content', ...medidas.content });
        }

        if (desbordamientos.length > 0) {
          // Buscamos el elemento cuyo borde derecho se sale de la
          // ventana visible: recorremos el DOM desde .content (o desde
          // document.body si .content no existiera) y nos quedamos con
          // el que tenga el .right más alto.
          const culpable = await browser.execute((vp) => {
            const root = document.querySelector('.content') ?? document.body;
            const todos = Array.from(root.querySelectorAll('*'));
            let best = null;
            for (const el of todos) {
              const r = el.getBoundingClientRect();
              if (r.width === 0) continue;
              const overflow = r.right - vp;
              if (overflow > 1) {
                if (overflow > (best?.overflow ?? 0)) {
                  best = {
                    overflow,
                    right: r.right,
                    width: r.width,
                    tag: el.tagName,
                    id: el.id || null,
                    cls: typeof el.className === 'string' ? el.className.slice(0, 80) : null,
                    text: (el.textContent ?? '').trim().slice(0, 60) || null,
                  };
                }
              }
            }
            return best;
          }, medidas.viewport);
          throw new Error(
            `Vista ${v.nombre}: desbordamiento horizontal detectado ` +
            `(${JSON.stringify(desbordamientos)}). ` +
            `Viewport=${medidas.viewport}. ` +
            `Elemento que más se sale por la derecha: ${JSON.stringify(culpable)}`
          );
        }
        // Aseguramos que ambas mediciones cumplen con margen ±1 px.
        expect(medidas.doc.scrollWidth).toBeLessThanOrEqual(medidas.doc.clientWidth + 1);
        if (medidas.content) {
          expect(medidas.content.scrollWidth).toBeLessThanOrEqual(medidas.content.clientWidth + 1);
        }
      });
    }

    // Pestaña "Asistente (MCP)": no tiene atajo propio; la activamos
    // haciendo clic. Solo existe en escritorio (no Android).
    it('Ajustes › Asistente (MCP) no tiene desbordamiento horizontal (si la pestaña existe)', async () => {
      await navegarVistaAlt(6);
      await browser.waitUntil(
        async () => await browser.execute(
          () => !document.getElementById('ajustes-panel-appearance')?.hidden,
        ),
        { timeout: 5_000, timeoutMsg: 'Ajustes › Apariencia no se abrió' },
      );
      const existe = await browser.execute(() => {
        const t = document.querySelector('.ajustes-tab[data-tab="mcp"]');
        return !!t && !t.hidden;
      });
      // Los E2E corren en escritorio, donde la pestaña tiene que
      // existir: si faltara, es un fallo y no un caso que saltar.
      expect(existe).toBe(true);
      await browser.execute(() => {
        document.querySelector('.ajustes-tab[data-tab="mcp"]').click();
      });
      await browser.waitUntil(
        async () => await browser.execute(
          () => !document.getElementById('ajustes-panel-mcp')?.hidden,
        ),
        { timeout: 5_000, timeoutMsg: 'Ajustes › Asistente (MCP) no se abrió' },
      );
      const medidas = await browser.execute(() => {
        const doc = document.documentElement;
        const content = document.querySelector('.content');
        const docW = doc.clientWidth;
        const contentW = content ? content.clientWidth : null;
        return {
          doc: {
            scrollWidth: doc.scrollWidth,
            clientWidth: docW,
            overflow: doc.scrollWidth - docW,
          },
          content: content ? {
            scrollWidth: content.scrollWidth,
            clientWidth: contentW,
            overflow: content.scrollWidth - contentW,
          } : null,
          viewport: window.innerWidth,
        };
      });
      const desbordamientos = [];
      if (medidas.doc.overflow > 1) {
        desbordamientos.push({ donde: 'documentElement', ...medidas.doc });
      }
      if (medidas.content && medidas.content.overflow > 1) {
        desbordamientos.push({ donde: '.content', ...medidas.content });
      }
      if (desbordamientos.length > 0) {
        const culpable = await browser.execute((vp) => {
          const root = document.querySelector('.content') ?? document.body;
          const todos = Array.from(root.querySelectorAll('*'));
          let best = null;
          for (const el of todos) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            const overflow = r.right - vp;
            if (overflow > 1 && overflow > (best?.overflow ?? 0)) {
              best = {
                overflow, right: r.right, width: r.width,
                tag: el.tagName, id: el.id || null,
                cls: typeof el.className === 'string' ? el.className.slice(0, 80) : null,
                text: (el.textContent ?? '').trim().slice(0, 60) || null,
              };
            }
          }
          return best;
        }, medidas.viewport);
        throw new Error(
          `Ajustes › Asistente (MCP): desbordamiento horizontal ` +
          `(${JSON.stringify(desbordamientos)}). Viewport=${medidas.viewport}. ` +
          `Elemento que más se sale por la derecha: ${JSON.stringify(culpable)}`
        );
      }
      expect(medidas.doc.scrollWidth).toBeLessThanOrEqual(medidas.doc.clientWidth + 1);
      if (medidas.content) {
        expect(medidas.content.scrollWidth).toBeLessThanOrEqual(medidas.content.clientWidth + 1);
      }
    });
  });

});