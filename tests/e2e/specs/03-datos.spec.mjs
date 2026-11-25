// Recorrido de la vista "Gestión de datos" (💾 Importar / Exportar /
// Borrar todo) y de la vista "Imprimir / PDF" (🖨️ Semana actual y
// Exportar rango). Recorre la app como lo haría una persona: el JSON
// del import sale del fixture, la descarga se intercepta envolviendo
// HTMLAnchorElement.prototype.click y leyendo el blob con fetch desde
// la propia página.
//
// «Borrar todo» pide confirmación en el diálogo propio de la app
// (T-053): no en el confirm() del navegador, que ya no se usa.
//
// La importación también pide confirmación antes de sustituir la lista
// (T-054): el diálogo dice cuántas tareas entran y cuántas se
// descartan.

import { join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  abrirAppNueva,
  crearTarea,
  nombresDeTareas,
  tiposDeTareas,
  irATareas,
  irAGestionDatos,
  irAImprimir,
  recargar,
  cargarArchivoEnInput,
  cargarTextoEnInput,
  descargarYLeer,
  escucharCambios,
  instalarCapturaDeDescarga,
  esperarStatus,
  mensajeDelDialogo,
  pulsarEnDialogo,
} from '../helpers.mjs';

// Ruta absoluta al fixture con 3 tareas (DailyTask, DaysOfWeekTask,
// NDaysTask) en el formato que produce ToJson. La usa Importar.
const HERE      = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE   = joinPath(HERE, '..', 'fixtures', 'tareas.json');
// Fixture con un JSON roto a propósito (la lista de tareas se corta a
// mitad). Importarlo NO puede borrar las tareas del usuario (T-031).
const FIXTURE_ROTA = joinPath(HERE, '..', 'fixtures', 'json-corrupto.json');

describe('Gestión de datos: importar, exportar, borrar y PDF', () => {

  // ── Importar ───────────────────────────────────────────────────────

  it('importa 3 tareas del fixture y el estado lo anuncia', async () => {
    await abrirAppNueva();
    await irAGestionDatos();

    // Escuchamos los cambios de la app: la importación tiene que
    // despachar `planner:changed` para que las demás vistas se repinten
    // y se anuncie el resultado (T-031).
    await escucharCambios();

    // Ruta absoluta al fixture: primero intentamos el camino oficial
    // setValue; si WebKitWebDriver lo rechaza, caemos al polyfill del
    // DOM (DataTransfer + change). En ambos casos se ejecuta el
    // manejador real del input (FileReader incluido). El método
    // helper devuelve qué camino se usó.
    const camino = await cargarArchivoEnInput('#importJsonInput', FIXTURE);
    // eslint-disable-next-line no-console
    console.log('Importación por:', camino);

    // Antes de sustituir nada, la importación pide confirmación y dice
    // cuántas tareas entran y cuántas se descartan (T-054).
    await $('.dialogo-capa .dialogo').waitForDisplayed({ timeout: 5_000 });
    expect(await mensajeDelDialogo()).toBe('Se van a sustituir 0 tareas por 3 (0 descartadas)');
    await pulsarEnDialogo('aceptar');

    // La tarjeta avisa en su #dataStatus con el emoji y el plural.
    await esperarStatus('#dataStatus', '✅ 3 tarea(s) importada(s)');

    // Y la app entera se ha enterado del cambio.
    const eventos = await browser.execute(() => window.__changed);
    const importacion = eventos.find(e => e.action === 'import');
    expect(importacion).toBeTruthy();   // la importación despacha planner:changed
    expect(importacion.status).toBe('✅ 3 tarea(s) importada(s)');

    // Volvemos a la vista Tareas para ver la lista: la lista se
    // actualiza al disparar 'change' (la importación sustituye
    // Context.Tasks, que es Proxy → persiste; como la vista activa es
    // 'ajustes', hay que ir a 'tasks').
    await irATareas();
    expect(await nombresDeTareas()).toEqual([
      'Beber agua', 'Gimnasio', 'Regar plantas',
    ]);
    // El resumen de repetición de cada una (T-052). Las tareas
    // importadas empiezan en la fecha de inicio del planificador (el
    // fixture usa daysFrom: 0), así que esa fecha se lee de la app en
    // vez de suponerla: cambia de un día a otro.
    const inicio = await browser.execute(() => window.PlannerApi.getStartDate());
    const [, mes, dia] = inicio.split('-');
    expect(await tiposDeTareas()).toEqual([
      'Diaria', 'Lun, Mié, Vie', `Cada 3 días desde el ${dia}/${mes}`,
    ]);
  });

  it('las tareas importadas siguen tras recargar la app', async () => {
    expect(await recargar()).toBe('app');
    expect(await nombresDeTareas()).toEqual([
      'Beber agua', 'Gimnasio', 'Regar plantas',
    ]);
  });

  // ── Borrar todo: cancelar y aceptar ─────────────────────────────────

  it('cancelar el diálogo de Borrar todo no elimina las tareas', async () => {
    await irAGestionDatos();
    await $('#clearAllBtn').click();

    // El diálogo de la app pide la confirmación (no el del navegador).
    await $('.dialogo-capa .dialogo').waitForDisplayed({ timeout: 5_000 });
    await $('.dialogo-capa .dialogo-btn[data-accion="cancelar"]').click();
    await browser.waitUntil(
      async () => (await $$('.dialogo-capa')).length === 0,
      { timeout: 5_000, timeoutMsg: 'El diálogo no se cerró' },
    );

    // La lista sigue con las 3 tareas importadas: nada cambió.
    await irATareas();
    expect(await nombresDeTareas()).toEqual([
      'Beber agua', 'Gimnasio', 'Regar plantas',
    ]);
  });

  it('aceptar el diálogo de Borrar todo vacía la lista, deja el estado y persiste', async () => {
    await irAGestionDatos();
    await $('#clearAllBtn').click();
    await $('.dialogo-capa .dialogo').waitForDisplayed({ timeout: 5_000 });
    await $('.dialogo-capa .dialogo-btn[data-accion="aceptar"]').click();

    // La tarjeta avisa con el emoji exacto.
    await esperarStatus('#dataStatus', '🗑️ Datos borrados');

    // La lista está vacía y, al recargar, sigue vacía.
    await irATareas();
    await expect($('#taskCount')).toHaveText('0');
    expect(await nombresDeTareas()).toEqual([]);
    expect(await recargar()).toBe('app');
    await expect($('#taskCount')).toHaveText('0');
    expect(await nombresDeTareas()).toEqual([]);
  });

  // ── Exportar ───────────────────────────────────────────────────────

  it('exportar captura un JSON con las tareas actuales', async () => {
    // Tras Borrar, la lista está vacía: volvemos a crear dos tareas
    // desde la UI real para poder comprobar que el JSON de la
    // exportación las incluye.
    await crearTarea('Tarea A', 'daily');
    await crearTarea('Tarea B', 'daily');
    await expect($('#taskCount')).toHaveText('2');

    // Envolvemos HTMLAnchorElement.prototype.click y URL.createObjectURL
    // antes de pulsar el botón de Descargar. La tarjeta crea un Blob con
    // el JSON, lo envuelve en un blob: URL y hace click() en un <a>
    // para disparar la descarga. Capturamos el Blob directamente (no la
    // URL, que en headless WebKit se invalida en cuanto se inicia la
    // descarga) y guardamos también el nombre de archivo.
    //
    // Por qué NO leemos el blob URL desde fuera del override: en
    // WebKitGTK headless el XHR/fetch contra un blob: URL falla con
    // "A network error occurred" en cuanto la descarga nativa empieza.
    // Tenemos que leer el Blob antes de que click() haga su trabajo.
    await instalarCapturaDeDescarga();

    await irAGestionDatos();
    const { texto, nombre } = await descargarYLeer('#exportJsonBtn');

    // El archivo de la copia lleva la fecha (T-054), para no pisar la
    // copia de otro día.
    expect(nombre).toMatch(/^planificador-\d{4}-\d{2}-\d{2}\.json$/);

    // El contenido es la copia de seguridad: un objeto con la versión
    // del formato y las tareas dentro. Comprobamos nombres y tipos por
    // nombre de clase, sin asumir orden.
    const copia = JSON.parse(texto);
    expect(copia.app).toBe('planificador-semanal');
    expect(copia.version).toBe(2);
    expect(typeof copia.exportedAt).toBe('string');
    expect(Array.isArray(copia.tasks)).toBe(true);
    expect(copia.tasks).toHaveLength(2);
    const nombres = copia.tasks.map(t => t.name).sort();
    expect(nombres).toEqual(['Tarea A', 'Tarea B']);
    for (const t of copia.tasks) {
      expect(t.className).toBe('DailyTask');
      expect(t.total).toBe(1);
    }
  });

  // ── Ida y vuelta: exportar → borrar → importar lo exportado ────────

  it('ida y vuelta: exportar, borrar y reimportar deja la lista igual', async () => {
    // El test anterior ya capturó el href y el contenido. Para esta
    // ida y vuelta partimos de un JSON recién exportado desde el
    // estado actual de la app (las mismas dos tareas A y B).
    await irAGestionDatos();

    // Capturamos una nueva exportación del estado actual (la captura
    // de la descarga del test anterior sigue montada).
    const { texto } = await descargarYLeer('#exportJsonBtn');

    // Borramos todo (aceptando el diálogo de la app).
    await $('#clearAllBtn').click();
    await $('.dialogo-capa .dialogo').waitForDisplayed({ timeout: 5_000 });
    await $('.dialogo-capa .dialogo-btn[data-accion="aceptar"]').click();
    await esperarStatus('#dataStatus', '🗑️ Datos borrados');
    await irATareas();
    expect(await nombresDeTareas()).toEqual([]);

    // Reimportamos el JSON recién exportado. Para no depender del
    // filesystem usamos directamente el polyfill del DOM: pasamos el
    // contenido del blob a un File y disparamos 'change' en el input.
    const nombre = 'exportado.json';
    await irAGestionDatos();
    await cargarTextoEnInput('#importJsonInput', texto, nombre);
    await pulsarEnDialogo('aceptar');
    await esperarStatus('#dataStatus', '✅ 2 tarea(s) importada(s)');

    // La lista vuelve a ser la misma que antes de borrar.
    await irATareas();
    expect(await nombresDeTareas()).toEqual(['Tarea A', 'Tarea B']);
    expect(await tiposDeTareas()).toEqual(['Diaria', 'Diaria']);
  });

  // ── Importar un JSON corrupto: no debe borrar nada ──────────────────

  it('importar un JSON corrupto no borra las tareas y avisa del error', async () => {
    // Estado heredado del test anterior: Tarea A y Tarea B.
    await irAGestionDatos();

    // Escuchamos los cambios: una importación fallida no muta la lista,
    // así que no debe despachar ningún `planner:changed`.
    await escucharCambios();

    const camino = await cargarArchivoEnInput('#importJsonInput', FIXTURE_ROTA);
    // eslint-disable-next-line no-console
    console.log('Importación corrupta por:', camino);

    // La tarjeta avisa del error (y nunca de "0 tarea(s) importada(s)").
    await esperarStatus('#dataStatus', '❌ JSON inválido');

    // No se ha avisado de ningún cambio: no se ha tocado nada.
    const eventos = await browser.execute(() => window.__changed);
    expect(eventos.filter(e => e.action === 'import')).toHaveLength(0);

    // La lista sigue intacta…
    await irATareas();
    await expect($('#taskCount')).toHaveText('2');
    expect(await nombresDeTareas()).toEqual(['Tarea A', 'Tarea B']);

    // …y sigue intacta tras recargar la app: no se ha perdido nada.
    expect(await recargar()).toBe('app');
    expect(await nombresDeTareas()).toEqual(['Tarea A', 'Tarea B']);
  });

  // ── Exportar PDF: Semana actual y Exportar rango ───────────────────

  it('PDF: "Semana actual" termina con "✅ PDF generado"', async () => {
    await irAImprimir();
    await $('#printWeekBtn').click();
    await esperarStatus('#printStatus', '✅ PDF generado', 20_000);
    // La tarjeta borra el mensaje al cabo de 4 s, pero la siguiente
    // aserción ya habrá pasado; no esperamos al borrado.
  });

  it('PDF: "Exportar rango" termina con "✅ PDF generado"', async () => {
    await irAImprimir();
    // El input #printWeeks ya vale 4 por defecto; lo dejamos así.
    await $('#printCustomBtn').click();
    await esperarStatus('#printStatus', '✅ PDF generado', 20_000);
  });

});