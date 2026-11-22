#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────
// tasks.mjs — Cola de tareas del proyecto (supervisor Claude + MiniMax).
//
// Cada petición del usuario es una tarea en .tasks/tasks.json. Si el
// usuario cambia algo de una tarea que aún no está hecha, se modifica
// esa tarea (`amend`); no se crea otra. Una tarea hecha no se modifica:
// se crea una nueva con --relacionada.
//
// Uso:  node tools/tasks/tasks.mjs <orden> [argumentos]
//   add      --title T --request R [--criterio C]... [--nota N]... [--relacionada T-001]
//   amend    T-001 [--request R] [--title T] [--criterio C]... [--nota N]...
//   list     [--todas]
//   show     T-001
//   next                       primera tarea pendiente
//   status   T-001 <estado> [--note N]
//   feedback T-001 --note N    el supervisor la devuelve a MiniMax
//   snapshot T-001             foto del árbol antes de que trabaje MiniMax
//   diff     T-001 [--stat] [--total]
//                              cambios desde la foto del último intento
//                              (--total: desde el primer intento; excluye .tasks/)
//   prompt   T-001             instrucciones para MiniMax
//   busy                       sale con código 1 si hay una tarea en curso
//   empezar  [T-001]           MiniMax toma la tarea (o la siguiente pendiente):
//                              foto, estado en_curso e instrucciones completas
//   terminar T-001             MiniMax la entrega: estado en_revision
//
// Estados: pendiente → en_curso → en_revision → hecha  (o cancelada)
// ────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STORE_DIR = join(ROOT, '.tasks');
const STORE = join(STORE_DIR, 'tasks.json');

const WORKER_RULES = join(ROOT, 'tools', 'minimax', 'worker-prompt.md');

const STATES = ['pendiente', 'en_curso', 'en_revision', 'hecha', 'cancelada'];
const OPEN = ['pendiente', 'en_curso', 'en_revision'];
const STATE_LABEL = {
  pendiente: 'Pendiente',
  en_curso: 'En curso (MiniMax)',
  en_revision: 'En revisión (Claude)',
  hecha: 'Hecha',
  cancelada: 'Cancelada',
};

// ── Almacén ─────────────────────────────────────────────────────────

function load() {
  if (!existsSync(STORE)) return { next: 1, tasks: [] };
  return JSON.parse(readFileSync(STORE, 'utf8'));
}

function save(db) {
  mkdirSync(STORE_DIR, { recursive: true });
  const tmp = `${STORE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n');
  renameSync(tmp, STORE);
}

const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(2);
}

function find(db, id) {
  const task = db.tasks.find(t => t.id === String(id).toUpperCase());
  if (!task) fail(`no existe la tarea ${id}. Usa "list --todas" para verlas.`);
  return task;
}

function log(task, event, note = '') {
  task.updated = now();
  task.history.push({ at: task.updated, event, ...(note ? { note } : {}) });
}

// ── Argumentos ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : (i++, next);
    if (key === 'criterio' || key === 'nota') (opts[key] ??= []).push(value);
    else opts[key] = value;
  }
  return { positional, opts };
}

function requireText(value, flag) {
  if (typeof value !== 'string' || !value.trim()) fail(`falta ${flag} "…"`);
  return value.trim();
}

// ── Git: fotos del árbol sin tocar el índice del usuario ────────────

function git(args, env = {}) {
  return execFileSync('git', args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Árbol git del directorio de trabajo actual (incluye archivos nuevos no ignorados). */
function workingTree(tag) {
  const gitDir = git(['rev-parse', '--absolute-git-dir']).trim();
  const index = join(gitDir, `tasks-index-${tag}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    git(['read-tree', 'HEAD'], env);
    git(['add', '-A'], env);
    return git(['write-tree'], env).trim();
  } finally {
    rmSync(index, { force: true });
  }
}

const EXCLUDE = ['--', '.', ':(exclude).tasks'];

// ── Formato ─────────────────────────────────────────────────────────

function line(task) {
  const related = task.relatedTo ? ` (sigue a ${task.relatedTo})` : '';
  return `${task.id}  [${STATE_LABEL[task.status]}]  ${task.title}${related}`;
}

function detail(task) {
  const out = [line(task), ''];
  out.push(`Creada: ${task.created}   Actualizada: ${task.updated}   Intentos de MiniMax: ${task.attempts}`);
  out.push('', 'Petición del usuario:');
  task.requests.forEach((r, i) => out.push(`  ${i === 0 ? '•' : '+'} [${r.at}] ${r.text}`));
  if (task.criteria.length) {
    out.push('', 'Criterios de aceptación:');
    task.criteria.forEach(c => out.push(`  - ${c}`));
  }
  if (task.notes?.length) {
    out.push('', 'Notas técnicas del supervisor:');
    task.notes.forEach(n => out.push(`  - ${n}`));
  }
  if (task.feedback.length) {
    out.push('', 'Correcciones del supervisor:');
    task.feedback.forEach(f => out.push(`  - [${f.at}] ${f.note}`));
  }
  out.push('', 'Historial:');
  task.history.forEach(h => out.push(`  ${h.at}  ${h.event}${h.note ? ` — ${h.note}` : ''}`));
  return out.join('\n');
}

function workerPrompt(task) {
  const out = [
    `Tarea ${task.id}: ${task.title}`,
    '',
    'Petición del usuario (las líneas posteriores modifican o amplían a las anteriores; manda la más reciente):',
    ...task.requests.map((r, i) => `${i + 1}. ${r.text}`),
  ];
  if (task.notes?.length) {
    out.push('', 'Contexto técnico (análisis del supervisor; úsalo como punto de partida):');
    task.notes.forEach(n => out.push(`- ${n}`));
  }
  if (task.criteria.length) {
    out.push('', 'Criterios de aceptación (el supervisor comprobará cada uno):');
    task.criteria.forEach(c => out.push(`- ${c}`));
  }
  if (task.feedback.length) {
    out.push('', 'Correcciones del supervisor a intentos anteriores (resuélvelas todas):');
    task.feedback.forEach(f => out.push(`- ${f.note}`));
  }
  out.push('', 'Cuando termines, responde con un resumen breve: archivos cambiados, cómo se cumple cada criterio y qué no has podido comprobar.');
  return out.join('\n');
}

// ── Órdenes ─────────────────────────────────────────────────────────

const { positional: [cmd, ...rest], opts } = parseArgs(process.argv.slice(2));
const db = load();

switch (cmd) {
  case 'add': {
    const title = requireText(opts.title, '--title');
    const request = requireText(opts.request, '--request');
    let relatedTo = null;
    if (opts.relacionada) relatedTo = find(db, opts.relacionada).id;
    const id = `T-${String(db.next).padStart(3, '0')}`;
    db.next++;
    const task = {
      id, title, status: 'pendiente', relatedTo,
      created: now(), updated: now(), attempts: 0,
      requests: [{ at: now(), text: request }],
      criteria: (opts.criterio ?? []).map(c => String(c).trim()).filter(Boolean),
      notes: (opts.nota ?? []).map(n => String(n).trim()).filter(Boolean),
      feedback: [], baseTree: null, history: [],
    };
    log(task, 'creada');
    db.tasks.push(task);
    save(db);
    console.log(`Creada ${id}: ${title}`);
    break;
  }

  case 'amend': {
    const task = find(db, rest[0]);
    if (!OPEN.includes(task.status)) {
      fail(`${task.id} está ${STATE_LABEL[task.status].toLowerCase()} y no se modifica. ` +
           `Crea una tarea nueva con: add --title "…" --request "…" --relacionada ${task.id}`);
    }
    const changes = [];
    if (typeof opts.request === 'string' && opts.request.trim()) {
      task.requests.push({ at: now(), text: opts.request.trim() });
      changes.push('petición ampliada');
    }
    if (typeof opts.title === 'string' && opts.title.trim()) {
      task.title = opts.title.trim();
      changes.push('título');
    }
    for (const c of opts.criterio ?? []) {
      if (String(c).trim()) { task.criteria.push(String(c).trim()); changes.push('criterio'); }
    }
    for (const n of opts.nota ?? []) {
      if (String(n).trim()) { (task.notes ??= []).push(String(n).trim()); changes.push('nota'); }
    }
    if (!changes.length) fail('nada que cambiar: usa --request, --title, --criterio o --nota');
    log(task, 'modificada', changes.join(', '));
    save(db);
    const warn = task.status === 'en_curso' ? ' (MiniMax ya está con ella: revísalo al terminar)' : '';
    console.log(`Modificada ${task.id}: ${changes.join(', ')}${warn}`);
    break;
  }

  case 'list': {
    const tasks = opts.todas ? db.tasks : db.tasks.filter(t => OPEN.includes(t.status));
    if (!tasks.length) console.log(opts.todas ? 'No hay tareas.' : 'No hay tareas abiertas.');
    tasks.forEach(t => console.log(line(t)));
    break;
  }

  case 'show':
    console.log(detail(find(db, rest[0])));
    break;

  case 'next': {
    const task = db.tasks.find(t => t.status === 'pendiente');
    if (!task) { console.log('No hay tareas pendientes.'); process.exit(1); }
    console.log(task.id);
    break;
  }

  case 'status': {
    const task = find(db, rest[0]);
    const state = rest[1];
    if (!STATES.includes(state)) fail(`estado no válido. Usa: ${STATES.join(', ')}`);
    task.status = state;
    if (state === 'en_curso') task.attempts++;
    log(task, `estado → ${state}`, typeof opts.note === 'string' ? opts.note : '');
    save(db);
    console.log(line(task));
    break;
  }

  case 'feedback': {
    const task = find(db, rest[0]);
    const note = requireText(opts.note, '--note');
    task.feedback.push({ at: now(), note });
    task.status = 'pendiente';
    log(task, 'devuelta a MiniMax', note);
    save(db);
    console.log(`${task.id} devuelta a MiniMax con correcciones.`);
    break;
  }

  case 'snapshot': {
    const task = find(db, rest[0]);
    task.baseTree = workingTree(task.id);
    task.firstTree ??= task.baseTree;   // foto del primer intento, para diff --total
    log(task, 'foto del árbol', task.baseTree.slice(0, 10));
    save(db);
    console.log(task.baseTree);
    break;
  }

  case 'diff': {
    const task = find(db, rest[0]);
    if (!task.baseTree) fail(`${task.id} no tiene foto: ejecútala con tools/minimax/run-task.sh`);
    const base = opts.total ? (task.firstTree ?? task.baseTree) : task.baseTree;
    const current = workingTree(`${task.id}-now`);
    const args = ['diff', ...(opts.stat ? ['--stat'] : []), base, current, ...EXCLUDE];
    const out = git(args);
    console.log(out.trim() || 'Sin cambios desde la foto.');
    break;
  }

  case 'prompt':
    console.log(workerPrompt(find(db, rest[0])));
    break;

  case 'busy': {
    const running = db.tasks.find(t => t.status === 'en_curso');
    if (running) { console.log(running.id); process.exit(1); }
    break;
  }

  // Para cuando el usuario habla con MiniMax directamente en OpenCode
  // ("haz la siguiente tarea"): hace lo mismo que run-task.sh antes y
  // después de lanzarlo, para que el supervisor pueda revisar el diff.
  case 'empezar': {
    const running = db.tasks.find(t => t.status === 'en_curso');
    if (running && (!rest[0] || running.id !== String(rest[0]).toUpperCase())) {
      console.log(`Ya hay una tarea en curso: ${running.id}. Termínala antes de empezar otra:\n`);
      console.log(workerPrompt(running));
      process.exit(1);
    }
    const task = rest[0] ? find(db, rest[0]) : db.tasks.find(t => t.status === 'pendiente');
    if (!task) { console.log('No hay tareas pendientes. No hay nada que hacer.'); process.exit(1); }
    if (task.status !== 'pendiente' && task.status !== 'en_curso') {
      fail(`${task.id} está ${STATE_LABEL[task.status].toLowerCase()}; solo se empiezan tareas pendientes.`);
    }
    if (task.status === 'pendiente') {
      task.baseTree = workingTree(task.id);
      task.firstTree ??= task.baseTree;
      log(task, 'foto del árbol', task.baseTree.slice(0, 10));
      task.status = 'en_curso';
      task.attempts++;
      log(task, 'estado → en_curso', 'MiniMax la empieza desde OpenCode');
      save(db);
    }
    console.log(readFileSync(WORKER_RULES, 'utf8'));
    console.log('---\n');
    console.log(workerPrompt(task));
    console.log(`\nAl terminar ejecuta: node tools/tasks/tasks.mjs terminar ${task.id}`);
    break;
  }

  case 'terminar': {
    const task = find(db, rest[0]);
    if (task.status !== 'en_curso') fail(`${task.id} no está en curso (está ${STATE_LABEL[task.status].toLowerCase()}).`);
    task.status = 'en_revision';
    log(task, 'estado → en_revision', 'MiniMax ha terminado (sesión de OpenCode)');
    save(db);
    console.log(`${task.id} entregada. Pide a Claude que la revise.`);
    break;
  }

  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 28).join('\n').replace(/^\/\/ ?/gm, ''));
    process.exit(cmd ? 2 : 0);
}
