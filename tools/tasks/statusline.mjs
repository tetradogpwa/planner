#!/usr/bin/env node
// Línea de estado de Claude Code (ver "statusLine" en .claude/settings.json).
// Dice si la cola autónoma de MiniMax (tools/cola.sh) está trabajando y en
// qué, y, si está parada con tareas abiertas (por ejemplo tras reiniciar
// el PC), cómo retomarla. Lee solo .tasks/tasks.json, git y la lista de
// procesos; no escribe nada.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sh(cmd, args) {
  try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

let tasks = [];
try { tasks = JSON.parse(readFileSync(join(ROOT, '.tasks', 'tasks.json'), 'utf8')).tasks; }
catch { console.log('Cola de tareas ilegible'); process.exit(0); }

const abiertas = tasks.filter(t => ['pendiente', 'en_curso', 'en_revision'].includes(t.status));
const hechas   = tasks.filter(t => t.status === 'hecha').length;
const colaViva = sh('pgrep', ['-f', '^bash tools/cola.sh']) !== '';

// Qué está haciendo ahora: el revisor o el trabajador, y con qué tarea.
const revisando = sh('pgrep', ['-af', 'minimax/revisar.sh T-']).match(/revisar\.sh (T-\d+)/)?.[1];
const trabajando = sh('pgrep', ['-af', 'minimax/run-task.sh T-']).match(/run-task\.sh (T-\d+)/)?.[1];
const probando = sh('pgrep', ['-f', 'tools/test.sh']) !== '';

// cola.sh deja aquí hasta cuándo espera si MiniMax se ha quedado sin cuota.
let esperaHasta = '';
try { esperaHasta = readFileSync(join(ROOT, '.tasks', 'logs', 'espera-saldo'), 'utf8').trim(); } catch { /* no hay espera: el fichero no existe */ }

let line;
if (colaViva && esperaHasta && !trabajando && !revisando) {
  line = `⏸ MiniMax sin cuota · la cola sigue sola a las ${esperaHasta.slice(11) || esperaHasta} · ${abiertas.length} abiertas`;
} else if (colaViva) {
  const ahora = revisando ? `M3 revisa ${revisando}`
    : trabajando ? `Flash desarrolla ${trabajando}`
    : probando ? 'pasando pruebas antes del commit'
    : 'entre pasos';
  line = `▶ Cola en marcha · ${ahora} · ${abiertas.length} abiertas, ${hechas} hechas`;
} else if (abiertas.length) {
  line = `⏸ Cola parada con ${abiertas.length} tareas abiertas · bash tools/continuar.sh (o /avanzar)`;
} else {
  const ultimo = sh('git', ['log', '-1', '--format=%h %s', '--grep=^T-']);
  line = `✓ Cola vacía${ultimo ? ` · último: ${ultimo}` : ''} · dale más tareas a Claude`;
}
console.log(line);
