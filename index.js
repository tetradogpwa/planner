import { Context }         from './context.js';
import * as Main           from './back/main.js';
import { TaskManagerCard } from './ui/taskManager/taskManager-card.js';
import { DataManagerCard } from './ui/dataManager/dataManager-card.js';
import { PrintCard }       from './ui/print/print-card.js';
import { WeekCard }        from './ui/week/week-card.js';

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}

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
}

document.querySelectorAll('.nav-item').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.view))
);

async function render(view) {
  switch (view) {

    case 'tasks':
      new TaskManagerCard(views.tasks, Context).init();
      break;

    case 'week': {
      const weeks = Main.GetNWeeks(Context.StartDate, 1, 0, Context.Tasks);
      if (weeks.length > 0) {
        new WeekCard(views.week, weeks[0], 0).init();
      } else {
        views.week.innerHTML = '<p style="color:var(--muted)">Sin tareas para mostrar.</p>';
      }
      break;
    }

    case 'allWeeks': {
      views.allWeeks.innerHTML = '<h2 style="margin-top:0">Vista completa</h2>';
      const weeks = Main.GetNWeeks(Context.StartDate, 12, 0, Context.Tasks);
      if (weeks.length === 0) {
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