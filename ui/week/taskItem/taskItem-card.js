function colorIndex(name) {
  let h = 0;
  for (let i = 0; i < (name?.length ?? 0); i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xff;
  }
  return h % 2;
}

export class TaskItemCard {
  /**
   * @param {HTMLElement} root
   * @param {Array}       tasks
   * @param {number}      dayIndex  0=lun … 6=dom
   * @param {string}      dayLabel  'Lunes', 'Martes'…
   * @param {Date|null}   dayDate   fecha real del día (para detectar hoy)
   */
  constructor(root, tasks, dayIndex, dayLabel, dayDate = null) {
    this.root     = root;
    this.tasks    = tasks;
    this.dayIndex = dayIndex;
    this.dayLabel = dayLabel;
    this.dayDate  = dayDate;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/week/taskItem/taskItem-card.html').then(r => r.text()),
      fetch('./ui/week/taskItem/taskItem-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.cache();
    this.render();
    this.bindToggle();
  }

  cache() {
    this.cell      = this.root.querySelector('.day-cell');
    this.header    = this.root.querySelector('.day-header');
    this.nameEl    = this.root.querySelector('.day-name');
    this.dateEl    = this.root.querySelector('.day-date');
    this.countEl   = this.root.querySelector('.task-count-badge');
    this.list      = this.root.querySelector('.task-list');
  }

  render() {
    // Nombre del día
    this.nameEl.textContent = this.dayLabel;

    // Fecha formateada (dd/mm)
    if (this.dayDate) {
      this.dateEl.textContent = this.dayDate.toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit'
      });
    }

    // ¿Es hoy?
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = this.dayDate &&
      this.dayDate.getFullYear() === today.getFullYear() &&
      this.dayDate.getMonth()    === today.getMonth() &&
      this.dayDate.getDate()     === today.getDate();

    if (isToday) {
      this.cell.classList.add('is-today');
    }

    // Badge de conteo
    const totalBadges = this.tasks.reduce((acc, t) => acc + (t.Total ?? 1), 0);
    if (totalBadges > 0) {
      this.countEl.textContent = `${totalBadges} tarea${totalBadges !== 1 ? 's' : ''}`;
      this.countEl.classList.add('has-tasks');
    } else {
      this.countEl.textContent = '—';
      this.countEl.classList.add('empty');
    }

    // Lista de tareas
    this.list.innerHTML = '';
    if (!this.tasks?.length) {
      this.list.innerHTML = `<span class="empty-day">Sin tareas</span>`;
    } else {
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

    // Hoy se abre automáticamente
    if (isToday) {
      this.open();
    }
  }

  open() {
    this.cell.classList.add('open');
    this.header.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.cell.classList.remove('open');
    this.header.setAttribute('aria-expanded', 'false');
  }

  bindToggle() {
    this.header.addEventListener('click', () => {
      if (this.cell.classList.contains('open')) {
        this.close();
      } else {
        this.open();
      }
    });
  }
}