function colorIndex(name) {
  let h = 0;
  for (let i = 0; i < (name?.length ?? 0); i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xff;
  }
  return h % 2;
}

export class TaskItemCard {
  constructor(root, tasks, dayIndex, dayLabel) {
    this.root     = root;
    this.tasks    = tasks;
    this.dayIndex = dayIndex;
    this.dayLabel = dayLabel;

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
    this.dayNumber.textContent = this.dayLabel;
    this.list.innerHTML = '';

    if (!this.tasks?.length) {
      this.list.innerHTML = `<span class="empty-day">—</span>`;
      return;
    }

    this.tasks.forEach(task => {
      const hasSlot = task.Total > 1;
      const parity  = colorIndex(task.Name);

      for (let i = 0; i < task.Total; i++) {
        const badge = document.createElement('div');
        badge.className = hasSlot
          ? 'task-badge badge-slot'
          : `task-badge ${parity === 0 ? 'badge-odd' : 'badge-even'}`;

        const slot = hasSlot ? (i === 0 ? ' · 0–12H' : ' · 12–24H') : '';
        badge.textContent = `${(task.Name ?? '').toUpperCase()}${slot}`;
        badge.title = badge.textContent;
        this.list.appendChild(badge);
      }
    });
  }
}