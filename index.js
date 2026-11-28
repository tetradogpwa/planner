import { Context }         from './context.js';
import { GetNWeeks, GetWeek, today } from './back/calendar.js';
import { TaskManagerCard } from './ui/taskManager/taskManager-card.js';
import { WeekCard }        from './ui/week/week-card.js';
import { AjustesCard }     from './ui/ajustes/ajustes-card.js';
import { applyPreferences } from './ui/settings/preferences.js';
import { ConsentCard }     from './ui/consent/consent-card.js';
import { TermsCard, termsAccepted } from './ui/terms/terms-card.js';
import { initMonetization, needsConsent, hasAds } from './monetization.js';
import { shortcuts }       from './ui/shortcuts/shortcuts-card.js';
import { isEditable, focusHeading, bindRovingTabindex } from './ui/a11y.js';
import { startMcpBridge }  from './mcp-bridge.js';
import { leerEstadoMcp, PUERTO_POR_DEFECTO } from './ui/mcp/mcp-state.js';
import './api.js';   // monta window.PlannerApi

// ── Términos de uso ───────────────────────────────────────
// Lo primero que ve el usuario. Sin aceptarlos no se usa la app: si
// los rechaza, se cierra (ui/terms/).
async function requireTerms() {
  if (await termsAccepted()) return;
  await new TermsCard(document.getElementById('terms-gate')).init();
}

// ── Monetización ──────────────────────────────────────────
// Después de los términos: si la build tiene anuncios y no los ha
// aceptado, la pantalla de "consentimiento o pago" a pantalla completa.
// La app no se pinta hasta que acepte (si no acepta, se queda ahí).
const consentRoot  = document.getElementById('consent-gate');
const removeAdsBtn = document.getElementById('removeAdsBtn');

async function startMonetization() {
  try {
    await initMonetization();
    if (needsConsent()) await new ConsentCard(consentRoot).init();
  } catch (err) {
    console.warn('[init] monetization init falló:', err);
  }
}

function updateRemoveAdsButton() {
  removeAdsBtn.hidden = !hasAds();
}

removeAdsBtn.addEventListener('click', async () => {
  closeSidebarMobile();
  await new ConsentCard(consentRoot, { mode: 'upgrade' }).init();
  updateRemoveAdsButton();
});

// ── Vistas ───────────────────────────────────────────────
const views = {
  tasks:        document.getElementById('view-tasks'),
  week:         document.getElementById('view-week'),
  allWeeks:     document.getElementById('view-allWeeks'),
  ajustes:      document.getElementById('view-ajustes'),
};

const navButtons = () => Array.from(document.querySelectorAll('.nav-item[data-view]'));

// ── Vista "Semana actual" ─────────────────────────────────
// La semana que se está viendo: 0 es la que contiene hoy, -1 la
// anterior y +1 la siguiente.
let weekOffset = 0;
// La tarjeta de la vista Semana se conserva entre pintados: su
// región role="status" tiene que seguir viva en el DOM para que el
// cambio de semana se anuncie.
let currentWeekCard = null;

/** Cambia la semana que muestra la vista "Semana actual": -1 la
 *  anterior, +1 la siguiente y 0 la que contiene hoy. */
async function moverSemana(delta) {
  weekOffset = delta === 0 ? 0 : weekOffset + delta;
  await render('week');
}

async function setView(name, { focus = true, tab = null, focusTab = false } = {}) {
  // Al abrir la vista "Semana actual" se muestra la semana que
  // contiene hoy (no la que se estaba viendo antes).
  if (name === 'week') weekOffset = 0;

  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
  await render(name, { tab });
  closeSidebarMobile();

  // aria-current="page" en el botón de menú activo y lo quitamos
  // del resto. Mantenemos el isotipo visual con .active por si lo
  // usa algún estilo, pero la API accesible es aria-current.
  navButtons().forEach(b => {
    const isActive = b.dataset.view === name;
    b.classList.toggle('active', isActive);
    if (isActive) b.setAttribute('aria-current', 'page');
    else          b.removeAttribute('aria-current');
  });
  syncNavTabindex();

  // Mover el foco al primer encabezado de la nueva vista. Usamos
  // tabindex="-1" para que sea enfocable por script aunque no sea
  // interactivo (no es alcanzable con Tab). En la carga inicial lo
  // saltamos para que el primer Tab de la sesión caiga en el enlace
  // "Saltar al contenido".
  if (focus) {
    // Para Ajustes, si focusTab=true llevamos el foco a la pestaña
    // activa (patrón ARIA tablist: al cambiar de pestaña con flechas,
    // Inicio/Fin o al abrir con un atajo directo). Sin focusTab, al
    // encabezado de la vista (lo que pasa cuando se abre desde el
    // menú).
    if (name === 'ajustes' && focusTab && currentAjustesCard) {
      const tabBtn = currentAjustesCard.root.querySelector(
        `.ajustes-tab[aria-selected="true"]`
      );
      if (tabBtn) tabBtn.focus();
      else focusHeading(views[name]);
    } else {
      focusHeading(views[name]);
    }
  }
}

document.querySelectorAll('.nav-item[data-view]').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.view))
);

// ── Sidebar: mobile toggle ───────────────────────────────
const menuToggle     = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Tooltip accesible: el menú contraído oculta la etiqueta pero sigue
// teniéndola en el DOM (con el patrón sr-only para los lectores de
// pantalla); copiamos su texto a un `title` en el botón para que los
// usuarios de ratón también vean el nombre al pasar por encima.
document.querySelectorAll('.nav-item').forEach(btn => {
  const label = btn.querySelector('.nav-label')?.textContent?.trim();
  if (label) btn.title = label;
});

function openSidebarMobile() {
  document.body.classList.add('sidebar-open');
  menuToggle.setAttribute('aria-expanded', 'true');
}
function closeSidebarMobile() {
  document.body.classList.remove('sidebar-open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

menuToggle.addEventListener('click', () => {
  document.body.classList.contains('sidebar-open')
    ? closeSidebarMobile()
    : openSidebarMobile();
});
sidebarOverlay.addEventListener('click', closeSidebarMobile);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('sidebar-open'))
    closeSidebarMobile();
});

// ── Sidebar: desktop collapse ────────────────────────────
const sidebar            = document.getElementById('sidebar');
const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
const COLLAPSED_KEY      = 'planner_sidebar_collapsed';

if (localStorage.getItem(COLLAPSED_KEY) === '1') sidebar.classList.add('collapsed');

sidebarCollapseBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  localStorage.setItem(COLLAPSED_KEY, sidebar.classList.contains('collapsed') ? '1' : '0');
});

// ── Sidebar: tipo de dispositivo ──────────────────────────
// Los iconos grandes del menú contraído están pensados para tocarlos
// con el dedo, así que solo se usan si hay algo que tocar. WebKitGTK
// responde a '(pointer: coarse)' cuando la sesión gráfica no tiene
// ningún dispositivo de puntero (por ejemplo un Wayland sin ratón),
// aunque no exista ninguna pantalla táctil; en ese caso el contraído
// se dibuja como en escritorio (icono del tamaño del expandido).
// Para distinguirlo de una pantalla táctil de verdad miramos los
// puntos de contacto: si no hay ninguno, no hay dedo ni ratón.
// El atributo data-entrada="sin-puntero" lo lee index.css.
function marcarTipoEntrada() {
  const root = document.documentElement;
  const hayPunteroFino      = window.matchMedia('(pointer: fine)').matches;
  const hayPantallaTactil   = (navigator.maxTouchPoints || 0) > 0;
  if (!hayPunteroFino && !hayPantallaTactil) root.setAttribute('data-entrada', 'sin-puntero');
  else root.removeAttribute('data-entrada');
}

marcarTipoEntrada();
// Si conectan un ratón o aparece una pantalla táctil, se recalcula.
window.matchMedia('(pointer: fine)').addEventListener('change', marcarTipoEntrada);

// ── Sidebar: navegación por teclado (Flechas, Inicio/Fin) ──
// El contenedor .sidebar-nav actúa como un grupo de opciones tipo
// "menubar": flechas arriba/abajo mueven el foco entre .nav-item,
// Inicio/Fin van al primero/último, Enter/Espacio activan la
// opción enfocada. El listener ya gestiona preventDefault.
const sidebarNav = document.querySelector('.sidebar-nav');
bindRovingTabindex(sidebarNav, {
  selector: '.nav-item[data-view]',
  orientation: 'vertical',
  onSelect: (el) => el.click(),
});

// Mantener una sola opción con tabindex=0 para que el recorrido con
// Tab desde fuera entre solo a la activa; las demás se alcanzan con
// flechas.
function syncNavTabindex() {
  const buttons = navButtons();
  const active = buttons.find(b => b.getAttribute('aria-current') === 'page') ?? buttons[0];
  buttons.forEach(b => b.setAttribute('tabindex', b === active ? '0' : '-1'));
}
syncNavTabindex();

// ── Render ───────────────────────────────────────────────
let currentAjustesCard = null;

async function render(view, { tab = null } = {}) {
  switch (view) {
    case 'tasks':
      await new TaskManagerCard(views.tasks, Context).init();
      break;

    case 'week': {
      // La semana que contiene hoy, no la semana 0 desde la fecha de
      // inicio: de esa base se sale una semana hacia atrás o hacia
      // adelante.
      const semana = GetWeek(today(), weekOffset, Context.Tasks);
      if (!currentWeekCard) {
        views.week.innerHTML = '<div id="view-week-body"></div>';
        const body = views.week.querySelector('#view-week-body');
        const card = new WeekCard(body, semana, 0, {
          nav: true,
          onNav: (delta) => moverSemana(delta),
          // Sin tareas la semana se pinta como estado vacío, con el
          // enlace para crear la primera (T-056).
          totalTareas: Context.Tasks.length,
          onCrearTarea: async () => {
            await setView('tasks');
            // El foco va al campo donde se escribe el nombre: es lo
            // que el usuario tiene que hacer a continuación.
            const nameInput = document.getElementById('taskName');
            if (nameInput) nameInput.focus();
          },
        });
        // Si la tarjeta no se pudo montar (su HTML o su CSS faltaban),
        // la vista avisa y la tarjeta NO se guarda: en el siguiente
        // pintado se vuelve a montar (no se guarda una rota).
        if (await card.init()) currentWeekCard = card;
      } else {
        currentWeekCard.setWeek(semana, currentWeekCard.index, Context.Tasks.length);
      }
      break;
    }

    case 'allWeeks': {
      views.allWeeks.innerHTML = '<h2 id="view-allWeeks-heading" tabindex="-1" style="margin-top:0">Vista completa</h2>';
      // La vista completa empieza en la semana que contiene hoy.
      const weeks = GetNWeeks(today(), 12, 0, Context.Tasks);
      if (!weeks.length) {
        views.allWeeks.innerHTML += '<p style="color:var(--muted)">Sin tareas para mostrar.</p>';
        break;
      }
      for (let i = 0; i < weeks.length; i++) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '2rem';
        views.allWeeks.appendChild(wrapper);
        await new WeekCard(wrapper, weeks[i], i).init();
      }
      break;
    }

    case 'ajustes': {
      // Reutilizamos la misma instancia mientras la vista no cambie
      // (los ajustes viven en localStorage y reinicializar rompería
      // el foco del usuario). Al volver desde el menú sin pestaña,
      // reseteamos a la pestaña por defecto (Apariencia) para que
      // abrir Ajustes siempre muestre la misma entrada.
      if (!currentAjustesCard) {
        const card = new AjustesCard(views.ajustes, { tab });
        // Si la tarjeta no se pudo montar (su HTML o su CSS faltaban),
        // la vista avisa y la tarjeta NO se guarda: en el siguiente
        // pintado se vuelve a montar (no se guarda una rota).
        if (await card.init()) currentAjustesCard = card;
      } else if (tab) {
        await currentAjustesCard.showTab(tab);
      } else {
        await currentAjustesCard.showTab('appearance');
      }
      break;
    }
  }

  // La vista ya está pintada. Lo avisamos con un evento porque la
  // vista se activa (clase 'active') ANTES de pintarse: el pintado
  // es asíncrono (trae el HTML y el CSS de la tarjeta), así que
  // "visible" no quiere decir "al día". Sin esta señal, quien lea el
  // DOM nada más abrir una vista puede leer el contenido del pintado
  // anterior; era lo que hacía fallar la vista Tareas de forma
  // intermitente en los E2E.
  window.dispatchEvent(new CustomEvent('planner:painted', {
    detail: { view },
  }));
}

applyPreferences();   // activa también el seguimiento del tema del sistema

// ── API pública (PlannerApi) ───────────────────────────────────────────
// Tras cada cambio hecho por la API, `planner:changed` repinta la
// vista activa y anuncia el resultado en una región role="status". La
// navegación (`planner:navigate`) cambia de vista. La capa de API vive
// en api.js; aquí solo conectamos los eventos al render y a la UI.
const plannerStatusEl = document.getElementById('plannerStatus');

function currentViewName() {
  const btn = navButtons().find(b => b.getAttribute('aria-current') === 'page');
  return btn?.dataset.view ?? 'tasks';
}

window.addEventListener('planner:changed', (e) => {
  const { status, action } = e.detail ?? {};
  // Repintamos la vista activa para que la UI refleje los cambios
  // hechos por la API (addTask, updateTask, deleteTask, setStartDate…).
  const view = currentViewName();
  // Solo repintamos las vistas que muestran tareas; las demás (legal,
  // settings, data, print) no cambian con la API en esta tarea y
  // re-inicializarlas movería el foco o haría trabajo inútil.
  //
  // Marcar y desmarcar NO repintan: la casilla, el tachado y el
  // contador del día se actualizan en el sitio (en la tarjeta del
  // día). Repintar aquí destruiría la casilla que el usuario acaba de
  // pulsar y perdería el foco del teclado.
  if (action !== 'mark' && action !== 'unmark') {
    if (view === 'tasks' || view === 'week' || view === 'allWeeks') {
      // El repintado se aplaza un turno. La API puede cambiar algo
      // justo cuando la persona está usando la vista (un clic, un
      // formulario abierto): si el repintado fuera inmediato, le
      // quitaría de delante lo que tiene entre manos (el panel de
      // edición con lo que está escribiendo, el botón que iba a
      // pulsar). Antes tardaba en llegar (las plantillas se
      // descargaban por la red); con la base común (T-062) llegan al
      // instante, así que el turno de espera se pone aquí.
      const pintada = new Promise((resolve) => {
        setTimeout(() => resolve(render(view)), 0);
      });
      // Un «Deshacer» (T-053) repinta la vista entera: el foco se
      // lleva al encabezado, que es el anclaje más estable (las filas
      // se recrean y el botón del aviso que lo tenía ya no existe).
      if (action === 'restore') pintada.then(() => focusHeading(views[view]));
    }
  }
  // Mensaje a la región role="status" para lectores de pantalla.
  if (plannerStatusEl && status) plannerStatusEl.textContent = status;
});

window.addEventListener('planner:navigate', (e) => {
  const view = e.detail?.view;
  if (!view) return;
  // setView ya actualiza aria-current, tabindex y mueve el foco al
  // encabezado de la nueva vista (o a la pestaña si se pidió una).
  setView(view, { tab: e.detail?.tab ?? null });
});
await requireTerms();
await startMonetization();
updateRemoveAdsButton();
document.body.classList.remove('booting');

// Puente MCP: escucha el evento 'mcp:call' del backend y delega en
// PlannerApi. Solo se activa DESPUÉS de los términos y el
// consentimiento para no aceptar llamadas de un usuario que no haya
// pasado la pantalla de acceso.
startMcpBridge().catch(err => console.warn('[mcp] bridge no iniciado:', err));

// Arranca el servidor MCP si el usuario lo dejó activado. Solo en
// escritorio (en Android no existe `mcp_start`).
//
// El token NO está en el `localStorage`: lo genera y guarda la capa
// nativa (fichero con permisos 0600 en el directorio de datos de la
// app), así que lo pedimos con 'mcp_token' (T-033). Gracias a eso el
// token sobrevive a un reinicio de la app y el comando `claude mcp add`
// del usuario sigue funcionando.
if (window.__TAURI__?.core?.invoke && !/android/i.test(navigator.userAgent)) {
  try {
    const saved = leerEstadoMcp();
    if (saved.enabled) {
      const port  = Number(saved.port) || PUERTO_POR_DEFECTO;
      const token = await window.__TAURI__.core.invoke('mcp_token');
      await window.__TAURI__.core.invoke('mcp_start', { port, token });
    }
  } catch (err) {
    console.warn('[mcp] no se pudo reiniciar el servidor:', err);
  }
}

// ── Atajos globales y diálogo de ayuda ────────────────────
// Se registran DESPUÉS de requireTerms()/startMonetization() para que
// Alt+1…7 y '?' no actúen sobre las pantallas de términos y
// consentimiento (solo deben hacerlo una vez la app está cargada).
document.addEventListener('keydown', (e) => {
  // Alt+1..Alt+3 cambian a las vistas de tareas. Alt+4..Alt+8 abren
  // Ajustes en una pestaña concreta (Datos, Imprimir y PDF,
  // Apariencia, Legal, Accesibilidad). Funciona aunque el foco esté
  // en un campo de texto (Alt es modificador y no se usa para escribir
  // dentro del formulario). También pulsamos preventDefault para que
  // no se active el menú nativo del navegador.
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    // Vista "Semana actual": Alt+← / Alt+→ cambian de semana y Alt+H
    // vuelve a la semana que contiene hoy. Solo actúan con la vista
    // Semana abierta.
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'h' || e.key === 'H') {
      if (currentViewName() === 'week') {
        e.preventDefault();
        moverSemana(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0);
        return;
      }
    }
    const viewMap = {
      '1': 'tasks',
      '2': 'week',
      '3': 'allWeeks',
    };
    if (viewMap[e.key]) {
      e.preventDefault();
      setView(viewMap[e.key]);
      return;
    }
    // Alt+4..Alt+8 → Ajustes en una pestaña concreta, con el foco
    // en la pestaña activa (criterio de T-022: "foco en la pestaña
    // activa" cuando se entra por atajo).
    const tabMap = {
      '4': 'data',
      '5': 'print',
      '6': 'appearance',
      '7': 'legal',
      '8': 'accessibility',
    };
    if (tabMap[e.key]) {
      e.preventDefault();
      setView('ajustes', { tab: tabMap[e.key], focusTab: true });
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      // Foco en el campo nombre de la nueva tarea. Primero cambiamos
      // de vista si hace falta; el formulario se inyecta en el
      // `await render('tasks')` y `taskName` ya existe.
      e.preventDefault();
      setView('tasks').then(() => {
        const nameInput = document.getElementById('taskName');
        if (nameInput) nameInput.focus();
      });
      return;
    }
  }

  // La tecla '?' (Shift+/) abre la ayuda. Fuera de campos de texto,
  // para no interferir al escribir.
  if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    if (!isEditable(e.target)) {
      e.preventDefault();
      shortcuts.open(e.target);
      return;
    }
  }
});

// Vista inicial sin mover el foco para que el primer Tab de la sesión
// caiga en el enlace "Saltar al contenido" (primer elemento enfocable).
setView('tasks', { focus: false });
