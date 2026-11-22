#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────
// status.mjs — Vista de terminal de la cola de tareas (.tasks/tasks.json)
// y de si MiniMax está trabajando ahora mismo.
//
//   npx status              resumen de todas las tareas
//   npx status --watch      solo las tareas en curso o en revisión,
//                           refrescadas EN EL MISMO SITIO cada 4 s
//                           (Ctrl+C para salir). Antes limpiaba la
//                           pantalla y la reimprimía entera; ahora
//                           actualiza el bloque sobre la marcha.
//   npx status T-009        solo esa tarea, con las últimas líneas de su
//                           registro (o el registro entero con --full)
//
// Sin dependencias: solo lee .tasks/, los procesos (`pgrep`) y git. No
// escribe nada. Se expone como `npx status` por el "bin" del
// package.json de la raíz (no hace falta `npm install`).
// ────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STORE = join(ROOT, '.tasks', 'tasks.json');
const LOGS = join(ROOT, '.tasks', 'logs');

const STATE_LABEL = {
  pendiente: 'pendiente', en_curso: 'en curso', en_revision: 'en revisión',
  hecha: 'hecha', cancelada: 'cancelada',
};
const STATE_ICON = {
  pendiente: '·', en_curso: '⏳', en_revision: '🔎', hecha: '✓', cancelada: '✗',
};
// Estados que --watch muestra: solo lo que está pasando AHORA.
const CURRENT_STATES = new Set(['en_curso', 'en_revision']);

const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const color = { pendiente: dim, en_curso: (s) => c('33', s), en_revision: (s) => c('36', s), hecha: (s) => c('32', s), cancelada: (s) => c('31', s) };

function sh(cmd, args) {
  try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

function loadTasks() {
  try { return JSON.parse(readFileSync(STORE, 'utf8')).tasks; }
  catch { return null; }
}

function lastLogFor(id) {
  let files;
  try { files = readdirSync(LOGS).filter(f => f.startsWith(`${id}-`) && f.endsWith('.log')); }
  catch { return null; }
  if (!files.length) return null;
  files.sort();
  return join(LOGS, files[files.length - 1]);
}

function pidFor(id) {
  const out = sh('pgrep', ['-f', `minimax/run-task\\.sh ${id}\\b`]);
  return out.split('\n').find(Boolean) ?? null;
}

const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
const lastEvent = (t, prefix) => [...t.history].reverse().find(h => h.event.startsWith(prefix));

function commitFor(task) {
  return sh('git', ['log', '-1', '--format=%h %s', `--grep=^${task.id}:`]);
}

function renderTask(task, { verbose } = {}) {
  const icon = STATE_ICON[task.status] ?? '·';
  const col = color[task.status] ?? ((s) => s);
  const lines = [];
  let head = `${icon} ${bold(task.id)}  ${col(STATE_LABEL[task.status])}  ${task.title}`;
  lines.push(head);

  if (task.status === 'en_curso') {
    const pid = pidFor(task.id);
    const since = lastEvent(task, 'estado → en_curso')?.at ?? task.updated;
    const mins = minutesSince(since);
    lines.push('   ' + (pid
      ? dim(`intento ${task.attempts} · MiniMax trabajando desde hace ${mins} min (PID ${pid})`)
      : c('31', `intento ${task.attempts} · SIN PROCESO: se cortó hace ~${mins} min. Usa /avanzar.`)));
  } else if (task.status === 'en_revision') {
    lines.push('   ' + dim(`intento ${task.attempts} · esperando revisión del supervisor`));
  } else if (task.status === 'pendiente' && task.feedback?.length) {
    const fb = task.feedback[task.feedback.length - 1];
    lines.push('   ' + dim(`devuelta (intento ${task.attempts}) · última corrección: ${fb.note.slice(0, 90)}`));
  } else if (task.status === 'hecha') {
    const commit = commitFor(task);
    if (commit) lines.push('   ' + dim(`commit ${commit}`));
  }

  const log = lastLogFor(task.id);
  if (log && (verbose || task.status === 'en_curso')) {
    const text = readFileSync(log, 'utf8');
    const tail = text.split('\n').filter(l => l.trim()).slice(verbose ? -30 : -4);
    lines.push(dim(`   registro: ${log.replace(ROOT + '/', '')}`));
    for (const l of tail) lines.push('   ' + dim('│ ') + l.slice(0, 160));
  }
  return lines.join('\n');
}

// ── Funciones puras exportadas (para las pruebas) ──────────────────
// Importar este módulo no debe disparar la CLI; por eso la lógica de
// process.argv vive al final, detrás de un chequeo de import.meta.url.

export const isCurrent = (task) => CURRENT_STATES.has(task?.status);
export const currentTasks = (tasks) => tasks.filter(isCurrent);

// Secuencia ANSI para devolver el cursor al inicio de un bloque ya
// impreso (de `prev` líneas) y borrar de ahí al final de la pantalla.
// Si `prev` es 0 (primer print), devuelve '' y no toca la pantalla.
export const redrawPrefix = (prev) => prev > 0 ? `\x1b[${prev}A\x1b[J` : '';

// Líneas visuales que ocupa un texto que TERMINA en '\n'. El '\n'
// final solo mueve el cursor a la línea siguiente, no añade una línea
// propia.
export const lineCount = (text) => text.split('\n').length - 1;

// ── Vistas ─────────────────────────────────────────────────────────
function renderAll() {
  const tasks = loadTasks();
  if (!tasks) return c('31', 'No se puede leer .tasks/tasks.json');
  const out = [];
  out.push(bold('Planificador — cola de tareas') + dim(`  (${new Date().toLocaleTimeString('es-ES')})`));
  out.push('');
  const order = ['en_curso', 'en_revision', 'pendiente', 'hecha', 'cancelada'];
  const sorted = [...tasks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  for (const t of sorted) {
    out.push(renderTask(t));
    out.push('');
  }
  const counts = tasks.reduce((m, t) => (m[t.status] = (m[t.status] ?? 0) + 1, m), {});
  const summary = Object.entries(counts).map(([k, n]) => `${n} ${STATE_LABEL[k]}`).join(' · ');
  out.push(dim(summary));
  out.push('');
  out.push(dim('npx status T-00X        detalle y registro completo de una tarea'));
  out.push(dim('npx status --watch       solo las tareas en curso o en revisión, refrescadas en el sitio cada 4 s'));
  return out.join('\n');
}

// Lo que muestra --watch: solo en_curso y en_revision. Pensada para
// reescribirse en su sitio cada 4 s sin saltos visuales.
function renderCurrent() {
  const tasks = loadTasks();
  if (!tasks) return c('31', 'No se puede leer .tasks/tasks.json');
  const current = currentTasks(tasks);
  const out = [];
  out.push(bold('Planificador — tareas en curso') + dim(`  (${new Date().toLocaleTimeString('es-ES')})`));
  out.push('');
  if (!current.length) {
    out.push(dim('  (ninguna · no hay tareas en curso ni en revisión)'));
    out.push('');
  } else {
    for (const t of current) {
      out.push(renderTask(t));
      out.push('');
    }
  }
  out.push(dim('Refresca cada 4 s (Ctrl+C para salir).  npx status          resumen completo.'));
  return out.join('\n');
}

function renderOne(id, { full }) {
  const tasks = loadTasks();
  const task = tasks?.find(t => t.id.toUpperCase() === id.toUpperCase());
  if (!task) return c('31', `No existe ${id}.`);
  return renderTask(task, { verbose: true }) + (full ? renderFullLog(task) : '');
}

function renderFullLog(task) {
  const log = lastLogFor(task.id);
  if (!log) return '';
  return '\n\n' + dim(`── registro completo: ${log.replace(ROOT + '/', '')} ──\n`) + readFileSync(log, 'utf8');
}

// ── CLI ────────────────────────────────────────────────────────────
function runCli() {
  const args = process.argv.slice(2);
  const watch = args.includes('--watch');
  const full = args.includes('--full');
  const id = args.find(a => /^T-\d+$/i.test(a));

  if (!watch) {
    console.log(id ? renderOne(id, { full }) : renderAll());
    return;
  }

  let stop = false;
  let prevLines = 0;
  process.on('SIGINT', () => { stop = true; process.stdout.write('\n'); process.exit(0); });
  const tick = () => {
    if (stop) return;
    // Devuelve el cursor al inicio del bloque anterior y borra de ahí
    // al final; luego escribe el bloque nuevo. Sin esto, cada 4 s se
    // veía un parpadeo con la pantalla limpia y todo el texto
    // reimpreso desde arriba.
    process.stdout.write(redrawPrefix(prevLines));
    const out = renderCurrent() + '\n';
    process.stdout.write(out);
    prevLines = lineCount(out);
    setTimeout(tick, 4000);
  };
  tick();
}

// Solo ejecuta la CLI cuando se invoca este archivo directamente (no
// cuando se importa para pruebas). Compara con realpath para que
// también funcione si se llega por un symlink (p. ej. `npx status`,
// que deja el symlink del bin en process.argv[1]).
function realPath(p) {
  if (!p) return null;
  try { return realpathSync(p); }
  catch { return null; }
}
const argv1 = process.argv[1];
const argvReal = realPath(argv1);
const scriptReal = realPath(fileURLToPath(import.meta.url));
if (argvReal && scriptReal && argvReal === scriptReal) {
  runCli();
}