import { AddTaskCard } from '../addTask/addTask-card.js';

export class TaskManagerCard {

    constructor(root, context) {
        this.root = root;
        this.context = context;
    }

    async init() {

        const html = await fetch('./ui/taskManager/taskManager-card.html').then(r => r.text());
        const css = await fetch('./ui/taskManager/taskManager-card.css').then(r => r.text());

        this.root.innerHTML = `<style>${css}</style>${html}`;

        this.mount();
    }

    mount() {
        const addRoot = this.root.querySelector('#addTaskMount');
        const listRoot = this.root.querySelector('#taskListMount');

        const add = new AddTaskCard(addRoot);

        add.onAdd = (task) => {
            this.context.Tasks.push(task);
            this.renderList();
        };

        add.init();

        this.listRoot = listRoot;
        this.renderList();
    }

    renderList() {
        this.listRoot.innerHTML = '';

        this.context.Tasks.forEach((t, i) => {
            const div = document.createElement('div');
            div.className = 'task-row';

            div.innerHTML = `
                <span>${t.Name}</span>
                <button data-i="${i}">Eliminar</button>
            `;

            div.querySelector('button').onclick = () => {
                this.context.Tasks.splice(i, 1);
                this.renderList();
            };

            this.listRoot.appendChild(div);
        });
    }
}