import { AddTaskCard }  from './addTask/addTask-card.js';
import { EditTaskCard } from './editTask/editTask-card.js';

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
    this.mount();
  }

  mount() {
    const addRoot = this.root.querySelector('#addTaskMount');
    this.listRoot = this.root.querySelector('#taskListMount');
    this.countEl  = this.root.querySelector('#taskCount');
    const toggle  = this.root.querySelector('#editToggle');

    toggle.addEventListener('change', () => {
      this.listRoot.classList.toggle('edit-mode', toggle.checked);
      // Cerrar cualquier panel abierto al salir del modo edición
      if (!toggle.checked) this.#closeAllPanels();
    });

    const add = new AddTaskCard(addRoot);
    add.init();

    addRoot.addEventListener('task-create', (e) => {
      this.context.Tasks.push(e.detail);
      this.renderList();
    });

    this.renderList();
  }

  renderList() {
    this.listRoot.innerHTML = '';
    this.countEl.textContent = this.context.Tasks.length;

    this.context.Tasks.forEach((t, i) => {
      // ── Fila de tarea ──
      const row = document.createElement('div');
      row.className = 'task-row';
      row.innerHTML = `
        <button class="btn-trash" title="Eliminar" aria-label="Eliminar la tarea «${this.#escape(t.Name)}»">🗑️</button>
        <button class="btn-edit"  title="Editar"    aria-label="Editar la tarea «${this.#escape(t.Name)}»">✏️</button>
        <span class="task-name">${this.#escape(t.Name)}</span>
        <span class="task-type">${this.#typeLabel(t)}</span>
      `;

      // ── Panel de edición (colapsado por defecto) ──
      const panel = document.createElement('div');
      panel.className = 'edit-panel';

      row.querySelector('.btn-trash').onclick = (ev) => {
        // Tras el repintado el foco debe quedarse en el botón
        // Eliminar de la fila que ahora ocupa la posición `i` (la
        // siguiente tarea), o la anterior si era la última. Si la
        // lista queda vacía, saltamos al interruptor "Gestionar".
        this.context.Tasks.splice(i, 1);
        this.renderList();
        this.#focusAfterDelete(i);
      };

      row.querySelector('.btn-edit').onclick = () => {
        this.#togglePanel(i, panel, t);
      };

      this.listRoot.appendChild(row);
      this.listRoot.appendChild(panel);
    });
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

  /** Escapa comillas / corchetes angulares para que un nombre con
   *  caracteres especiales no rompa los atributos `aria-label`. */
  #escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));
  }

  // ── Panel inline de edición ───────────────────────────────────────────────

  #togglePanel(i, panel, task) {
    const isOpen = panel.classList.contains('open');

    // Cerrar todos los paneles abiertos
    this.#closeAllPanels();

    if (!isOpen) {
      panel.classList.add('open');
      const editCard = new EditTaskCard(panel, task);
      editCard.init();

      panel.addEventListener('task-update', (e) => {
        this.context.Tasks[i] = e.detail;
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
        // del recorrido.
        panel.classList.remove('open');
        panel.innerHTML = '';
        const buttons = this.listRoot.querySelectorAll('.btn-edit');
        const target  = buttons[i] ?? buttons[buttons.length - 1] ?? this.root.querySelector('#editToggle');
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
