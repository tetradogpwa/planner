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

/** Nombres de las tareas de la lista de la vista Tareas, tal como se
 *  guardaron (textContent: el CSS los muestra en mayúsculas). */
export async function nombresDeTareas() {
  return $$('#taskListMount .task-row .task-name')
    .map(async el => (await el.getProperty('textContent')).trim());
}
