// T-047: el formulario de tarea es el mismo módulo en el alta y en la
// edición.
//
// El de alta está siempre en la página y el de edición dentro del panel
// de una fila: los dos conviven. Esta spec comprueba que cada uno
// tiene sus ids, su grupo de radios y su estilo, y que el de edición
// no necesita el CSS del alta para verse bien (si dependiera de él, al
// quitar el CSS del alta se quedaría sin estilo).

import { abrirAppNueva, crearTarea } from '../helpers.mjs';

// Selector del botón "Editar" de la fila `i` (0-based) de la lista.
// Las filas y los paneles de edición son hermanos y los dos son
// <div>: las filas son los DIVs impares (1, 3, 5…) → `2*i+1`.
const btnEdit = (i) => $(`#taskListMount .task-row:nth-of-type(${2 * i + 1}) .btn-edit`);

describe('Formulario de tarea compartido por el alta y la edición', () => {

  before(async () => {
    await abrirAppNueva();
    await crearTarea('Tarea compartida', 'daily');
    await expect($('#taskCount')).toHaveText('1');
  });

  // Abre el panel de edición de la fila `i` (como una persona: el
  // interruptor "Gestionar" y luego el botón Editar de la fila).
  const abrirEdicion = async (i) => {
    await browser.waitUntil(
      async () => (await $$('#taskListMount .task-row').length) >= i + 1,
      { timeout: 5_000, timeoutMsg: `La lista no llegó a tener ${i + 1} filas` },
    );
    if (!(await $('#editToggle').isSelected())) {
      // El <input id="editToggle"> está oculto: se clic su slider
      // visible, que es lo que hace una persona con el ratón.
      const slider = await $('#editToggle + .slider');
      await slider.scrollIntoView();
      await slider.click();
    }
    await btnEdit(i).click();
    await $('#editTaskName').waitForDisplayed();
  };

  it('el alta y la edición están a la vez, con ids distintos', async () => {
    await abrirEdicion(0);

    const estado = await browser.execute(() => {
      const cuenta = {};
      for (const id of ['taskName', 'timesPerDay', 'repeatLabel', 'extraOptions',
                        'editTaskName', 'editTimesPerDay', 'editRepeatLabel', 'editExtraOptions']) {
        cuenta[id] = document.querySelectorAll(`[id="${id}"]`).length;
      }
      return {
        cuenta,
        radiosAlta:    document.querySelectorAll('input[name="repeat"]').length,
        radiosEdicion: document.querySelectorAll('input[name="edit-repeat"]').length,
      };
    });

    // Cada id existe una vez y solo una: los dos formularios no se pisan.
    Object.values(estado.cuenta).forEach(n => expect(n).toBe(1));
    // Y cada uno tiene su propio grupo de cinco radios.
    expect(estado.radiosAlta).toBe(5);
    expect(estado.radiosEdicion).toBe(5);
  });

  it('cambiar el tipo de repetición en la edición no toca el del alta', async () => {
    // En la edición ponemos "Días específicos"; en el alta debe seguir
    // "Sin repetición" y sin sus casillas de días.
    await $('input[name="edit-repeat"][value="days"]').click();

    const estado = await browser.execute(() => ({
      alta:        document.querySelector('input[name="repeat"]:checked')?.value,
      edicion:     document.querySelector('input[name="edit-repeat"]:checked')?.value,
      diasAlta:    document.querySelectorAll('#extraOptions input[type="checkbox"]').length,
      diasEdicion: document.querySelectorAll('#editExtraOptions input[type="checkbox"]').length,
    }));

    expect(estado.alta).toBe('no-repeat');
    expect(estado.edicion).toBe('days');
    expect(estado.diasAlta).toBe(0);
    expect(estado.diasEdicion).toBe(7);
  });

  it('el formulario de edición se ve igual sin el CSS del alta', async () => {
    // Quitamos del documento todo el CSS que inyectó el alta (el de su
    // tarjeta y el del módulo del formulario): el formulario de
    // edición tiene que seguir con el estilo del módulo compartido.
    const quitados = await browser.execute(() => {
      const estilos = document.querySelectorAll('#addTaskMount style');
      estilos.forEach(s => s.remove());
      return estilos.length;
    });
    expect(quitados).toBeGreaterThan(0);

    const estilo = await browser.execute(() => {
      const opcion = document.getElementById('editRepeatLabel')
        .parentElement.querySelector('.repeat-option');
      const cs = getComputedStyle(opcion);
      return { radio: cs.borderRadius, display: cs.display };
    });
    // Las opciones de repetición son "pills" (radio 999px) en fila.
    expect(estilo.radio).toBe('999px');
    expect(estilo.display).toBe('flex');
  });
});
