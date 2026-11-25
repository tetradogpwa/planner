// Recorrido con teclado de la pantalla de Términos, las vistas, los
// atajos globales, los diálogos de atajos y legal, y la vista Semana.
// Actúa sobre la app real como lo haría una persona: Tab, flechas,
// Inicio/Fin, Alt+Num, ?, Escape, Shift+Tab… El recorrido protege lo
// hecho en T-007 (atajos, foco y diálogos) tras los cambios de T-019
// (Alt+1..Alt+8 y atajo '?' desde fuera de campos).

import { Key } from 'webdriverio';
import { esperarArranque, crearTarea } from '../helpers.mjs';

/** Lee el id del elemento con foco (o cadena vacía si no hay id). */
const focoId = () =>
  browser.execute(() => document.activeElement?.id || '');

/** Lee la clase del elemento con foco (o cadena vacía si no hay). */
const focoClase = () =>
  browser.execute(() => document.activeElement?.className || '');

/** Selector CSS del primer elemento con foco cuyo id coincida con
 *  `id`. Útil para preguntar a la página por el id directamente sin
 *  esperar a `browser.execute`. */
const porId = (id) => $(`#${id}`);

describe('Uso completo con teclado', () => {

  // ── Pantalla de términos: navegación por teclado ────────────────
  // Empezamos SIEMPRE en términos (instalación nueva): el spec
  // siguiente ("Saltar al contenido") ya requiere el primer arranque
  // con términos aún sin aceptar (que es como arranca la app). Si
  // otro `it` ya pasó por aquí, el `recargar` del spec siguiente
  // vuelve a los términos; este describe empieza con datos vacíos.

  it('en Términos, flechas e Inicio/Fin cambian de pestaña y solo la seleccionada tiene tabindex=0', async () => {
    expect(await esperarArranque()).toBe('terminos');

    // Estado inicial: la pestaña "Términos de uso" seleccionada.
    await expect(porId('terms-tab-TERMS')).toHaveAttribute('aria-selected', 'true');
    await expect(porId('terms-tab-TERMS')).toHaveAttribute('tabindex', '0');
    await expect(porId('terms-tab-EULA')).toHaveAttribute('tabindex', '-1');
    await expect(porId('terms-tab-PRIVACY')).toHaveAttribute('tabindex', '-1');

    // El card de términos enfoca el <h2> al montar. Tab lleva a la
    // primera pestaña (las demás tienen tabindex=-1, así que Tab las
    // salta). Solo se necesita UN Tab para llegar a TERMS.
    await browser.keys([Key.Tab]);
    expect(await focoId()).toBe('terms-tab-TERMS');

    // Flecha derecha → EULA.
    await browser.keys([Key.ArrowRight]);
    expect(await focoId()).toBe('terms-tab-EULA');
    await expect(porId('terms-tab-EULA')).toHaveAttribute('aria-selected', 'true');
    await expect(porId('terms-tab-TERMS')).toHaveAttribute('tabindex', '-1');
    await expect(porId('terms-tab-EULA')).toHaveAttribute('tabindex', '0');

    // Flecha derecha otra vez → Privacidad.
    await browser.keys([Key.ArrowRight]);
    expect(await focoId()).toBe('terms-tab-PRIVACY');
    await expect(porId('terms-tab-PRIVACY')).toHaveAttribute('aria-selected', 'true');
    await expect(porId('terms-tab-PRIVACY')).toHaveAttribute('tabindex', '0');

    // Flecha izquierda → vuelve a EULA.
    await browser.keys([Key.ArrowLeft]);
    expect(await focoId()).toBe('terms-tab-EULA');

    // Fin → última pestaña.
    await browser.keys([Key.End]);
    expect(await focoId()).toBe('terms-tab-PRIVACY');

    // Inicio → primera pestaña.
    await browser.keys([Key.Home]);
    expect(await focoId()).toBe('terms-tab-TERMS');
  });

  it('en Términos, los términos se aceptan con Tab + Enter sobre el botón', async () => {
    // Tras el test anterior el foco está en la primera pestaña (Home).
    // Tabulamos hasta llegar al botón "Acepto los términos…" en lugar
    // de contar Tabs a ciegas: el DOM de términos puede variar
    // (panel con tabindex=0, hr, etc.) y queremos un test robusto.
    // Mientras no lleguemos al botón Aceptar (data-action="accept") o
    // al Rechazar, seguimos tabulando.
    let intentos = 0;
    let dataAction = '';
    while (intentos < 12) {
      const foco = await browser.execute(() => {
        const el = document.activeElement;
        return {
          tag:    el?.tagName || '',
          id:     el?.id || '',
          cls:    el?.className || '',
          action: el?.getAttribute?.('data-action') || '',
        };
      });
      if (foco.action === 'accept') { dataAction = 'accept'; break; }
      await browser.keys([Key.Tab]);
      intentos++;
    }
    expect(dataAction).toBe('accept');

    // Enter acepta y la app pasa a la vista Tareas.
    await browser.keys([Key.Enter]);
    await porId('view-tasks-heading').waitForDisplayed();
    await porId('taskName').waitForDisplayed();
  });

  // ── "Saltar al contenido" y <main> con teclado ────────────────
  // Tras aceptar, recargamos la app: vuelve a salir la pantalla de
  // términos si los datos no se han tocado (sí: este spec ya aceptó),
  // pero el "primer Tab" tiene que verse en la app real, sin términos
  // delante. Recargamos con el helper para reiniciar el foco.

  it('tras un arranque limpio, el primer Tab enfoca "Saltar al contenido" y Enter lleva el foco a <main>', async () => {
    // Aceptar los términos los oculta permanentemente; la app
    // siguiente arranca directamente en la vista Tareas. Tras
    // `refresh`, la página se recarga y WebKit devuelve el foco al
    // <body> (sin id). Damos un pequeño respiro para que la app
    // termine el primer pintado y empezar el Tab desde un estado
    // conocido (body).
    await browser.refresh();
    await porId('view-tasks-heading').waitForDisplayed();

    // Pequeña pausa para que WebKit termine el primer pintado tras el
    // refresh (focus puede quedarse en body unos ms).
    await browser.pause(200);

    // El primer Tab de la sesión enfoca el skip-link (el primero del
    // DOM: <a class="skip-link" href="#main-content">…</a>). El
    // elemento NO tiene id, solo la clase `.skip-link`.
    await browser.keys([Key.Tab]);
    const claseFoco = await focoClase();
    const textoFoco = await browser.execute(
      () => (document.activeElement?.textContent || '').trim(),
    );
    expect(claseFoco).toContain('skip-link');
    expect(textoFoco).toBe('Saltar al contenido');

    // Enter activa el enlace: el foco salta al <main>.
    await browser.keys([Key.Enter]);
    const idMain = await focoId();
    const mainTag = await browser.execute(
      () => document.activeElement?.tagName || '',
    );
    expect(idMain).toBe('main-content');
    expect(mainTag).toBe('MAIN');
  });

  // ── Atajos de vista (Alt+1..Alt+3 y Alt+4..Alt+8) ─────────────────
  // Alt+1..Alt+3 abren vistas distintas (Tareas, Semana, Vista
  // completa) y el foco va al encabezado de cada vista.
  // Alt+4..Alt+8 abren Ajustes en una pestaña concreta (T-022) y el
  // foco va a la pestaña activa, NO al encabezado de la vista
  // (criterio explícito: "foco en la pestaña activa"). Estos casos
  // los cubre la spec 10-ajustes; aquí verificamos el resto.

  const atajosBase = [
    { n: 1, vista: 'tasks',    idHeading: 'view-tasks-heading' },
    { n: 2, vista: 'week',     idHeading: 'view-week-body-title' },
    { n: 3, vista: 'allWeeks', idHeading: 'view-allWeeks-heading' },
  ];

  for (const { n, vista, idHeading } of atajosBase) {
    it(`Alt+${n} abre la vista ${vista}, enfoca su encabezado y marca aria-current en el menú`, async () => {
      // Partimos de la vista Tareas para que el atajo tenga que
      // "mover" de vista (excepto Alt+1).
      if (n !== 1) {
        await browser.keys([Key.Alt, '1']);
        await porId('view-tasks-heading').waitForDisplayed();
        await browser.waitUntil(
          async () => (await browser.execute(
            () => document.getElementById('view-tasks').classList.contains('active'),
          )),
          { timeout: 3_000, timeoutMsg: 'La vista Tareas no quedó activa tras Alt+1' },
        );
      }
      await browser.keys([Key.Alt, String(n)]);

      // La vista queda activa y el encabezado recibe el foco.
      await browser.waitUntil(
        async () => (await browser.execute(
          (v) => document.getElementById('view-' + v).classList.contains('active'),
          vista,
        )),
        { timeout: 5_000, timeoutMsg: `Alt+${n} no activó la vista ${vista}` },
      );
      await browser.waitUntil(
        async () => await browser.execute(
          (id) => !!document.getElementById(id),
          idHeading,
        ),
        { timeout: 5_000, timeoutMsg: `Alt+${n} no creó el encabezado ${idHeading}` },
      );
      await browser.waitUntil(
        async () => (await focoId()) === idHeading,
        { timeout: 3_000, timeoutMsg: `Alt+${n} no enfocó ${idHeading}` },
      );

      // El botón del menú correspondiente tiene aria-current="page".
      const ariaCurrent = await $(`button.nav-item[data-view="${vista}"]`)
        .getAttribute('aria-current');
      expect(ariaCurrent).toBe('page');
    });
  }

  // ── Menú lateral: flechas, Inicio y Fin ────────────────────────
  it('en el menú lateral, flechas abajo/arriba, Inicio y Fin mueven el foco entre opciones', async () => {
    // Empezamos desde la vista Tareas.
    await browser.keys([Key.Alt, '1']);
    await porId('view-tasks-heading').waitForDisplayed();

    // Tras Alt+1 el foco está en el encabezado de Tareas. Para probar
    // las flechas del menú, llevamos el foco a su primer botón SIN
    // pasar por un clic (el clic relanzaría setView y el foco
    // acabaría de nuevo en el encabezado). Lo hacemos directamente
    // con .focus() y verificamos que el botón del menú está activo.
    await browser.execute(() => {
      const btn = document.querySelector('button.nav-item[data-view="tasks"]');
      btn.focus();
    });
    expect(await focoId()).toBe('');    // sin id en estos botones
    const primeraClase = await focoClase();
    expect(primeraClase).toContain('nav-item');

    // Flecha abajo → segunda opción (data-view="week").
    await browser.keys([Key.ArrowDown]);
    const vistaDespuesAbajo = await browser.execute(
      () => document.activeElement?.dataset?.view || '',
    );
    expect(vistaDespuesAbajo).toBe('week');

    // Flecha arriba → vuelve a la primera.
    await browser.keys([Key.ArrowUp]);
    const vistaDespuesArriba = await browser.execute(
      () => document.activeElement?.dataset?.view || '',
    );
    expect(vistaDespuesArriba).toBe('tasks');

    // Fin → última opción con data-view (ajustes, índice 4 desde T-022).
    await browser.keys([Key.End]);
    const vistaFin = await browser.execute(
      () => document.activeElement?.dataset?.view || '',
    );
    expect(vistaFin).toBe('ajustes');

    // Inicio → primera opción (tasks).
    await browser.keys([Key.Home]);
    const vistaInicio = await browser.execute(
      () => document.activeElement?.dataset?.view || '',
    );
    expect(vistaInicio).toBe('tasks');
  });

  // ── Alt+N enfoca #taskName ────────────────────────────────────
  it('Alt+N enfoca #taskName desde otra vista', async () => {
    // Estamos en Tareas; saltamos a Semana.
    await browser.keys([Key.Alt, '2']);
    await porId('view-week-body-title').waitForDisplayed();

    // Alt+N → cambia a Tareas y enfoca #taskName.
    await browser.keys([Key.Alt, 'n']);
    // Espera a que la vista Tareas esté activa y a que #taskName
    // aparezca en el DOM (AddTaskCard lo inyecta de forma asíncrona).
    await porId('view-tasks-heading').waitForDisplayed();
    await porId('taskName').waitForDisplayed({ timeout: 5_000 });
    // Tras pulsarlo, el foco debe estar en #taskName (lo que la app
    // intenta en index.js cuando se pulsa Alt+N).
    await browser.waitUntil(
      async () => (await focoId()) === 'taskName',
      { timeout: 3_000, timeoutMsg: 'Alt+N no enfocó #taskName' },
    );
  });

  it('? no abre la ayuda mientras se escribe en #taskName', async () => {
    // Aseguramos que estamos en Tareas con #taskName visible. Lo
    // hacemos con Alt+1 (que sí funciona) en lugar de Alt+N para que
    // este test sea independiente del criterio "Alt+N enfoca
    // #taskName". Si Alt+N tiene un bug, este test seguirá pasando.
    await browser.keys([Key.Alt, '1']);
    await porId('view-tasks-heading').waitForDisplayed();
    await porId('taskName').waitForDisplayed();

    // Ponemos el foco en #taskName explícitamente (clic real, como
    // lo haría una persona para empezar a escribir).
    await porId('taskName').click();
    await porId('taskName').setValue('a');
    await browser.keys('?');

    // La ayuda debe seguir oculta.
    const modal = porId('shortcuts-modal');
    await browser.pause(300);
    const visible = await modal.isDisplayed().catch(() => false);
    expect(visible).toBe(false);

    // Limpiamos el campo para no contaminar pruebas siguientes.
    await browser.execute(() => {
      const el = document.getElementById('taskName');
      if (el) el.value = '';
    });
    // Sacamos el foco a un botón del menú (no editable) para el
    // siguiente test que prueba ? fuera de campos.
    await browser.execute(() => {
      document.querySelector('button.nav-item[data-view="tasks"]').focus();
    });
  });

  it('? abre la ayuda cuando el foco está fuera de un campo', async () => {
    // Tras el test anterior, el foco está en algún botón posterior al
    // #taskName (no en un campo editable). Si no fuera así, lo
    // movemos a un botón del menú explícitamente.
    const enCampo = await browser.execute(
      () => {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') {
          const t = (el.type || 'text').toLowerCase();
          return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(t);
        }
        return !!el.isContentEditable;
      },
    );
    if (enCampo) {
      // Forzamos foco en un botón del menú (no editable).
      await browser.execute(() => {
        document.querySelector('button.nav-item[data-view="tasks"]').focus();
      });
    }

    // Pulsa '?' → la ayuda debe abrirse.
    await browser.keys([Key.Shift, '/']);  // '?' = Shift+/
    await porId('shortcuts-modal').waitForDisplayed();
    // Está visible (no hidden).
    const hidden = await browser.execute(
      () => document.getElementById('shortcuts-modal').hidden,
    );
    expect(hidden).toBe(false);
  });

  // ── Ayuda de atajos: trampa, cierre, idempotencia ─────────────
  it('en la ayuda, Tab y Shift+Tab no salen del diálogo', async () => {
    // Abrimos la ayuda (puede que un test anterior la dejara
    // cerrada). Si ya está abierta, abrir es no-op.
    await browser.execute(() => {
      document.querySelector('button.nav-item[data-view="tasks"]')?.focus();
    });
    await browser.keys([Key.Shift, '/']);
    await porId('shortcuts-modal').waitForDisplayed();

    // Confirmamos que hay al menos un elemento enfocable dentro.
    const totalEnDialogo = await browser.execute(() => {
      const dlg = document.getElementById('shortcuts-modal');
      const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(dlg.querySelectorAll(sel))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
        .length;
    });
    expect(totalEnDialogo).toBeGreaterThanOrEqual(1);

    // Pulsamos Tab muchas veces: el foco debe quedarse dentro del
    // modal aunque haya un solo botón (la trampa cicla y no escapa).
    for (let i = 0; i < totalEnDialogo + 4; i++) {
      await browser.keys([Key.Tab]);
      const dentro = await browser.execute(() =>
        document.getElementById('shortcuts-modal').contains(document.activeElement),
      );
      expect(dentro).toBe(true);
    }

    // Shift+Tab también debe dejar el foco dentro.
    for (let i = 0; i < totalEnDialogo + 4; i++) {
      await browser.keys([Key.Shift, Key.Tab]);
      const dentro = await browser.execute(() =>
        document.getElementById('shortcuts-modal').contains(document.activeElement),
      );
      expect(dentro).toBe(true);
    }
  });

  it('Escape cierra la ayuda y devuelve el foco al elemento que la abrió', async () => {
    // Abrimos la ayuda con foco en un botón conocido.
    await browser.execute(() => {
      document.querySelector('button.nav-item[data-view="tasks"]').focus();
    });
    // El foco está en el botón Tareas. Pulsamos ?.
    await browser.keys([Key.Shift, '/']);
    await porId('shortcuts-modal').waitForDisplayed();

    // Escape lo cierra.
    await browser.keys(Key.Escape);
    // La ayuda pasa a hidden.
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.getElementById('shortcuts-modal').hidden,
      )) === true,
      { timeout: 3_000, timeoutMsg: 'La ayuda no se cerró con Escape' },
    );

    // El foco vuelve al botón que la abrió.
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.activeElement?.dataset?.view || '',
      )) === 'tasks',
      { timeout: 3_000, timeoutMsg: 'El foco no volvió al disparador tras cerrar' },
    );
  });

  it('Escape cierra la ayuda también si se pulsa nada más abrirla', async () => {
    // Para que el fallo no dependa del ritmo de la máquina, congelamos
    // requestAnimationFrame: la ayuda se abre (el modal ya es visible)
    // pero el siguiente frame no llega a ejecutarse, que es justo la
    // ventana en la que el Escape se perdía.
    await browser.execute(() => {
      window.__rafOriginal = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = () => 0;    // congelado: no se ejecuta
    });

    try {
      // El foco está fuera del modal (en el botón de Tareas), como lo
      // deja una persona que acaba de pulsar '?'.
      await browser.execute(() => {
        document.querySelector('button.nav-item[data-view="tasks"]').focus();
      });
      await browser.keys([Key.Shift, '/']);        // '?' abre la ayuda
      await porId('shortcuts-modal').waitForDisplayed();

      // Escape sin esperar a nada: tiene que cerrar la ayuda.
      await browser.keys(Key.Escape);
      await browser.waitUntil(
        async () => (await browser.execute(
          () => document.getElementById('shortcuts-modal').hidden,
        )) === true,
        { timeout: 3_000, timeoutMsg: 'La ayuda no se cerró con Escape justo después de abrirla' },
      );
    } finally {
      // Se restaura requestAnimationFrame para no dejar la app helada.
      await browser.execute(() => {
        if (window.__rafOriginal) {
          window.requestAnimationFrame = window.__rafOriginal;
          delete window.__rafOriginal;
        }
      });
    }
  });

  it('abrir la ayuda dos veces no duplica #shortcuts-modal', async () => {
    // Pulsamos ? dos veces y contamos cuántos #shortcuts-modal hay
    // en el DOM: debe seguir habiendo exactamente uno.
    await browser.keys([Key.Shift, '/']);
    await porId('shortcuts-modal').waitForDisplayed();
    await browser.keys([Key.Shift, '/']);  // no debe duplicarse
    const total = await browser.execute(() =>
      document.querySelectorAll('#shortcuts-modal').length,
    );
    expect(total).toBe(1);

    // Cerramos para no contaminar.
    await browser.keys(Key.Escape);
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.getElementById('shortcuts-modal').hidden,
      )) === true,
      { timeout: 3_000, timeoutMsg: 'La ayuda no se cerró al final' },
    );
  });

  // ── Modal legal: foco en título, trampa, retorno al enlace ─────
  // Desde T-029 los documentos publicados (PRIVACY, TERMS, EULA…)
  // se abren en el navegador del sistema, así que el modal ya no es
  // lo que muestran. Para seguir probando la trampa de foco del
  // modal usamos THIRD_PARTY_LICENSES, que no se publica y siempre
  // se muestra en el modal con su copia local.
  it('abrir un documento desde Legal enfoca el título del modal y devuelve el foco al enlace', async () => {
    // Vamos a la pestaña Legal de Ajustes (Alt+7 desde T-022).
    await browser.keys([Key.Alt, '7']);
    // La pestaña Legal está dentro de #view-ajustes; esperamos al
    // primer enlace de documento como señal de que la pestaña pintó.
    await $('a[data-doc="THIRD_PARTY_LICENSES"]').waitForDisplayed();

    // Identificamos el enlace de THIRD_PARTY_LICENSES (el único
    // documento que la app muestra siempre en el modal) y pulsamos
    // Enter sobre él (ya debe estar en el orden del DOM).
    // Movemos el foco al enlace con un clic de WebdriverIO (lo haría
    // un usuario con ratón) y luego probamos el cierre.
    const enlace = $('a[data-doc="THIRD_PARTY_LICENSES"]');
    await enlace.click();
    await porId('legal-modal').waitForDisplayed();

    // El título recibe el foco.
    await browser.waitUntil(
      async () => (await focoId()) === 'legal-modal-title',
      { timeout: 3_000, timeoutMsg: 'El modal legal no enfocó su título' },
    );

    // Tab debe mantener el foco dentro del modal.
    for (let i = 0; i < 6; i++) {
      await browser.keys([Key.Tab]);
      const dentro = await browser.execute(() =>
        document.getElementById('legal-modal').contains(document.activeElement),
      );
      expect(dentro).toBe(true);
    }

    // Escape cierra y devuelve el foco al enlace que lo abrió.
    await browser.keys(Key.Escape);
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.getElementById('legal-modal').hidden,
      )) === true,
      { timeout: 3_000, timeoutMsg: 'El modal legal no se cerró con Escape' },
    );
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.activeElement?.getAttribute('data-doc') || '',
      )) === 'THIRD_PARTY_LICENSES',
      { timeout: 3_000, timeoutMsg: 'El foco no volvió al enlace que abrió el modal' },
    );
  });

  it('en el modal legal, Tab y Shift+Tab no salen del diálogo al abrirlo con el foco en el título', async () => {
    // Vamos a la pestaña Legal de Ajustes (Alt+7 desde T-022).
    await browser.keys([Key.Alt, '7']);
    await $('a[data-doc="THIRD_PARTY_LICENSES"]').waitForDisplayed();

    // Abrimos el modal con un clic real sobre el enlace (como
    // lo haría una persona). El foco va a #legal-modal-title, que
    // tiene tabindex=-1 y NO está en la lista de enfocables de la
    // trampa: este es el caso que la trampa de foco debe cubrir.
    await $('a[data-doc="THIRD_PARTY_LICENSES"]').click();
    await porId('legal-modal').waitForDisplayed();
    await browser.waitUntil(
      async () => (await focoId()) === 'legal-modal-title',
      { timeout: 3_000, timeoutMsg: 'El modal legal no enfocó su título' },
    );

    // Confirmamos que hay al menos un elemento enfocable dentro.
    const totalEnDialogo = await browser.execute(() => {
      const dlg = document.getElementById('legal-modal');
      const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(dlg.querySelectorAll(sel))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
        .length;
    });
    expect(totalEnDialogo).toBeGreaterThanOrEqual(1);

    // Shift+Tab nada más abrir, con el foco en el título: lo anterior
    // al título en el DOM está fuera del modal, así que sin la trampa
    // el foco escaparía.
    await browser.keys([Key.Shift, Key.Tab]);
    const dentroShiftAlAbrir = await browser.execute(() =>
      document.getElementById('legal-modal').contains(document.activeElement),
    );
    expect(dentroShiftAlAbrir).toBe(true);

    // Devolvemos el foco al título para probar también Tab desde ahí.
    await browser.execute(() => document.getElementById('legal-modal-title').focus());

    // Inmediatamente después de abrir, el foco está en el título
    // (tabindex=-1, fuera de la lista de enfocables). Tab debe llevar
    // al primer control del modal, no a nada fuera.
    await browser.keys([Key.Tab]);
    const dentroTab1 = await browser.execute(() =>
      document.getElementById('legal-modal').contains(document.activeElement),
    );
    expect(dentroTab1).toBe(true);

    // Shift+Tab desde ese primer control debe volver a un control
    // DENTRO del modal, no salir.
    await browser.keys([Key.Shift, Key.Tab]);
    const dentroShiftTab1 = await browser.execute(() =>
      document.getElementById('legal-modal').contains(document.activeElement),
    );
    expect(dentroShiftTab1).toBe(true);

    // Y un buen recorrido de Tabs / Shift+Tabs no debe escapar nunca.
    for (let i = 0; i < totalEnDialogo + 4; i++) {
      await browser.keys([Key.Tab]);
      const dentro = await browser.execute(() =>
        document.getElementById('legal-modal').contains(document.activeElement),
      );
      expect(dentro).toBe(true);
    }
    for (let i = 0; i < totalEnDialogo + 4; i++) {
      await browser.keys([Key.Shift, Key.Tab]);
      const dentro = await browser.execute(() =>
        document.getElementById('legal-modal').contains(document.activeElement),
      );
      expect(dentro).toBe(true);
    }

    // Cerramos para no contaminar pruebas siguientes.
    await browser.keys(Key.Escape);
    await browser.waitUntil(
      async () => (await browser.execute(
        () => document.getElementById('legal-modal').hidden,
      )) === true,
      { timeout: 3_000, timeoutMsg: 'El modal legal no se cerró con Escape' },
    );
  });

  // ── Vista Semana: flechas entre cabeceras de día ──────────────
  it('en Semana, flecha abajo/arriba mueve el foco entre cabeceras de día', async () => {
    // La vista Semana solo pinta los siete días si hay tareas: sin
    // ninguna muestra el estado vacío (T-056). Creamos una para poder
    // recorrer las cabeceras (lo que se comprueba aquí no cambia).
    await browser.keys([Key.Alt, '1']);
    await porId('taskName').waitForDisplayed();
    await crearTarea('Tarea del teclado', 'daily');

    // Vamos a la vista Semana.
    await browser.keys([Key.Alt, '2']);
    await porId('view-week-body-title').waitForDisplayed();

    // Esperamos a que las cabeceras de día estén enganchadas.
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('#view-week .day-header').length === 7,
      ),
      { timeout: 5_000, timeoutMsg: 'La vista Semana no pintó 7 cabeceras de día' },
    );

    // Ponemos el foco en la primera cabecera.
    await browser.execute(() => {
      const first = document.querySelector('#view-week .day-header');
      first.focus();
    });
    const diaInicial = await browser.execute(() =>
      document.activeElement?.querySelector('.day-name')?.textContent?.trim() || '',
    );
    expect(diaInicial).toBe('Lunes');

    // Flecha abajo → Martes.
    await browser.keys([Key.ArrowDown]);
    const diaDespuesAbajo = await browser.execute(() =>
      document.activeElement?.querySelector('.day-name')?.textContent?.trim() || '',
    );
    expect(diaDespuesAbajo).toBe('Martes');

    // Flecha arriba → vuelve a Lunes.
    await browser.keys([Key.ArrowUp]);
    const diaDespuesArriba = await browser.execute(() =>
      document.activeElement?.querySelector('.day-name')?.textContent?.trim() || '',
    );
    expect(diaDespuesArriba).toBe('Lunes');

    // Flecha arriba otra vez → Domingo (wrap).
    await browser.keys([Key.ArrowUp]);
    const diaWrap = await browser.execute(() =>
      document.activeElement?.querySelector('.day-name')?.textContent?.trim() || '',
    );
    expect(diaWrap).toBe('Domingo');
  });

  // ── Limpieza: cerramos cualquier diálogo abierto por si acaso ──
  afterEach(async () => {
    // Clic en el botón de cerrar del modal de ayuda si existe (el
    // handler es el mismo que usa la app, así sincronizamos el estado
    // interno de ShortcutsCard con el DOM); fallback por si el
    // selector no encuentra el botón (el modal no se montó).
    await browser.execute(() => {
      const closeBtn = document.getElementById('shortcuts-close');
      if (closeBtn) closeBtn.click();
      const help = document.getElementById('shortcuts-modal');
      if (help) help.hidden = true;
      const legal = document.getElementById('legal-modal');
      if (legal) legal.hidden = true;
    });
    // Restauramos el foco al menú (no editable) para los tests que
    // pulsan '?' a continuación.
    await browser.execute(() => {
      document.querySelector('button.nav-item[data-view="tasks"]')?.focus();
    });
  });
});