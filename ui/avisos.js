// ────────────────────────────────────────────────────────────────────
// ui/avisos.js
//
// Los dos avisos de la app que no pertenecen a una tarjeta concreta:
//
//   - `mostrarAviso`: el cartel con una acción («Deshacer») que se
//     cierra solo a los ~8 s. Es lo que hace que borrar una tarea (o
//     un tema guardado) no sea irreversible.
//
//   - `abrirDialogo`: un diálogo propio, accesible y tematizable, en
//     vez de la pregunta de confirmación del navegador. La del
//     navegador no se puede teñir con el tema, no la anuncia ningún
//     lector de pantalla y no devuelve el foco a donde estaba.
//
// El aviso vive en <body> (no en la vista): así sobrevive a un cambio
// de vista y el «Deshacer» sigue sirviendo. Sus estilos están en
// index.css, que es donde viven los estilos globales.
// ────────────────────────────────────────────────────────────────────

import { trapFocus } from './a11y.js';

/** Cuánto tiempo vive un aviso si nadie lo cierra (ms). */
const DURACION_AVISO = 8000;

/** Cada diálogo tiene sus ids propios: así no se repiten en el DOM. */
let contadorDialogos = 0;

/** El contenedor donde se apilan los avisos. Puede haber más de uno
 *  (si se borran dos tareas seguidas, cada una tiene su «Deshacer»):
 *  por eso van en una columna y no uno encima de otro. */
function contenedorAvisos() {
  let cont = document.querySelector('.avisos');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'avisos';
    document.body.appendChild(cont);
  }
  return cont;
}

/**
 * Muestra un aviso con una acción opcional («Deshacer»).
 *
 * El aviso es una región `role="status"`: los lectores de pantalla
 * anuncian el texto. El botón es un <button> de verdad, así que se
 * puede alcanzar y pulsar con el teclado.
 *
 * `alPulsarAccion` es lo que hace el «Deshacer». Si no se pasa, el
 * aviso solo informa.
 *
 * Devuelve `{ cerrar() }` por si hay que quitarlo antes de tiempo.
 */
export function mostrarAviso({
  texto,
  accion = 'Deshacer',
  alPulsarAccion = null,
  duracion = DURACION_AVISO,
}) {
  const aviso = document.createElement('div');
  aviso.className = 'aviso';
  aviso.setAttribute('role', 'status');

  // La región live se inserta VACÍA en el DOM y se rellena después:
  // así el lector de pantalla la anuncia como un cambio de la región,
  // y no como el contenido con el que nació.
  contenedorAvisos().appendChild(aviso);

  const mensaje = document.createElement('span');
  mensaje.className = 'aviso-texto';
  mensaje.textContent = texto;
  aviso.appendChild(mensaje);

  let temporizador = null;
  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    if (temporizador !== null) clearTimeout(temporizador);
    aviso.remove();
  };

  if (alPulsarAccion) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aviso-accion';
    btn.textContent = accion;
    btn.addEventListener('click', () => {
      // Primero se quita el aviso (el botón que tenía el foco
      // desaparece) y después se hace la acción: quien la llama
      // devuelve el foco a donde quiere.
      cerrar();
      alPulsarAccion();
    });
    aviso.appendChild(btn);
  }

  temporizador = setTimeout(cerrar, duracion);
  return { cerrar };
}

/**
 * Abre un diálogo modal accesible y devuelve una promesa con la
 * respuesta: 'aceptar' o 'cancelar'.
 *
 * El foco queda atrapado dentro del diálogo (con la trampa de foco de
 * ui/a11y.js), Escape cancela y, al cerrarse, el foco vuelve al
 * elemento que lo abrió.
 */
export function abrirDialogo({
  titulo,
  mensaje,
  textoAceptar = 'Aceptar',
  textoCancelar = 'Cancelar',
  peligro = false,
}) {
  return new Promise((resolver) => {
    const id = `dialogo-${++contadorDialogos}`;

    const capa = document.createElement('div');
    capa.className = 'dialogo-capa';

    const panel = document.createElement('div');
    panel.className = 'dialogo';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', `${id}-titulo`);

    const tituloEl = document.createElement('h2');
    tituloEl.className = 'dialogo-titulo';
    tituloEl.id = `${id}-titulo`;
    tituloEl.textContent = titulo;

    const mensajeEl = document.createElement('p');
    mensajeEl.className = 'dialogo-mensaje';
    mensajeEl.textContent = mensaje;

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'dialogo-btn';
    btnCancelar.dataset.accion = 'cancelar';
    btnCancelar.textContent = textoCancelar;

    const btnAceptar = document.createElement('button');
    btnAceptar.type = 'button';
    btnAceptar.className = peligro ? 'dialogo-btn dialogo-btn-peligro' : 'dialogo-btn';
    btnAceptar.dataset.accion = 'aceptar';
    btnAceptar.textContent = textoAceptar;

    const acciones = document.createElement('div');
    acciones.className = 'dialogo-acciones';
    // «Cancelar» va primero en el DOM: al abrir, el foco cae en él
    // (lo primero enfocable del diálogo) y así no se borra nada por
    // error.
    acciones.append(btnCancelar, btnAceptar);

    panel.append(tituloEl, mensajeEl, acciones);
    capa.appendChild(panel);
    document.body.appendChild(capa);

    let liberar = null;
    const cerrar = (respuesta) => {
      if (liberar) { liberar(); liberar = null; }
      capa.remove();
      resolver(respuesta);
    };

    btnAceptar.addEventListener('click', () => cerrar('aceptar'));
    btnCancelar.addEventListener('click', () => cerrar('cancelar'));
    // Clic fuera del panel: cancela (como en el diálogo de atajos).
    capa.addEventListener('click', (e) => {
      if (e.target === capa) cerrar('cancelar');
    });

    // La trampa de foco: Tab y Shift+Tab no salen del diálogo, Escape
    // lo cancela y, al cerrarlo, el foco vuelve al elemento que lo
    // abrió (el botón que lo puso en marcha).
    liberar = trapFocus(panel, { onEscape: () => cerrar('cancelar') });
  });
}
