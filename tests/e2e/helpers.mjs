// Utilidades comunes de los specs E2E. Actúan sobre la interfaz como
// lo haría una persona (clics y teclado), sin tocar el estado interno
// de la app.

/** Espera a que la app termine de arrancar: o la pantalla de términos
 *  o la vista de tareas. Devuelve cuál de las dos aparece. */
export async function esperarArranque() {
  await browser.waitUntil(
    async () => (await $('.terms-gate').isExisting()) || (await $('#view-tasks-heading').isExisting()),
    { timeout: 20_000, timeoutMsg: 'La app no ha mostrado ni los términos ni la vista de tareas' },
  );
  return (await $('.terms-gate').isExisting()) ? 'terminos' : 'app';
}

/** Acepta los términos (la app recién instalada siempre los pide). */
export async function aceptarTerminos() {
  await $('[data-action="accept"]').click();
  await $('#view-tasks-heading').waitForDisplayed();
}

/** Arranque completo de una instalación nueva hasta la vista Tareas. */
export async function abrirAppNueva() {
  const pantalla = await esperarArranque();
  if (pantalla === 'terminos') await aceptarTerminos();
}

/** Recarga la ventana (equivale a cerrar y volver a abrir la app con
 *  los mismos datos guardados). */
export async function recargar() {
  await browser.refresh();
  return esperarArranque();
}

/** Crea una tarea desde el formulario. `repeticion` es el value del
 *  radio: no-repeat, daily, interval, days o cycle. */
export async function crearTarea(nombre, repeticion = 'daily') {
  await $('#taskName').setValue(nombre);
  await $(`input[name="repeat"][value="${repeticion}"]`).click();
  await $('#addTaskBtn').click();
}

/** Crea una tarea de tipo "Cada N días", fijando el N del formulario.
 *  Si no se indica, vale 3. */
export async function crearTareaNDias(nombre, n = 3, totalVeces = 1) {
  await $('#taskName').setValue(nombre);
  if (totalVeces !== 1) await $('#timesPerDay').setValue(String(totalVeces));
  await $('input[name="repeat"][value="interval"]').click();
  await $('#interval').setValue(String(n));
  await $('#addTaskBtn').click();
}

/** Crea una tarea de tipo "Días específicos". `dias` es un array de
 *  índices 0-6 (0 lunes, 6 domingo). */
export async function crearTareaDias(nombre, dias) {
  await $('#taskName').setValue(nombre);
  await $('input[name="repeat"][value="days"]').click();
  for (const d of dias) {
    await $(`#extraOptions input[type="checkbox"][data-day="${d}"]`).click();
  }
  await $('#addTaskBtn').click();
}

/** Crea una tarea de tipo "Ciclo" con la lista de semanas indicada.
 *  `semanas` es un array de arrays de índices 0-6 (días marcados por
 *  semana). El formulario arranca con una sola semana; si hace falta
 *  más se pulsa "Añadir semana al ciclo", y para reducir se pulsa
 *  "Quitar" sobre la última semana visible. Los clics son reales de
 *  WebdriverIO (no dentro de browser.execute) para que la app los
 *  gestione exactamente como los haría una persona. */
export async function crearTareaCiclo(nombre, semanas) {
  await $('#taskName').setValue(nombre);
  await $('input[name="repeat"][value="cycle"]').click();
  const total = semanas.length;
  // Añadimos o quitamos semanas hasta tener el número deseado, con
  // clics reales de WebdriverIO (cada clic reconstruye el DOM, por
  // que re-obtenemos los selectores en cada iteración).
  while ((await $$('#extraOptions .cycle-week')).length < total) {
    await $('#extraOptions .btn-add-week').click();
  }
  while ((await $$('#extraOptions .cycle-week')).length > total) {
    const removes = await $$('#extraOptions .btn-remove-week');
    await removes[removes.length - 1].click();
  }
  // Marcamos los días de cada semana tras dejar el número deseado.
  for (let i = 0; i < total; i++) {
    for (const d of semanas[i]) {
      const cb = await $(`#extraOptions .cycle-week:nth-of-type(${i + 1}) input[type="checkbox"][data-day="${d}"]`);
      if (!(await cb.isSelected())) await cb.click();
    }
  }
  await $('#addTaskBtn').click();
}

/** Nombres de las tareas de la lista de la vista Tareas, tal como se
 *  guardaron (textContent: el CSS los muestra en mayúsculas). */
export async function nombresDeTareas() {
  return $$('#taskListMount .task-row .task-name')
    .map(async el => (await el.getProperty('textContent')).trim());
}

/** Etiquetas de tipo de cada tarea de la lista de la vista Tareas
 *  ('Una vez', 'Diaria', 'Cada 3d', 'Días esp.', 'Ciclo'…). */
export async function tiposDeTareas() {
  return $$('#taskListMount .task-row .task-type')
    .map(async el => (await el.getProperty('textContent')).trim());
}

/** Navega a la vista Semana usando el menú lateral. Espera a que
 *  haya al menos una celda de día en pantalla. */
export async function irASemana() {
  await $('button.nav-item[data-view="week"]').click();
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelectorAll('#view-week .day-cell').length > 0
    ),
    { timeout: 10_000, timeoutMsg: 'La vista Semana no pintó celdas de día' },
  );
}

/** Navega a la vista Tareas usando el menú lateral (clic real sobre
 *  el botón del sidebar, como lo haría una persona). Espera a que
 *  la vista esté visible. */
export async function irATareas() {
  await $('button.nav-item[data-view="tasks"]').click();
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.getElementById('view-tasks').classList.contains('active')
    ),
    { timeout: 5_000, timeoutMsg: 'No se volvió a la vista Tareas' },
  );
}

/** Devuelve, para cada celda de la vista Semana (0 lunes … 6 domingo),
 *  los textos de las insignias que contiene (.task-badge). Las
 *  insignias se pintan en mayúsculas con CSS; los textos aquí son los
 *  finales del textContent. */
export async function insigniasPorCelda() {
  return browser.execute(() => {
    const cells = Array.from(document.querySelectorAll('#view-week .day-cell'));
    return cells.map(cell =>
      Array.from(cell.querySelectorAll('.task-badge'))
        .map(b => b.textContent.trim())
    );
  });
}

/** Indica en qué celdas (0 lunes … 6 domingo) de la vista Semana
 *  aparece una insignia cuyo texto empiece por el nombre en
 *  mayúsculas. La insignia puede llevar los sufijos ' · 0–12H' o
 *  ' · 12–24H' cuando la tarea tiene Veces/día > 1. */
export async function celdasCon(nombre) {
  const objetivo = nombre.toUpperCase();
  const porCelda = await insigniasPorCelda();
  return porCelda.map(badges => badges.some(t => t.startsWith(objetivo)));
}
