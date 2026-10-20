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

/** Abre la pestaña "Datos" dentro de Ajustes (clic sobre el botón
 *  "Ajustes" del menú lateral y luego sobre su pestaña "Datos"). El
 *  bloque sigue exponiendo #dataStatus y los botones de importar /
 *  exportar / borrar; antes vivía en una vista propia. */
export async function irAGestionDatos() {
  await $('button.nav-item[data-view="ajustes"]').click();
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.getElementById('view-ajustes').classList.contains('active'),
    ),
    { timeout: 5_000, timeoutMsg: 'La vista Ajustes no se abrió' },
  );
  await browser.execute(() => {
    const tab = document.querySelector('.ajustes-tab[data-tab="data"]');
    tab?.click();
  });
  await browser.waitUntil(
    async () => await browser.execute(
      () => !document.getElementById('ajustes-panel-data').hidden
        && !!document.getElementById('dataStatus')
    ),
    { timeout: 5_000, timeoutMsg: 'La pestaña Datos de Ajustes no se abrió' },
  );
}

/** Abre la pestaña "Imprimir y PDF" dentro de Ajustes. Antes era la
 *  vista Imprimir / PDF; ahora vive como pestaña de Ajustes. */
export async function irAImprimir() {
  await $('button.nav-item[data-view="ajustes"]').click();
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.getElementById('view-ajustes').classList.contains('active'),
    ),
    { timeout: 5_000, timeoutMsg: 'La vista Ajustes no se abrió' },
  );
  await browser.execute(() => {
    const tab = document.querySelector('.ajustes-tab[data-tab="print"]');
    tab?.click();
  });
  await browser.waitUntil(
    async () => await browser.execute(
      () => !document.getElementById('ajustes-panel-print').hidden
        && !!document.getElementById('printStatus')
    ),
    { timeout: 5_000, timeoutMsg: 'La pestaña Imprimir y PDF no se abrió' },
  );
}

/** Espera a que el textContent de un selector que hace de #status
 *  (role="status") coincida con la cadena esperada. Se usa tanto para
 *  #dataStatus como para #printStatus. */
export async function esperarStatus(selector, esperado, timeout = 10_000) {
  await browser.waitUntil(
    async () => {
      const txt = await $(selector).getText();
      return txt.trim() === esperado;
    },
    { timeout, timeoutMsg: `El status ${selector} no llegó a "${esperado}"` },
  );
}

/** Dispara la carga de un archivo en un <input type="file"> desde
 *  WebKitWebDriver, que no admite setValue sobre inputs de archivo.
 *  Crea el File en la página con un Blob y dispara el evento "change"
 *  con un DataTransfer que lleva el archivo: así se ejecuta el
 *  manejador real del input (FileReader incluido), igual que si el
 *  usuario hubiera seleccionado el archivo en el diálogo del sistema.
 *  Devuelve 'setValue' si WebdriverIO pudo hacerlo de forma nativa o
 *  'dataTransfer' si tuvimos que recurrir al polyfill del DOM. */
export async function cargarArchivoEnInput(selector, rutaAbsoluta) {
  let useDataTransfer = false;
  try {
    await $(selector).setValue(rutaAbsoluta);
  } catch (_) {
    useDataTransfer = true;
  }
  if (!useDataTransfer) return 'setValue';

  // Leemos el contenido del fixture desde el sistema de archivos del
  // proceso de Node del spec y lo inyectamos en la página como un Blob.
  // La página crea el File y dispara el 'change' exactamente como si el
  // usuario hubiera elegido el archivo.
  const contenido = await readFixtureFromSpec(rutaAbsoluta);
  await browser.execute(({ selector, contenido, nombre }) => {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`No existe ${selector}`);
    const file = new File([contenido], nombre, { type: 'application/json' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { selector, contenido, nombre: rutaAbsoluta.split('/').pop() });
  return 'dataTransfer';
}

/** Lee un archivo del sistema de archivos del proceso de Node del spec
 *  (donde corre WebdriverIO). Se separa de cargarArchivoEnInput para que
 *  el contenido pueda prepararse una sola vez por spec si hace falta. */
export async function readFixtureFromSpec(rutaAbsoluta) {
  const fs = await import('node:fs/promises');
  return fs.readFile(rutaAbsoluta, 'utf8');
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

/** Fija el tamaño de la ventana a uno de móvil (por defecto 390×844,
 *  iPhone 13/14). La app tiene minWidth 380, así que 390 deja un
 *  margen mínimo. Tras cambiar el tamaño, espera a que
 *  document.documentElement.clientWidth refleje el nuevo ancho
 *  (algunos drivers no aplican el resize hasta el siguiente frame). */
export async function ventanaMovil(ancho = 390, alto = 844) {
  await browser.setWindowSize(ancho, alto);
  await browser.waitUntil(
    async () => {
      const w = await browser.execute(
        () => document.documentElement.clientWidth,
      );
      return Math.abs(w - ancho) <= 2;
    },
    { timeout: 5_000, timeoutMsg: `La ventana no se redimensionó a ${ancho} px` },
  );
}

/** Cambia de vista con el atajo global Alt+N. Desde T-022:
 *   1=tareas, 2=semana, 3=todas semanas,
 *   4=Ajustes › Datos, 5=Ajustes › Imprimir y PDF,
 *   6=Ajustes › Apariencia, 7=Ajustes › Legal,
 *   8=Ajustes › Accesibilidad.
 *  Espera a que la vista objetivo quede activa antes de devolver el
 *  control. */
export async function navegarVistaAlt(n) {
  // Todas las vistas tienen un id `view-<name>` en el DOM. Ajustes
  // también, aunque ahora Alt+4..8 llevan a pestañas concretas
  // dentro de Ajustes.
  const mapaVista = {
    1: 'tasks',        2: 'week',     3: 'allWeeks',
    4: 'ajustes',      5: 'ajustes',  6: 'ajustes',
    7: 'ajustes',      8: 'ajustes',
  };
  const vista = mapaVista[n];
  if (!vista) throw new Error(`Atajo de vista desconocido: Alt+${n}`);
  const Key = (await import('webdriverio')).Key;
  await browser.keys([Key.Alt, String(n)]);
  await browser.waitUntil(
    async () => await browser.execute(
      (v) => document.getElementById('view-' + v).classList.contains('active'),
      vista,
    ),
    { timeout: 5_000, timeoutMsg: `Alt+${n} no abrió la vista ${vista}` },
  );
}
