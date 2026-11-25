// Recorrido de la vista "Gestión de datos" (💾 Importar / Exportar /
// Borrar todo) y de la vista "Imprimir / PDF" (🖨️ Semana actual y
// Exportar rango). Recorre la app como lo haría una persona: el JSON
// del import sale del fixture, la descarga se intercepta envolviendo
// HTMLAnchorElement.prototype.click y leyendo el blob con fetch desde
// la propia página.
//
// «Borrar todo» pide confirmación en el diálogo propio de la app
// (T-053): no en el confirm() del navegador, que ya no se usa.

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
  esperarStatus,
} from '../helpers.mjs';

// Ruta absoluta al fixture con 3 tareas (DailyTask, DaysOfWeekTask,
// NDaysTask) en el formato que produce ToJson. La usa Importar.
const HERE      = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE   = joinPath(HERE, '..', 'fixtures', 'tareas.json');
// Fixture con un JSON roto a propósito (la lista de tareas se corta a
// mitad). Importarlo NO puede borrar las tareas del usuario (T-031).
const FIXTURE_ROTA = joinPath(HERE, '..', 'fixtures', 'json-corrupto.json');

/** Instala un listener de `planner:changed` que guarda en
 *  window.__changed los eventos que dispara la app (acción y mensaje).
 *  Se reinstala en cada uso porque una recarga de la app borra los
 *  listeners de la página. */
async function escucharCambios() {
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
  await browser.execute(() => {
    window.__exportedDownload = null;
    window.__exportedTexto = null;
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
        // Leemos el Blob ahora mismo, antes de que el click nativo
        // haga nada: lo convertimos a texto vía FileReader (text()).
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

    await irAGestionDatos();
    await $('#exportJsonBtn').click();

    await browser.waitUntil(
      async () => await browser.execute(() => window.__exportedTexto !== null),
      { timeout: 5_000, timeoutMsg: 'La exportación no produjo ningún Blob' },
    );
    const texto = await browser.execute(() => window.__exportedTexto);
    const download = await browser.execute(() => window.__exportedDownload);
    expect(download).toBe('planner.json');

    // El contenido es el JSON que produce ToJson: un array con un
    // objeto por tarea, className DailyTask (porque las dos que
    // creamos son diarias). Comprobamos nombres y tipos por nombre
    // de clase, sin asumir orden.
    const tareas = JSON.parse(texto);
    expect(Array.isArray(tareas)).toBe(true);
    expect(tareas).toHaveLength(2);
    const nombres = tareas.map(t => t.name).sort();
    expect(nombres).toEqual(['Tarea A', 'Tarea B']);
    for (const t of tareas) {
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

    // Capturamos una nueva exportación del estado actual (el override
    // de Blob + click del test anterior sigue montado).
    await browser.execute(() => { window.__exportedTexto = null; });
    await $('#exportJsonBtn').click();
    await browser.waitUntil(
      async () => await browser.execute(() => window.__exportedTexto !== null),
      { timeout: 5_000, timeoutMsg: 'La exportación no produjo ningún Blob' },
    );
    const exportado = await browser.execute(() => window.__exportedTexto);

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
    await browser.execute(({ contenido, nombre }) => {
      const input = document.getElementById('importJsonInput');
      const file = new File([contenido], nombre, { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { contenido: exportado, nombre });
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