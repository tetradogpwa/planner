---
name: avanzar
description: Retoma el ciclo de trabajo con MiniMax a partir del estado de la cola (.tasks), sin depender de la conversación anterior. Úsala cuando el usuario escriba /avanzar [T-00X], diga "sigue", "continúa" o "siguiente tarea", al empezar una sesión nueva o después de /clear, y cuando llegue el aviso de que ha terminado run-task.sh y no recuerdes el contexto.
---

# Avanzar el ciclo de una tarea

El usuario hace `/clear` al terminar cada tarea, así que **la
conversación no guarda nada**: todo el estado está en
`.tasks/tasks.json` (estado, intentos, correcciones, notas, fotos del
árbol) y en `.tasks/logs/`. Esta skill lee ese estado y da el siguiente
paso. Repítela hasta que la tarea quede **hecha y con commit**, sin
pedir confirmación al usuario entre pasos.

## 1. Ver dónde estamos

```bash
node tools/tasks/tasks.mjs list
pgrep -af "run-task.sh T-" || echo "MiniMax parado"
```

Si el usuario nombró una tarea (`/avanzar T-00X`), trabaja con esa. Si
no, elige así:

| Situación en la cola | Qué hacer |
|---|---|
| Una tarea `en_curso` y `run-task.sh` en marcha | MiniMax está trabajando (lanzado desacoplado, sobrevive al `/clear`). Espera con `bash tools/minimax/lanzar.sh T-00X --esperar` en segundo plano y, al acabar, sigue con la fila que toque. |
| Una tarea `en_curso` sin proceso | Se cortó (sesión de OpenCode del usuario o `/clear` que mató el proceso). Mira el último registro (`ls -t .tasks/logs/T-00X-*.log`). Si hay trabajo entregado, pásala a `en_revision` con `status`; si no, a `pendiente` y relánzala. |
| Una tarea `en_revision` | Skill `revisar-tarea`. |
| Una tarea `pendiente` con correcciones (`feedback` en `show`) | Relánzala con `delegar-minimax`: vuelve de una revisión. |
| Solo tareas `pendiente` sin empezar | Lanza la primera (`tasks.mjs next`) con `delegar-minimax`. |
| Ninguna abierta | Díselo al usuario y para. |

Una tarea cada vez: no empieces otra mientras haya una sin cerrar.

## 2. Encadenar hasta cerrarla

- Al terminar `run-task.sh` → `revisar-tarea`.
- Si la devuelves → relánzala en el acto con `delegar-minimax`.
- Con `attempts` ≥ 3 → no la devuelvas más: corrígela tú o consulta al
  usuario (regla de `revisar-tarea`).
- Lo que no hayas podido comprobar en una revisión, anótalo en la tarea
  (`amend T-00X --nota "Supervisor: falta comprobar …"`) para que la
  siguiente revisión lo vea aunque haya habido un `/clear`.

Cuenta en una línea cada paso (lanzada, devuelta y por qué, aprobada).

## 3. Al cerrar la tarea

Cuando la tarea esté `hecha` y con su commit, **para** (no empieces la
siguiente) y termina con:

> T-00X hecha (commit `abc1234`). Puedes hacer `/clear` y escribir
> `/avanzar` para seguir con T-00Y.

Si la tarea queda bloqueada (fallo de MiniMax que no se arregla
reintentando, o una decisión que es del usuario), explica por qué y para.
