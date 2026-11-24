import { buildTaskFromSpec } from '../../../back/taskSpec.js';
import { todayISO }         from '../../../back/calendar.js';
import { TaskForm }         from '../taskForm/taskForm-card.js';

export class AddTaskCard {
  constructor(root) {
    this.root = root;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/taskManager/addTask/addTask-card.html').then(r => r.text()),
      fetch('./ui/taskManager/addTask/addTask-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.cache();
    // El formulario es el mismo módulo que usa la edición (T-047):
    // aquí, sin prefijo de id (taskName, timesPerDay, extraOptions…).
    this.form = new TaskForm(this.root.querySelector('#addTaskFormMount'));
    await this.form.init();
    this.bind();
  }

  cache() {
    this.btn = this.root.querySelector('#addTaskBtn');
  }

  bind() {
    this.btn.addEventListener('click', () => this.createTask());
  }

  createTask() {
    // Construye el spec que espera PlannerApi / buildTaskFromSpec. La
    // validación y construcción por tipo de repetición viven en
    // back/taskSpec.js: si algo no cuadra, buildTaskFromSpec lanza el
    // error con el mensaje en español y lo mostramos al usuario.
    //
    // La tarea empieza HOY (su fecha de inicio es real, no un offset
    // respecto a un origen): así la columna en la que sale depende del
    // día de la semana de verdad y no del día en que se abrió la app.
    const spec = this.form.buildSpec(todayISO());

    let task;
    try {
      task = buildTaskFromSpec(spec);
    } catch (err) {
      return alert(err.message);
    }

    this.root.dispatchEvent(new CustomEvent('task-create', { detail: task, bubbles: true }));
    this.form.reset();
  }
}
