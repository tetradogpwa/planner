# Instrucciones para MiniMax (OpenCode)

OpenCode solo carga este archivo. Las convenciones del proyecto
(estructura, accesibilidad, comprobaciones) están en `CLAUDE.md`:
léelo antes de tocar código.

Eres el desarrollador del Planificador Semanal. Lo que tienes que hacer
está en la cola de tareas que mantiene el supervisor (Claude). No
inventes tareas ni busques "pendientes" en el código.

## Si el usuario te pide "la siguiente tarea", "sigue", "trabaja" o similar

1. Ejecuta `node tools/tasks/tasks.mjs empezar`. Te devuelve tus reglas
   de trabajo y la tarea completa (petición, contexto técnico y
   criterios de aceptación), y la marca como en curso.
   - Si te pide una tarea concreta: `node tools/tasks/tasks.mjs empezar T-00X`.
   - Si dice que ya hay una en curso, continúa con esa.
   - Si dice que no hay tareas pendientes, díselo al usuario y para.
2. Implementa la tarea siguiendo esas reglas y esos criterios.
3. Antes de entregar, ejecuta `bash tools/test.sh` (unitarias y E2E
   contra la app real) y deja todo en ✓; las reglas de las pruebas
   vienen en tus instrucciones de trabajo.
4. Al acabar, ejecuta `node tools/tasks/tasks.mjs terminar T-00X` y
   escribe el resumen final. Claude la revisará.

Para consultar sin empezar nada: `node tools/tasks/tasks.mjs list` (tareas
abiertas) y `node tools/tasks/tasks.mjs show T-00X` (detalle).

## Si el mensaje ya trae la tarea completa ("Tarea T-00X: …")

Te ha lanzado `tools/minimax/run-task.sh`: no ejecutes `empezar` ni
`terminar` (el script ya lo hace). Trabaja directamente en esa tarea.

## Siempre

- Una sola tarea cada vez. No empieces otra hasta haber ejecutado
  `terminar` de la actual.
- No edites `.tasks/` a mano: solo con las órdenes de arriba.
- Las pruebas, siempre con `bash tools/test.sh` (o `/test`); nunca
  `wdio` a pelo, que abre la ventana en el escritorio del usuario y
  usa sus datos reales.
