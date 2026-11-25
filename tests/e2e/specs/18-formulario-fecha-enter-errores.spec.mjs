// T-048: el formulario de tarea tiene fecha de inicio, es un <form>
// (Enter en el nombre añade la tarea) y sus errores no usan alert().
//
// Se recorre:
//   1. Se crea una tarea con una fecha futura y sale ese día en la
//      vista Semana (y no en los demás).
//   2. Enter en el campo del nombre crea la tarea, que se avisa en una
//      región role="status".
//   3. Con el nombre vacío no se abre ninguna ventana de diálogo: el
//      error sale junto al campo, el campo queda marcado como inválido
//      y el foco vuelve a él.
//
// La app saca "hoy" de `new Date()`, así que la prueba fija la fecha con
// un reloj falso (como en la spec 16): la semana que se espera es
// siempre la del lunes 09/03/2026 al domingo 15/03/2026 y la fecha
// futura, la del miércoles 18/03/2026.

import { Key } from 'webdriverio';
import {
  abrirAppNueva,
  celdasCon,
  esperarCeldasSemana,
  esperarPintado,
  irASemana,
  irATareas,
} from '../helpers.mjs';

// Miércoles 11/03/2026.
const HOY = '2026-03-11';
// Miércoles de la semana siguiente: la fecha que se elige en el
// formulario.
const FECHA_FUTURA = '2026-03-18';
const SEMANA_SIGUIENTE = '16/03/2026';

/** Sustituye el constructor Date de la página por uno que siempre
 *  devuelve la fecha fijada (un reloj falso). La app usa `new Date()`
 *  para saber qué día es hoy, así que con esto la semana que se pinta
 *  no depende del día real en que se ejecuta la prueba. */
async function fijarFecha(iso) {
  await browser.execute((fecha) => {
    const [a, m, d] = fecha.split('-').map(Number);
    const fija = new Date(a, m - 1, d);
    const Real = Date;
    window.Date = new Proxy(Real, {
      construct: (target, args) =>
        args.length === 0 ? new target(fija.getTime()) : new target(...args),
      get: (target, prop) =>
        prop === 'now' ? () => fija.getTime() : Reflect.get(target, prop),
    });
  }, iso);
}

/** Texto del título de la semana (el que anuncia el cambio). */
const tituloSemana = () => browser.execute(
  () => document.getElementById('view-week-body-title')?.textContent?.trim() ?? '',
);

/** Espera a que el título de la semana contenga el texto dado. */
async function esperarSemana(texto) {
  await browser.waitUntil(
    async () => (await tituloSemana()).includes(texto),
    { timeout: 5_000, timeoutMsg: `El título de la semana no contiene "${texto}"` },
  );
}

describe('Formulario de tarea: fecha, Enter y errores sin alert()', () => {

  before(async () => {
    await abrirAppNueva();
    // Reloj falso: a partir de aquí la app cree que hoy es el
    // 11/03/2026.
    await fijarFecha(HOY);
    await irATareas();
    await $('#taskName').waitForDisplayed();
  });

  it('una tarea con fecha futura sale ese día en la vista Semana', async () => {
    // La etiqueta del campo de fecha dice "Fecha" cuando la tarea no
    // se repite (no tiene una fecha de "empiece") y "Empieza el"
    // cuando sí. El `for` de la etiqueta y el id del campo no cambian.
    // (El texto se lee del DOM: el CSS lo pone en mayúsculas como las
    // demás etiquetas del formulario.)
    const textoEtiqueta = () => browser.execute(
      () => document.querySelector('label[for="taskDate"]')?.textContent?.trim() ?? '',
    );

    expect(await textoEtiqueta()).toBe('Fecha');
    expect(await $('label[for="taskDate"]').getAttribute('for')).toBe('taskDate');
    expect(await $('#taskDate').getAttribute('id')).toBe('taskDate');

    await $('input[name="repeat"][value="daily"]').click();
    expect(await textoEtiqueta()).toBe('Empieza el');
    // El id del campo y el `for` de la etiqueta siguen siendo los
    // mismos: solo cambia el texto.
    expect(await $('label[for="taskDate"]').getAttribute('for')).toBe('taskDate');
    expect(await $('#taskDate').getAttribute('id')).toBe('taskDate');

    // Vuelve a "Sin repetición" (una sola vez: sale solo ese día) y se
    // crea la tarea con la fecha elegida.
    await $('input[name="repeat"][value="no-repeat"]').click();
    await $('#taskName').setValue('Tarea futura');
    await $('#taskDate').setValue(FECHA_FUTURA);
    await $('#addTaskBtn').click();
    await expect($('#taskCount')).toHaveText('1');

    // En la vista Semana sale en la semana del 16/03 y solo en el
    // miércoles 18/03.
    await irASemana();
    await esperarSemana('09/03/2026');
    expect(await celdasCon('Tarea futura')).toEqual(
      [false, false, false, false, false, false, false],
    );

    await esperarPintado(async () => {
      await $('#week-nav-next').click();
    });
    await esperarSemana(SEMANA_SIGUIENTE);
    // Las celdas de la semana nueva se inyectan de forma asíncrona:
    // se espera a que estén pintadas antes de leerlas.
    await esperarCeldasSemana();
    expect(await celdasCon('Tarea futura')).toEqual(
      [false, false, true, false, false, false, false],
    );
  });

  it('Enter en el campo del nombre crea la tarea y se avisa', async () => {
    await irATareas();
    await $('#taskName').waitForDisplayed();

    await $('#taskName').click();
    await $('#taskName').setValue('Tarea con Enter');
    await browser.keys([Key.Enter]);

    await expect($('#taskCount')).toHaveText('2');

    // El aviso va en una región role="status" (para que lo anuncie el
    // lector de pantalla), no en una ventana de diálogo.
    expect(await $('#taskStatus').getAttribute('role')).toBe('status');
    expect(await $('#taskStatus').getText()).toBe('Tarea «Tarea con Enter» añadida');
  });

  it('con el nombre vacío el error sale junto al campo, sin ventana de diálogo', async () => {
    await irATareas();
    await $('#taskName').waitForDisplayed();

    // Se sustituye alert() por una sonda: si la app abriera una
    // ventana de diálogo, el mensaje quedaría registrado aquí.
    await browser.execute(() => {
      window.__alertas = [];
      window.alert = (mensaje) => { window.__alertas.push(String(mensaje)); };
    });

    // El nombre está vacío, así que la tarea no se puede guardar.
    await $('#addTaskBtn').click();

    // Ninguna ventana de diálogo.
    expect(await browser.execute(() => window.__alertas ?? [])).toEqual([]);

    // El error se ve junto al campo y dice qué pasa.
    expect(await $('#taskError').getText()).toBe('Nombre requerido');
    expect(await $('#taskError').isDisplayed()).toBe(true);

    // El campo queda marcado como inválido y descrito por el error.
    // (Los atributos se leen con el comando nativo del WebDriver: leer
    // `aria-describedby` desde un script hace que WebKit calcule la
    // descripción accesible del campo y el script falla.)
    expect(await $('#taskName').getAttribute('aria-invalid')).toBe('true');
    expect(await $('#taskName').getAttribute('aria-describedby')).toBe('taskError');

    // El foco vuelve al campo del nombre.
    expect(await browser.execute(() => document.activeElement?.id ?? '')).toBe('taskName');

    // Y no se ha creado ninguna tarea.
    expect(await $('#taskCount').getText()).toBe('2');

    // Al corregir el nombre, el error se borra y el campo deja de
    // estar marcado como inválido.
    await $('#taskName').setValue('Ahora sí');
    expect(await $('#taskError').getText()).toBe('');
    expect(await $('#taskName').getAttribute('aria-invalid')).toBe(null);
    expect(await $('#taskName').getAttribute('aria-describedby')).toBe(null);

    // La tarea no se ha creado de verdad: el contador sigue en 2.
    expect(await $('#taskCount').getText()).toBe('2');
  });

  it('en la edición, el campo de fecha trae la fecha de la tarea', async () => {
    await irATareas();
    await $('#taskName').waitForDisplayed();

    // Con "Gestionar" activado se abre el panel de edición de la
    // primera fila (la tarea con la fecha futura). Las filas y los
    // paneles son <div> hermanos: las filas son los DIVs impares.
    if (!(await $('#editToggle').isSelected())) {
      const slider = await $('#editToggle + .slider');
      await slider.scrollIntoView();
      await slider.click();
    }
    await $('#taskListMount .task-row:nth-of-type(1) .btn-edit').click();
    await $('#editTaskName').waitForDisplayed();

    // El campo de fecha de la edición trae la fecha de la tarea (la
    // elegida en el alta), no la de hoy.
    expect(await $('#editTaskDate').getValue()).toBe(FECHA_FUTURA);

    // Al guardar, la tarea sigue en su día: la fecha no se pierde.
    await $('#saveEditBtn').click();
    await expect($('#taskCount')).toHaveText('2');

    await irASemana();
    await esperarSemana('09/03/2026');
    await esperarPintado(async () => {
      await $('#week-nav-next').click();
    });
    await esperarSemana(SEMANA_SIGUIENTE);
    await esperarCeldasSemana();
    expect(await celdasCon('Tarea futura')).toEqual(
      [false, false, true, false, false, false, false],
    );
  });
});
