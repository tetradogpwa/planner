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
        <button class="btn-trash" title="Eliminar">🗑️</button>
        <button class="btn-edit"  title="Editar">✏️</button>
        <span class="task-name">${t.Name}</span>
        <span class="task-type">${this.#typeLabel(t)}</span>
      `;

      // ── Panel de edición (colapsado por defecto) ──
      const panel = document.createElement('div');
      panel.className = 'edit-panel';

      row.querySelector('.btn-trash').onclick = () => {
        this.context.Tasks.splice(i, 1);
        this.renderList();
      };

      row.querySelector('.btn-edit').onclick = () => {
        this.#togglePanel(i, panel, t);
      };

      this.listRoot.appendChild(row);
      this.listRoot.appendChild(panel);
    });
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
      }, { once: true });

      panel.addEventListener('task-cancel', () => {
        panel.classList.remove('open');
        panel.innerHTML = '';
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
