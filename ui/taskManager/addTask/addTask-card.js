import { TaskForm } from '../taskForm/taskForm-card.js';

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
    // El formulario se guarda solo (su submit) y avisa con onSave.
    this.form = new TaskForm(this.root.querySelector('#addTaskFormMount'), {
      onSave: (task) => this.creaTarea(task),
    });
    await this.form.init();
    this.bind();
  }

  cache() {
    this.btn = this.root.querySelector('#addTaskBtn');
  }

  bind() {
    // El botón es type="submit" del <form> del formulario: el navegador
    // lo envía (y Enter en el nombre hace lo mismo). Como el formulario
    // vive en otro sitio del DOM, se lo asocia con su atributo `form`.
    this.btn.setAttribute('form', this.form.ids.formId);
  }

  creaTarea(task) {
    this.root.dispatchEvent(new CustomEvent('task-create', { detail: task, bubbles: true }));
    this.form.reset();
  }
}
