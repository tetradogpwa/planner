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
   * @param {string|null} parentId  id del contenedor padre para IDs únicos
   */
  constructor(root, tasks, dayIndex, dayLabel, dayDate = null, parentId = null) {
    this.root     = root;
    this.tasks    = tasks;
    this.dayIndex = dayIndex;
    this.dayLabel = dayLabel;
    this.dayDate  = dayDate;
    this.parentId = parentId;
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
    this.bindRovingKeyboard();
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

    // IDs únicos para que aria-controls apunte al panel de tareas
    // y el botón sea fácil de identificar (importante cuando hay
    // varias semanas pintadas).
    const suffix = this.parentId ? `${this.parentId}-d${this.dayIndex}` : `d${this.dayIndex}`;
    this.header.id = `${suffix}-header`;
    this.list.id   = `${suffix}-list`;
    this.header.setAttribute('aria-controls', this.list.id);

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

  /** Navegación por teclado entre cabeceras de día: flecha arriba /
   *  abajo se mueve a la cabecera anterior / siguiente dentro del
   *  mismo contenedor (.days-container). Home/End van al primero y al
   *  último. Enter y Espacio NO los gestionamos aquí: `.day-header` es
   *  un <button> y el navegador ya dispara el click (que abre o cierra
   *  el día); manejarlo a mano duplicaría el toggle o dependería de
   *  que `preventDefault` cancele el click según el navegador. Esta
   *  parte se engancha al pulsar sobre la cabecera; el contenedor es
   *  el responsable del listado de cabeceras. */
  bindRovingKeyboard() {
    this.header.addEventListener('keydown', (e) => {
      const container = this.header.closest('.days-container');
      if (!container) return;
      const headers = Array.from(container.querySelectorAll('.day-header'));
      const idx = headers.indexOf(this.header);
      if (idx < 0) return;

      let next = -1;
      switch (e.key) {
        case 'ArrowUp':   next = (idx - 1 + headers.length) % headers.length; break;
        case 'ArrowDown': next = (idx + 1) % headers.length; break;
        case 'Home':      next = 0; break;
        case 'End':       next = headers.length - 1; break;
        default: return;
      }
      e.preventDefault();
      headers[next].focus();
    });
  }
}
