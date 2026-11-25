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
  await esperarPintadoTareas();
}

/** Espera a que la vista Tareas esté pintada de verdad.
 *
 *  La app activa la vista antes de pintarla y el pintado es asíncrono
 *  (trae el HTML y el CSS de la tarjeta): el formulario (#taskName) se
 *  inyecta AL FINAL del pintado, así que esperarlo es esperar al
 *  pintado, no a un plazo. */
async function esperarPintadoTareas() {
  await $('#taskName').waitForDisplayed({ timeout: 10_000 });
}

/** Arranque completo de una instalación nueva hasta la vista Tareas. */
export async function abrirAppNueva() {
  const pantalla = await esperarArranque();
  if (pantalla === 'terminos') await aceptarTerminos();
  else await esperarPintadoTareas();
}

/** Recarga la ventana (equivale a cerrar y volver a abrir la app con
 *  los mismos datos guardados). */
export async function recargar() {
  await browser.refresh();
  const pantalla = await esperarArranque();
  // Tras el refresh no se puede escuchar el evento 'planner:painted'
  // (la página se recrea), así que se espera al pintado con la misma
  // señal que se usa en el resto: el formulario de la vista Tareas,
  // que se inyecta al final del pintado.
  if (pantalla === 'app') await esperarPintadoTareas();
  return pantalla;
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

/** Fecha de hoy a las 00:00 en hora local (el mismo reloj que usa la
 *  app). Desde T-045 las tareas se colocan por su fecha de inicio real,
 *  así que las pruebas tienen que saber qué día es hoy. */
export function hoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Columna de la semana (0 = lunes … 6 = domingo) del día `d`. */
export function columnaDe(d) {
  return (d.getDay() + 6) % 7;
}

/** Lunes de la semana que contiene `d`. */
export function lunesDe(d) {
  const l = new Date(d);
  l.setDate(l.getDate() - columnaDe(d));
  return l;
}

/** Celdas de la semana (0 = lunes … 6 = domingo) en las que sale una
 *  tarea de "una sola vez" que empieza el día `inicio`: solo en esa. */
export function celdasDeUnaVez(inicio) {
  const lunes = lunesDe(inicio);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d.getTime() === inicio.getTime();
  });
}

/** Celdas de la semana en las que sale una tarea de "días de la
 *  semana" (`dias` = índices 0-6, 0 lunes) que empieza el día
 *  `inicio`: los días marcados, pero solo a partir de esa fecha. */
export function celdasDeDiasSemana(dias, inicio) {
  const lunes = lunesDe(inicio);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d.getTime() >= inicio.getTime() && dias.includes(columnaDe(d));
  });
}

/** Celdas de la semana en las que sale una tarea de "cada N días" que
 *  empieza el día `inicio`: cada N días reales desde esa fecha. */
export function celdasCadaNDias(n, inicio) {
  const lunes = lunesDe(inicio);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    const dias = Math.round((d.getTime() - inicio.getTime()) / 86400000);
    return dias >= 0 && dias % n === 0;
  });
}

/** Celdas de la semana en las que sale una tarea diaria que empieza el
 *  día `inicio`: todos los días desde esa fecha (los anteriores a ella
 *  la tarea todavía no existía). */
export function celdasDesde(inicio) {
  const lunes = lunesDe(inicio);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d.getTime() >= inicio.getTime();
  });
}

/** Resumen de repetición de cada tarea de la lista de la vista Tareas.
 *  Desde T-052 no son etiquetas cortas sino el resumen legible de
 *  cuándo se repite cada tarea: 'Una vez · 25/11', 'Diaria',
 *  'Diaria · 3 veces', 'Cada 3 días desde el 25/11', 'Lun, Mié, Vie',
 *  'Ciclo de 2 semanas'… (lo calcula back/taskSummary.js). */
export async function tiposDeTareas() {
  return $$('#taskListMount .task-row .task-type')
    .map(async el => (await el.getProperty('textContent')).trim());
}

/** La fecha en el formato corto que usa el resumen de las tareas
 *  ('DD/MM'). Por defecto, hoy: el mismo reloj que usa la app. */
export function fechaCorta(d = new Date()) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Espera a que la vista Semana tenga sus celdas de día pintadas de
 *  verdad. La tarjeta de cada día se inyecta de forma asíncrona
 *  (trae su HTML y su CSS), así que puede haber celdas a medio
 *  pintar: con que aparezca una no basta.
 *
 *  Sin tareas la vista no tiene celdas: muestra el estado vacío
 *  (T-056), y eso también es un estado ya pintado. */
export async function esperarCeldasSemana() {
  await browser.waitUntil(
    async () => await browser.execute(() => {
      const week = document.getElementById('view-week');
      if (!week) return false;
      const celdas = week.querySelectorAll('.day-cell');
      if (celdas.length === 0) {
        return !!week.querySelector('.estado-vacio:not([hidden])');
      }
      return [...celdas].every(c => !!c.querySelector('.day-header'));
    }),
    { timeout: 10_000, timeoutMsg: 'La vista Semana no pintó sus celdas de día' },
  );
}

/** Navega a la vista Semana usando el menú lateral. Espera a que
 *  la vista esté pintada (no solo activa) y a que sus celdas de día
 *  estén pintadas. */
export async function irASemana() {
  await esperarPintado(async () => {
    await $('button.nav-item[data-view="week"]').click();
  });
  await esperarCeldasSemana();
}

/** Navega a la vista Tareas usando el menú lateral (clic real sobre
 *  el botón del sidebar, como lo haría una persona). Espera a que
 *  la vista esté visible Y pintada: la app activa la vista antes de
 *  pintarla, así que leer la lista justo después del clic puede dar
 *  el contenido del pintado anterior. */
export async function irATareas() {
  await esperarPintado(async () => {
    await $('button.nav-item[data-view="tasks"]').click();
  });
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.getElementById('view-tasks').classList.contains('active')
    ),
    { timeout: 5_000, timeoutMsg: 'No se volvió a la vista Tareas' },
  );
}

/** Ejecuta `accion` y espera a que la app avise de que la vista ya
 *  está pintada (evento 'planner:painted', emitido por index.js al
 *  terminar cada render).
 *
 *  El contador se pone a cero y el listener se instala ANTES de la
 *  acción, para que no se escape ningún pintado; y se espera a que
 *  llegue uno nuevo, no a que la vista esté visible: visible solo
 *  dice que la vista está activa, no que su contenido sea el actual.
 */
export async function esperarPintado(accion) {
  await browser.execute(() => {
    window.__painted = 0;
    if (window.__paintedHandler) {
      window.removeEventListener('planner:painted', window.__paintedHandler);
    }
    window.__paintedHandler = () => { window.__painted += 1; };
    window.addEventListener('planner:painted', window.__paintedHandler);
  });
  await accion();
  await browser.waitUntil(
    async () => await browser.execute(() => (window.__painted ?? 0) > 0),
    { timeout: 10_000, timeoutMsg: 'La app no avisó de que la vista terminó de pintarse' },
  );
}

/** Espera a que la pestaña `tab` de Ajustes esté visible y con su
 *  contenido montado. El panel se muestra (se quita el atributo
 *  hidden) antes de que su tarjeta esté inyectada, así que esperar
 *  solo a que esté visible deja leer un panel a medio pintar. */
export async function esperarPestanaAjustes(tab) {
  await browser.waitUntil(
    async () => await browser.execute(
      t => {
        const panel = document.getElementById(`ajustes-panel-${t}`);
        return !!panel && !panel.hidden && panel.dataset.mounted === '1';
      },
      tab,
    ),
    { timeout: 5_000, timeoutMsg: `La pestaña ${tab} de Ajustes no se pintó` },
  );
}

/** Cambia de pestaña dentro de Ajustes (clic real sobre la pestaña)
 *  y espera a que su contenido esté montado. */
export async function irAPestanaAjustes(tab) {
  await browser.execute(t => {
    document.querySelector(`.ajustes-tab[data-tab="${t}"]`)?.click();
  }, tab);
  await esperarPestanaAjustes(tab);
}

/** Abre la pestaña "Datos" dentro de Ajustes (clic sobre el botón
 *  "Ajustes" del menú lateral y luego sobre su pestaña "Datos"). El
 *  bloque sigue exponiendo #dataStatus y los botones de importar /
 *  exportar / borrar; antes vivía en una vista propia. */
export async function irAGestionDatos() {
  await esperarPintado(async () => {
    await $('button.nav-item[data-view="ajustes"]').click();
  });
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
  await esperarPintado(async () => {
    await $('button.nav-item[data-view="ajustes"]').click();
  });
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

/** Carga un JSON (un texto) en un input de archivos, como si el
 *  usuario hubiera elegido ese archivo en el diálogo del sistema.
 *  Se usa para importar el archivo que la propia app acaba de
 *  exportar (sin tocar el disco). */
export async function cargarTextoEnInput(selector, contenido, nombre = 'copia.json') {
  await browser.execute(({ selector, contenido, nombre }) => {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`No existe ${selector}`);
    const file = new File([contenido], nombre, { type: 'application/json' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { selector, contenido, nombre });
}

/** Instala la captura de las descargas de la app: envuelve
 *  URL.createObjectURL y el clic de los <a> para quedarse con el
 *  contenido del archivo y con su nombre, en vez de dejar que la
 *  descarga se vaya al disco.
 *
 *  Por qué NO se lee el blob URL desde fuera del override: en
 *  WebKitGTK headless el XHR/fetch contra un blob: URL falla con
 *  "A network error occurred" en cuanto la descarga nativa empieza.
 *  Hay que leer el Blob antes de que click() haga su trabajo. */
export async function instalarCapturaDeDescarga() {
  await browser.execute(() => {
    window.__exportedTexto = null;
    window.__exportedDownload = null;
    if (!window.__origCreateObjectURL) {
      window.__origCreateObjectURL = URL.createObjectURL;
    }
    URL.createObjectURL = function (blob) {
      window.__lastBlob = blob;
      return window.__origCreateObjectURL.call(URL, blob);
    };
    if (!window.__origAnchorClick) {
      window.__origAnchorClick = HTMLAnchorElement.prototype.click;
    }
    HTMLAnchorElement.prototype.click = function () {
      if (this.href && this.href.startsWith('blob:') && window.__lastBlob) {
        const blob = window.__lastBlob;
        const download = this.download;
        window.__lastBlob = null;
        const reader = new FileReader();
        reader.onloadend = () => {
          window.__exportedTexto = reader.result;
          window.__exportedDownload = download;
        };
        reader.readAsText(blob);
      }
      return window.__origAnchorClick.apply(this, arguments);
    };
  });
}

/** Deshace la captura de descargas: devuelve al navegador su
 *  URL.createObjectURL y el clic de los <a>. Sin esto el parche se
 *  queda montado en la página y falsea las pruebas siguientes del
 *  mismo fichero (que no esperan una descarga, sino el
 *  comportamiento normal del navegador). */
export async function desinstalarCapturaDeDescarga() {
  await browser.execute(() => {
    if (window.__origCreateObjectURL) {
      URL.createObjectURL = window.__origCreateObjectURL;
      delete window.__origCreateObjectURL;
    }
    if (window.__origAnchorClick) {
      HTMLAnchorElement.prototype.click = window.__origAnchorClick;
      delete window.__origAnchorClick;
    }
    window.__exportedTexto = null;
    window.__exportedDownload = null;
    window.__lastBlob = null;
  });
}

/** Pulsa el botón que descarga un archivo y devuelve su contenido y su
 *  nombre. Necesita `instalarCapturaDeDescarga` antes. */
export async function descargarYLeer(selector) {
  await browser.execute(() => {
    window.__exportedTexto = null;
    window.__exportedDownload = null;
  });
  await $(selector).click();
  await browser.waitUntil(
    async () => await browser.execute(() => window.__exportedTexto !== null),
    { timeout: 5_000, timeoutMsg: 'La exportación no produjo ningún Blob' },
  );
  return {
    texto: await browser.execute(() => window.__exportedTexto),
    nombre: await browser.execute(() => window.__exportedDownload),
  };
}

/** Instala un listener de `planner:changed` que guarda en
 *  window.__changed los eventos que dispara la app (acción y mensaje).
 *  Se reinstala en cada uso porque una recarga de la app borra los
 *  listeners de la página. */
export async function escucharCambios() {
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
}

/** Espera al diálogo de la app y pulsa el botón pedido ('aceptar' o
 *  'cancelar'). Espera a que el diálogo se cierre. */
export async function pulsarEnDialogo(accion = 'aceptar') {
  await $('.dialogo-capa .dialogo').waitForDisplayed({ timeout: 5_000 });
  await $(`.dialogo-capa .dialogo-btn[data-accion="${accion}"]`).click();
  await browser.waitUntil(
    async () => (await $$('.dialogo-capa')).length === 0,
    { timeout: 5_000, timeoutMsg: 'El diálogo no se cerró' },
  );
}

/** El texto del mensaje del diálogo que está abierto. */
export async function mensajeDelDialogo() {
  return (await $('.dialogo-capa .dialogo-mensaje').getText()).trim();
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
 *  mayúsculas. La insignia puede llevar el sufijo ' · 1/2', ' · 2/2'…
 *  cuando la tarea tiene Veces/día > 1. */
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
  await ventanaTamano(ancho, alto);
}

/** Fija el tamaño de la ventana a uno de escritorio (por defecto
 *  1280×800, el tamaño con el que se abren los E2E). Sirve para
 *  comprobar la vista Semana en rejilla (a partir de 1024 px). */
export async function ventanaEscritorio(ancho = 1280, alto = 800) {
  await ventanaTamano(ancho, alto);
}

/** Cambia el tamaño de la ventana y espera a que la página lo vea. */
async function ventanaTamano(ancho, alto) {
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
 *  Espera a que la app avise de que la vista terminó de pintarse
 *  (evento 'planner:painted') antes de devolver el control: la vista
 *  se activa antes de pintarse, así que esperar solo a que esté activa
 *  deja leer el contenido del pintado anterior. */
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
  await esperarPintado(async () => {
    await browser.keys([Key.Alt, String(n)]);
  });
  await browser.waitUntil(
    async () => await browser.execute(
      (v) => document.getElementById('view-' + v).classList.contains('active'),
      vista,
    ),
    { timeout: 5_000, timeoutMsg: `Alt+${n} no abrió la vista ${vista}` },
  );
}
