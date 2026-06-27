import { AddTaskCard } from './addTask/addTask-card.js'; // ← path corregido

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
    const listRoot = this.root.querySelector('#taskListMount');

    const add = new AddTaskCard(addRoot);
    add.init();

    // AddTaskCard dispara 'task-create' con bubbles:true → lo capturamos aquí
    addRoot.addEventListener('task-create', (e) => {
      this.context.Tasks.push(e.detail);
      this.renderList(listRoot);
    });

    this.listRoot = listRoot;
    this.renderList(listRoot);
  }

  renderList(listRoot = this.listRoot) {
    listRoot.innerHTML = '';
    this.context.Tasks.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'task-row';
      div.innerHTML = `
        <span>${t.Name}</span>
        <button data-i="${i}" style="background:var(--danger)">Eliminar</button>
      `;
      div.querySelector('button').onclick = () => {
        this.context.Tasks.splice(i, 1);
        this.renderList(listRoot);
      };
      listRoot.appendChild(div);
    });
  }
}