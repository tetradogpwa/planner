import { buildTaskFromSpec } from '../../../back/taskSpec.js';
import { todayISO }         from '../../../back/calendar.js';
import { DAY_NAMES }        from '../../../back/dayNames.js';
import { cargarFragmentos, inyectarHtml } from '../../base-card.js';
import { escapeAttr }      from '../../html.js';

// Las plantillas de la tarjeta. El CSS necesita su ruta aparte (para
// inyectarlo junto al HTML): el HTML lleva marcadores {{id}} que se
// sustituyen al pintarlo.
const RUTA_HTML = './ui/taskManager/taskForm/taskForm-card.html';
const RUTA_CSS  = './ui/taskManager/taskForm/taskForm-card.css';

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
    dateId:        conPrefijo('taskDate'),
    errorId:       conPrefijo('taskError'),
    formId:        conPrefijo('taskForm'),
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
   * @param {Function}    [opciones.onSave] — se llama con la tarea creada
   */
  constructor(root, { prefix = '', onSave = null } = {}) {
    this.root = root;
    this.ids  = idsDelFormulario(prefix);

    // Lo que hace la tarjeta con la tarea que se acaba de guardar (el
    // alta la añade a la lista, la edición la reemplaza). Si no se
    // pasa, el formulario se limita a validar.
    this.onSave = onSave;

    // Estado del formulario. La edición lo rellena con el de la tarea
    // (setState) y el alta lo deja en los valores por defecto.
    this.repeatType = 'no-repeat';
    this.nDays      = 3;
    this.flags      = 0;
    this.cycleWeeks = [0];
  }

  /** Monta el formulario. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const partes = await cargarFragmentos([RUTA_HTML, RUTA_CSS], this.root);
    if (!partes) return false;
    const [html, css] = partes;
    // El formulario está a la vez en el alta y en la edición: cada
    // instancia lleva su propio <style> (propia). Si compartieran el
    // CSS, el que se quitara (al vaciar un panel) dejaría al otro sin
    // estilo.
    inyectarHtml(this.root, this.#render(html), [RUTA_CSS], [css], { propia: true });
    this.cache();
    // Valores por defecto: la tarea empieza hoy.
    this.setValues();
    this.bind();
    this.setState();
    return true;
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
    this.nameEl   = this.root.querySelector(`#${this.ids.nameId}`);
    this.timesEl  = this.root.querySelector(`#${this.ids.timesId}`);
    this.dateEl   = this.root.querySelector(`#${this.ids.dateId}`);
    this.dateLbl  = this.root.querySelector(`label[for="${this.ids.dateId}"]`);
    this.errorEl  = this.root.querySelector(`#${this.ids.errorId}`);
    this.formEl   = this.root.querySelector('form');
    this.radios   = this.root.querySelectorAll(`input[name="${this.ids.repeatName}"]`);
    this.extra    = this.root.querySelector(`#${this.ids.extraId}`);
  }

  bind() {
    this.radios.forEach(r => r.addEventListener('change', () => {
      this.repeatType = r.value;
      if (this.repeatType === 'cycle') this.cycleWeeks = [0];
      this.renderExtra();
      this.actualizaEtiquetaFecha();
    }));

    // El formulario es un <form> de verdad: el botón "Añadir tarea" y
    // el "Guardar cambios" lo envían (y Enter en el nombre también).
    // Aquí se recoge el envío y se guarda la tarea; las tarjetas solo
    // dicen qué hacer con ella (onSave).
    this.formEl?.addEventListener('submit', e => {
      e.preventDefault();
      this.submit();
    });

    // Al escribir en el nombre, el error anterior ya no vale: se borra
    // (y el campo deja de estar marcado como inválido).
    this.nameEl?.addEventListener('input', () => this.limpiaError());
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
    this.actualizaEtiquetaFecha();
  }

  /** Rellena el nombre, las veces/día y la fecha de inicio (en la
   *  edición, los de la tarea que se está editando). */
  setValues({ name = '', total = 1, date = todayISO() } = {}) {
    this.nameEl.value  = name;
    this.timesEl.value = total;
    this.dateEl.value  = date;
  }

  /** Vacía el formulario: lo usa el alta después de crear la tarea. */
  reset() {
    this.setValues({ name: '', total: 1 });
    this.setState();
  }

  /** La etiqueta del campo de fecha: "Fecha" cuando la tarea solo
   *  ocurre una vez (no tiene una fecha de "empiece") y "Empieza el"
   *  cuando se repite. Solo cambia el texto: el `for` de la etiqueta y
   *  el id del campo no se tocan. */
  actualizaEtiquetaFecha() {
    if (!this.dateLbl) return;
    this.dateLbl.textContent = this.repeatType === 'no-repeat' ? 'Fecha' : 'Empieza el';
  }

  // ── Opciones extra (intervalo, días y ciclo) ────────────────────────────

  renderExtra() {
    this.extra.innerHTML = '';

    if (this.repeatType === 'interval') {
      this.extra.innerHTML = `
        <div class="extra-interval">
          <label for="${this.ids.intervalId}">Repetir cada</label>
          <input type="number" id="${this.ids.intervalId}" value="${escapeAttr(this.nDays)}" min="2">
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
   *  formulario.
   *
   *  La fecha de inicio la lee el propio formulario (el campo "Empieza
   *  el"), no el llamante: así no se puede empezar una tarea en una
   *  fecha que el usuario no ha elegido. */
  buildSpec() {
    const name      = this.nameEl.value.trim();
    const total     = parseInt(this.timesEl.value) || 1;
    const startDate = this.dateEl.value || todayISO();

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

  // ── Envío y errores ─────────────────────────────────────────────────────

  /** Envía el formulario: construye la tarea y se la pasa a la tarjeta
   *  (`onSave`). Si algo no cuadra (por ejemplo, el nombre está
   *  vacío) el error se muestra junto al campo y el foco vuelve a él:
   *  no hay ninguna ventana de diálogo.
   *
   *  Devuelve la tarea creada, o null si hubo un error. */
  submit() {
    let task;
    try {
      task = buildTaskFromSpec(this.buildSpec());
    } catch (err) {
      this.muestraError(err.message);
      return null;
    }

    this.limpiaError();
    this.onSave?.(task);
    return task;
  }

  /** Muestra un error junto al campo del nombre: el mensaje va en una
   *  región role="alert" (para que se anuncie), el campo queda marcado
   *  como inválido y descrito por esa región, y el foco vuelve al
   *  campo. */
  muestraError(mensaje) {
    if (!this.errorEl) return;
    this.errorEl.textContent = mensaje;
    this.nameEl.setAttribute('aria-invalid', 'true');
    this.nameEl.setAttribute('aria-describedby', this.ids.errorId);
    this.nameEl.focus();
  }

  /** Quita el error: el mensaje se borra y el campo deja de estar
   *  marcado como inválido (y sin `aria-describedby`, que apuntaría a
   *  una región vacía). */
  limpiaError() {
    if (!this.errorEl) return;
    this.errorEl.textContent = '';
    this.nameEl.removeAttribute('aria-invalid');
    this.nameEl.removeAttribute('aria-describedby');
  }
}
