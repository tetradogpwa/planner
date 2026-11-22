import { FromJson, ToJson } from '../../back/serializer.js';
import { emitChanged }         from '../../api.js';

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
      const url  = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href:     url,
        download: 'planner.json',
      });
      a.click();
      // Liberamos el blob, pero NO de inmediato: el clic encola la
      // descarga y revocar la URL en el mismo instante puede cancelarla
      // (WebKitGTK y Firefox leen el blob de forma asíncrona). La
      // liberamos cuando la descarga ya ha podido empezar.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    // Importar JSON
    this.root.querySelector('#importJsonInput').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        // Primero se lee y se valida el archivo. La lista del usuario no
        // se toca hasta saber que el JSON es bueno: antes, importar un
        // archivo corrupto borraba todas las tareas y decía "0
        // tarea(s) importada(s)" (T-031 / R-01).
        let tareas;
        try {
          tareas = FromJson(ev.target.result);
        } catch (err) {
          console.warn('[datos] importación descartada:', err);
          this.#setStatus('❌ JSON inválido');
          return;
        }

        if (tareas.length === 0) {
          // El JSON es válido pero no trae ninguna tarea que sepamos
          // leer. Tampoco borramos la lista: para vaciarla hay un botón
          // explícito ("Borrar"), y aquí el usuario no ha pedido nada.
          this.#setStatus('⚠ El JSON no contiene tareas reconocibles; la lista no se ha modificado');
          return;
        }

        // Sustituimos la lista entera de golpe: una sola escritura en
        // localStorage y nunca una lista a medio rellenar.
        this.context.Tasks = tareas;

        const mensaje = `✅ ${tareas.length} tarea(s) importada(s)`;
        this.#setStatus(mensaje);
        // Avisamos al resto de la app para que las demás vistas se
        // repinten y se anuncie el resultado.
        emitChanged('import', mensaje);
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
