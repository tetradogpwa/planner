import { TaskItemCard } from './taskItem/taskItem-card.js';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export class WeekCard {
  constructor(root, weekData, index) {
    this.root  = root;
    this.week  = weekData;
    this.index = index;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/week/week-card.html').then(r => r.text()),
      fetch('./ui/week/week-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.cache();
    this.render();
  }

  cache() {
    this.title         = this.root.querySelector('.week-title');
    this.daysContainer = this.root.querySelector('.days-container');
  }

  render() {
    const monday = this.week.mondayTo;
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const fmt = d => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    this.title.textContent = `Semana ${this.index + 1} · ${fmt(monday)} – ${fmt(sunday)}`;

    this.daysContainer.innerHTML = '';

    this.week.weekTasks.forEach((tasksOfDay, dayIndex) => {
      const wrapper = document.createElement('div');

      const dayDate = new Date(monday);
      dayDate.setDate(dayDate.getDate() + dayIndex);

      const label = DAY_NAMES[dayIndex];

      // Pasamos también la fecha real del día para detectar "hoy"
      new TaskItemCard(wrapper, tasksOfDay || [], dayIndex, label, dayDate).init();
      this.daysContainer.appendChild(wrapper);
    });
  }
}