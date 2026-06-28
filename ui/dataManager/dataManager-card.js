import { FromJson, ToJson } from '../../back/serializer.js';

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
      const blob = new Blob([ToJson(this.context.Tasks)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(blob),
        download: 'planner.json',
      });
      a.click();
    };

    // Importar JSON
    this.root.querySelector('#importJsonInput').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const parsed = FromJson(ev.target.result);
          this.context.Tasks.length = 0;
          parsed.forEach(t => this.context.Tasks.push(t));
          this.#setStatus(`✅ ${parsed.length} tarea(s) importada(s)`);
        } catch {
          this.#setStatus('❌ JSON inválido');
        }
      };
      reader.readAsText(file);
    };

    // Borrar todo
    this.root.querySelector('#clearAllBtn').onclick = () => {
      if (confirm('¿Borrar todas las tareas?')) {
        this.context.Tasks.length = 0;
        this.#setStatus('🗑️ Datos borrados');
      }
    };
  }

  #setStatus(msg) {
    const el = this.root.querySelector('#dataStatus');
    if (el) el.textContent = msg;
  }
}
