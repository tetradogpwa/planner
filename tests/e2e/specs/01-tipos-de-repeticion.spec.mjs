// Recorrido del formulario de creación para los cinco tipos de repetición:
// "Sin repetición", "Diario", "Cada N días", "Días específicos" y "Ciclo".
// Para cada uno crea la tarea desde la UI, comprueba el resumen de
// repetición en la lista y verifica en qué celdas (lunes a domingo)
// aparece su insignia en la vista Semana. Termina con las validaciones
// del formulario (el error se muestra junto al campo, sin ventanas de
// diálogo: T-048) y el caso de Veces/día > 1.

import {
  abrirAppNueva,
  crearTarea,
  crearTareaNDias,
  crearTareaDias,
  esperarPintado,
  nombresDeTareas,
  tiposDeTareas,
  fechaCorta,
  irASemana,
  celdasCon,
  hoy,
  celdasDeUnaVez,
  celdasDeDiasSemana,
  celdasCadaNDias,
  celdasDesde,
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
  // Desde T-048 la aplicación NO abre ninguna ventana de diálogo: los
  // errores de validación se muestran junto al campo. El polyfill de
  // window.alert se queda como sonda: si la app volviera a llamar a
  // alert(), el mensaje quedaría registrado (y la prueba lo vería).
  // No se llama al alert original, para que un diálogo nativo no
  // bloquee la sesión.
  // Lo registramos en beforeEach porque la app puede perder
  // listeners al navegar entre vistas (la sesión DOM se reinicia).
  beforeEach(async () => {
    await browser.execute(() => {
      window.__lastAlert = null;
      window.alert = (msg) => {
        window.__lastAlert = String(msg);
      };
    });
  });
  before(() => {
    // Listener global para TODOS los tests: desactivamos el
    // auto-handle de WebdriverIO y dejamos el alert abierto para
    // poder llamar a acceptAlert().
    browser.on('dialog', () => {});
  });

  /** Estado del error de validación que se muestra junto al campo del
   *  nombre: el mensaje, si se ve, y qué marca el campo (T-048).
   *
   *  Los atributos se leen con el comando nativo del WebDriver (no con
   *  un script): leer `aria-describedby` desde un script hace que
   *  WebKit calcule la descripción accesible del campo y el script
   *  falla con un error que no es del test. */
  const errorEnElCampo = async () => ({
    alerta:   await browser.execute(() => window.__lastAlert),
    mensaje:  await $('#taskError').getText(),
    visible:  await $('#taskError').isDisplayed(),
    invalido: await $('#taskName').getAttribute('aria-invalid'),
    foco:     await browser.execute(() => document.activeElement?.id ?? ''),
  });

  it('la app arranca con la lista de tareas vacía', async () => {
    await abrirAppNueva();
    await expect($('#view-tasks-heading')).toBeDisplayed();
    await expect($('#taskCount')).toHaveText('0');
    expect(await nombresDeTareas()).toEqual([]);
  });

  it('crea las 5 tareas básicas y cada una muestra su resumen de repetición', async () => {
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
    // El resumen de cada una dice cuándo se repite (T-052). Las tareas
    // se acaban de crear, así que su fecha de inicio es la de hoy: el
    // resumen se calcula, no se escribe a mano.
    const hoy = fechaCorta();
    expect(await tiposDeTareas()).toEqual([
      `Una vez · ${hoy}`, 'Diaria', `Cada 3 días desde el ${hoy}`,
      'Lun, Jue', 'Ciclo de 2 semanas',
    ]);
  });

  it('en la Semana, "Diaria" aparece todos los días desde que se creó y "Una vez" solo en una', async () => {
    // La navegación (irASemana) espera al aviso de pintado de la app
    // ('planner:painted'): la vista se activa antes de pintarse, así
    // que sin esa espera las celdas que se leen abajo podrían ser las
    // del pintado anterior.
    await irASemana();
    // La tarea diaria se creó hoy: sale todos los días desde ese día
    // (antes no existía) y en las 7 celdas a partir de ahí.
    expect(await celdasCon('Tarea diaria')).toEqual(celdasDesde(hoy()));
    const unaVez = await celdasCon('Una sola vez');
    const totalPresencias = unaVez.filter(Boolean).length;
    expect(totalPresencias).toBe(1);
    // Y la única celda es la del día en que se creó la tarea: el
    // calendario va anclado a fechas reales, así que una tarea "sin
    // repetición" caduca (no vuelve a salir al día siguiente) y sale en
    // la columna de su día de la semana de verdad.
    // (La lectura va con la vista ya pintada: por eso aquí no sale el
    // 'stale element reference' que se vio antes.)
    expect(unaVez).toEqual(celdasDeUnaVez(hoy()));
  });

  it('"Cada 3 días" aparece cada 3 días reales desde el día en que se creó', async () => {
    // No es "los días 0, 3 y 6 de la semana": es cada 3 días desde la
    // fecha de creación de la tarea.
    expect(await celdasCon('Cada 3 días')).toEqual(celdasCadaNDias(3, hoy()));
  });

  it('"Días puntuales" aparece solo en los días marcados (lunes y jueves)', async () => {
    expect(await celdasCon('Días puntuales')).toEqual(celdasDeDiasSemana([0, 3], hoy()));
  });

  it('"Ciclo quincenal" pinta los días de la primera semana del ciclo (lunes y miércoles)', async () => {
    expect(await celdasCon('Ciclo quincenal')).toEqual(celdasDeDiasSemana([0, 2], hoy()));
  });

  it('con Veces/día = 2, una tarea diaria muestra dos insignias, una por vez', async () => {
    // Volvemos a la vista Tareas para crear una nueva tarea. Se espera
    // al aviso de pintado ('planner:painted'): la vista se activa
    // antes de pintarse, así que sin esta espera se podría leer el
    // contenido del pintado anterior.
    await esperarPintado(async () => {
      await $('button.nav-item[data-view="tasks"]').click();
    });
    await $('#taskName').setValue('Dos veces');
    await $('#timesPerDay').setValue('2');
    await $('input[name="repeat"][value="daily"]').click();
    await $('#addTaskBtn').click();
    await expect($('#taskCount')).toHaveText('6');

    await irASemana();
    const celdas = await celdasCon('Dos veces');
    // Aparece todos los días desde el día en que se creó.
    expect(celdas).toEqual(celdasDesde(hoy()));
    // Y en cada una de esas celdas hay dos insignias, una por vez
    // (en las anteriores no hay ninguna: la tarea no existía).
    const detalle = await browser.execute(() => {
      const cells = Array.from(document.querySelectorAll('#view-week .day-cell'));
      return cells.map(cell =>
        Array.from(cell.querySelectorAll('.task-badge'))
          .map(b => b.textContent.trim())
          .filter(t => t.startsWith('DOS VECES'))
      );
    });
    detalle.forEach((badges, i) => {
      if (celdas[i]) expect(badges).toEqual(['DOS VECES · 1/2', 'DOS VECES · 2/2']);
      else          expect(badges).toEqual([]);
    });
  });

  it('valida: nombre vacío muestra el error junto al campo y no crea la tarea', async () => {
    // Volvemos a la vista Tareas y esperamos al aviso de pintado
    // ('planner:painted'): la vista se activa antes de pintarse.
    await esperarPintado(async () => {
      await $('button.nav-item[data-view="tasks"]').click();
    });
    const antes = await $('#taskCount').getText();

    // Reiniciamos el último alert registrado por el polyfill.
    await browser.execute(() => { window.__lastAlert = null; });

    // El campo #taskName ya está vacío tras el reset() anterior;
    // WebdriverIO rechaza setValue con string vacío, así que no lo
    // tocamos.
    await $('input[name="repeat"][value="daily"]').click();
    await $('#addTaskBtn').click();

    // El error se ve junto al campo del nombre (no en una ventana de
    // diálogo) y el foco vuelve al campo.
    const estado = await errorEnElCampo();
    expect(estado.alerta).toBe(null);
    expect(estado.mensaje).toBe('Nombre requerido');
    expect(estado.visible).toBe(true);
    expect(estado.invalido).toBe('true');
    expect(estado.foco).toBe('taskName');

    const despues = await $('#taskCount').getText();
    expect(despues).toBe(antes);
  });

  it('valida: "Días específicos" sin días muestra el error y no crea la tarea', async () => {
    // Volvemos a la vista Tareas y esperamos al aviso de pintado
    // ('planner:painted'): la vista se activa antes de pintarse.
    await esperarPintado(async () => {
      await $('button.nav-item[data-view="tasks"]').click();
    });
    const antes = await $('#taskCount').getText();

    await browser.execute(() => { window.__lastAlert = null; });

    await $('#taskName').setValue('Sin días');
    await $('input[name="repeat"][value="days"]').click();
    // No marcamos ningún día: el formulario arranca con los 7
    // checkboxes desmarcados (flags=0).
    await $('#addTaskBtn').click();

    const estado = await errorEnElCampo();
    expect(estado.alerta).toBe(null);
    expect(estado.mensaje).toBe('Selecciona al menos un día');
    expect(estado.visible).toBe(true);

    const despues = await $('#taskCount').getText();
    expect(despues).toBe(antes);
  });

  it('valida: "Ciclo" con todas las semanas sin días muestra el error y no crea la tarea', async () => {
    // Volvemos a la vista Tareas y esperamos al aviso de pintado
    // ('planner:painted'): la vista se activa antes de pintarse.
    await esperarPintado(async () => {
      await $('button.nav-item[data-view="tasks"]').click();
    });
    const antes = await $('#taskCount').getText();

    await browser.execute(() => { window.__lastAlert = null; });

    await $('#taskName').setValue('Ciclo vacío');
    await $('input[name="repeat"][value="cycle"]').click();
    // Solo la semana 1 existe y, por defecto, todos sus días están
    // desmarcados (flags=0 en cycleWeeks[0]).
    await $('#addTaskBtn').click();

    const estado = await errorEnElCampo();
    expect(estado.alerta).toBe(null);
    expect(estado.mensaje).toBe('Marca al menos un día en el ciclo');
    expect(estado.visible).toBe(true);

    const despues = await $('#taskCount').getText();
    expect(despues).toBe(antes);
  });
});
