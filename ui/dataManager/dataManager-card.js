import { backupFileName, backupToJson, parseBackup } from '../../back/backup.js';
import { emitChanged }                                    from '../../api.js';
import { formatLocalDate, parseLocalDate }                from '../../back/calendar.js';
import { abrirDialogo, mostrarAviso }                      from '../avisos.js';
import { getPreferences, sanitizePreferences, setPreferences } from '../settings/preferences.js';

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
    // Exportar la copia de seguridad. No solo van las tareas: también la
    // fecha de inicio del planificador, las marcas de «hecho» y las
    // preferencias, que antes se perdían al exportar (T-054).
    this.root.querySelector('#exportJsonBtn').onclick = () => {
      const texto = backupToJson({
        tasks:       this.context.Tasks,
        completions: this.context.GetAllMarks(),
        startDate:   formatLocalDate(this.context.StartDate),
        preferences: getPreferences(),
      });
      const blob = new Blob([texto], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href:     url,
        download: backupFileName(),
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
      reader.onload = async ev => {
        // Primero se lee y se valida el archivo. La lista del usuario no
        // se toca hasta saber que el JSON es bueno: antes, importar un
        // archivo corrupto borraba todas las tareas y decía "0
        // tarea(s) importada(s)" (T-031 / R-01).
        let copia;
        try {
          // `origin`: las tareas del formato viejo guardaban un offset
          // en días respecto al origen del planificador; al importarlas
          // ese offset se traduce a una fecha real (T-045).
          copia = parseBackup(ev.target.result, { origin: this.context.StartDate });
        } catch (err) {
          console.warn('[datos] importación descartada:', err);
          this.#setStatus('❌ JSON inválido');
          return;
        }

        if (copia.tareas.length === 0) {
          // El JSON es válido pero no trae ninguna tarea que sepamos
          // leer. Tampoco borramos la lista: para vaciarla hay un botón
          // explícito ("Borrar"), y aquí el usuario no ha pedido nada.
          this.#setStatus('⚠ El JSON no contiene tareas reconocibles; la lista no se ha modificado');
          return;
        }

        // Antes de sustituir nada, se dice qué va a pasar: cuántas
        // tareas hay ahora, cuántas traen el archivo y cuántas se han
        // descartado por no reconocerlas (T-054).
        const respuesta = await abrirDialogo({
          titulo: 'Importar copia de seguridad',
          mensaje: `Se van a sustituir ${this.context.Tasks.length} tareas por ${copia.tareas.length} (${copia.descartadas} descartadas)`,
          textoAceptar: 'Confirmar',
          textoCancelar: 'Cancelar',
        });
        if (respuesta !== 'aceptar') {
          // Cancelar no toca nada: la lista sigue como estaba.
          this.#setStatus('⚠ Importación cancelada; la lista no se ha modificado');
          return;
        }

        // Sustituimos la lista entera de golpe: una sola escritura en
        // localStorage y nunca una lista a medio rellenar.
        this.context.Tasks = copia.tareas;
        // Y con ellas, sus marcas de «hecho» (si el archivo las trae:
        // los archivos antiguos no las tienen y se dejan las que había).
        if (copia.completions) this.context.SetAllMarks(copia.completions);
        // La fecha de inicio del planificador y las preferencias, si el
        // archivo las trae.
        if (copia.startDate) this.context.StartDate = parseLocalDate(copia.startDate);
        if (copia.preferences) setPreferences(sanitizePreferences(copia.preferences));

        const mensaje = `✅ ${copia.tareas.length} tarea(s) importada(s)`;
        this.#setStatus(mensaje);
        // Avisamos al resto de la app para que las demás vistas se
        // repinten y se anuncie el resultado.
        emitChanged('import', mensaje);
      };
      reader.readAsText(file);
    };

    // Borrar todo
    this.root.querySelector('#clearAllBtn').onclick = async () => {
      const total = this.context.Tasks.length;
      if (total === 0) {
        this.#setStatus('No hay tareas que borrar');
        return;
      }
      // Diálogo propio de la app, no la pregunta de confirmación del
      // navegador: este se puede teñir con el tema, avisa a los lectores
      // de pantalla y devuelve el foco a donde estaba (T-053).
      const respuesta = await abrirDialogo({
        titulo: 'Borrar todas las tareas',
        mensaje: `Se borrarán las ${total} ${total === 1 ? 'tarea' : 'tareas'} que tienes. Puedes deshacerlo después.`,
        textoAceptar: 'Borrar todo',
        textoCancelar: 'Cancelar',
        peligro: true,
      });
      if (respuesta !== 'aceptar') return;

      // Foto de las tareas (y de sus marcas de «hecho») para poder
      // deshacer el borrado (T-053).
      const foto = this.context.FotoTodas();
      this.context.Tasks.length = 0;
      // Con las tareas se van también sus marcas de «hecho» (T-050).
      this.context.ClearAllMarks();
      this.#setStatus('🗑️ Datos borrados');
      // La app entera tiene que enterarse del cambio: sin este aviso,
      // las demás vistas no se repintan (T-053).
      emitChanged('clear', '🗑️ Datos borrados');
      // Y se puede deshacer.
      mostrarAviso({
        texto: `Tareas borradas (${total})`,
        alPulsarAccion: () => this.#deshacerBorrado(foto),
      });
    };
  }

  /** Deshace el «Borrar todo»: vuelve a poner las tareas que había,
   *  con sus id y con sus marcas de «hecho» (T-053). */
  #deshacerBorrado(foto) {
    const tareas = this.context.RestaurarTodas(foto);
    if (tareas.length === 0) return;
    this.#setStatus('↩️ Tareas restauradas');
    emitChanged('restore', 'Tareas restauradas');
    // El aviso ya no está (el botón que tenía el foco ha
    // desaparecido): el foco vuelve al botón de Borrar, si se ve.
    const btn = this.root.querySelector('#clearAllBtn');
    if (btn && btn.offsetParent !== null) btn.focus();
  }

  #setStatus(msg) {
    const el = this.root.querySelector('#dataStatus');
    if (el) el.textContent = msg;
  }
}
