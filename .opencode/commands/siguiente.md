---
description: Empieza la siguiente tarea de la cola (o la que indiques, p. ej. /siguiente T-010)
agent: planner-worker
---
Esta es la tarea que te toca, con tus reglas de trabajo (ya está marcada como en curso; no ejecutes `empezar` otra vez):

!`node tools/tasks/tasks.mjs empezar $ARGUMENTS`

Si arriba dice que no hay tareas pendientes, díselo al usuario y no hagas nada más. Si no, impleméntala ahora y, al terminar, ejecuta `node tools/tasks/tasks.mjs terminar` con su identificador y escribe el resumen final.
