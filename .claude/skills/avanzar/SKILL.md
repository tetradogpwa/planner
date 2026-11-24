---
name: avanzar
description: Supervisa el ciclo autónomo de MiniMax (tools/cola.sh) a partir del estado de la cola (.tasks) y de git, sin depender de la conversación anterior. Úsala cuando el usuario escriba /avanzar [T-00X], diga "sigue", "continúa", "cómo va" o "siguiente tarea", al empezar una sesión nueva o después de /clear, y cuando llegue el aviso de que ha terminado cola.sh.
---

# Supervisar el ciclo autónomo

MiniMax trabaja solo: **M3.1 Flash desarrolla** (`run-task.sh`), **M3
revisa** (`revisar.sh`) y `tools/cola.sh` encadena desarrollar → revisar
→ corregir → pruebas → commit en toda la cola. Claude **no** implementa
ni revisa tarea a tarea: vigila, audita lo commiteado y da más tareas.
La conversación no guarda nada; el estado está en `.tasks/`, en
`.tasks/logs/cola-*.log` y en git.

## 1. Ver dónde estamos

```bash
bash tools/continuar.sh --estado
```

Tras reiniciar el PC la cola estará parada: es lo normal.

## 2. Si la cola está parada y hay tareas abiertas, lanzarla

Antes, `git status`: si hay cambios de Claude (herramientas, docs) sin
commitear, commitéalos aparte; `cola.sh` usa `HEAD` como foto y se
colarían en el commit de la tarea. Los cambios de una tarea en curso o en
revisión se dejan: son trabajo de MiniMax.

```bash
bash tools/continuar.sh
```

`/avanzar T-00X` → `bash tools/cola.sh T-00X` (solo esa tarea).

## 3. Auditar lo commiteado desde la última vez

Por cada commit `T-0XX` nuevo: `git show --stat` y una lectura del diff
contra los criterios (`tasks.mjs show T-0XX`) y las convenciones de
`CLAUDE.md` (accesibilidad, colores con variables, pruebas que fallan al
romper el código). Muestreo razonable: profundiza en las tareas de riesgo
(dominio, datos, seguridad, Rust). Si algo aprobado está mal: **no** se
reescribe el commit; se crea una tarea nueva con `--relacionada T-0XX` y
una explicación concreta (fichero:línea, cómo reproducirlo).

## 4. Desatascar lo que la cola no resuelve

| Situación | Qué hacer |
|---|---|
| Tarea `pendiente` que agotó intentos (lo dice el log de la cola) | Leer sus correcciones (`show`); aclarar con `amend --nota "Supervisor: …"`, o partirla en tareas más pequeñas y cancelar la original. Relanzar la cola. |
| Tarea `en_revision` cuya revisión falla ("no dio veredicto") | Mirar `.tasks/logs/T-0XX-revision-*.log`; si es un fallo de herramienta, arreglarlo (commit aparte) y relanzar. |
| Pruebas en rojo en `main` por algo ajeno a la tarea | Tarea nueva urgente para arreglarlo. |

## 5. Informar al usuario

Breve: qué tareas se han cerrado (con commit), qué está en marcha, qué
hallazgos de la auditoría se han convertido en tareas nuevas y si hace
falta alguna decisión suya. Si la cola sigue trabajando, dilo y termina:
no hay que esperar a que acabe.
