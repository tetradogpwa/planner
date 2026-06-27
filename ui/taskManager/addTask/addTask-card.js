import * as Main from '../../../back/main.js';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export class AddTaskCard {
  constructor(root) {
    this.root       = root;
    this.repeatType = 'no-repeat';
    this.cycleWeeks = [0]; // cada elemento es el flags bitmask de esa semana
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/taskManager/addTask/addTask-card.html').then(r => r.text()),
      fetch('./ui/taskManager/addTask/addTask-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.cache();
    this.bind();
  }

  cache() {
    this.name   = this.root.querySelector('#taskName');
    this.times  = this.root.querySelector('#timesPerDay');
    this.radios = this.root.querySelectorAll('input[name="repeat"]');
    this.extra  = this.root.querySelector('#extraOptions');
    this.btn    = this.root.querySelector('#addTaskBtn');
  }

  bind() {
    this.radios.forEach(r => r.addEventListener('change', () => {
      this.repeatType = r.value;
      if (this.repeatType === 'cycle') this.cycleWeeks = [0];
      this.renderExtra();
    }));
    this.btn.addEventListener('click', () => this.createTask());
    this.renderExtra();
  }

  // ── Renderizado de la sección extra ────────────────────────────────────────

  renderExtra() {
    this.extra.innerHTML = '';

    if (this.repeatType === 'interval') {
      this.extra.innerHTML = `
        <div class="extra-interval">
          <span>Repetir cada</span>
          <input type="number" id="interval" value="3" min="2">
          <span>días</span>
        </div>`;
    }

    if (this.repeatType === 'days') {
      this.extra.innerHTML = `
        <div class="form-group">
          <label>Días activos</label>
          <div class="days-grid">${this.#dayCheckboxes('dw')}</div>
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
          <input type="checkbox" data-day="${i}" value="${i}" ${checked}
                 data-prefix="${prefix}">
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
        <div class="days-grid">${this.#dayCheckboxes(`cw${wi}`, flags)}</div>
      `;
      builder.appendChild(weekEl);
    });

    const addBtn = document.createElement('button');
    addBtn.className   = 'btn-add-week';
    addBtn.textContent = '＋ Añadir semana al ciclo';
    builder.appendChild(addBtn);

    // Delegar eventos dentro del builder
    builder.addEventListener('change', e => {
      if (!e.target.matches('input[type="checkbox"]')) return;
      const wi  = parseInt(e.target.closest('.cycle-week').dataset.wi);
      const day = parseInt(e.target.dataset.day);
      if (e.target.checked) {
        this.cycleWeeks[wi] |= (1 << day);
      } else {
        this.cycleWeeks[wi] &= ~(1 << day);
      }
    });

    builder.addEventListener('click', e => {
      const removeBtn = e.target.closest('.btn-remove-week');
      if (removeBtn) {
        const wi = parseInt(removeBtn.dataset.wi);
        this.cycleWeeks.splice(wi, 1);
        this.#renderCycle(); // re-render solo el ciclo
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

  // ── Creación de la tarea ───────────────────────────────────────────────────

  createTask() {
    const name  = this.name.value.trim();
    const total = parseInt(this.times.value) || 1;
    if (!name) return alert('Nombre requerido');

    let task = null;

    switch (this.repeatType) {
      case 'no-repeat':
        task = Main.CreateOneTimeTask(Main.CreateDailyTask(name, total, 0), total, 0);
        break;

      case 'daily':
        task = Main.CreateDailyTask(name, total, 0);
        break;

      case 'interval': {
        const n = parseInt(this.extra.querySelector('#interval')?.value) || 3;
        task = Main.CreateNDaysTask(name, n, total, 0);
        break;
      }

      case 'days': {
        const days = [...this.extra.querySelectorAll('input[type="checkbox"]:checked')]
          .map(x => parseInt(x.dataset.day));
        if (!days.length) return alert('Selecciona al menos un día');
        task = Main.CreateDaysOfWeekTask(name, days, total, 0);
        break;
      }

      case 'cycle': {
        if (this.cycleWeeks.length === 0) return alert('Añade al menos una semana al ciclo');
        const hasAnyDay = this.cycleWeeks.some(f => f !== 0);
        if (!hasAnyDay) return alert('Marca al menos un día en el ciclo');
        // Convertimos los flags guardados en arrays de índices de día
        const cycleWeekDays = this.cycleWeeks.map(flags =>
          DAY_NAMES.map((_, i) => i).filter(i => (flags & (1 << i)) !== 0)
        );
        task = Main.CreateCycleDaysOfWeekTask(name, cycleWeekDays, total, 0);
        break;
      }
    }

    if (!task) return;

    this.root.dispatchEvent(new CustomEvent('task-create', { detail: task, bubbles: true }));
    this.reset();
  }

  reset() {
    this.name.value        = '';
    this.times.value       = 1;
    this.repeatType        = 'no-repeat';
    this.cycleWeeks        = [0];
    this.radios[0].checked = true;
    this.renderExtra();
  }
}