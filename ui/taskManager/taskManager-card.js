import { AddTaskCard }  from './addTask/addTask-card.js';
import { EditTaskCard } from './editTask/editTask-card.js';
import { escapeHtml }   from '../escape.js';

// Estado del interruptor "Gestionar" (T-026). `index.js` recrea la
// TaskManagerCard en cada navegación a la vista 'tasks', así que sin
// esto el interruptor se apagaba solo al ir a Semana y volver. Lo
// guardamos en memoria del módulo (no en localStorage) porque es un
// estado de UI de la sesión: al recargar la app vuelve a estar apagado.
let editMode = false;

export class TaskManagerCard {
  constructor(root, context) {
    this.root    = root;
    this.context = context;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/taskManager/taskManager-card.html').then(r => r.text()),
      fetch('./ui/taskManager/taskManager-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    // `mount()` es async (espera a AddTaskCard para garantizar que
    // #taskName ya esté inyectado cuando el atajo Alt+N lo busca,
    // T-024): hay que esperar a su promesa aquí.
    await this.mount();
  }

  async mount() {
    const addRoot = this.root.querySelector('#addTaskMount');
    this.listRoot = this.root.querySelector('#taskListMount');
    this.countEl  = this.root.querySelector('#taskCount');
    this.statusEl = this.root.querySelector('#taskStatus');
    const toggle  = this.root.querySelector('#editToggle');

    toggle.addEventListener('change', () => {
      // Guardamos el estado en memoria del módulo para que la tarjeta
      // se pueda recrear al navegar sin perderlo (T-026).
      editMode = toggle.checked;
      this.listRoot.classList.toggle('edit-mode', toggle.checked);
      // Cerrar cualquier panel abierto al salir del modo edición
      if (!toggle.checked) this.#closeAllPanels();
    });

    // Restauramos el estado que hubiera antes de que la tarjeta se
    // recreara: marcado el interruptor y la clase en la lista, para
    // que la UI sea coherente desde el primer pintado (T-026).
    toggle.checked = editMode;
    this.listRoot.classList.toggle('edit-mode', editMode);

    const add = new AddTaskCard(addRoot);
    // Esperar a que AddTaskCard termine de inyectar su HTML (incluido
    // #taskName) antes de devolver el control: el atajo Alt+N hace
    // `setView('tasks').then(() => taskName.focus())` y, si esto
    // siguiera sin await, la promesa de `add.init()` quedaría
    // pendiente y el `.then()` no encontraría el campo (T-024).
    await add.init();

    addRoot.addEventListener('task-create', (e) => {
      this.context.Tasks.push(e.detail);
      this.renderList();
      // Aviso para los lectores de pantalla: la tarea se ha añadido.
      if (this.statusEl) this.statusEl.textContent = `Tarea «${e.detail.Name}» añadida`;
    });

    this.renderList();
  }

  renderList() {
    this.listRoot.innerHTML = '';
    this.countEl.textContent = this.context.Tasks.length;

    this.context.Tasks.forEach((t) => {
      // El identificador de la tarea: con él se sabe SIEMPRE qué tarea
      // es, aunque se mueva de posición. La posición capturada al
      // pintar deja de ser válida en cuanto se borra otra tarea (por
      // ejemplo, si un asistente borra una mientras el usuario edita
      // otra) (T-049).
      const taskId = t.Id;

      // ── Fila de tarea ──
      const row = document.createElement('div');
      row.className = 'task-row';
      row.innerHTML = `
        <button class="btn-trash" title="Eliminar" aria-label="Eliminar la tarea «${escapeHtml(t.Name)}»">🗑️</button>
        <button class="btn-edit"  title="Editar"    aria-label="Editar la tarea «${escapeHtml(t.Name)}»">✏️</button>
        <span class="task-name">${escapeHtml(t.Name)}</span>
        <span class="task-type">${escapeHtml(this.#typeLabel(t))}</span>
      `;

      // ── Panel de edición (colapsado por defecto) ──
      const panel = document.createElement('div');
      panel.className = 'edit-panel';

      row.querySelector('.btn-trash').onclick = () => {
        // La tarea se busca por su id y no por la posición que tenía
        // al pintarse la fila: si desde entonces se ha borrado otra,
        // esa posición ya apunta a otra tarea (T-049).
        const pos = this.#indiceDe(taskId);
        if (pos === -1) return;
        // Tras el repintado el foco debe quedarse en el botón
        // Eliminar de la fila que ahora ocupa la posición `pos` (la
        // siguiente tarea), o la anterior si era la última. Si la
        // lista queda vacía, saltamos al interruptor "Gestionar".
        this.context.Tasks.splice(pos, 1);
        // Con la tarea se van sus marcas de «hecho» (T-050): si no, al
        // volver a importar esa tarea aparecería como ya hecha.
        this.context.ClearMarks(taskId);
        this.renderList();
        this.#focusAfterDelete(pos);
      };

      row.querySelector('.btn-edit').onclick = () => {
        this.#togglePanel(panel, t);
      };

      this.listRoot.appendChild(row);
      this.listRoot.appendChild(panel);
    });
  }

  /** La posición de la tarea con el id `taskId` en la lista, o -1 si
   *  ya no está (por ejemplo, si la ha borrado un asistente). */
  #indiceDe(taskId) {
    return this.context.Tasks.findIndex(t => t.Id === taskId);
  }

  /** Tras borrar la tarea en el índice `i`, devuelve el foco a la
   *  misma posición tras el repintado (la fila que antes era la
   *  siguiente). Si era la última, va a la anterior; si la lista
   *  ha quedado vacía, salta al interruptor "Gestionar" para no
   *  perder el recorrido. */
  #focusAfterDelete(i) {
    const buttons = this.listRoot.querySelectorAll('.btn-trash');
    if (buttons.length === 0) {
      const toggle = this.root.querySelector('#editToggle');
      if (toggle) toggle.focus();
      return;
    }
    const target = buttons[Math.min(i, buttons.length - 1)];
    if (target) target.focus();
  }

  // ── Panel inline de edición ───────────────────────────────────────────────

  #togglePanel(panel, task) {
    const isOpen = panel.classList.contains('open');

    // Cerrar todos los paneles abiertos
    this.#closeAllPanels();

    if (!isOpen) {
      panel.classList.add('open');
      // La tarea que se está editando, por su id: el guardado tiene
      // que ir a ESTA tarea, no a la que ocupaba su posición cuando
      // se abrió el panel (T-049).
      const taskId = task.Id;
      const editCard = new EditTaskCard(panel, task);
      editCard.init();

      panel.addEventListener('task-update', (e) => {
        const pos = this.#indiceDe(taskId);
        if (pos === -1) {
          // La tarea editada ya no está (un asistente la borró
          // mientras el panel estaba abierto): el cambio no se aplica
          // a ninguna otra tarea.
          if (this.statusEl) {
            this.statusEl.textContent = 'La tarea que estabas editando ya no existe';
          }
          this.renderList();
          return;
        }
        // La tarea editada conserva su identificador: sigue siendo la
        // misma tarea.
        e.detail.Id = taskId;
        this.context.Tasks[pos] = e.detail;
        this.renderList();
        // Devolvemos el foco al heading principal; tras un cambio
        // seguido de repintado completo, el heading es el anclaje
        // más estable (no dependemos de la fila, que se recrea).
        const heading = this.root.querySelector('#view-tasks-heading');
        if (heading) heading.focus();
      }, { once: true });

      panel.addEventListener('task-cancel', () => {
        // Cancelar no cambia los datos; devolvemos el foco al botón
        // Editar de la fila correspondiente para mantener el orden
        // del recorrido. La fila se busca por su id (y no por la
        // posición capturada al abrir el panel), que es la que sigue
        // siendo la misma tarea (T-049).
        panel.classList.remove('open');
        panel.innerHTML = '';
        const pos = this.#indiceDe(taskId);
        const buttons = this.listRoot.querySelectorAll('.btn-edit');
        const target  = buttons[pos] ?? buttons[buttons.length - 1] ?? this.root.querySelector('#editToggle');
        if (target) target.focus();
      }, { once: true });
    }
  }

  #closeAllPanels() {
    this.listRoot.querySelectorAll('.edit-panel.open').forEach(p => {
      p.classList.remove('open');
      p.innerHTML = '';
    });
  }

  // ── Utilidades ───────────────────────────────────────────────────────────

  #typeLabel(t) {
    switch (t.constructor?.name) {
      case 'DailyTask':          return 'Diaria';
      case 'WeeklyTask':         return 'Semanal';
      case 'NDaysTask':          return `Cada ${t.NDays}d`;
      case 'DaysOfWeekTask':     return 'Días esp.';
      case 'OneTimeTask':        return 'Una vez';
      case 'CiclesDaysOfWeekTask': return 'Ciclo';
      default:                   return t.constructor?.name ?? '—';
    }
  }
}
