import { TaskForm } from '../taskForm/taskForm-card.js';
import { montarTarjeta } from '../../base-card.js';

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

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const html = await montarTarjeta(
      this.root,
      './ui/taskManager/editTask/editTask-card.html',
      './ui/taskManager/editTask/editTask-card.css',
    );
    if (!html) return false;
    this.cache();
    // El formulario es el mismo módulo que usa el alta (T-047):
    // aquí, con prefijo de id ("edit"): editTaskName, editTimesPerDay…
    // El formulario se guarda solo (su submit) y avisa con onSave.
    this.form = new TaskForm(this.root.querySelector('#editTaskFormMount'), {
      prefix: 'edit',
      onSave: (task) => this.guardarTarea(task),
    });
    if (!await this.form.init()) return false;
    this.prefill();
    this.bind();
    return true;
  }

  cache() {
    this.saveBtn = this.root.querySelector('#saveEditBtn');
  }

  prefill() {
    this.form.setValues({
      name:  this.task.Name ?? '',
      total: this.task.Total ?? 1,
      date:  this.task.StartDate,
    });
    this.form.setState(this.state);
  }

  bind() {
    // El botón es type="submit" del <form> del formulario: el navegador
    // lo envía (y Enter en el nombre hace lo mismo). Como el formulario
    // vive en otro sitio del DOM, se lo asocia con su atributo `form`.
    this.saveBtn.setAttribute('form', this.form.ids.formId);

    // Ambos botones de cancelar
    this.root.querySelector('#cancelEditBtn').addEventListener('click',  () => this.#cancel());
    this.root.querySelector('#cancelEditBtn2').addEventListener('click', () => this.#cancel());
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  guardarTarea(task) {
    this.root.dispatchEvent(new CustomEvent('task-update', { detail: task, bubbles: true }));
  }

  #cancel() {
    this.root.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true }));
  }
}
