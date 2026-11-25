// Recorrido básico de la app real: términos, crear una tarea, verla en
// la semana y que siga ahí al volver a abrir. Si esta spec falla, la
// app no sirve para lo más básico.

import {
  esperarArranque,
  aceptarTerminos,
  recargar,
  crearTarea,
  nombresDeTareas,
  irATareas,
  navegarVistaAlt,
} from '../helpers.mjs';

describe('Arranque y primera tarea', () => {
  it('una instalación nueva pide los términos antes de nada', async () => {
    expect(await esperarArranque()).toBe('terminos');
    await expect($('#terms-title')).toHaveText('Antes de empezar');
  });

  it('al aceptarlos se abre la vista Tareas, vacía', async () => {
    await aceptarTerminos();
    await expect($('#taskCount')).toHaveText('0');
    expect(await nombresDeTareas()).toEqual([]);
  });

  it('los términos aceptados no se vuelven a pedir', async () => {
    expect(await recargar()).toBe('app');
  });

  it('crea una tarea diaria y aparece en la lista', async () => {
    await crearTarea('Beber agua', 'daily');
    await expect($('#taskCount')).toHaveText('1');
    expect(await nombresDeTareas()).toEqual(['Beber agua']);
  });

  it('la tarea diaria sale hoy en la vista Semana (Alt+2)', async () => {
    // navegarVistaAlt espera al aviso de pintado de la app
    // ('planner:painted'): sin esa espera se puede leer la celda de
    // hoy antes de que la vista Semana esté pintada.
    await navegarVistaAlt(2);
    const hoy = $('#view-week .day-cell.is-today');
    await hoy.waitForDisplayed();
    await expect(hoy.$('.day-header')).toHaveAttribute('aria-expanded', 'true');
    await expect(hoy.$('.task-list')).toHaveText(expect.stringContaining('BEBER AGUA'));
  });

  it('la tarea sigue guardada al volver a abrir la app', async () => {
    expect(await recargar()).toBe('app');
    expect(await nombresDeTareas()).toEqual(['Beber agua']);
  });

  it('avisa cuando una vista termina de pintarse', async () => {
    // La app activa la vista antes de pintarla (el pintado es
    // asíncrono: trae el HTML y el CSS de la tarjeta). Sin este
    // aviso, quien lea el DOM nada más abrir una vista puede leer el
    // contenido del pintado anterior; fue lo que hizo fallar de
    // forma intermitente a la vista Tareas en los E2E.
    await browser.execute(() => {
      window.__painted = 0;
      window.__paintedView = null;
      window.addEventListener('planner:painted', (e) => {
        window.__painted += 1;
        window.__paintedView = e.detail?.view ?? null;
      });
    });

    await $('button.nav-item[data-view="week"]').click();
    await browser.waitUntil(
      async () => await browser.execute(() => window.__painted > 0),
      { timeout: 10_000, timeoutMsg: 'La app no avisó de que la vista terminó de pintarse' },
    );
    expect(await browser.execute(() => window.__paintedView)).toBe('week');

    // Volvemos a Tareas para no dejar la app en otra vista.
    await irATareas();
  });
});
