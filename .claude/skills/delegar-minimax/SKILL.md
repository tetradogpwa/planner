---
name: delegar-minimax
description: Envía la siguiente tarea pendiente de la cola a MiniMax para que la implemente y espera a que termine. Úsala después de registrar tareas, cuando el usuario pida avanzar con la cola o tras devolver una tarea con correcciones. Una sola tarea a la vez.
---

# Delegar una tarea a MiniMax

MiniMax implementa; tú supervisas. Se ejecuta con
`tools/minimax/run-task.sh`, que lanza `opencode run` con el agente
`planner-worker` (definido en `opencode.json`, con sus permisos) y el
modelo de MiniMax. La clave la guarda OpenCode, no el proyecto.

## 1. Comprobar la configuración (la primera vez de cada sesión)

```bash
bash tools/minimax/run-task.sh --check
```

Si falla, sigue las indicaciones que imprime: el modelo no está
disponible (ajusta `MINIMAX_MODEL` en `.env` con uno de la lista) o
MiniMax no está conectado en OpenCode (el usuario debe ejecutar
`opencode auth login`). Nunca le pidas la clave en el chat ni la escribas
en ningún archivo. `--ping` hace una llamada real mínima si necesitas
confirmar que responde.

## 2. Elegir la tarea

```bash
node tools/tasks/tasks.mjs busy || echo "ocupado"   # ¿hay una en curso?
node tools/tasks/tasks.mjs next                     # primera pendiente
node tools/tasks/tasks.mjs show T-00X
```

- Si hay una en curso, no lances otra: espera a que termine.
- Antes de lanzarla, revisa que tenga criterios de aceptación claros. Si
  no los tiene, añádelos con `amend --criterio`. MiniMax solo sabe lo que
  dice la tarea.

## 3. Lanzar

Ejecuta con la herramienta Bash en segundo plano (`run_in_background`),
porque puede tardar varios minutos:

```bash
bash tools/minimax/run-task.sh T-00X
```

El script hace una foto del árbol de archivos, pone la tarea en
`en_curso`, ejecuta MiniMax y, al acabar, la deja en `en_revision` (o en
`pendiente` si falló). El registro completo queda en
`.tasks/logs/T-00X-<fecha>.log`.

Dile al usuario en una línea que MiniMax está con T-00X. No esperes
activamente: recibirás una notificación al terminar.

## 4. Al terminar

- **Código 0:** sigue con la skill `revisar-tarea`.
- **Fallo:** lee el final del registro.
  - Autenticación o proveedor (`ProviderAuthError`, `APIError`, 401):
    MiniMax no está bien conectado en OpenCode. Avisa al usuario
    (`opencode auth login`).
  - Modelo desconocido: revisa `MINIMAX_MODEL` con `--check`.
  - "Permission denied" repetido en algo que la tarea necesita: revisa
    los permisos de `planner-worker` en `opencode.json` antes de
    reintentar.
  - Tiempo agotado (124): divide la tarea en partes más pequeñas.
  - Otro error: reintenta una vez. Si se repite, informa al usuario.
