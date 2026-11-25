// Estados vacíos de las vistas Tareas y Semana (T-056).
//
// En una instalación recién hecha (sin ninguna tarea) las dos vistas
// tienen que explicar qué es la app y dar el paso siguiente:
//   * Tareas: qué es la app, un ejemplo y el foco en el campo del
//     nombre de la tarea.
//   * Semana: un enlace para crear la primera tarea (en vez de los
//     siete "Sin tareas" sin explicación).
// En cuanto hay una tarea, los dos estados vacíos desaparecen; y
// vuelven a aparecer si se borra la última.

import {
  abrirAppNueva,
  crearTarea,
  nombresDeTareas,
} from '../helpers.mjs';

/** Abre la vista Semana con el menú lateral y espera a que esté
 *  activa. No se usa el helper `irASemana`: ese espera a que se
 *  pinten las celdas de los días, y con el estado vacío no hay
 *  ninguna celda. */
async function irASemana() {
  await $('button.nav-item[data-view="week"]').click();
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.getElementById('view-week')?.classList.contains('active') ?? false,
    ),
    { timeout: 5_000, timeoutMsg: 'La vista Semana no se abrió' },
  );
}

/** El id del elemento con foco (o cadena vacía). */
const focoId = () => browser.execute(() => document.activeElement?.id ?? '');

/** Espera a que el foco esté en el elemento con el id dado. */
async function esperarFoco(id) {
  await browser.waitUntil(
    async () => (await focoId()) === id,
    { timeout: 5_000, timeoutMsg: `El foco no llegó a #${id}` },
  );
}

/** Enciende el interruptor "Gestionar" (sin él no se ven los botones
 *  de editar y eliminar). Se clica el slider, que es lo que hace una
 *  persona con el ratón. */
async function activarGestionar() {
  if (!(await $('#editToggle').isSelected())) {
    const slider = await $('#editToggle + .slider');
    await slider.scrollIntoView();
    await slider.click();
  }
}

describe('Primer uso: los estados vacíos de Tareas y Semana', () => {

  before(async () => {
    await abrirAppNueva();
  });

  it('en Tareas, sin tareas, se explica qué es la app y cómo empezar', async () => {
    // El estado vacío está a la vista...
    await expect($('#tasksEmpty')).toBeDisplayed();

    // ...y dice qué es la app, da un ejemplo y dice dónde escribir.
    const texto = await $('#tasksEmpty').getText();
    expect(texto).toContain('Planificador Semanal');
    expect(texto).toContain('Beber agua');
    expect(texto).toContain('Añadir tarea');

    // La lista de tareas está vacía de verdad (no hay filas).
    expect(await nombresDeTareas()).toEqual([]);
    await expect($('#taskCount')).toHaveText('0');
  });

  it('el botón del estado vacío lleva el foco al campo donde se escribe el nombre', async () => {
    await $('#tasksEmptyBtn').click();
    await esperarFoco('taskName');
  });

  it('en Semana, sin tareas, se ve el estado vacío en vez de los siete "Sin tareas"', async () => {
    await irASemana();

    // El estado vacío de la semana está a la vista.
    await expect($('#view-week .estado-vacio')).toBeDisplayed();
    const texto = await $('#view-week .estado-vacio').getText();
    expect(texto).toContain('Crear la primera tarea');

    // Y no hay ninguna celda de día ni ningún "Sin tareas".
    expect(await $$('#view-week .day-cell').length).toBe(0);
    const sinTareas = await browser.execute(() =>
      Array.from(document.querySelectorAll('#view-week .empty-day'))
        .map(el => el.textContent.trim()),
    );
    expect(sinTareas).toEqual([]);
  });

  it('el enlace "Crear la primera tarea" lleva a Tareas con el foco en el campo del nombre', async () => {
    await $('#view-week .estado-vacio-btn').click();

    // Estamos en la vista Tareas...
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.getElementById('view-tasks')?.classList.contains('active') ?? false,
      ),
      { timeout: 5_000, timeoutMsg: 'No se volvió a la vista Tareas' },
    );
    // ...y el foco está en el campo donde se escribe el nombre.
    await esperarFoco('taskName');
  });

  it('al crear la primera tarea, los dos estados vacíos desaparecen', async () => {
    await crearTarea('Beber agua', 'daily');

    // En Tareas: la lista ya tiene la tarea y el estado vacío no está.
    await expect($('#taskCount')).toHaveText('1');
    expect(await nombresDeTareas()).toEqual(['Beber agua']);
    await expect($('#tasksEmpty')).not.toBeDisplayed();

    // En Semana: los siete días vuelven a pintarse.
    await irASemana();
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelectorAll('#view-week .day-cell').length === 7,
      ),
      { timeout: 5_000, timeoutMsg: 'La vista Semana no pintó los 7 días' },
    );
    await expect($('#view-week .estado-vacio')).not.toBeDisplayed();
  });

  it('al borrar la última tarea, los dos estados vacíos vuelven a aparecer', async () => {
    // Borramos la única tarea desde la vista Tareas, con el interruptor
    // "Gestionar" encendido (como haría una persona).
    await $('button.nav-item[data-view="tasks"]').click();
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.getElementById('view-tasks')?.classList.contains('active') ?? false,
      ),
      { timeout: 5_000, timeoutMsg: 'No se volvió a la vista Tareas' },
    );
    await activarGestionar();
    await $('#taskListMount .btn-trash').click();

    await expect($('#taskCount')).toHaveText('0');
    await expect($('#tasksEmpty')).toBeDisplayed();

    // Y la Semana vuelve a su estado vacío.
    await irASemana();
    await expect($('#view-week .estado-vacio')).toBeDisplayed();
    expect(await $$('#view-week .day-cell').length).toBe(0);
  });
});
