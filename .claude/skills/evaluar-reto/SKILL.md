---
name: evaluar-reto
description: Cómo evalúa MiniMax el reto de cada tarea de la cola (dificultad, delicadeza y motivo) para STATUS.md. La usa tools/minimax/evaluar.sh, que la incluye entera en el mensaje al evaluador; Claude la consulta para revisar o corregir evaluaciones.
---

# Evaluar el reto de una tarea

Lo que escribes aparece en `STATUS.md`, en GitHub. Lo lee el **usuario,
que no es programador del día a día**: quiere saber de un vistazo si
MiniMax está con algo fácil o con algo difícil y delicado. No
implementas nada ni editas ningún fichero.

Por cada tarea das tres cosas: **dificultad**, **delicadeza** y
**motivo**. Son dos preguntas distintas; no las mezcles.

## 1. Dificultad: ¿cuánto le va a costar a MiniMax hacerlo bien?

Mira solo el trabajo, no lo importante que sea el tema.

| Nivel | Cuándo | Ejemplos de este proyecto |
|---|---|---|
| `fácil` | 1–2 ficheros, los pasos vienen dados, la prueba es directa | Endurecer un `it` de una E2E; sustituir literales por una constante que ya existe; borrar un fichero que nadie importa y apuntar su prueba al bueno |
| `media` | 3–4 ficheros, o una E2E nueva, o mover código sin cambiar su comportamiento, o una lógica corta con casos borde | Sacar funciones a otro módulo; un helper de prueba compartido; guardar la tarea vecina para deshacer en orden; añadir un campo a la copia de seguridad |
| `difícil` | Código asíncrono o concurrente (Rust async, carreras), un diseño que la tarea no da hecho, una prueba que exige simular el sistema o montar algo que no sale solo, o la tarea ya ha vuelto 2+ veces del revisor | Limpiar respuestas pendientes del MCP con Drop/timeout; serializar dos arranques del servidor |

Señales para subir un nivel: ya lleva 2 o más intentos o devoluciones;
la tarea pide ver la prueba en rojo en una E2E (más lenta y frágil);
toca algo que otra tarea está cambiando a la vez.

Señales para bajar: la tarea trae los pasos numerados con ficheros y
líneas, y solo hay que seguirlos.

## 2. Delicadeza: si el cambio está mal y se cuela, ¿qué le pasa al usuario?

Juzga **el daño que haría este cambio concreto si fuera erróneo**, no
lo importante que sea la zona que protege. Una tarea que solo añade o
corrige pruebas no puede romper la app: su delicadeza es `baja`, aunque
lo que pruebe sean los datos del usuario.

| Nivel | Qué pasaría si se cuela un error | Ejemplos |
|---|---|---|
| `baja` | Nada visible: falla una prueba, sobra un comentario, queda código muerto | Solo tests; borrar código que nadie usa; constantes sin cambio de comportamiento |
| `media` | Algo se ve o funciona mal en una parte de la app, pero no se pierde nada y se arregla con otra tarea | Accesibilidad de un diálogo; estilos de una vista; mover código de Ajustes; validar argumentos que hoy ya valida el frontend |
| `alta` | Se pierden o estropean datos del usuario (tareas, marcas, copias de seguridad); un agujero de seguridad; un texto legal falso; la app no arranca; o se rompe el aspecto de toda la app a la vez | Leer o guardar las tareas; deshacer borrados; el formato de la copia de seguridad; PRIVACY.md; el servidor MCP abierto a otros programas |

## 3. Motivo: una o dos frases para el usuario

- **Español claro, sin una sola palabra en otro idioma ni en otro
  alfabeto.** Nada de «guard», «Drop», «async», «helper», «spec»,
  «assert»: di «una comprobación», «el servidor de asistentes», «una
  prueba de la app»… Los nombres de ficheros y de tareas sí se pueden
  citar entre comillas invertidas, pero el motivo tiene que entenderse
  sin ellos.
- **220 caracteres o menos** (con más de 260 la línea se rechaza y se
  vuelve a pedir). Primero qué cambia para el usuario o para la app,
  luego qué es lo difícil o lo arriesgado.
- No repitas el título ni cuentes los pasos: di el **porqué** de la
  dificultad y de la delicadeza.
- No inventes números ni datos que no estén en la tarea.

Bien:

```
RETO: T-097 | media | alta | Al deshacer varios borrados, cada tarea vuelve junto a su vecina. Es poco código, pero un fallo desordena la lista de tareas del usuario.
RETO: T-094 | fácil | baja | Solo añade una prueba que avisa si una tarea se marca dos veces como hecha; si la prueba estuviera mal, la app no cambia.
```

Mal (y por qué):

- `T-094 | fácil | alta | …protege los datos del usuario…` → la tarea
  solo añade una prueba: delicadeza `baja`.
- `…una mejora de算法 de reordenación…` → otro alfabeto.
- `…con un guard de limpieza en Rust async…` → jerga en inglés; di
  «una limpieza automática en el servidor de asistentes».
- `…un fallo alters los contrastes…`, `…mislead al usuario…` → verbos
  en inglés colados en mitad de la frase. **Antes de dar cada línea,
  reléela palabra por palabra**: si una palabra no es español, cámbiala
  («cambiaría», «engañaría»).

## Formato de la respuesta (obligatorio)

Una línea por tarea, en el mismo orden en que se te pasan:

```
RETO: <id> | <fácil|media|difícil> | <baja|media|alta> | <motivo>
```

Sin el carácter `|` dentro del motivo. Puedes razonar antes, pero solo
se leen las líneas que empiezan por `RETO:`; una línea mal formada se
descarta y la tarea se vuelve a pedir.
