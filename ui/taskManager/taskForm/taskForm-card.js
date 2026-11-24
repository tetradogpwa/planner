import { DAY_NAMES }  from '../../../back/dayNames.js';
import { escapeHtml } from '../../escape.js';

// ────────────────────────────────────────────────────────────────────
// taskForm-card.js — El FORMULARIO DE TAREA, compartido por el alta y
// la edición.
//
// Antes de T-047 el alta (addTask-card) y la edición (editTask-card)
// tenían cada una su copia del formulario: ≈108 líneas de JavaScript
// duplicadas y un CSS de edición que dependía del CSS del alta (con
// 21 `!important` para imponerse). Aquí vive una sola vez.
//
// El módulo se parametriza con un prefijo de id para que los dos
// formularios puedan estar en la misma página (el de alta siempre y el
// de edición dentro del panel de una fila) sin pisarse:
//   - prefijo ''     → taskName, timesPerDay, extraOptions, interval…
//   - prefijo 'edit' → editTaskName, editTimesPerDay, editExtraOptions…
// ────────────────────────────────────────────────────────────────────

/**
 * Ids de los campos del formulario y nombre del grupo de radios,
 * según el prefijo de la tarjeta.
 *
 * El prefijo se antepone con mayúscula inicial al nombre base del
 * campo ("edit" + "taskName" → "editTaskName"). El grupo de radios
 * lleva su propio guion ("repeat" en el alta, "edit-repeat" en la
 * edición) para que los dos formularios no compartan grupo.
 */
export function idsDelFormulario(prefix = '') {
  const conPrefijo = (base) =>
    prefix ? `${prefix}${base.charAt(0).toUpperCase()}${base.slice(1)}` : base;

  return {
    nameId:        conPrefijo('taskName'),
    timesId:       conPrefijo('timesPerDay'),
    repeatLabelId: conPrefijo('repeatLabel'),
    extraId:       conPrefijo('extraOptions'),
    intervalId:    conPrefijo('interval'),
    repeatName:    prefix ? `${prefix}-repeat` : 'repeat',
  };
}

export class TaskForm {
  /**
   * @param {HTMLElement} root             — donde se inyecta el formulario
   * @param {object}      [opciones]
   * @param {string}      [opciones.prefix] — prefijo de los ids ('edit' en la edición)
   */
  constructor(root, { prefix = '' } = {}) {
    this.root = root;
    this.ids  = idsDelFormulario(prefix);

    // Estado del formulario. La edición lo rellena con el de la tarea
    // (setState) y el alta lo deja en los valores por defecto.
    this.repeatType = 'no-repeat';
    this.nDays      = 3;
    this.flags      = 0;
    this.cycleWeeks = [0];
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/taskManager/taskForm/taskForm-card.html').then(r => r.text()),
      fetch('./ui/taskManager/taskForm/taskForm-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${this.#render(html)}`;
    this.cache();
    this.bind();
    this.setState();
  }

  /** Sustituye los `{{id}}` de la plantilla por los ids de esta
   *  instancia. Un marcador desconocido es un error: si el HTML y las
   *  ids se desincronizan, el formulario saldría sin campo y sin
   *  avisar. */
  #render(html) {
    return html.replace(/\{\{(\w+)\}\}/g, (_, clave) => {
      const valor = this.ids[clave];
      if (valor === undefined) {
        throw new Error(`El formulario usa un id que no existe: ${clave}`);
      }
      return valor;
    });
  }

  cache() {
    this.nameEl  = this.root.querySelector(`#${this.ids.nameId}`);
    this.timesEl = this.root.querySelector(`#${this.ids.timesId}`);
    this.radios  = this.root.querySelectorAll(`input[name="${this.ids.repeatName}"]`);
    this.extra   = this.root.querySelector(`#${this.ids.extraId}`);
  }

  bind() {
    this.radios.forEach(r => r.addEventListener('change', () => {
      this.repeatType = r.value;
      if (this.repeatType === 'cycle') this.cycleWeeks = [0];
      this.renderExtra();
    }));
  }

  /** Pone el formulario en un estado concreto: el de la tarea en la
   *  edición, el de por defecto en el alta. Marca el radio del tipo
   *  de repetición y vuelve a pintar las opciones extra. */
  setState({ repeatType = 'no-repeat', nDays = 3, flags = 0, cycleWeeks = [0] } = {}) {
    this.repeatType = repeatType;
    this.nDays      = nDays;
    this.flags      = flags;
    this.cycleWeeks = [...cycleWeeks];

    this.radios.forEach(r => { r.checked = r.value === this.repeatType; });
    this.renderExtra();
  }

  /** Rellena el nombre y las veces/día (en la edición, los de la
   *  tarea que se está editando). */
  setValues({ name = '', total = 1 } = {}) {
    this.nameEl.value  = name;
    this.timesEl.value = total;
  }

  /** Vacía el formulario: lo usa el alta después de crear la tarea. */
  reset() {
    this.setValues({ name: '', total: 1 });
    this.setState();
  }

  // ── Opciones extra (intervalo, días y ciclo) ────────────────────────────

  renderExtra() {
    this.extra.innerHTML = '';

    if (this.repeatType === 'interval') {
      this.extra.innerHTML = `
        <div class="extra-interval">
          <label for="${this.ids.intervalId}">Repetir cada</label>
          <input type="number" id="${this.ids.intervalId}" value="${escapeHtml(this.nDays)}" min="2">
          <span>días</span>
        </div>`;
    }

    if (this.repeatType === 'days') {
      this.extra.innerHTML = `
        <div class="form-group">
          <span class="form-group-label">Días activos</span>
          <div class="days-grid">${this.#dayCheckboxes(this.flags)}</div>
        </div>`;
    }

    if (this.repeatType === 'cycle') {
      this.#renderCycle();
    }
  }

  #dayCheckboxes(flags = 0) {
    return DAY_NAMES.map((d, i) => {
      const checked = (flags & (1 << i)) ? 'checked' : '';
      return `
        <label class="day-toggle">
          <input type="checkbox" data-day="${i}" value="${i}" ${checked}>
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
        <div class="days-grid">${this.#dayCheckboxes(flags)}</div>
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

  // ── Datos ───────────────────────────────────────────────────────────────

  /** Convierte el estado del formulario al spec JSON que valida
   *  back/taskSpec.js. La validación de días/semanas vive allí
   *  (mensajes en español); aquí solo mapeamos los campos del
   *  formulario. */
  buildSpec(startDate) {
    const name  = this.nameEl.value.trim();
    const total = parseInt(this.timesEl.value) || 1;

    switch (this.repeatType) {
      case 'no-repeat':
        return { name, total, startDate, repeat: 'none' };

      case 'daily':
        return { name, total, startDate, repeat: 'daily' };

      case 'interval': {
        const n = parseInt(this.extra.querySelector(`#${this.ids.intervalId}`)?.value) || 3;
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
}
