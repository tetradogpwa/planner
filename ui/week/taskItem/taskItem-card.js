export class TaskItemCard {
    constructor(root, tasks, dayIndex) {
        this.root = root;
        this.tasks = tasks;
        this.dayIndex = dayIndex;
    }

    async init() {
        const [html, css] = await Promise.all([
            fetch('./ui/week/taskItem/taskItem-card.html').then(r => r.text()),
            fetch('./ui/week/taskItem/taskItem-card.css').then(r => r.text())
        ]);

        this.root.innerHTML = `
            <style>${css}</style>
            ${html}
        `;

        this.cache();
        this.render();
    }

    cache() {
        this.dayNumber = this.root.querySelector('.day-number');
        this.list = this.root.querySelector('.task-list');
    }

    render() {
        this.dayNumber.textContent = `Día ${this.dayIndex + 1}`;
        this.list.innerHTML = "";

        if (!this.tasks || this.tasks.length === 0) {
            this.list.innerHTML = `<span style="opacity:.4;font-size:0.75rem">—</span>`;
            return;
        }

        this.tasks.forEach(task => {
            for (let i = 0; i < task.Total; i++) {

                const badge = document.createElement('div');
                badge.className = 'task-badge';

                const extra = task.Total > 1
                    ? (i === 0 ? '[0-12]' : '[12-24]')
                    : '';

                badge.textContent = `${task.Name} ${extra}`;

                this.list.appendChild(badge);
            }
        });
    }
}