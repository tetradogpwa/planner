import * as Main from '../../back/main.js';

export class DataManagerCard {
  constructor(root, context) {
    this.root    = root;
    this.context = context;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/dataManager/dataManager-card.html').then(r => r.text()),
      fetch('./ui/dataManager/dataManager-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.mount();
  }

  mount() {
    // Exportar JSON
    this.root.querySelector('#exportJsonBtn').onclick = () => {
      const blob = new Blob([Main.ToJson(this.context.Tasks)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = 'planner.json';
      a.click();
    };

    // Importar JSON
    this.root.querySelector('#importJsonInput').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = ev => {
        try {
          const parsed = Main.FromJson(ev.target.result);
          this.context.Tasks.length = 0;
          parsed.forEach(t => this.context.Tasks.push(t));
          this.root.querySelector('#dataStatus').textContent =
            `✅ ${parsed.length} tarea(s) importada(s)`;
        } catch {
          this.root.querySelector('#dataStatus').textContent = '❌ JSON inválido';
        }
      };
      r.readAsText(file);
    };

    // Borrar todo
    this.root.querySelector('#clearAllBtn').onclick = () => {
      if (confirm('¿Borrar todas las tareas?')) {
        this.context.Tasks.length = 0;
        this.root.querySelector('#dataStatus').textContent = '🗑️ Datos borrados';
      }
    };
  }
}