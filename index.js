import { Context } from './context.js';

import { TaskManagerCard } from './ui/taskManager/taskManager-card.js';
import { DataManagerCard } from './ui/dataManager/dataManager-card.js';
import { PrintCard } from './ui/print/print-card.js';
import { WeekCard } from './ui/week/week-card.js';

const views = {
  tasks: document.getElementById('view-tasks'),
  week: document.getElementById('view-week'),
  allWeeks: document.getElementById('view-allWeeks'),
  data: document.getElementById('view-data'),
  print: document.getElementById('view-print')
};

function setView(name) {

  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');

  document.querySelectorAll('.nav-item')
    .forEach(b => b.classList.remove('active'));

  document.querySelector(`[data-view="${name}"]`)
    .classList.add('active');

  render(name);
}

document.querySelectorAll('.nav-item')
  .forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

function render(view) {

  if (view === 'tasks') {
    new TaskManagerCard(
      document.getElementById('view-tasks'),
      Context
    ).init();
  }

  if (view === 'data') {
    new DataManagerCard(
      document.getElementById('view-data'),
      Context
    ).init();
  }

  if (view === 'print') {
    new PrintCard(
      document.getElementById('view-print'),
      Context
    ).init();
  }

  if (view === 'week') {
    const root = document.getElementById('view-week');
    const weeks = Main.GetNWeeks(Context.StartDate, 1, 0, Context.Tasks);

    new WeekCard(root, weeks[0], 0).init();
  }
}

setView('tasks');