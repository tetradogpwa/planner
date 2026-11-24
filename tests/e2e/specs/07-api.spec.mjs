// Recorrido de PlannerApi desde la consola del navegador: crea una
// tarea, comprueba que la lista visible se actualiza sin recargar y
// que el anuncio role="status" lleva el mensaje correcto. Después
// navega a la vista Semana, borra la tarea y comprueba que se vacía
// la lista de Tareas al volver.

import { aceptarTerminos, nombresDeTareas } from '../helpers.mjs';

describe('PlannerApi (capa pública)', () => {
  it('monta window.PlannerApi al arrancar', async () => {
    await aceptarTerminos();
    const existe = await browser.execute(() => typeof window.PlannerApi);
    expect(existe).toBe('object');
  });

  it('addTask crea la tarea, actualiza la lista y anuncia el cambio', async () => {
    await browser.execute(() => window.PlannerApi.addTask({
      name: 'API diaria', repeat: 'daily',
    }));
    // La lista visible (sin recargar) ya tiene la tarea.
    await expect($('#taskCount')).toHaveText('1');
    expect(await nombresDeTareas()).toEqual(['API diaria']);
    // La región role="status" anuncia el cambio. Leemos textContent
    // (no getText, que en WebdriverIO puede leer aria-hidden).
    const status = await browser.execute(() => document.getElementById('plannerStatus').textContent);
    expect(status).toBe('Tarea «API diaria» añadida');
  });

  it('navigate("week") cambia la vista activa', async () => {
    await browser.execute(() => window.PlannerApi.navigate('week'));
    // La vista week queda activa.
    const weekActive = await $('#view-week').getAttribute('class');
    expect(weekActive).toContain('active');
    // Y el botón de menú de semana lleva aria-current="page".
    const ariaCurrent = await $('button.nav-item[data-view="week"]').getAttribute('aria-current');
    expect(ariaCurrent).toBe('page');
  });

  it('deleteTask borra la tarea y vuelve a la vista Tareas', async () => {
    // Borramos desde la vista Semana para verificar que la mutación
    // funciona aunque la vista activa no sea Tareas.
    await browser.execute(() => window.PlannerApi.deleteTask(0));
    const status = await browser.execute(() => document.getElementById('plannerStatus').textContent);
    expect(status).toBe('Tarea «API diaria» eliminada');
    // Volvemos a Tareas y comprobamos que la lista está vacía.
    await browser.execute(() => window.PlannerApi.navigate('tasks'));
    await expect($('#taskCount')).toHaveText('0');
    expect(await nombresDeTareas()).toEqual([]);
  });

  it('addTask acepta y devuelve la fecha de inicio de la tarea (startDate)', async () => {
    const creada = await browser.execute(() => window.PlannerApi.addTask({
      name: 'API con fecha', repeat: 'daily', startDate: '2026-11-25',
    }));
    // La API devuelve la fecha de inicio que le han dado.
    expect(creada.startDate).toBe('2026-11-25');

    // Y la lista también la lleva.
    const lista = await browser.execute(() => window.PlannerApi.listTasks());
    const tarea = lista.find(t => t.name === 'API con fecha');
    expect(tarea.startDate).toBe('2026-11-25');

    // daysFrom se sigue aceptando por compatibilidad: son los días
    // desde la fecha de inicio del planificador.
    const conOffset = await browser.execute(() => window.PlannerApi.addTask({
      name: 'API con offset', repeat: 'daily', daysFrom: 2,
    }));
    expect(typeof conOffset.startDate).toBe('string');
    expect(conOffset.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(conOffset.daysFrom).toBe(2);
  });

  it('cada tarea tiene un id único, y se puede usar para editarla y borrarla', async () => {
    const creada = await browser.execute(() => window.PlannerApi.addTask({
      name: 'API con id', repeat: 'daily',
    }));
    expect(typeof creada.id).toBe('string');
    expect(creada.id.length).toBeGreaterThan(0);

    // Los ids de la lista son únicos.
    const ids = await browser.execute(() => window.PlannerApi.listTasks().map(t => t.id));
    ids.forEach(id => expect(typeof id).toBe('string'));
    expect(new Set(ids).size).toBe(ids.length);

    // Editarla por su id no le cambia el id.
    const editada = await browser.execute(
      (id) => window.PlannerApi.updateTask(id, { name: 'API con id editada', repeat: 'daily' }),
      creada.id,
    );
    expect(editada.name).toBe('API con id editada');
    expect(editada.id).toBe(creada.id);

    // Y se puede leer por su id.
    const leida = await browser.execute((id) => window.PlannerApi.getTask(id), creada.id);
    expect(leida.name).toBe('API con id editada');

    // Y borrar por su id borra esa tarea y solo esa.
    const nombre = await browser.execute((id) => window.PlannerApi.deleteTask(id), creada.id);
    expect(nombre).toBe('API con id editada');
    const queda = await browser.execute((id) => window.PlannerApi.getTask(id), creada.id);
    expect(queda).toBeNull();
  });
});
