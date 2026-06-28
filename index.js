import { Context }         from './context.js';
import { GetNWeeks }       from './back/calendar.js';
import { TaskManagerCard } from './ui/taskManager/taskManager-card.js';
import { DataManagerCard } from './ui/dataManager/dataManager-card.js';
import { PrintCard }       from './ui/print/print-card.js';
import { WeekCard }        from './ui/week/week-card.js';

// ── Service Worker ────────────────────────────────────────
if ('serviceWorker' in navigator && false) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}

// ── Vistas ───────────────────────────────────────────────
const views = {
  tasks:    document.getElementById('view-tasks'),
  week:     document.getElementById('view-week'),
  allWeeks: document.getElementById('view-allWeeks'),
  data:     document.getElementById('view-data'),
  print:    document.getElementById('view-print'),
};

function setView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  render(name);
  closeSidebarMobile();
}

document.querySelectorAll('.nav-item').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.view))
);

// ── Sidebar: mobile toggle ───────────────────────────────
const menuToggle     = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

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
  }
}

setView('tasks');
