---
name: registrar-tarea
description: Registra cada petición de cambio del usuario como tarea en la cola (.tasks) antes de hacer nada más. Úsala siempre que el usuario pida una funcionalidad, corrección o ajuste de la app, y también cuando cambie o amplíe algo pedido antes. Si la petición modifica una tarea aún no hecha, actualiza esa tarea en vez de crear otra. No la uses para preguntas ni para hablar del propio flujo de trabajo.
---

# Registrar una petición como tarea

Todo lo que el usuario pide cambiar en la aplicación pasa por la cola de
tareas. Tú (Claude) eres el supervisor: registras, delegas a MiniMax y
revisas. No implementes tú la petición salvo que el usuario lo pida
expresamente o MiniMax haya fallado tres veces en la misma tarea.

## 1. ¿Es una petición de cambio?

- **Sí:** nueva funcionalidad, corrección de un fallo, cambio de diseño,
  textos, textos legales, configuración de la build.
- **No:** preguntas ("¿cómo funciona…?"), peticiones de revisión o de
  explicación, órdenes sobre el propio flujo ("delega la siguiente",
  "¿cómo va T-003?"). En ese caso no crees tarea.

Si un mensaje mezcla varias peticiones independientes, crea una tarea por
cada una.

## 2. ¿Nueva o modificación de una existente?

```bash
node tools/tasks/tasks.mjs list          # abiertas
node tools/tasks/tasks.mjs list --todas  # incluye hechas y canceladas
```

| Situación | Acción |
|-----------|--------|
| Cambia, amplía o corrige algo de una tarea **abierta** (pendiente, en curso, en revisión) | `amend` sobre esa tarea |
| Toca algo de una tarea **hecha** | `add` nueva con `--relacionada T-00X` |
| Tema nuevo | `add` |
| No está claro a qué tarea se refiere | Pregunta al usuario antes de registrar |

## 3. Registrar

```bash
node tools/tasks/tasks.mjs add \
  --title "Verbo + objeto, corto" \
  --request "Las palabras del usuario, casi literales" \
  --criterio "Comprobación verificable 1" \
  --criterio "Comprobación verificable 2" \
  --nota "Contexto técnico: causa medida, archivos y líneas, funciones a usar"

node tools/tasks/tasks.mjs amend T-004 --request "Lo nuevo que pide" [--criterio "…"]
```

- `--request`: lo que pidió el usuario, sin reinterpretarlo.
- `--nota`: lo que has averiguado tú (causa, archivos y líneas, API disponible, dependencias con otras tareas). Cuanto más concreto, menos intentos necesita MiniMax.
- `--criterio`: cómo sabrás en la revisión que está bien. Concretos y
  comprobables ("el botón Borrar pide confirmación", no "funciona bien").
  En cambios de interfaz añade siempre:
  - "Cumple las convenciones de accesibilidad de CLAUDE.md (tokens de
    color, rem con --fs-*, contraste AA en tema claro y oscuro)".
  - "No se sale de la pantalla con letra al 200 % en móvil".
- Si `amend` falla porque la tarea ya está hecha, la herramienta te dice
  cómo crear la relacionada: hazlo.
- Si haces `amend` sobre una tarea **en curso**, MiniMax no verá el
  cambio hasta el siguiente intento: compruébalo en la revisión y, si
  falta, devuélvela con `feedback`.

## 4. Contestar al usuario

Una línea por tarea: "Registrada T-005: …" o "Añadido a T-003 (aún
pendiente): …". Después, si no hay otra tarea en curso, continúa con la
skill `delegar-minimax`, salvo que el usuario haya dicho que solo
registres.
