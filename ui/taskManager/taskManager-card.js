import { AddTaskCard } from './addTask/addTask-card.js';

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
    const addRoot  = this.root.querySelector('#addTaskMount');
    this.listRoot  = this.root.querySelector('#taskListMount');
    this.countEl   = this.root.querySelector('#taskCount');
    const toggle   = this.root.querySelector('#editToggle');

    // Switch gestión → activa/desactiva modo edición
    toggle.addEventListener('change', () => {
      this.listRoot.classList.toggle('edit-mode', toggle.checked);
    });

    // AddTaskCard emite 'task-create' con bubbles
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
      const row = document.createElement('div');
      row.className = 'task-row';
      row.innerHTML = `
        <button class="btn-trash" title="Eliminar">🗑️</button>
        <span class="task-name">${t.Name}</span>
        <span class="task-type">${this.typeLabel(t)}</span>
      `;
      row.querySelector('.btn-trash').onclick = () => {
        this.context.Tasks.splice(i, 1);
        this.renderList();
      };
      this.listRoot.appendChild(row);
    });
  }

  typeLabel(t) {
    switch (t.constructor?.name) {
      case 'DailyTask':      return 'Diaria';
      case 'WeeklyTask':     return 'Semanal';
      case 'NDaysTask':      return `Cada ${t.NDays}d`;
      case 'DaysOfWeekTask': return 'Días esp.';
      case 'OneTimeTask':    return 'Una vez';
      default:               return t.constructor?.name ?? '—';
    }
  }
}