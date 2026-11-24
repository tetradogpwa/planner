import { buildTaskFromSpec } from '../../../back/taskSpec.js';
import { TaskForm }         from '../taskForm/taskForm-card.js';

/** Convierte un objeto tarea a estado del formulario. */
function taskToFormState(task) {
  const cn = task.constructor?.name ?? '';
  switch (cn) {
    case 'OneTimeTask':
      return { repeatType: 'no-repeat', nDays: 3, flags: 0, cycleWeeks: [0] };
    case 'DailyTask':
      return { repeatType: 'daily',     nDays: 3, flags: 0, cycleWeeks: [0] };
    case 'NDaysTask':
      return { repeatType: 'interval',  nDays: task.NDays ?? 3, flags: 0, cycleWeeks: [0] };
    case 'DaysOfWeekTask':
      return { repeatType: 'days',      nDays: 3, flags: task.flags ?? 0, cycleWeeks: [0] };
    case 'CiclesDaysOfWeekTask': {
      const cycleWeeks = (task.Cicles ?? []).map(c => c.flags ?? 0);
      return { repeatType: 'cycle',     nDays: 3, flags: 0, cycleWeeks: cycleWeeks.length ? cycleWeeks : [0] };
    }
    default:
      return { repeatType: 'daily',     nDays: 3, flags: 0, cycleWeeks: [0] };
  }
}

export class EditTaskCard {
  /**
   * @param {HTMLElement} root
   * @param {object}      task  — tarea existente (puede ser Proxy)
   */
  constructor(root, task) {
    this.root = root;
    this.task = task;

    // Estado del formulario inicializado desde la tarea
    this.state = taskToFormState(task);
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/taskManager/editTask/editTask-card.html').then(r => r.text()),
      fetch('./ui/taskManager/editTask/editTask-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.cache();
    // El formulario es el mismo módulo que usa el alta (T-047):
    // aquí, con prefijo de id ("edit"): editTaskName, editTimesPerDay…
    this.form = new TaskForm(this.root.querySelector('#editTaskFormMount'), { prefix: 'edit' });
    await this.form.init();
    this.prefill();
    this.bind();
  }

  cache() {
    this.saveBtn = this.root.querySelector('#saveEditBtn');
  }

  prefill() {
    this.form.setValues({ name: this.task.Name ?? '', total: this.task.Total ?? 1 });
    this.form.setState(this.state);
  }

  bind() {
    this.saveBtn.addEventListener('click', () => this.saveTask());

    // Ambos botones de cancelar
    this.root.querySelector('#cancelEditBtn').addEventListener('click',  () => this.#cancel());
    this.root.querySelector('#cancelEditBtn2').addEventListener('click', () => this.#cancel());
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  saveTask() {
    // Se conserva la fecha de inicio de la tarea que se está editando.
    const spec = this.form.buildSpec(this.task.StartDate);

    let task;
    try {
      task = buildTaskFromSpec(spec);
    } catch (err) {
      return alert(err.message);
    }

    this.root.dispatchEvent(new CustomEvent('task-update', { detail: task, bubbles: true }));
  }

  #cancel() {
    this.root.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true }));
  }
}
