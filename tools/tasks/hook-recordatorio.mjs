#!/usr/bin/env node
// Hook UserPromptSubmit (ver .claude/settings.json). Recuerda al
// supervisor que registre cada petición como tarea y le pasa las tareas
// abiertas para decidir entre crear una nueva o modificar una existente.
// No hace nada en las sesiones de MiniMax (PLANNER_ROLE=worker).

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.PLANNER_ROLE === 'worker') process.exit(0);

const STORE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.tasks', 'tasks.json');
const OPEN = ['pendiente', 'en_curso', 'en_revision'];

let open = [];
try {
  if (existsSync(STORE)) {
    open = JSON.parse(readFileSync(STORE, 'utf8')).tasks.filter(t => OPEN.includes(t.status));
  }
} catch { /* almacén ilegible: se recuerda igualmente el flujo */ }

const list = open.length
  ? open.map(t => `- ${t.id} [${t.status}] ${t.title}`).join('\n')
  : '- (ninguna)';

const context = [
  'Flujo de trabajo con MiniMax (skill registrar-tarea):',
  'si este mensaje pide un cambio en la aplicación (funcionalidad, corrección, ajuste de diseño o texto),',
  'regístralo como tarea antes de nada con node tools/tasks/tasks.mjs. Si modifica o amplía una tarea',
  'abierta, usa "amend" sobre esa tarea en vez de crear otra. Si es una pregunta o habla del propio flujo,',
  'no crees tarea.',
  'Tareas abiertas:',
  list,
].join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
}));
