import { buildTaskFromSpec } from '../../../back/taskSpec.js';
import { DAY_NAMES }        from '../../../back/dayNames.js';
import { escapeHtml }       from '../../escape.js';

/** Convierte un objeto tarea a estado del formulario. */
function taskToFormState(task) {
  const cn = task.constructor?.name ?? '';
  switch (cn) {
    case 'OneTimeTask':
      return { repeatType: 'no-repeat', nDays: 3, flags: 0, cycleWeeks: [0] };
    case 'DailyTask':
      return { repeatType: 'daily',     nDays: 3, flags: 0, cycleWeeks: [0] };
    case 'NDaysTask':
      return { repeatType: 'interval',  nDays: task.NDays ?? 3, flags: 0, cycleWeeks: [0] };
    case 'DaysOfWeekTask':
      return { repeatType: 'days',      nDays: 3, flags: task.flags ?? 0, cycleWeeks: [0] };
    case 'CiclesDaysOfWeekTask': {
      const cycleWeeks = (task.Cicles ?? []).map(c => c.flags ?? 0);
      return { repeatType: 'cycle',     nDays: 3, flags: 0, cycleWeeks: cycleWeeks.length ? cycleWeeks : [0] };
    }
    default:
      return { repeatType: 'daily',     nDays: 3, flags: 0, cycleWeeks: [0] };
  }
}

export class EditTaskCard {
  /**
   * @param {HTMLElement} root
   * @param {object}      task  — tarea existente (puede ser Proxy)
   */
  constructor(root, task) {
    this.root = root;
    this.task = task;

    // Estado del formulario inicializado desde la tarea
    const state      = taskToFormState(task);
    this.repeatType  = state.repeatType;
    this.initialNDays    = state.nDays;
    this.initialFlags    = state.flags;
    this.cycleWeeks  = [...state.cycleWeeks];
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/taskManager/editTask/editTask-card.html').then(r => r.text()),
      fetch('./ui/taskManager/editTask/editTask-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.cache();
    this.prefill();
    this.bind();
  }

  cache() {
    this.nameEl  = this.root.querySelector('#editTaskName');
    this.timesEl = this.root.querySelector('#editTimesPerDay');
    this.radios  = this.root.querySelectorAll('input[name="edit-repeat"]');
    this.extra   = this.root.querySelector('#editExtraOptions');
    this.saveBtn = this.root.querySelector('#saveEditBtn');
  }

  prefill() {
    this.nameEl.value  = this.task.Name  ?? '';
    this.timesEl.value = this.task.Total ?? 1;

    // Seleccionar radio correspondiente al tipo actual
    this.radios.forEach(r => { r.checked = r.value === this.repeatType; });

    this.renderExtra();
  }

  bind() {
    this.radios.forEach(r => r.addEventListener('change', () => {
      this.repeatType = r.value;
      if (this.repeatType === 'cycle') this.cycleWeeks = [0];
      this.renderExtra();
    }));

    this.saveBtn.addEventListener('click', () => this.saveTask());

    // Ambos botones de cancelar
    this.root.querySelector('#cancelEditBtn').addEventListener('click',  () => this.#cancel());
    this.root.querySelector('#cancelEditBtn2').addEventListener('click', () => this.#cancel());
  }

  // ── Extra options (idéntico a AddTaskCard pero prellenado) ───────────────

  renderExtra() {
    this.extra.innerHTML = '';

    if (this.repeatType === 'interval') {
      this.extra.innerHTML = `
        <div class="extra-interval">
          <label for="editInterval">Repetir cada</label>
          <input type="number" id="editInterval" value="${escapeHtml(this.initialNDays)}" min="2">
          <span>días</span>
        </div>`;
    }

    if (this.repeatType === 'days') {
      this.extra.innerHTML = `
        <div class="form-group">
          <span class="form-group-label">Días activos</span>
          <div class="days-grid">${this.#dayCheckboxes('edw', this.initialFlags)}</div>
        </div>`;
    }

    if (this.repeatType === 'cycle') {
      this.#renderCycle();
    }
  }

  #dayCheckboxes(prefix, flags = 0) {
    return DAY_NAMES.map((d, i) => {
      const checked = (flags & (1 << i)) ? 'checked' : '';
      return `
        <label class="day-toggle">
          <input type="checkbox" data-day="${i}" value="${i}" ${checked} data-prefix="${prefix}">
          ${d}
        </label>`;
    }).join('');
  }

  #renderCycle() {
    const builder = document.createElement('div');
    builder.className = 'cycle-builder';

    this.cycleWeeks.forEach((flags, wi) => {
      const weekEl = document.createElement('div');
      weekEl.className  = 'cycle-week';
      weekEl.dataset.wi = wi;
      weekEl.innerHTML  = `
        <div class="cycle-week-header">
          <span class="cycle-week-label">Semana ${wi + 1}</span>
          ${this.cycleWeeks.length > 1
            ? `<button class="btn-remove-week" data-wi="${wi}">✕ Quitar</button>`
            : ''}
        </div>
        <div class="days-grid">${this.#dayCheckboxes(`ecw${wi}`, flags)}</div>
      `;
      builder.appendChild(weekEl);
    });

    const addBtn = document.createElement('button');
    addBtn.className   = 'btn-add-week';
    addBtn.textContent = '＋ Añadir semana al ciclo';
    builder.appendChild(addBtn);

    builder.addEventListener('change', e => {
      if (!e.target.matches('input[type="checkbox"]')) return;
      const wi  = parseInt(e.target.closest('.cycle-week').dataset.wi);
      const day = parseInt(e.target.dataset.day);
      if (e.target.checked) this.cycleWeeks[wi] |=  (1 << day);
      else                  this.cycleWeeks[wi] &= ~(1 << day);
    });

    builder.addEventListener('click', e => {
      const removeBtn = e.target.closest('.btn-remove-week');
      if (removeBtn) {
        this.cycleWeeks.splice(parseInt(removeBtn.dataset.wi), 1);
        this.#renderCycle();
        return;
      }
      if (e.target === addBtn) {
        this.cycleWeeks.push(0);
        this.#renderCycle();
      }
    });

    this.extra.innerHTML = '';
    this.extra.appendChild(builder);
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  saveTask() {
    const name     = this.nameEl.value.trim();
    const total    = parseInt(this.timesEl.value) || 1;
    const startDate = this.task.StartDate;   // conservar la fecha de inicio

    const spec = this.#buildSpec(name, total, startDate);

    let task;
    try {
      task = buildTaskFromSpec(spec);
    } catch (err) {
      return alert(err.message);
    }

    this.root.dispatchEvent(new CustomEvent('task-update', { detail: task, bubbles: true }));
  }

  /** Convierte el estado del formulario al spec JSON que valida
   *  back/taskSpec.js (mapeo paralelo al de AddTaskCard). Las
   *  validaciones de días y semanas viven allí (mensajes en español). */
  #buildSpec(name, total, startDate) {
    switch (this.repeatType) {
      case 'no-repeat':
        return { name, total, startDate, repeat: 'none' };

      case 'daily':
        return { name, total, startDate, repeat: 'daily' };

      case 'interval': {
        const n = parseInt(this.extra.querySelector('#editInterval')?.value) || 3;
        return { name, total, startDate, repeat: 'nDays', nDays: n };
      }

      case 'days': {
        const days = [...this.extra.querySelectorAll('input[type="checkbox"]:checked')]
          .map(x => parseInt(x.dataset.day));
        return { name, total, startDate, repeat: 'daysOfWeek', days };
      }

      case 'cycle': {
        const cycle = this.cycleWeeks.map(flags =>
          [0,1,2,3,4,5,6].filter(i => (flags & (1 << i)) !== 0)
        );
        return { name, total, startDate, repeat: 'cycle', cycle };
      }
    }
    return null;
  }

  #cancel() {
    this.root.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true }));
  }
}
