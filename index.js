import { Context }         from './context.js';
import { GetNWeeks }       from './back/calendar.js';
import { TaskManagerCard } from './ui/taskManager/taskManager-card.js';
import { DataManagerCard } from './ui/dataManager/dataManager-card.js';
import { PrintCard }       from './ui/print/print-card.js';
import { WeekCard }        from './ui/week/week-card.js';
import { LegalCard }       from './ui/legal/legal-card.js';
import { SettingsCard }    from './ui/settings/settings-card.js';
import { applyPreferences } from './ui/settings/preferences.js';
import { ConsentCard }     from './ui/consent/consent-card.js';
import { TermsCard, termsAccepted } from './ui/terms/terms-card.js';
import { initMonetization, needsConsent, hasAds } from './monetization.js';
import { shortcuts }       from './ui/shortcuts/shortcuts-card.js';
import { isEditable, focusHeading, bindRovingTabindex } from './ui/a11y.js';
import './api.js';   // monta window.PlannerApi

// ── Service Worker ────────────────────────────────────────
// En Tauri el Service Worker no aporta nada (los recursos ya están
// locales). Solo se activa en modo PWA puro (sin Tauri), pero
// actualmente está desactivado por defecto.
if ('serviceWorker' in navigator && false) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}

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
const VIEW_KEYS = ['tasks', 'week', 'allWeeks', 'data', 'print', 'legal', 'settings'];
const views = {
  tasks:    document.getElementById('view-tasks'),
  week:     document.getElementById('view-week'),
  allWeeks: document.getElementById('view-allWeeks'),
  data:     document.getElementById('view-data'),
  print:    document.getElementById('view-print'),
  legal:    document.getElementById('view-legal'),
  settings: document.getElementById('view-settings'),
};

const navButtons = () => Array.from(document.querySelectorAll('.nav-item[data-view]'));

async function setView(name, { focus = true } = {}) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
  await render(name);
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
  if (focus) focusHeading(views[name]);
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
async function render(view) {
  switch (view) {
    case 'tasks':
      await new TaskManagerCard(views.tasks, Context).init();
      break;

    case 'week': {
      views.week.innerHTML = '<div id="view-week-body"></div>';
      const weeks = GetNWeeks(Context.StartDate, 1, 0, Context.Tasks);
      const body = views.week.querySelector('#view-week-body');
      if (weeks.length > 0) {
        await new WeekCard(body, weeks[0], 0).init();
      } else {
        body.innerHTML = '<p style="color:var(--muted)">Sin tareas para mostrar.</p>';
      }
      break;
    }

    case 'allWeeks': {
      views.allWeeks.innerHTML = '<h2 id="view-allWeeks-heading" tabindex="-1" style="margin-top:0">Vista completa</h2>';
      const weeks = GetNWeeks(Context.StartDate, 12, 0, Context.Tasks);
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

    case 'data':
      await new DataManagerCard(views.data, Context).init();
      break;

    case 'print':
      await new PrintCard(views.print, Context).init();
      break;

    case 'legal':
      await new LegalCard(views.legal).init();
      break;

    case 'settings':
      await new SettingsCard(views.settings).init();
      break;
  }
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
  const { action, status } = e.detail ?? {};
  // Repintamos la vista activa para que la UI refleje los cambios
  // hechos por la API (addTask, updateTask, deleteTask, setStartDate…).
  const view = currentViewName();
  // Solo repintamos las vistas que muestran tareas; las demás (legal,
  // settings, data, print) no cambian con la API en esta tarea y
  // re-inicializarlas movería el foco o haría trabajo inútil.
  if (view === 'tasks' || view === 'week' || view === 'allWeeks') {
    render(view);
  }
  // Mensaje a la región role="status" para lectores de pantalla.
  if (plannerStatusEl && status) plannerStatusEl.textContent = status;
});

window.addEventListener('planner:navigate', (e) => {
  const view = e.detail?.view;
  if (!view) return;
  // setView ya actualiza aria-current, tabindex y mueve el foco al
  // encabezado de la nueva vista.
  setView(view);
});
await requireTerms();
await startMonetization();
updateRemoveAdsButton();
document.body.classList.remove('booting');

// ── Atajos globales y diálogo de ayuda ────────────────────
// Se registran DESPUÉS de requireTerms()/startMonetization() para que
// Alt+1…7 y '?' no actúen sobre las pantallas de términos y
// consentimiento (solo deben hacerlo una vez la app está cargada).
document.addEventListener('keydown', (e) => {
  // Alt+1..Alt+7 cambian de vista. Funciona aunque el foco esté en un
  // campo de texto (Alt es modificador y no se usa para escribir
  // dentro del formulario). También pulsamos preventDefault para que
  // no se active el menú nativo del navegador.
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const map = {
      '1': 'tasks',
      '2': 'week',
      '3': 'allWeeks',
      '4': 'data',
      '5': 'print',
      '6': 'settings',
      '7': 'legal',
    };
    if (map[e.key]) {
      e.preventDefault();
      setView(map[e.key]);
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
