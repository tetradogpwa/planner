import { TaskItemCard } from './taskItem/taskItem-card.js';
import { DAY_NAMES_LONG } from '../../back/dayNames.js';

export class WeekCard {
  constructor(root, weekData, index) {
    this.root  = root;
    this.week  = weekData;
    this.index = index;
    // ID estable para que los aria-controls de las cabeceras de día
    // apunten a IDs únicos cuando hay varias semanas pintadas (vista
    // completa). Si el contenedor ya trae id, lo respetamos.
    if (!this.root.id) this.root.id = `week-${this.index}`;
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
    this.title.id = `${this.root.id}-title`;
    this.title.setAttribute('tabindex', '-1');

    this.daysContainer.innerHTML = '';

    this.week.weekTasks.forEach((tasksOfDay, dayIndex) => {
      const wrapper = document.createElement('div');

      const dayDate = new Date(monday);
      dayDate.setDate(dayDate.getDate() + dayIndex);

      const label = DAY_NAMES_LONG[dayIndex];

      // Pasamos también la fecha real del día para detectar "hoy" y
      // el id del contenedor padre (la semana) para que los IDs únicos
      // generados por taskItem no se pisen entre semanas.
      new TaskItemCard(wrapper, tasksOfDay || [], dayIndex, label, dayDate, this.root.id).init();
      this.daysContainer.appendChild(wrapper);
    });
  }
}