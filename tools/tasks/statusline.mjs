#!/usr/bin/env node
// Línea de estado de Claude Code (ver "statusLine" en .claude/settings.json).
// Dice en una línea en qué punto está el ciclo de la tarea actual y, sobre
// todo, si el usuario ya puede hacer /clear (cuando la tarea está cerrada).
// Lee solo .tasks/tasks.json, git y la lista de procesos; no escribe nada.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sh(cmd, args) {
  try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
const lastEvent = (t, event) => [...t.history].reverse().find(h => h.event.startsWith(event));

let tasks = [];
try { tasks = JSON.parse(readFileSync(join(ROOT, '.tasks', 'tasks.json'), 'utf8')).tasks; }
catch { console.log('Cola de tareas ilegible'); process.exit(0); }

const pending = tasks.filter(t => t.status === 'pendiente');
const running = tasks.find(t => t.status === 'en_curso');
const review  = tasks.find(t => t.status === 'en_revision');
const returned = pending.find(t => t.feedback?.length);

// run-task.sh tarda unos segundos en marcar la tarea en_curso.
const starting = !running && sh('pgrep', ['-af', 'minimax/run-task.sh T-'])
  .match(/run-task\.sh (T-\d+)/)?.[1];

let line;
if (starting) {
  line = `⏳ ${starting}: arrancando MiniMax…`;
} else if (running) {
  const alive = sh('pgrep', ['-f', `minimax/run-task.sh ${running.id}`]);
  const since = lastEvent(running, 'estado → en_curso')?.at ?? running.updated;
  line = alive
    ? `⏳ ${running.id}: MiniMax trabajando (intento ${running.attempts}, ${minutesSince(since)} min) · /clear no lo corta, pero la tarea sigue abierta`
    : `⚠ ${running.id} en curso sin run-task.sh (¿OpenCode a mano o se cortó?) · /avanzar lo resuelve`;
} else if (review) {
  line = `🔎 ${review.id}: lista para revisión · espera a que Claude la apruebe o la devuelva`;
} else if (returned) {
  line = `↩ ${returned.id}: devuelta con correcciones (intento ${returned.attempts}) · Claude la relanza`;
} else {
  const done = tasks.filter(t => t.status === 'hecha')
    .sort((a, b) => (a.updated < b.updated ? 1 : -1))[0];
  const commit = done ? sh('git', ['log', '-1', '--format=%h', `--grep=^${done.id}:`]) : '';
  const next = pending[0] ? ` y /avanzar para ${pending[0].id}` : '';
  line = done
    ? `✓ ${done.id} hecha${commit ? ` (${commit})` : ''} · puedes hacer /clear${next}`
    : `${pending.length} tareas pendientes · /avanzar para empezar`;
}
console.log(line);
