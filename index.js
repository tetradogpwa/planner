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
const views = {
  tasks:    document.getElementById('view-tasks'),
  week:     document.getElementById('view-week'),
  allWeeks: document.getElementById('view-allWeeks'),
  data:     document.getElementById('view-data'),
  print:    document.getElementById('view-print'),
  legal:    document.getElementById('view-legal'),
  settings: document.getElementById('view-settings'),
};

function setView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  render(name);
  closeSidebarMobile();
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

// ── Render ───────────────────────────────────────────────
async function render(view) {
  switch (view) {
    case 'tasks':
      new TaskManagerCard(views.tasks, Context).init();
      break;

    case 'week': {
      const weeks = GetNWeeks(Context.StartDate, 1, 0, Context.Tasks);
      if (weeks.length > 0) {
        new WeekCard(views.week, weeks[0], 0).init();
      } else {
        views.week.innerHTML = '<p style="color:var(--muted)">Sin tareas para mostrar.</p>';
      }
      break;
    }

    case 'allWeeks': {
      views.allWeeks.innerHTML = '<h2 style="margin-top:0">Vista completa</h2>';
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
      new DataManagerCard(views.data, Context).init();
      break;

    case 'print':
      new PrintCard(views.print, Context).init();
      break;

    case 'legal':
      new LegalCard(views.legal).init();
      break;

    case 'settings':
      new SettingsCard(views.settings).init();
      break;
  }
}

applyPreferences();   // activa también el seguimiento del tema del sistema
await requireTerms();
await startMonetization();
updateRemoveAdsButton();
document.body.classList.remove('booting');
setView('tasks');
