import { Context }         from '../../../context.js';
import { PlannerApi }      from '../../../api.js';
import { formatLocalDate } from '../../../back/calendar.js';
import { slotLabel }       from '../../slotLabel.js';

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
    // La fecha real del día ('YYYY-MM-DD'): es lo que indexa las
    // marcas de «hecho», para que sigan valiendo al cambiar de semana.
    this.date     = dayDate ? formatLocalDate(dayDate) : '';
    // Número de apariciones del día (las que se pueden marcar).
    this.total    = 0;
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
    this.bindMarks();
    this.bindMarksChanged();
  }

  cache() {
    this.cell      = this.root.querySelector('.day-cell');
    this.header    = this.root.querySelector('.day-header');
    this.nameEl    = this.root.querySelector('.day-name');
    this.dateEl    = this.root.querySelector('.day-date');
    this.countEl   = this.root.querySelector('.task-count-badge');
    this.progressEl= this.root.querySelector('.day-progress');
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
    this.total = 0;
    if (!this.tasks?.length) {
      this.list.innerHTML = `<span class="empty-day">Sin tareas</span>`;
    } else {
      this.tasks.forEach(task => {
        const hasSlot = task.Total > 1;
        const parity  = colorIndex(task.Name);
        for (let i = 0; i < task.Total; i++) {
          this.list.appendChild(this.crearAparicion(task, i, hasSlot, parity, suffix));
          this.total++;
        }
      });
    }

    // Las marcas ya guardadas se reflejan al pintar (por si el día se
    // vuelve a pintar después de haber marcado algo).
    this.syncMarks();

    // Hoy se abre automáticamente
    if (isToday) {
      this.open();
    }
  }

  /** Crea la fila de una aparición: la casilla para marcarla como
   *  hecha y la insignia con el nombre de la tarea.
   *
   *  Cada aparición es una marca distinta: la casilla lleva el id de
   *  la tarea, la fecha real del día y el número de vez (para las
   *  tareas con más de una vez al día). */
  crearAparicion(task, vez, hasSlot, parity, suffix) {
    const item = document.createElement('div');
    item.className = 'task-item';

    const slot  = slotLabel(task.Total, vez);
    const check = document.createElement('input');
    check.type        = 'checkbox';
    check.className   = 'task-check';
    check.id          = `${suffix}-${task.Id}-${vez}`;
    check.dataset.taskId = task.Id;
    check.dataset.date    = this.date;
    check.dataset.vez     = String(vez);
    check.setAttribute('aria-label', `${task.Name ?? ''}${slot ? ` (${slot})` : ''}`);

    const badge = document.createElement('label');
    badge.className = hasSlot
      ? 'task-badge badge-slot'
      : `task-badge ${parity === 0 ? 'badge-odd' : 'badge-even'}`;
    badge.htmlFor = check.id;
    badge.textContent = `${(task.Name ?? '').toUpperCase()}${slot ? ` · ${slot}` : ''}`;
    badge.title = badge.textContent;

    item.append(check, badge);
    return item;
  }

  /** Al pulsar la casilla, la aparición se marca (o se desmarca) y
   *  queda guardada. */
  bindMarks() {
    this.list.addEventListener('change', (e) => {
      const check = e.target?.closest?.('.task-check');
      if (!check) return;
      const { taskId, date, vez } = check.dataset;
      try {
        if (check.checked) PlannerApi.markTask(taskId, date, Number(vez));
        else              PlannerApi.unmarkTask(taskId, date, Number(vez));
      } catch (err) {
        // Si no se ha podido guardar, la casilla vuelve a su estado.
        check.checked = !check.checked;
        console.warn('[semana] no se ha podido guardar la marca:', err);
      }
    });
  }

  /** Escucha los cambios de marca para que el día se actualice también
   *  cuando el cambio no viene de esta casilla (por ejemplo, de un
   *  asistente que usa la API o el MCP).
   *
   *  Si la tarjeta ya no está en el DOM (la semana se ha repintado),
   *  se desuscribe sola: así no se quedan escuchas de tarjetas viejas. */
  bindMarksChanged() {
    this.onMarksChanged = () => {
      if (!this.root.isConnected) {
        window.removeEventListener('planner:changed', this.onMarksChanged);
        return;
      }
      this.syncMarks();
    };
    window.addEventListener('planner:changed', this.onMarksChanged);
  }

  /** Pone las casillas, el tachado de las hechas y el contador del día
   *  al día con las marcas guardadas. */
  syncMarks() {
    let hechas = 0;
    for (const item of this.list.querySelectorAll('.task-item')) {
      const check = item.querySelector('.task-check');
      const marcada = Context.IsMarked(
        check.dataset.taskId, check.dataset.date, Number(check.dataset.vez),
      );
      check.checked = marcada;
      item.classList.toggle('is-done', marcada);
      if (marcada) hechas++;
    }
    this.updateProgress(hechas);
  }

  /** Escribe "2/5 hechas" en la cabecera del día. */
  updateProgress(hechas) {
    const total = this.total ?? 0;
    this.progressEl.textContent = total > 0 ? `${hechas}/${total} hechas` : '';
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

      let next;
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
