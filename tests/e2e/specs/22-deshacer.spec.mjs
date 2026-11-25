// T-053: deshacer el borrado.
//
// Al borrar una tarea sale un aviso «Tarea «X» eliminada» con un botón
// «Deshacer»: es una región role="status" (lo que anuncia el lector de
// pantalla) y el botón se puede pulsar con el teclado. El aviso se
// cierra solo a los ~8 s.
//
// Al pulsar «Deshacer», la tarea vuelve a la lista en la posición que
// tenía, con su id y con sus marcas de «hecho».
//
// La primera prueba usa el TECLADO de verdad: le da el foco al botón
// «Deshacer» (un <button>, o sea, alcanzable con el Tab) y lo activa
// con Enter. Si el botón no fuera alcanzable con el teclado, la
// prueba se quedaría en rojo.
//
// «Borrar todo» (Ajustes › Datos) pide confirmación en un diálogo
// propio de la app (con la trampa de foco de ui/a11y.js, no el
// diálogo del navegador) y también se puede deshacer.
//
// Borrar un tema guardado (Ajustes › Apariencia) sale sin pregunta de
// confirmación del navegador y también se puede deshacer.

import {
  abrirAppNueva,
  crearTarea,
  nombresDeTareas,
  irASemana,
  irATareas,
  irAGestionDatos,
  esperarStatus,
  navegarVistaAlt,
} from '../helpers.mjs';

// El botón de eliminar de la fila `i` (0-based) de la lista.
// OJO: las filas y los paneles de edición son hermanos y los dos son
// <div>: las filas siempre son los DIVs impares (1, 3, 5…).
const btnTrash = (i) => $(`#taskListMount .task-row:nth-of-type(${2 * i + 1}) .btn-trash`);

// El aviso con «Deshacer» y su botón (el aviso vive en <body>).
const aviso       = () => $('.aviso');
const btnDeshacer = () => $('.aviso .aviso-accion');

// El diálogo de confirmación de «Borrar todo» y sus botones.
const dialogo     = () => $('.dialogo-capa .dialogo');
const btnAceptar  = () => $('.dialogo-capa .dialogo-btn[data-accion="aceptar"]');
const btnCancelar = () => $('.dialogo-capa .dialogo-btn[data-accion="cancelar"]');

/** Enciende el interruptor "Gestionar" (el que deja ver el botón de
 *  eliminar). El <input> está visualmente oculto: se pulsa el slider
 *  visible que tiene al lado, como haría una persona. */
const activarGestionar = async () => {
  if (!(await $('#editToggle').isSelected())) {
    const slider = await $('#editToggle + .slider');
    await slider.scrollIntoView();
    await slider.click();
  }
};

/** Los ids de las tareas, en el orden de la lista. */
const idsDeTareas = () => browser.execute(
  () => (window.PlannerApi?.listTasks() ?? []).map(t => t.id),
);

/** Cuántas tareas hay ahora mismo (sin mirar la vista). */
const numeroDeTareas = () => browser.execute(
  () => (window.PlannerApi?.listTasks() ?? []).length,
);

/** Deja el elemento en el centro de la pantalla. La barra superior es
 *  fija: si el elemento se deja arriba del todo, el clic lo intercepta
 *  la barra en vez de llegar al botón. */
const verEnCentro = (selector) => browser.execute(
  (sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }),
  selector,
);

describe('Deshacer el borrado (T-053)', () => {

  before(async () => {
    await abrirAppNueva();
    await crearTarea('Tarea A', 'daily');
    await crearTarea('Tarea B', 'daily');
    await crearTarea('Tarea C', 'daily');
    await expect($('#taskCount')).toHaveText('3');
  });

  it('borrar una tarea avisa y «Deshacer» la devuelve con su id y sus marcas', async () => {
    // El id de la tarea B (la del medio): después de deshacer tiene que
    // ser el MISMO.
    const ids = await idsDeTareas();
    expect(ids.length).toBe(3);

    // Marcamos B como hecha en la vista Semana: al deshacer, su marca
    // de «hecho» tiene que volver con ella.
    await irASemana();
    const celda = await $('#view-week .day-cell.is-today');
    const casillas = await celda.$$('.task-check');
    expect(casillas.length).toBe(3);
    await casillas[1].click();
    await browser.waitUntil(
      async () => (await (await celda.$('.day-progress')).getText()).trim() === '1/3 hechas',
      { timeout: 5_000, timeoutMsg: 'No se pudo marcar la tarea B como hecha' },
    );

    // Ahora la borramos desde la lista de Tareas.
    await irATareas();
    await activarGestionar();
    await btnTrash(1).click();

    // La lista ya no tiene B...
    await expect($('#taskCount')).toHaveText('2');
    expect(await nombresDeTareas()).toEqual(['Tarea A', 'Tarea C']);

    // ...pero sale el aviso, con su texto y su botón «Deshacer».
    await aviso().waitForDisplayed({ timeout: 5_000 });
    expect((await aviso().getText()).trim()).toContain('Tarea «Tarea B» eliminada');
    expect((await btnDeshacer().getText()).trim()).toBe('Deshacer');

    // El aviso es una región role="status" (es lo que anuncia el
    // lector de pantalla).
    const rol = await browser.execute(
      () => document.querySelector('.aviso')?.getAttribute('role') ?? '',
    );
    expect(rol).toBe('status');

    // El botón «Deshacer» se usa con el TECLADO, no con el ratón: se
    // le da el foco (lo que hace el Tab al llegar a él) y se activa con
    // Enter. Si no fuera alcanzable con el teclado (si no fuera un
    // <button> de verdad), no recibiría el foco y esta prueba fallaría.
    const teclado = await browser.execute(() => {
      const btn = document.querySelector('.aviso .aviso-accion');
      if (!btn) return { existe: false };
      btn.focus();
      return {
        existe: true,
        etiqueta: btn.tagName,
        // Un <button> tiene tabIndex 0: está en el orden del Tab.
        enTabulador: btn.tabIndex >= 0,
        conFoco: document.activeElement === btn,
      };
    });
    expect(teclado.existe).toBe(true);
    expect(teclado.etiqueta).toBe('BUTTON');
    expect(teclado.enTabulador).toBe(true);
    expect(teclado.conFoco).toBe(true);

    // Y se activa con Enter (una tecla de verdad).
    await browser.keys(['Enter']);

    // La tarea vuelve a su sitio...
    await browser.waitUntil(
      async () => (await numeroDeTareas()) === 3,
      { timeout: 5_000, timeoutMsg: 'La tarea no volvió tras deshacer' },
    );
    expect(await nombresDeTareas()).toEqual(['Tarea A', 'Tarea B', 'Tarea C']);
    // ...con el mismo id...
    expect(await idsDeTareas()).toEqual(ids);
    // ...y con su marca de «hecho».
    await irASemana();
    const celda2 = await $('#view-week .day-cell.is-today');
    const casillas2 = await celda2.$$('.task-check');
    expect(casillas2.length).toBe(3);
    expect(await casillas2[1].isSelected()).toBe(true);
    expect((await (await celda2.$('.day-progress')).getText()).trim()).toBe('1/3 hechas');
  });

  it('el aviso se cierra solo a los ~8 s y la tarea se queda borrada', async () => {
    await irATareas();
    await activarGestionar();
    await btnTrash(0).click();          // borra «Tarea A»

    await aviso().waitForDisplayed({ timeout: 5_000 });
    expect(await nombresDeTareas()).toEqual(['Tarea B', 'Tarea C']);

    // El aviso se va solo (a los ~8 s), sin que nadie pulse nada.
    await browser.waitUntil(
      async () => (await $$('.aviso')).length === 0,
      { timeout: 15_000, timeoutMsg: 'El aviso no se cerró solo' },
    );

    // Y la tarea sigue borrada: el aviso solo informa, no deshace.
    expect(await nombresDeTareas()).toEqual(['Tarea B', 'Tarea C']);
  });

  it('«Borrar todo» pide confirmación en un diálogo propio y se puede deshacer', async () => {
    await irAGestionDatos();

    // Escuchamos los cambios de la app: «Borrar todo» tiene que
    // despachar `planner:changed` (T-053).
    await browser.execute(() => {
      window.__changed = [];
      if (window.__changedHandler) {
        window.removeEventListener('planner:changed', window.__changedHandler);
      }
      window.__changedHandler = (e) => {
        window.__changed.push({
          action: e.detail?.action ?? null,
          status: e.detail?.status ?? null,
        });
      };
      window.addEventListener('planner:changed', window.__changedHandler);
    });

    // El botón «Borrar» abre el diálogo de la app (no el del
    // navegador).
    await $('#clearAllBtn').click();
    await dialogo().waitForDisplayed({ timeout: 5_000 });

    // Es un diálogo accesible: role="dialog", aria-modal y el foco
    // dentro (la trampa de foco de ui/a11y.js).
    const attrs = await browser.execute(() => {
      const d = document.querySelector('.dialogo-capa .dialogo');
      return {
        role:      d?.getAttribute('role') ?? '',
        modal:     d?.getAttribute('aria-modal') ?? '',
        focoDentro: !!d?.contains(document.activeElement),
      };
    });
    expect(attrs.role).toBe('dialog');
    expect(attrs.modal).toBe('true');
    expect(attrs.focoDentro).toBe(true);

    // Cancelar no borra nada.
    await btnCancelar().click();
    await browser.waitUntil(
      async () => (await $$('.dialogo-capa')).length === 0,
      { timeout: 5_000, timeoutMsg: 'El diálogo no se cerró' },
    );
    expect(await numeroDeTareas()).toBe(2);

    // Los ids de las tareas, para comprobar que vuelven con el
    // «Deshacer».
    const ids = await idsDeTareas();
    expect(ids.length).toBe(2);

    // Ahora sí: «Borrar todo».
    await $('#clearAllBtn').click();
    await dialogo().waitForDisplayed({ timeout: 5_000 });
    await btnAceptar().click();

    // La lista está vacía...
    await esperarStatus('#dataStatus', '🗑️ Datos borrados');
    expect(await numeroDeTareas()).toBe(0);
    // ...y la app entera se ha enterado del cambio.
    const eventos = await browser.execute(() => window.__changed);
    expect(eventos.some(e => e.action === 'clear')).toBe(true);

    // Y se puede deshacer.
    await aviso().waitForDisplayed({ timeout: 5_000 });
    await btnDeshacer().click();

    await browser.waitUntil(
      async () => (await numeroDeTareas()) === 2,
      { timeout: 5_000, timeoutMsg: 'Las tareas no volvieron tras deshacer' },
    );
    // Vuelven con su id...
    expect(await idsDeTareas()).toEqual(ids);
    // ...y la vista Tareas las vuelve a mostrar.
    await irATareas();
    expect(await nombresDeTareas()).toEqual(['Tarea B', 'Tarea C']);
  });

  it('borrar un tema guardado también se puede deshacer', async () => {
    // Ajustes › Apariencia.
    await navegarVistaAlt(6);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('input[name="theme"]').length > 0,
      ),
      { timeout: 5_000, timeoutMsg: 'Los radios de Tema no se han pintado' },
    );

    // Modo edición: sin él no sale el formulario de guardado ni el
    // botón «Eliminar» de los temas guardados. El <input> está
    // visualmente oculto: se pulsa el slider visible que tiene al lado,
    // como haría una persona.
    const slider = await $('#customEditToggle + .settings-slider');
    await slider.scrollIntoView();
    await slider.click();
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.getElementById('customEditToggle')?.checked === true,
      ),
      { timeout: 5_000, timeoutMsg: 'No se activó el modo edición' },
    );

    // Se guarda un tema.
    await $('#customName').setValue('Mi tema');
    await $('input[name="customScheme"][value="dark"]').click();
    await $('#customSave').click();

    // Aparece en la lista de temas guardados.
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('#savedThemeOptions .saved-theme-row').length === 1,
      ),
      { timeout: 5_000, timeoutMsg: 'El tema guardado no apareció' },
    );
    const idTema = await browser.execute(
      () => document.querySelector('#savedThemeOptions .saved-theme-delete')?.dataset.id ?? '',
    );
    expect(idTema).not.toBe('');

    // Se borra: desaparece de la lista y sale el aviso con «Deshacer»
    // (ya sin la pregunta de confirmación del navegador).
    await verEnCentro('#savedThemeOptions .saved-theme-delete');
    await $('#savedThemeOptions .saved-theme-delete').click();
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('#savedThemeOptions .saved-theme-row').length === 0,
      ),
      { timeout: 5_000, timeoutMsg: 'El tema guardado no se borró' },
    );
    await aviso().waitForDisplayed({ timeout: 5_000 });
    expect((await aviso().getText()).trim()).toContain('Tema «Mi tema» eliminado');

    // Y se deshace: el tema vuelve con su id.
    await btnDeshacer().click();
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('#savedThemeOptions .saved-theme-row').length === 1,
      ),
      { timeout: 5_000, timeoutMsg: 'El tema no volvió tras deshacer' },
    );
    const idRestaurado = await browser.execute(
      () => document.querySelector('#savedThemeOptions .saved-theme-delete')?.dataset.id ?? '',
    );
    expect(idRestaurado).toBe(idTema);
  });
});
