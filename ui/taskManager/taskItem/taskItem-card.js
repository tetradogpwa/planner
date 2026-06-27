export class TaskCard {
    constructor(root, task, index) {
        this.root = root;
        this.task = task;
        this.index = index;
    }

    async init() {
        const [html, css] = await Promise.all([
            fetch('./ui/task/task-card.html').then(r => r.text()),
            fetch('./ui/task/task-card.css').then(r => r.text())
        ]);

        this.root.innerHTML = `
            <style>${css}</style>
            ${html}
        `;

        this.cache();
        this.render();
        this.bind();
    }

    cache() {
        this.title = this.root.querySelector('.task-title');
        this.subtitle = this.root.querySelector('.task-subtitle');
        this.deleteBtn = this.root.querySelector('#deleteBtn');
    }

    render() {

        let subtitle;
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
          
        this.title.textContent = this.task.Name;


        switch (this.task.constructor.name) {
            case 'DailyTask':
                subtitle = 'Diaria';
                break;

            case 'WeeklyTask':
                subtitle = 'Semanal';
                break;

            case 'NDaysTask':
                subtitle = `Cada ${task.NDays} días`;
                break;

            case 'DaysOfWeekTask':
                subtitle = 'Días específicos';
                break;

            case 'CiclesDaysOfWeekTask':
                subtitle = 'Ciclo personalizado';
                break;

            case 'OneTimeTask':
                subtitle = 'Una sola vez';
                break;
        }
        if (this.task.DaysFrom !== undefined) {
            if (this.task.DaysFrom >= 0 && this.task.DaysFrom <= 6) {
                subtitle += ` • Inicia: ${days[this.task.DaysFrom]}`;
            }
        }

        this.subtitle.textContent = subtitle;
    }

    bind() {
        this.deleteBtn.onclick = () => {
            this.emit('task-delete', {
                index: this.index
            });
        };
    }

    emit(type, detail) {
        this.root.dispatchEvent(new CustomEvent(type, {
            detail,
            bubbles: true
        }));
    }
}