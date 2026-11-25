import { TaskItemCard } from './taskItem/taskItem-card.js';
import { montarTarjeta } from '../base-card.js';
import { DAY_NAMES_LONG } from '../../back/dayNames.js';
import { today } from '../../back/calendar.js';
import { consultaRejilla, enRejilla } from './weekLayout.js';

/** Fecha con año (23/11/2026): el título tiene que decir en qué
 *  semana está, también cuando la semana salta de mes o de año. */
const fmtFecha = d => d.toLocaleDateString('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

export class WeekCard {
  /**
   * @param {HTMLElement} root
   * @param {object}     weekData  { mondayTo, weekTasks }
   * @param {number}     index     posición de la semana (para los ids)
   * @param {object}     options   { nav: boolean, onNav: (delta) => void,
   *                                 totalTareas: number,
   *                                 onCrearTarea: () => void }
   *
   *  `nav` añade los controles ◀ Anterior · Hoy · Siguiente ▶ (solo
   *  los lleva la vista "Semana actual") y `onNav` recibe el salto
   *  pedido: -1 (semana anterior), +1 (semana siguiente) o 0 (la
   *  semana que contiene hoy).
   *
   *  `totalTareas` es cuántas tareas hay en la app: si no hay ninguna,
   *  la tarjeta se pinta como estado vacío (en vez de los siete días
   *  con "Sin tareas") y `onCrearTarea` es lo que hace el botón del
   *  estado vacío (T-056).
   */
  constructor(root, weekData, index, options = {}) {
    this.root        = root;
    this.week        = weekData;
    this.index       = index;
    this.options     = options;
    // Cuántas tareas hay en la app. Con null (la vista de todas las
    // semanas) la semana se pinta siempre con sus días.
    this.totalTareas = options.totalTareas ?? null;
    // ID estable para que los aria-controls de las cabeceras de día
    // apunten a IDs únicos cuando hay varias semanas pintadas (vista
    // completa). Si el contenedor ya trae id, lo respetamos.
    if (!this.root.id) this.root.id = `week-${this.index}`;
  }

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const html = await montarTarjeta(
      this.root,
      './ui/week/week-card.html',
      './ui/week/week-card.css',
    );
    if (!html) return false;
    this.cache();
    this.buildNav();
    this.bindEmpty();
    this.bindModo();
    if (this.week) this.render();
    return true;
  }

  cache() {
    this.titleRegion   = this.root.querySelector('.week-title-region');
    this.title         = this.root.querySelector('.week-title');
    this.daysContainer = this.root.querySelector('.days-container');
    this.grid          = this.root.querySelector('.calendar-grid');
    this.emptyEl       = this.root.querySelector('.estado-vacio');
  }

  /** El botón del estado vacío: lleva a la creación de la primera
   *  tarea (T-056). */
  bindEmpty() {
    this.emptyEl?.querySelector('.estado-vacio-btn')?.addEventListener('click', () => {
      this.options.onCrearTarea?.();
    });
  }

  /** Crea los controles de navegación (solo en la vista "Semana
   *  actual") y conecta sus botones con `onNav`. */
  buildNav() {
    if (!this.options.nav) return;

    const nav = document.createElement('div');
    nav.className = 'week-nav';
    nav.innerHTML = `
      <button type="button" class="week-nav-btn" id="week-nav-prev" data-nav="prev">
        <span aria-hidden="true">◀</span> Anterior
      </button>
      <button type="button" class="week-nav-btn" id="week-nav-today" data-nav="today">Hoy</button>
      <button type="button" class="week-nav-btn" id="week-nav-next" data-nav="next">
        Siguiente <span aria-hidden="true">▶</span>
      </button>`;
    // El nav va entre el título y los días: al abrir la vista el foco
    // está en el título y con Tab se llega a los botones.
    const grid = this.root.querySelector('.calendar-grid');
    grid.parentElement.insertBefore(nav, grid);
    this.nav = nav;

    // La semana se anuncia en una región role="status": el título, que
    // está dentro, cambia de texto al cambiar de semana.
    this.titleRegion.setAttribute('role', 'status');

    this.hoyBtn = nav.querySelector('[data-nav="today"]');
    nav.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const accion = btn.dataset.nav;
        const delta  = accion === 'prev' ? -1 : accion === 'next' ? 1 : 0;
        this.options.onNav?.(delta);
      });
    });
  }

  /** Pinta otra semana en la misma tarjeta.
   *
   *  La tarjeta no se destruye: su región role="status" sigue en el
   *  DOM, así que el cambio de semana se anuncia a los lectores de
   *  pantalla (si se recreara la tarjeta, el aviso se perdería). */
  setWeek(weekData, index = this.index, totalTareas = this.totalTareas) {
    this.week       = weekData;
    this.index      = index;
    this.totalTareas = totalTareas;
    this.render();
  }

  render() {
    const monday = this.week.mondayTo;
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    this.title.textContent = `Semana del ${fmtFecha(monday)} al ${fmtFecha(sunday)}`;
    this.title.id = `${this.root.id}-title`;
    this.title.setAttribute('tabindex', '-1');

    // El botón "Hoy" marca con aria-current la semana que contiene
    // hoy (así se sabe desde qué semana se ha salido).
    if (this.hoyBtn) {
      const hoy = today();
      if (hoy >= monday && hoy <= sunday) this.hoyBtn.setAttribute('aria-current', 'date');
      else this.hoyBtn.removeAttribute('aria-current');
    }

    // Sin tareas no hay semana que enseñar: se muestra el estado vacío
    // (qué es la app y el enlace para crear la primera tarea) en vez de
    // los siete días con "Sin tareas" (T-056).
    const vacio = this.totalTareas === 0;
    if (this.grid)    this.grid.hidden = vacio;
    if (this.emptyEl) this.emptyEl.hidden = !vacio;
    // Los controles de semana tampoco tienen sentido sin tareas.
    if (this.nav) this.nav.hidden = vacio;

    this.daysContainer.innerHTML = '';
    this.dayCards = [];

    if (vacio) return;

    this.week.weekTasks.forEach((tasksOfDay, dayIndex) => {
      const wrapper = document.createElement('div');

      const dayDate = new Date(monday);
      dayDate.setDate(dayDate.getDate() + dayIndex);

      const label = DAY_NAMES_LONG[dayIndex];

      // Pasamos también la fecha real del día para detectar "hoy" y
      // el id del contenedor padre (la semana) para que los IDs únicos
      // generados por taskItem no se pisen entre semanas.
      const card = new TaskItemCard(wrapper, tasksOfDay || [], dayIndex, label, dayDate, this.root.id);
      this.dayCards.push(card);
      card.init();
      this.daysContainer.appendChild(wrapper);
    });
  }

  /** Escucha los cambios de ancho de la ventana: al pasar de 1024 px
   *  o más (rejilla de columnas) a menos (acordeón), o al revés, los
   *  días se abren o se cierran. Si la tarjeta ya no está en el DOM
   *  (la vista se ha repintado), se desuscribe sola. */
  bindModo() {
    this.onModo = () => {
      if (!this.root.isConnected) {
        consultaRejilla.removeEventListener('change', this.onModo);
        return;
      }
      this.applyModo();
    };
    consultaRejilla.addEventListener('change', this.onModo);
  }

  /** Aplica el modo actual de la ventana (rejilla o acordeón) a los
   *  días de la semana. */
  applyModo() {
    const rejilla = enRejilla();
    this.dayCards.forEach(card => card.applyModo(rejilla));
  }
}
