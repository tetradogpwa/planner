export class TaskItemCard {
  constructor(root, tasks, dayIndex) {
    this.root     = root;
    this.tasks    = tasks;
    this.dayIndex = dayIndex;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/week/taskItem/taskItem-card.html').then(r => r.text()),
      fetch('./ui/week/taskItem/taskItem-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.cache();
    this.render();
  }

  cache() {
    this.dayNumber = this.root.querySelector('.day-number');
    this.list      = this.root.querySelector('.task-list');
  }

  render() {
    this.dayNumber.textContent = `Día ${this.dayIndex + 1}`;
    this.list.innerHTML = '';

    if (!this.tasks?.length) {
      this.list.innerHTML = `<span class="empty-day">—</span>`;
      return;
    }

    this.tasks.forEach((task, taskIdx) => {
      const hasSlot = task.Total > 1;

      for (let i = 0; i < task.Total; i++) {
        const badge = document.createElement('div');

        // Color: ámbar si tiene horario, violeta si impar, cian si par
        if (hasSlot) {
          badge.className = 'task-badge badge-slot';
        } else if (taskIdx % 2 === 0) {
          badge.className = 'task-badge badge-odd';
        } else {
          badge.className = 'task-badge badge-even';
        }

        const slot = hasSlot ? (i === 0 ? ' · 0–12H' : ' · 12–24H') : '';
        badge.textContent = `${task.Name.toUpperCase()}${slot}`;
        badge.title       = badge.textContent;

        this.list.appendChild(badge);
      }
    });
  }
}