import { TaskItemCard } from './taskItem/taskItem-card.js';

export class WeekCard {
    constructor(root, weekData, index) {
        this.root = root;
        this.week = weekData;
        this.index = index;
    }

    async init() {
        const [html, css] = await Promise.all([
            fetch('./ui/week/week-card.html').then(r => r.text()),
            fetch('./ui/week/week-card.css').then(r => r.text())
        ]);

        this.root.innerHTML = `
            <style>${css}</style>
            ${html}
        `;

        this.cache();
        this.render();
    }

    cache() {
        this.title = this.root.querySelector('.week-title');
        this.daysContainer = this.root.querySelector('.days-container');
    }

    render() {
        const monday = this.week.mondayTo;
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const format = (d) =>
            d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

        this.title.textContent =
            `Semana ${this.index + 1} (${format(monday)} - ${format(sunday)})`;

        this.daysContainer.innerHTML = "";

        this.week.weekTasks.forEach((tasksOfDay, dayIndex) => {

            const dayWrapper = document.createElement('div');

            const taskItem = new TaskItemCard(
                dayWrapper,
                tasksOfDay || [],
                dayIndex
            );

            taskItem.init();

            this.daysContainer.appendChild(dayWrapper);
        });
    }
}