// T-054: la copia de seguridad es completa (tareas con su id, marcas de
// «hecho», fecha de inicio y preferencias), lleva la versión del
// formato y, al importarla, se pide confirmación antes de sustituir
// nada.
//
// El recorrido:
//   1. Exportar la copia: el archivo se llama planificador-<fecha>.json
//      y dentro lleva la versión del formato.
//   2. Ida y vuelta: exportar, borrar todo, importar la copia → la app
//      queda igual (mismas tareas, mismos ids, mismas marcas).
//   3. Un JSON antiguo (un array de tareas) se sigue importando.
//   4. La importación avisa de cuántas tareas ha descartado.
//   5. Cancelar la importación no toca nada.

import {
  abrirAppNueva,
  crearTarea,
  cargarTextoEnInput,
  desinstalarCapturaDeDescarga,
  descargarYLeer,
  escucharCambios,
  esperarStatus,
  instalarCapturaDeDescarga,
  irAGestionDatos,
  irASemana,
  irATareas,
  mensajeDelDialogo,
  navegarVistaAlt,
  nombresDeTareas,
  pulsarEnDialogo,
  recargar,
} from '../helpers.mjs';

/** La fecha de hoy en ISO local ('YYYY-MM-DD'): la misma que usa la
 *  app para las marcas de «hecho». */
function hoyISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Elige un tema de la lista de Ajustes › Apariencia (como una
 *  persona: clic sobre el radio). */
async function elegirTema(valor) {
  await navegarVistaAlt(6);
  await browser.waitUntil(
    async () => await browser.execute(
      () => document.querySelectorAll('input[name="theme"]').length > 0,
    ),
    { timeout: 5_000, timeoutMsg: 'Los radios de Tema no se han pintado' },
  );
  await $(`input[name="theme"][value="${valor}"]`).click();
  await browser.waitUntil(
    async () => await browser.execute(
      (v) => document.querySelector(`input[name="theme"][value="${v}"]`)?.checked === true,
      valor,
    ),
    { timeout: 5_000, timeoutMsg: `El tema ${valor} no quedó marcado` },
  );
}

/** Lo que tiene que quedar igual tras una ida y vuelta: las tareas
 *  (con su id y su fecha de inicio), las marcas de «hecho» y la fecha
 *  de inicio del planificador. */
const estadoDeLaApp = () => browser.execute(() => ({
  tareas: window.PlannerApi.listTasks()
    .map(t => ({ id: t.id, name: t.name, startDate: t.startDate })),
  marcas: JSON.parse(localStorage.getItem('Context_MARKS') ?? '{}'),
  inicio: window.PlannerApi.getStartDate(),
}));

describe('Copia de seguridad completa (T-054)', () => {

  before(async () => {
    await abrirAppNueva();
  });

  // La captura de las descargas se instala para cada prueba y se
  // desmonta al terminar: si se dejara montada, el parche de
  // URL.createObjectURL y del clic de los <a> seguiría en la página y
  // falsearía las pruebas que vinieran después. Se instala en cada
  // prueba (y no una sola vez) porque una recarga de la app recrea la
  // página y se perdería el parche.
  beforeEach(async () => {
    await instalarCapturaDeDescarga();
  });

  afterEach(async () => {
    await desinstalarCapturaDeDescarga();
  });

  it('exportar guarda las tareas con su id y sus marcas de «hecho»', async () => {
    await crearTarea('Leer', 'daily');
    await crearTarea('Correr', 'daily');

    // Marcamos una de las dos como hecha en la vista Semana.
    await irASemana();
    const celda = await $('#view-week .day-cell.is-today');
    const casillas = await celda.$$('.task-check');
    expect(casillas.length).toBe(2);
    await casillas[0].click();
    await browser.waitUntil(
      async () => (await (await celda.$('.day-progress')).getText()).trim() === '1/2 hechas',
      { timeout: 5_000, timeoutMsg: 'La tarea no se pudo marcar como hecha' },
    );

    await irAGestionDatos();
    const { texto, nombre } = await descargarYLeer('#exportJsonBtn');

    // El archivo de la copia lleva la fecha: no pisa la copia de otro día.
    expect(nombre).toMatch(/^planificador-\d{4}-\d{2}-\d{2}\.json$/);

    const copia = JSON.parse(texto);
    expect(copia.app).toBe('planificador-semanal');
    expect(copia.version).toBe(2);
    expect(typeof copia.exportedAt).toBe('string');
    expect(copia.tasks).toHaveLength(2);
    expect(copia.tasks.map(t => t.name).sort()).toEqual(['Correr', 'Leer']);

    // Cada tarea conserva su id (es lo que la hace la misma tarea).
    const ids = await browser.execute(() => window.PlannerApi.listTasks().map(t => t.id));
    expect(copia.tasks.map(t => t.id).sort()).toEqual([...ids].sort());

    // Y las marcas de «hecho» también van en la copia.
    expect(Object.keys(copia.completions)).toHaveLength(1);
    const idMarcada = Object.keys(copia.completions)[0];
    expect(copia.completions[idMarcada][hoyISO()]).toEqual([0]);
  });

  it('ida y vuelta: importar la copia deja la app igual', async () => {
    const antes = await estadoDeLaApp();

    // Exportamos la copia del estado actual.
    await irAGestionDatos();
    const { texto } = await descargarYLeer('#exportJsonBtn');

    // La copia trae la fecha de inicio del planificador: si no, al
    // importarla se perdería (era lo que pasaba antes de T-054).
    expect(JSON.parse(texto).startDate).toBe(antes.inicio);

    // Y al importarla, la app recupera esa fecha: la cambiamos (como si
    // el usuario la moviera después de hacer la copia) y al importar
    // tiene que volver a su sitio.
    await browser.execute(() => window.PlannerApi.setStartDate('2024-06-10'));
    expect(await browser.execute(() => window.PlannerApi.getStartDate())).toBe('2024-06-10');

    // Borramos todo (aceptando el diálogo de la app).
    await $('#clearAllBtn').click();
    await pulsarEnDialogo('aceptar');
    await esperarStatus('#dataStatus', '🗑️ Datos borrados');
    await irATareas();
    expect(await nombresDeTareas()).toEqual([]);

    // Importamos la copia: antes de tocar nada, se pide confirmación y
    // se dice cuántas tareas entran.
    await irAGestionDatos();
    await cargarTextoEnInput('#importJsonInput', texto, 'planificador.json');
    await $('.dialogo-capa .dialogo').waitForDisplayed({ timeout: 5_000 });
    expect(await mensajeDelDialogo()).toBe('Se van a sustituir 0 tareas por 2 (0 descartadas)');
    // Los botones son «Confirmar» y «Cancelar».
    expect(await browser.execute(() => Array.from(
      document.querySelectorAll('.dialogo-capa .dialogo-btn'),
    ).map(b => b.textContent))).toEqual(['Cancelar', 'Confirmar']);
    await pulsarEnDialogo('aceptar');
    await esperarStatus('#dataStatus', '✅ 2 tarea(s) importada(s)');

    // La app queda igual: mismas tareas, mismos ids, mismas marcas y la
    // misma fecha de inicio del planificador.
    const despues = await estadoDeLaApp();
    expect(despues.tareas).toEqual(antes.tareas);
    expect(despues.marcas).toEqual(antes.marcas);
    expect(despues.inicio).toBe(antes.inicio);

    // Y sigue igual tras recargar la app (lo importado está guardado).
    expect(await recargar()).toBe('app');
    const trasRecargar = await estadoDeLaApp();
    expect(trasRecargar.tareas).toEqual(antes.tareas);
    expect(trasRecargar.marcas).toEqual(antes.marcas);
    expect(trasRecargar.inicio).toBe(antes.inicio);
  });

  it('un JSON antiguo (un array de tareas) se sigue importando', async () => {
    await irAGestionDatos();
    const inicio = await browser.execute(() => window.PlannerApi.getStartDate());
    const viejo = JSON.stringify([
      { className: 'DailyTask', name: 'Tarea antigua', total: 1, daysFrom: 0, nDays: 1 },
    ]);
    await cargarTextoEnInput('#importJsonInput', viejo, 'viejo.json');
    await pulsarEnDialogo('aceptar');
    await esperarStatus('#dataStatus', '✅ 1 tarea(s) importada(s)');

    await irATareas();
    expect(await nombresDeTareas()).toEqual(['Tarea antigua']);

    // El archivo antiguo no trae fecha de inicio: la app se queda con
    // la suya (no se pierde al importar una copia vieja).
    expect(await browser.execute(() => window.PlannerApi.getStartDate())).toBe(inicio);
  });

  it('la importación avisa de las tareas descartadas', async () => {
    await irAGestionDatos();
    const mixto = JSON.stringify([
      { className: 'TipoQueNoExiste', name: 'No se reconoce' },
      { className: 'DailyTask', name: 'Tarea buena', total: 1, startDate: hoyISO(), nDays: 1 },
    ]);
    await cargarTextoEnInput('#importJsonInput', mixto, 'mixto.json');

    // El diálogo dice cuántas tareas entran y cuántas se descartan.
    await $('.dialogo-capa .dialogo').waitForDisplayed({ timeout: 5_000 });
    expect(await mensajeDelDialogo()).toBe('Se van a sustituir 1 tareas por 1 (1 descartadas)');
    await pulsarEnDialogo('aceptar');
    await esperarStatus('#dataStatus', '✅ 1 tarea(s) importada(s)');

    // La que no se reconoce no entra: la lista tiene solo la buena.
    await irATareas();
    expect(await nombresDeTareas()).toEqual(['Tarea buena']);
  });

  it('cancelar la importación no toca nada', async () => {
    await irAGestionDatos();

    // Escuchamos los cambios de la app: una importación cancelada no
    // muta la lista, así que no debe despachar ningún `planner:changed`.
    await escucharCambios();

    const antes = await estadoDeLaApp();
    // La copia trae su propia fecha de inicio (y sus preferencias): si
    // se cancela, la app no puede adoptarlas.
    const otra = JSON.stringify({
      app: 'planificador-semanal',
      version: 2,
      exportedAt: '2026-11-25T10:00:00Z',
      tasks: [{ className: 'DailyTask', name: 'Otra tarea', total: 1, startDate: hoyISO(), nDays: 1 }],
      completions: {},
      startDate: '2020-01-01',
      preferences: { theme: 'light' },
    });
    await cargarTextoEnInput('#importJsonInput', otra, 'otra.json');
    await pulsarEnDialogo('cancelar');
    await esperarStatus('#dataStatus', '⚠ Importación cancelada; la lista no se ha modificado');

    // La lista sigue igual…
    const despues = await estadoDeLaApp();
    expect(despues.tareas).toEqual(antes.tareas);
    expect(despues.marcas).toEqual(antes.marcas);
    expect(despues.inicio).toBe(antes.inicio);

    // …la app no se ha enterado de ningún cambio…
    const eventos = await browser.execute(() => window.__changed);
    expect(eventos.filter(e => e.action === 'import')).toHaveLength(0);

    // …y tras recargar la app tampoco ha cambiado nada.
    expect(await recargar()).toBe('app');
    const trasRecargar = await estadoDeLaApp();
    expect(trasRecargar.tareas).toEqual(antes.tareas);
    expect(trasRecargar.marcas).toEqual(antes.marcas);
    expect(trasRecargar.inicio).toBe(antes.inicio);
  });

  it('la copia también guarda las preferencias (el tema)', async () => {
    // La captura de la descarga la monta el `beforeEach` de este
    // fichero (la prueba anterior recargó la app, y una recarga borra
    // los overrides de la página).
    await elegirTema('dark');

    // Exportamos la copia con el tema oscuro.
    await irAGestionDatos();
    const { texto } = await descargarYLeer('#exportJsonBtn');
    expect(JSON.parse(texto).preferences.theme).toBe('dark');

    // Cambiamos el tema a claro…
    await elegirTema('light');
    expect(await browser.execute(() => document.documentElement.dataset.theme)).toBe('light');

    // …e importamos la copia: el tema vuelve al que tenía.
    await irAGestionDatos();
    await cargarTextoEnInput('#importJsonInput', texto, 'planificador.json');
    await pulsarEnDialogo('aceptar');
    await esperarStatus('#dataStatus', '✅ 1 tarea(s) importada(s)');

    expect(await browser.execute(() => document.documentElement.dataset.theme)).toBe('dark');
  });

});
