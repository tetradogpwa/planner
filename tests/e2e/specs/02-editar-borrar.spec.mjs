// Recorrido del interruptor "Gestionar" de la vista Tareas: editar una
// tarea (cambiando nombre y tipo), cancelar la edición, y borrar
// tareas (incluido el caso de vaciar la lista). Tras cada cambio
// comprobamos dónde queda el foco: editar guarda deja el foco en un
// anclaje estable; cancelar lo devuelve al botón Editar de la fila;
// borrar lo mantiene en la fila que pasa a ocupar la posición borrada
// (o la anterior si era la última, o el interruptor "Gestionar" si la
// lista queda vacía). En ningún caso debe quedar en <body>.

import {
  abrirAppNueva,
  crearTarea,
  nombresDeTareas,
  tiposDeTareas,
  irASemana,
  irATareas,
  celdasCon,
  recargar,
} from '../helpers.mjs';

// Selector del botón "Editar" de la fila `i` (0-based) de la lista.
// OJO: las filas y los paneles de edición son hermanos y los dos son
// <div>. `:nth-of-type` cuenta por tipo de elemento (DIV), así que
// `.task-row:nth-of-type(2)` no existe (el 2º DIV es un panel, no una
// fila). Las filas siempre son los DIVs impares: 1, 3, 5… → fórmula
// `2*i+1`.
const btnEdit   = (i) => $(`#taskListMount .task-row:nth-of-type(${2 * i + 1}) .btn-edit`);
const btnTrash  = (i) => $(`#taskListMount .task-row:nth-of-type(${2 * i + 1}) .btn-trash`);

// Helper: enciende el interruptor "Gestionar" si aún no lo está.
// El <input id="editToggle"> está visualmente oculto (opacity:0;
// width/height 0); clicar el slider visible que tiene al lado es lo
// que haría una persona con el ratón, y es lo que activa el input.
// Tras recargar la app, el slider puede quedar fuera del viewport
// efectivo del weston headless (1100×760 px con el sidebar expandido),
// así que primero lo llevamos al viewport con scrollIntoView() antes
// del clic real de WebdriverIO. Sin fallback DOM: si WebdriverIO no
// consigue clicar el slider, el fallo debe verse aquí, no esconderse.
const activarGestionar = async () => {
  if (!(await $('#editToggle').isSelected())) {
    const slider = await $('#editToggle + .slider');
    await slider.scrollIntoView();
    await slider.click();
  }
};

// Helper: espera a que la lista tenga al menos `n` filas y a que el
// Gestionar esté apagado (estado inicial al recargar). Evita clics
// prematuros sobre elementos aún no enganchados por los listeners.
const esperarLista = async (n) => {
  await browser.waitUntil(
    async () => (await $$('#taskListMount .task-row').length) >= n,
    { timeout: 5_000, timeoutMsg: `La lista no llegó a tener ${n} filas` },
  );
};

// Lee el id (o, en su defecto, una firma) del elemento con foco. Lo
// usamos en lugar de comparar el WebElement entero, que cambia entre
// repintados.
const focoActual = () => browser.execute(() => {
  const a = document.activeElement;
  if (!a) return { tag: null, id: null, cls: null, text: null };
  return {
    tag:  a.tagName,
    id:   a.id || null,
    cls:  a.className || null,
    text: (a.textContent || '').trim().slice(0, 60),
  };
});

// Devuelve la fila (1-based) que contiene al elemento con foco, o -1
// si el foco está fuera de las filas de tareas.
const filaDelFoco = () => browser.execute(() => {
  const row = document.activeElement?.closest('.task-row');
  if (!row) return -1;
  // nth-of-type: entre los .task-row hermanos.
  let idx = 0;
  for (const sib of row.parentElement.children) {
    if (sib.classList.contains('task-row')) {
      if (sib === row) return idx; // 0-based
      idx++;
    }
  }
  return -1;
});

describe('Vista Tareas: editar y borrar (interruptor Gestionar)', () => {

  before(async () => {
    await abrirAppNueva();
    // Creamos tres tareas desde el principio: la edición y los borrados
    // actúan sobre ellas. Usamos tipos distintos para que las pruebas
    // puedan distinguir visualmente el cambio.
    await crearTarea('Tarea A', 'daily');
    await crearTarea('Tarea B', 'daily');
    await crearTarea('Tarea C', 'daily');
    await expect($('#taskCount')).toHaveText('3');
  });

  // ── Editar ────────────────────────────────────────────────────────────

  it('con Gestionar activado, edita el nombre y el tipo (Diaria → Días específicos)', async () => {
    await esperarLista(3);
    await activarGestionar();

    // Abre el panel de la fila 1 (Tarea A).
    await btnEdit(0).click();
    await $('#editTaskName').waitForDisplayed();

    // Cambia el nombre y el tipo a "days" (Días específicos).
    await $('#editTaskName').setValue('Tarea A editada');
    await $('input[name="edit-repeat"][value="days"]').click();

    // Marca lunes y jueves (0 y 3). El `days-grid` aparece en
    // #editExtraOptions, dentro del panel de edición. Los checkboxes
    // tienen data-day="${i}" con un prefijo "edw" propio del editor.
    const lunes   = $('#editExtraOptions input[type="checkbox"][data-day="0"]');
    const jueves  = $('#editExtraOptions input[type="checkbox"][data-day="3"]');
    await lunes.waitForDisplayed();
    await lunes.click();
    await jueves.click();

    // Guarda.
    await $('#saveEditBtn').click();

    // El panel se cierra y la lista refleja el cambio de nombre y tipo.
    await expect($('#taskName')).toBeDisplayed(); // el form de creación vuelve a estar listo
    expect(await nombresDeTareas()).toEqual(['Tarea A editada', 'Tarea B', 'Tarea C']);
    expect(await tiposDeTareas()).toEqual(['Días esp.', 'Diaria', 'Diaria']);
  });

  it('en la vista Semana, la tarea editada aparece solo en lunes y jueves', async () => {
    await irASemana();
    expect(await celdasCon('Tarea A editada'))
      .toEqual([true, false, false, true, false, false, false]);
  });

  it('el cambio sigue guardado tras recargar la app', async () => {
    expect(await recargar()).toBe('app');
    expect(await nombresDeTareas()).toEqual(['Tarea A editada', 'Tarea B', 'Tarea C']);
    expect(await tiposDeTareas()).toEqual(['Días esp.', 'Diaria', 'Diaria']);

    // En Semana, la insignia editada sigue respetando los días elegidos.
    await irASemana();
    expect(await celdasCon('Tarea A editada'))
      .toEqual([true, false, false, true, false, false, false]);

    // Volvemos a la vista Tareas con el menú lateral (como una persona)
    // para que el siguiente test (cancelar edición) opere sobre la
    // lista de tareas.
    await irATareas();
  });

  // ── Cancelar la edición ───────────────────────────────────────────────

  it('cancelar (✕) no cambia la tarea y deja el foco en el botón Editar de esa fila', async () => {
    // Tras la recarga, Gestionar está apagado y la lista se re-pinta;
    // esperamos a que las 3 filas estén enganchadas antes del primer
    // clic para evitar acciones sobre elementos aún no listos.
    await esperarLista(3);

    // Tras la recarga, Gestionar está apagado; lo encendemos.
    await activarGestionar();

    // Abrimos el panel de la fila 2 (Tarea B).
    await btnEdit(1).click();
    await $('#editTaskName').waitForDisplayed();

    // Modificamos el nombre y el tipo, pero NO guardamos.
    await $('#editTaskName').setValue('Nombre provisional');
    await $('input[name="edit-repeat"][value="interval"]').click();

    // Cancelamos con el botón ✕ (id="cancelEditBtn").
    await $('#cancelEditBtn').click();

    // El panel se cierra y los datos no han cambiado.
    expect(await nombresDeTareas()).toEqual(['Tarea A editada', 'Tarea B', 'Tarea C']);
    expect(await tiposDeTareas()).toEqual(['Días esp.', 'Diaria', 'Diaria']);

    // El foco vuelve al botón Editar de la fila 2 (índice 1).
    const filaFoco = await filaDelFoco();
    expect(filaFoco).toBe(1);

    // Y el elemento concreto con foco es el .btn-edit de esa fila.
    const foco = await focoActual();
    expect(foco.cls).toContain('btn-edit');

    // El foco nunca queda en <body>.
    expect(foco.tag).not.toBe('BODY');
  });

  // ── Borrar (3 casos: medio, última, vaciar la lista) ───────────────────

  it('borrar la tarea del medio (fila 2) deja el foco en el botón Eliminar de la fila que ahora ocupa su posición', async () => {
    // Estado actual: [Tarea A editada, Tarea B, Tarea C] (índices 0,1,2).
    // Tras borrar la 1 (índice 1, "Tarea B"), la lista pasa a
    // [Tarea A editada, Tarea C] y el foco debe quedar en el
    // .btn-trash de la nueva fila 2 ("Tarea C"), la que antes era la 3.
    await btnTrash(1).click();

    // La lista refleja el borrado: contador y nombres.
    await expect($('#taskCount')).toHaveText('2');
    expect(await nombresDeTareas()).toEqual(['Tarea A editada', 'Tarea C']);

    // El foco está en la fila 2 (la que ha ocupado la posición borrada)
    // y el elemento concreto es el botón Eliminar.
    expect(await filaDelFoco()).toBe(1);
    const foco = await focoActual();
    expect(foco.cls).toContain('btn-trash');
    expect(foco.tag).not.toBe('BODY');

    // La tarea borrada tampoco debe quedar en la vista Semana: vamos
    // con el menú lateral, comprobamos que Tarea B ya no aparece en
    // ninguna celda y volvemos a Tareas con el menú (como una persona).
    await irASemana();
    expect(await celdasCon('Tarea B')).toEqual([false, false, false, false, false, false, false]);
    await irATareas();
  });

  it('borrar la última tarea lleva el foco al botón Eliminar de la anterior', async () => {
    // Estado actual: [Tarea A editada, Tarea C]. Borramos la última
    // (índice 1). El foco debe caer al botón Eliminar de la fila
    // anterior (la única que queda), no a <body>.
    // Tras la navegación Semana → Tareas del test anterior, Gestionar
    // queda apagado (la tarjeta se reconstruye en cada navegación a
    // 'tasks'); re-encendemos Gestionar para seguir borrando, igual
    // que haría una persona.
    await activarGestionar();
    await btnTrash(1).click();

    await expect($('#taskCount')).toHaveText('1');
    expect(await nombresDeTareas()).toEqual(['Tarea A editada']);

    expect(await filaDelFoco()).toBe(0);
    const foco = await focoActual();
    expect(foco.cls).toContain('btn-trash');
    expect(foco.tag).not.toBe('BODY');
  });

  it('vaciar la lista lleva el foco al interruptor Gestionar', async () => {
    // Estado actual: [Tarea A editada]. Borramos la última.
    await btnTrash(0).click();

    await expect($('#taskCount')).toHaveText('0');
    expect(await nombresDeTareas()).toEqual([]);

    // No debe haber ninguna fila; el foco salta al interruptor
    // Gestionar (#editToggle) para no perderse el recorrido.
    const totalFilas = await $$('#taskListMount .task-row').length;
    expect(totalFilas).toBe(0);
    const foco = await focoActual();
    expect(foco.id).toBe('editToggle');
    expect(foco.tag).not.toBe('BODY');
  });
});