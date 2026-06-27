import * as Main from '../../../back/main.js';

export class AddTaskCard {
  constructor(root) {
    this.root       = root;
    this.repeatType = 'no-repeat';
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/taskManager/addTask/addTask-card.html').then(r => r.text()), // ← corregido
      fetch('./ui/taskManager/addTask/addTask-card.css').then(r => r.text()),  // ← corregido
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
    this.radios.forEach(r => {
      r.addEventListener('change', () => {
        this.repeatType = r.value;
        this.renderExtra();
      });
    });
    this.renderExtra();
    this.btn.addEventListener('click', () => this.createTask());
  }

  renderExtra() {
    this.extra.innerHTML = '';

    if (this.repeatType === 'interval') {
      this.extra.innerHTML = `
        <div class="form-group">
          <label>Cada cuántos días</label>
          <input type="number" id="interval" value="3" min="2">
        </div>`;
    }

    if (this.repeatType === 'days') {
      this.extra.innerHTML = `
        <div class="form-group">
          <label>Días de la semana</label>
          <div class="repeat-grid">
            ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d, i) => `
              <label style="font-weight:normal">
                <input type="checkbox" value="${i}"> ${d}
              </label>`).join('')}
          </div>
        </div>`;
    }

    if (this.repeatType === 'cycle') {
      this.extra.innerHTML = `
        <p style="color:var(--text-secondary);font-size:0.85rem">
          Ciclo personalizado: usa la exportación JSON para configurarlo manualmente.
        </p>`;
    }
  }

  createTask() {
    const name  = this.name.value.trim();
    const total = parseInt(this.times.value) || 1;
    if (!name) return alert('Nombre requerido');

    let task = null;

    switch (this.repeatType) {
      case 'no-repeat':
        task = Main.CreateOneTimeTask(Main.CreateDailyTask(name, total, 0), total, 0);
        break;
      case 'daily':
        task = Main.CreateDailyTask(name, total, 0);
        break;
      case 'interval': {
        const interval = parseInt(this.extra.querySelector('#interval').value) || 3;
        task = Main.CreateNDaysTask(name, interval, total, 0);
        break;
      }
      case 'days': {
        const days = [...this.extra.querySelectorAll('input:checked')].map(x => parseInt(x.value));
        if (!days.length) return alert('Selecciona al menos un día');
        task = Main.CreateDaysOfWeekTask(name, days, total, 0);
        break;
      }
    }

    if (!task) return;

    this.root.dispatchEvent(new CustomEvent('task-create', { detail: task, bubbles: true }));
    this.reset();
  }

  reset() {
    this.name.value    = '';
    this.times.value   = 1;
    this.repeatType    = 'no-repeat';
    this.radios[0].checked = true;
    this.renderExtra();
  }
}