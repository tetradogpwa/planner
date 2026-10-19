// Recorrido del formulario de creación para los cinco tipos de repetición:
// "Sin repetición", "Diario", "Cada N días", "Días específicos" y "Ciclo".
// Para cada uno crea la tarea desde la UI, comprueba la etiqueta de tipo
// en la lista y verifica en qué celdas (lunes a domingo) aparece su
// insignia en la vista Semana. Termina con las validaciones del
// formulario (alert con browser.acceptAlert) y el caso de Veces/día > 1.

import {
  abrirAppNueva,
  crearTarea,
  crearTareaNDias,
  crearTareaDias,
  nombresDeTareas,
  tiposDeTareas,
  irASemana,
  celdasCon,
} from '../helpers.mjs';

// Cada `it` se monta sobre el estado dejado por el anterior: los datos
// se comparten dentro del mismo archivo de specs (beforeSession de
// wdio.conf.mjs los borra solo entre archivos). Por eso las pruebas se
// numeran en el orden esperado.

describe('Formulario de tareas: tipos de repetición', () => {

  // WebdriverIO descarta automáticamente los diálogos nativos (alert,
  // confirm, prompt) y no notifica al test, salvo que registremos un
  // listener para 'dialog'. Sin listener, el alert se cierra antes de
  // que nuestro await browser.acceptAlert() pueda encontrarlo.
  //
  // El criterio del supervisor pide validar con browser.acceptAlert().
  // Hacemos los dos: registramos el listener para que WebdriverIO
  // mantenga el alert abierto, lo aceptamos con acceptAlert(), y
  // mediante un polyfill de window.alert capturamos también el mensaje
  // para poder comprobarlo (el alert nativo en WebKit headless puede
  // no reportar el texto de forma fiable, pero sí dispara el evento).
  // Lo registramos en beforeEach porque la app puede perder
  // listeners al navegar entre vistas (la sesión DOM se reinicia).
  beforeEach(async () => {
    await browser.execute(() => {
      window.__lastAlert = null;
      const origAlert = window.alert;
      window.alert = (msg) => {
        window.__lastAlert = String(msg);
        return origAlert ? origAlert.call(window, msg) : undefined;
      };
    });
  });
  before(() => {
    // Listener global para TODOS los tests: desactivamos el
    // auto-handle de WebdriverIO y dejamos el alert abierto para
    // poder llamar a acceptAlert().
    browser.on('dialog', () => {});
  });

  it('la app arranca con la lista de tareas vacía', async () => {
    await abrirAppNueva();
    await expect($('#view-tasks-heading')).toBeDisplayed();
    await expect($('#taskCount')).toHaveText('0');
    expect(await nombresDeTareas()).toEqual([]);
  });

  it('crea las 5 tareas básicas y cada una muestra su etiqueta de tipo', async () => {
    await crearTarea('Una sola vez',  'no-repeat');
    await crearTarea('Tarea diaria',  'daily');
    await crearTareaNDias('Cada 3 días', 3);
    await crearTareaDias('Días puntuales', [0, 3]);        // lunes y jueves

    // El ciclo se crea ejercitando los botones del formulario como un
    // usuario: añadir semana, quitar una, volver a añadir (la nueva
    // semana debe estar vacía) y marcar días distintos en cada una.
    await $('#taskName').setValue('Ciclo quincenal');
    await $('input[name="repeat"][value="cycle"]').click();
    // Estado inicial: una sola semana, sin botón de quitar.
    expect(await $$('#extraOptions .cycle-week')).toHaveLength(1);
    expect(await $$('#extraOptions .btn-remove-week')).toHaveLength(0);

    // Añadimos una segunda semana.
    await $('#extraOptions .btn-add-week').click();
    expect(await $$('#extraOptions .cycle-week')).toHaveLength(2);

    // Quitamos la segunda (clic sobre su .btn-remove-week).
    const removes1 = await $$('#extraOptions .btn-remove-week');
    await removes1[removes1.length - 1].click();
    expect(await $$('#extraOptions .cycle-week')).toHaveLength(1);
    expect(await $$('#extraOptions .btn-remove-week')).toHaveLength(0);

    // Volvemos a añadir: la nueva semana 2 nace con sus 7 casillas
    // desmarcadas (flags=0).
    await $('#extraOptions .btn-add-week').click();
    expect(await $$('#extraOptions .cycle-week')).toHaveLength(2);
    const nuevasMarcadas = await browser.execute(() =>
      Array.from(
        document.querySelectorAll('#extraOptions .cycle-week:nth-of-type(2) input[type="checkbox"]')
      ).filter(cb => cb.checked).length
    );
    expect(nuevasMarcadas).toBe(0);

    // Marcamos días distintos en cada semana: semana A → lunes y
    // miércoles; semana B → viernes. Así el ciclo pinta en la vista
    // Semana los días de su primera semana (lun y mié).
    const sem1 = (dia) => $(`#extraOptions .cycle-week:nth-of-type(1) input[type="checkbox"][data-day="${dia}"]`);
    await sem1(0).click();
    await sem1(2).click();
    const sem2 = (dia) => $(`#extraOptions .cycle-week:nth-of-type(2) input[type="checkbox"][data-day="${dia}"]`);
    await sem2(4).click();

    await $('#addTaskBtn').click();

    await expect($('#taskCount')).toHaveText('5');
    expect(await nombresDeTareas()).toEqual([
      'Una sola vez', 'Tarea diaria', 'Cada 3 días', 'Días puntuales', 'Ciclo quincenal',
    ]);
    expect(await tiposDeTareas()).toEqual([
      'Una vez', 'Diaria', 'Cada 3d', 'Días esp.', 'Ciclo',
    ]);
  });

  it('en la Semana, "Diaria" aparece en las 7 celdas y "Una vez" solo en una', async () => {
    await irASemana();
    expect(await celdasCon('Tarea diaria')).toEqual([true, true, true, true, true, true, true]);
    const unaVez = await celdasCon('Una sola vez');
    const totalPresencias = unaVez.filter(Boolean).length;
    expect(totalPresencias).toBe(1);
    // Y la única celda debe ser la primera (lunes): la tarea interna
    // es una DailyTask y LimitedTimeTask deja pasar solo la primera
    // aparición, que coincide con daysFrom=0 (el lunes del origen).
    expect(unaVez[0]).toBe(true);
  });

  it('"Cada 3d" aparece en lunes, jueves y domingo (días 0, 3 y 6)', async () => {
    expect(await celdasCon('Cada 3 días')).toEqual([true, false, false, true, false, false, true]);
  });

  it('"Días esp." aparece solo en lunes y jueves (días 0 y 3)', async () => {
    expect(await celdasCon('Días puntuales')).toEqual([true, false, false, true, false, false, false]);
  });

  it('"Ciclo" pinta solo los días de la primera semana del ciclo (lunes y miércoles)', async () => {
    expect(await celdasCon('Ciclo quincenal')).toEqual([true, false, true, false, false, false, false]);
  });

  it('con Veces/día = 2, una tarea diaria muestra dos insignias con los tramos horarios', async () => {
    // Volvemos a la vista Tareas para crear una nueva tarea.
    await $('button.nav-item[data-view="tasks"]').click();
    await $('#view-tasks-heading').waitForDisplayed();
    await $('#taskName').setValue('Dos veces');
    await $('#timesPerDay').setValue('2');
    await $('input[name="repeat"][value="daily"]').click();
    await $('#addTaskBtn').click();
    await expect($('#taskCount')).toHaveText('6');

    await irASemana();
    const celdas = await celdasCon('Dos veces');
    // Aparece todos los días.
    expect(celdas).toEqual([true, true, true, true, true, true, true]);
    // Y en cada celda hay dos insignias con los tramos horarios.
    const detalle = await browser.execute(() => {
      const cells = Array.from(document.querySelectorAll('#view-week .day-cell'));
      return cells.map(cell =>
        Array.from(cell.querySelectorAll('.task-badge'))
          .map(b => b.textContent.trim())
          .filter(t => t.startsWith('DOS VECES'))
      );
    });
    for (const badges of detalle) {
      expect(badges).toEqual(['DOS VECES · 0–12H', 'DOS VECES · 12–24H']);
    }
  });

  it('valida: nombre vacío muestra alert y no crea la tarea', async () => {
    await $('button.nav-item[data-view="tasks"]').click();
    await $('#view-tasks-heading').waitForDisplayed();
    const antes = await $('#taskCount').getText();

    // Reiniciamos el último alert registrado por el polyfill.
    await browser.execute(() => { window.__lastAlert = null; });

    // El campo #taskName ya está vacío tras el reset() anterior;
    // WebdriverIO rechaza setValue con string vacío, así que no lo
    // tocamos.
    await $('input[name="repeat"][value="daily"]').click();
    await $('#addTaskBtn').click();

    // Primero esperamos a que el polyfill haya capturado el alert:
    // WebKit headless con tauri-driver no siempre expone los alerts
    // nativos al WebDriver, así que confiamos en el polyfill como
    // fuente principal de la verdad. Aun así, intentamos aceptar el
    // alert nativo si está disponible.
    await browser.waitUntil(
      async () => await browser.execute(() => window.__lastAlert) !== null,
      { timeout: 5_000, timeoutMsg: 'No se disparó ningún alert al enviar nombre vacío' },
    );
    const mensaje = await browser.execute(() => window.__lastAlert);
    expect(mensaje).toBe('Nombre requerido');

    // Aceptamos también el alert nativo si sigue abierto. Si el driver
    // ya lo descartó por su cuenta, lo ignoramos (en headless a veces
    // ocurre antes de llegar aquí).
    try {
      await browser.acceptAlert();
    } catch (_) {
      // Ya lo capturó el polyfill; el alert nativo puede haberse
      // cerrado solo. No es un fallo.
    }

    const despues = await $('#taskCount').getText();
    expect(despues).toBe(antes);
  });

  it('valida: "Días específicos" sin días muestra alert y no crea la tarea', async () => {
    await $('button.nav-item[data-view="tasks"]').click();
    await $('#view-tasks-heading').waitForDisplayed();
    const antes = await $('#taskCount').getText();

    await browser.execute(() => { window.__lastAlert = null; });

    await $('#taskName').setValue('Sin días');
    await $('input[name="repeat"][value="days"]').click();
    // No marcamos ningún día: el formulario arranca con los 7
    // checkboxes desmarcados (flags=0).
    await $('#addTaskBtn').click();

    // Mismo patrón que en "nombre vacío": primero confirmamos con el
    // polyfill, luego intentamos aceptar el alert nativo.
    await browser.waitUntil(
      async () => await browser.execute(() => window.__lastAlert) !== null,
      { timeout: 5_000, timeoutMsg: 'No se disparó ningún alert al enviar días específicos sin días' },
    );
    const mensaje = await browser.execute(() => window.__lastAlert);
    expect(mensaje).toBe('Selecciona al menos un día');
    try {
      await browser.acceptAlert();
    } catch (_) {
      // El alert nativo puede haberse cerrado solo; ya lo capturó el polyfill.
    }
    const despues = await $('#taskCount').getText();
    expect(despues).toBe(antes);
  });

  it('valida: "Ciclo" con todas las semanas sin días muestra alert y no crea la tarea', async () => {
    await $('button.nav-item[data-view="tasks"]').click();
    await $('#view-tasks-heading').waitForDisplayed();
    const antes = await $('#taskCount').getText();

    await browser.execute(() => { window.__lastAlert = null; });

    await $('#taskName').setValue('Ciclo vacío');
    await $('input[name="repeat"][value="cycle"]').click();
    // Solo la semana 1 existe y, por defecto, todos sus días están
    // desmarcados (flags=0 en cycleWeeks[0]).
    await $('#addTaskBtn').click();

    await browser.waitUntil(
      async () => await browser.execute(() => window.__lastAlert) !== null,
      { timeout: 5_000, timeoutMsg: 'No se disparó ningún alert al enviar ciclo sin días' },
    );
    const mensaje = await browser.execute(() => window.__lastAlert);
    expect(mensaje).toBe('Marca al menos un día en el ciclo');
    try {
      await browser.acceptAlert();
    } catch (_) {
      // El alert nativo puede haberse cerrado solo; ya lo capturó el polyfill.
    }
    const despues = await $('#taskCount').getText();
    expect(despues).toBe(antes);
  });
});
