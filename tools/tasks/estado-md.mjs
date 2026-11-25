// ────────────────────────────────────────────────────────────────────
// estado-md.mjs — Genera STATUS.md a partir de .tasks/tasks.json.
//
// STATUS.md cuenta al usuario qué tiene MiniMax entre manos y qué reto
// supone cada tarea abierta (dificultad y delicadeza). La evaluación
// de cada tarea la escribe MiniMax (tools/minimax/evaluar.sh →
// `tasks.mjs reto`); este módulo solo la pone en limpio.
//
// La línea «Actualizado» es la única que cambia sin que cambie nada
// más: `contenidoSinFecha` la quita para decidir si hay algo nuevo que
// publicar (así cola.sh no hace un commit en cada vuelta).
// ────────────────────────────────────────────────────────────────────

export const DIFICULTADES = ['fácil', 'media', 'difícil'];
export const DELICADEZAS = ['baja', 'media', 'alta'];

const ICONO_DIFICULTAD = { 'fácil': '🟢', media: '🟡', 'difícil': '🔴' };
const ICONO_DELICADEZA = { baja: '🟢', media: '🟡', alta: '🔴' };

const ESTADO = {
  pendiente: 'Pendiente',
  en_curso: 'MiniMax trabajando',
  en_revision: 'En revisión (M3)',
  hecha: 'Hecha',
  cancelada: 'Cancelada',
};

const ABIERTAS = ['en_curso', 'en_revision', 'pendiente'];
const MAX_INTENTOS = 4;   // el mismo límite que tools/cola.sh

const celda = (texto) => String(texto).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

function dificultad(t) {
  return t.reto ? `${ICONO_DIFICULTAD[t.reto.dificultad] ?? ''} ${t.reto.dificultad}` : '— sin evaluar';
}
function delicadeza(t) {
  return t.reto ? `${ICONO_DELICADEZA[t.reto.delicadeza] ?? ''} ${t.reto.delicadeza}` : '—';
}

/** Devoluciones del revisor en el intento actual de la cola: las
 *  correcciones que ha recibido la tarea en total. */
const devoluciones = (t) => t.feedback?.length ?? 0;

export function generarEstado(db, fecha = new Date()) {
  const abiertas = db.tasks
    .filter(t => ABIERTAS.includes(t.status))
    .sort((a, b) => ABIERTAS.indexOf(a.status) - ABIERTAS.indexOf(b.status)
      || db.tasks.indexOf(a) - db.tasks.indexOf(b));
  const activa = abiertas.find(t => t.status !== 'pendiente');
  const siguiente = abiertas.find(t => t.status === 'pendiente');
  const hechas = db.tasks.filter(t => t.status === 'hecha')
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .slice(0, 5);

  const out = [];
  out.push('# Estado de MiniMax');
  out.push('');
  out.push('> Lo genera `tools/tasks/tasks.mjs estado-md` a partir de la cola');
  out.push('> (`.tasks/tasks.json`) y lo publica `tools/cola.sh`. La evaluación');
  out.push('> de cada tarea (dificultad y delicadeza) la hace MiniMax con');
  out.push('> `tools/minimax/evaluar.sh`. No lo edites a mano: se sobrescribe.');
  out.push('');
  out.push(`Actualizado: ${fecha.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  out.push('');

  out.push('## Ahora');
  out.push('');
  const foco = activa ?? siguiente;
  if (!foco) {
    out.push('No hay tareas abiertas.');
  } else {
    const verbo = activa ? ESTADO[activa.status] : 'Siguiente en la cola';
    out.push(`**${foco.id} · ${foco.title}**`);
    out.push('');
    out.push(`- Estado: ${verbo} · intentos: ${foco.attempts} · devoluciones del revisor: ${devoluciones(foco)}`);
    out.push(`- Dificultad: ${dificultad(foco)} · Delicadeza: ${delicadeza(foco)}`);
    if (foco.reto?.motivo) out.push(`- Reto: ${foco.reto.motivo}`);
    if (foco.attempts >= MAX_INTENTOS - 1) {
      out.push(`- ⚠ Va por su intento ${foco.attempts} de ${MAX_INTENTOS}: si no sale, se quedará para que la mire el supervisor.`);
    }
  }
  out.push('');

  const evaluadas = abiertas.filter(t => t.reto);
  const cuenta = (campo, valor) => evaluadas.filter(t => t.reto[campo] === valor).length;
  out.push('## Resumen');
  out.push('');
  out.push(`- Abiertas: ${abiertas.length} (${abiertas.length - evaluadas.length} sin evaluar)`);
  out.push(`- Dificultad: ${DIFICULTADES.map(d => `${ICONO_DIFICULTAD[d]} ${cuenta('dificultad', d)} ${d}`).join(' · ')}`);
  out.push(`- Delicadeza: ${DELICADEZAS.map(d => `${ICONO_DELICADEZA[d]} ${cuenta('delicadeza', d)} ${d}`).join(' · ')}`);
  out.push('');
  out.push('**Dificultad**: cuánto trabajo y riesgo de equivocarse tiene la tarea.');
  out.push('**Delicadeza**: cuánto daño haría un error que se colara (datos del');
  out.push('usuario, seguridad, textos legales, lo que ve todo el mundo).');
  out.push('');

  out.push('## Cola');
  out.push('');
  if (abiertas.length) {
    out.push('| Tarea | Estado | Dificultad | Delicadeza | Intentos | Título |');
    out.push('|---|---|---|---|---|---|');
    for (const t of abiertas) {
      out.push(`| ${t.id} | ${ESTADO[t.status]} | ${dificultad(t)} | ${delicadeza(t)} | ${t.attempts} | ${celda(t.title)} |`);
    }
  } else {
    out.push('Vacía.');
  }
  out.push('');

  out.push('## El reto de cada tarea');
  out.push('');
  for (const t of abiertas) {
    out.push(`### ${t.id} · ${t.title}`);
    out.push('');
    out.push(`${dificultad(t)} · delicadeza ${delicadeza(t)}${t.relatedTo ? ` · sigue a ${t.relatedTo}` : ''}`);
    out.push('');
    out.push(t.reto?.motivo ?? 'Aún no la ha evaluado MiniMax.');
    out.push('');
  }

  out.push('## Últimas terminadas');
  out.push('');
  if (hechas.length) {
    for (const t of hechas) {
      out.push(`- ${t.id} · ${t.title} (${String(t.updated).slice(0, 10)}, ${t.attempts} ${t.attempts === 1 ? 'intento' : 'intentos'})`);
    }
  } else {
    out.push('Ninguna todavía.');
  }
  out.push('');
  return out.join('\n');
}

/** El contenido sin la línea «Actualizado», para comparar versiones. */
export const contenidoSinFecha = (md) => md.replace(/^Actualizado: .*$/m, '');
