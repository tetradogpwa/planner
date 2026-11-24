import { buildTaskFromSpec } from '../../../back/taskSpec.js';
import { DAY_NAMES }        from '../../../back/dayNames.js';

export class AddTaskCard {
  constructor(root) {
    this.root       = root;
    this.repeatType = 'no-repeat';
    this.cycleWeeks = [0];
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

  renderExtra() {
    this.extra.innerHTML = '';

    if (this.repeatType === 'interval') {
      this.extra.innerHTML = `
        <div class="extra-interval">
          <label for="interval">Repetir cada</label>
          <input type="number" id="interval" value="3" min="2">
          <span>días</span>
        </div>`;
    }

    if (this.repeatType === 'days') {
      this.extra.innerHTML = `
        <div class="form-group">
          <span class="form-group-label">Días activos</span>
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
        <div class="days-grid">${this.#dayCheckboxes(`cw${wi}`, flags)}</div>
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

  createTask() {
    const name  = this.name.value.trim();
    const total = parseInt(this.times.value) || 1;

    // Construye el spec que espera PlannerApi / buildTaskFromSpec. La
    // validación y construcción por tipo de repetición viven en
    // back/taskSpec.js: si algo no cuadra, buildTaskFromSpec lanza el
    // error con el mensaje en español y lo mostramos al usuario.
    const spec = this.#buildSpec(name, total, 0);

    let task;
    try {
      task = buildTaskFromSpec(spec);
    } catch (err) {
      return alert(err.message);
    }

    this.root.dispatchEvent(new CustomEvent('task-create', { detail: task, bubbles: true }));
    this.reset();
  }

  /** Convierte el estado del formulario al spec JSON que valida
   *  back/taskSpec.js. La validación de días/semanas vive allí
   *  (mensajes en español); aquí solo mapeamos los campos del
   *  formulario. */
  #buildSpec(name, total, daysFrom) {
    switch (this.repeatType) {
      case 'no-repeat':
        return { name, total, daysFrom, repeat: 'none' };
      case 'daily':
        return { name, total, daysFrom, repeat: 'daily' };
      case 'interval': {
        const n = parseInt(this.extra.querySelector('#interval')?.value) || 3;
        return { name, total, daysFrom, repeat: 'nDays', nDays: n };
      }
      case 'days': {
        const days = [...this.extra.querySelectorAll('input[type="checkbox"]:checked')]
          .map(x => parseInt(x.dataset.day));
        return { name, total, daysFrom, repeat: 'daysOfWeek', days };
      }
      case 'cycle': {
        const cycle = this.cycleWeeks.map(flags =>
          [0,1,2,3,4,5,6].filter(i => (flags & (1 << i)) !== 0)
        );
        return { name, total, daysFrom, repeat: 'cycle', cycle };
      }
    }
    return null;
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
