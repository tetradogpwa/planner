// T-049: cada tarea con un identificador estable.
//
// La app identificaba las tareas por su POSICIÓN en la lista. Si un
// asistente (por MCP) borra una tarea mientras el usuario edita otra,
// el panel de edición guardaba sobre la tarea equivocada: el índice
// capturado al abrir el panel ya no era el mismo.
//
// Aquí se comprueba que con el id:
//   1. cada tarea tiene un id único,
//   2. editar una tarea no le cambia el id,
//   3. editar una tarea mientras otra se borra por la API modifica la
//      correcta,
//   4. borrar desde la lista borra la tarea que el usuario tenía
//      delante, aunque otra se haya borrado antes.
//
// OJO: en los dos últimos casos el borrado por la API y la pulsación
// del usuario se ejecutan en el MISMO instante (en un solo
// `browser.execute`). Eso es lo que hace que la prueba sea
// determinista: al borrar una tarea por la API la app repinta la
// lista, y ese repintado (asíncrono) borraría el panel y los botones
// que el usuario tenía delante. En la app real el usuario puede
// pulsar antes de que llegue el repintado: justo lo que hay que
// arreglar.

import { abrirAppNueva, crearTarea, nombresDeTareas, recargar } from '../helpers.mjs';

// Selector del botón "Editar" de la fila `i` (0-based) de la lista.
// Las filas y los paneles de edición son hermanos y los dos son
// <div>: `:nth-of-type` cuenta por tipo de elemento, así que las
// filas son los DIVs impares (1, 3, 5…) → `2*i+1`.
const btnEdit = (i) => $(`#taskListMount .task-row:nth-of-type(${2 * i + 1}) .btn-edit`);

// Enciende el interruptor "Gestionar" si aún no lo está. El <input
// id="editToggle"> está visualmente oculto; se pulsa el slider que
// tiene al lado, que es lo que haría una persona con el ratón.
const activarGestionar = async () => {
  if (!(await $('#editToggle').isSelected())) {
    const slider = await $('#editToggle + .slider');
    await slider.scrollIntoView();
    await slider.click();
  }
};

// Espera a que la lista tenga los nombres esperados y los devuelve.
// Se espera a la lista real (se compara con lo esperado), no a un
// plazo: si no llega, el fallo dice cuál era la lista de verdad.
const esperarNombres = async (esperado, ms = 5_000) => {
  let vista = [];
  const llegó = await browser.waitUntil(
    async () => {
      vista = await nombresDeTareas();
      return vista.join(' | ') === esperado;
    },
    { timeout: ms, timeoutMsg: `La lista de tareas no llegó a ser "${esperado}"` },
  ).then(() => true).catch(() => false);
  if (!llegó) {
    throw new Error(
      `La lista de tareas no llegó a ser "${esperado}". Ahora es: "${vista.join(' | ')}"`,
    );
  }
  return vista;
};

describe('Identificador estable de cada tarea (T-049)', () => {

  before(async () => {
    await abrirAppNueva();
    await crearTarea('Tarea A', 'daily');
    await crearTarea('Tarea B', 'daily');
    await crearTarea('Tarea C', 'daily');
    await crearTarea('Tarea D', 'daily');
    await expect($('#taskCount')).toHaveText('4');
  });

  it('cada tarea tiene un id único', async () => {
    const ids = await browser.execute(() => window.PlannerApi.listTasks().map(t => t.id));
    expect(ids.length).toBe(4);
    ids.forEach(id => expect(typeof id).toBe('string'));
    expect(new Set(ids).size).toBe(4);
  });

  it('editar una tarea desde la interfaz no le cambia el id', async () => {
    const antes = await browser.execute(
      () => window.PlannerApi.listTasks().find(t => t.name === 'Tarea A'),
    );

    await activarGestionar();
    await btnEdit(0).click();
    await $('#editTaskName').waitForDisplayed();
    await $('#editTaskName').setValue('Tarea A editada');
    await $('#saveEditBtn').click();

    const vista = await esperarNombres('Tarea A editada | Tarea B | Tarea C | Tarea D');
    expect(vista.join(' | ')).toBe('Tarea A editada | Tarea B | Tarea C | Tarea D');

    // La lista tiene la tarea nueva… con el MISMO id: editarla no la
    // convierte en otra tarea.
    const despues = await browser.execute(
      () => window.PlannerApi.listTasks().find(t => t.name === 'Tarea A editada'),
    );
    expect(despues.id).toBe(antes.id);
  });

  it('editar una tarea mientras otra se borra por la API modifica la correcta', async () => {
    await activarGestionar();

    // El usuario abre el panel de edición de la tercera tarea
    // (Tarea C) y cambia su nombre.
    await btnEdit(2).click();
    await $('#editTaskName').waitForDisplayed();
    await $('#editTaskName').setValue('Tarea C editada');

    // Un asistente borra la segunda tarea (Tarea B) por la API y el
    // usuario guarda, en el mismo instante. El panel sigue abierto
    // (el repintado de la lista llega después), así que el guardado
    // no puede usar la posición: tiene que usar el id.
    await browser.execute(() => {
      const b = window.PlannerApi.listTasks().find(t => t.name === 'Tarea B');
      window.PlannerApi.deleteTask(b.id);
      document.querySelector('#editTaskForm').requestSubmit();
    });

    // La lista queda con A, C editada y D: la tarea D (la que ocupaba
    // la posición 2 cuando se borró la B) no se ha tocado.
    const vista = await esperarNombres('Tarea A editada | Tarea C editada | Tarea D');
    expect(vista.join(' | ')).toBe('Tarea A editada | Tarea C editada | Tarea D');
  });

  it('borrar desde la lista borra la tarea que tenía delante, aunque otra se haya borrado antes', async () => {
    await activarGestionar();

    // El usuario tiene delante la segunda fila (Tarea C editada) y
    // pulsa su botón de eliminar. Un asistente borra la primera tarea
    // (Tarea A editada) por la API en el mismo instante: el índice
    // que el botón capturó al pintarse ya no es el de esa fila.
    await browser.execute(() => {
      const a = window.PlannerApi.listTasks().find(t => t.name === 'Tarea A editada');
      window.PlannerApi.deleteTask(a.id);
      document.querySelectorAll('#taskListMount .btn-trash')[1].click();
    });

    // Se borra la fila que el usuario tenía delante (Tarea C
    // editada), no la que quedó en su lugar (Tarea D).
    const vista = await esperarNombres('Tarea D');
    expect(vista.join(' | ')).toBe('Tarea D');
  });

  it('el id sigue siendo el mismo tras recargar la app', async () => {
    const antes = await browser.execute(
      () => window.PlannerApi.listTasks().map(t => ({ id: t.id, name: t.name })),
    );
    expect(antes.length).toBeGreaterThan(0);

    // Recargar es como cerrar la app y volver a abrirla.
    expect(await recargar()).toBe('app');

    const despues = await browser.execute(
      () => window.PlannerApi.listTasks().map(t => ({ id: t.id, name: t.name })),
    );
    expect(despues).toEqual(antes);
  });
});
