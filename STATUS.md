# Estado de MiniMax

> Lo genera `tools/tasks/tasks.mjs estado-md` a partir de la cola
> (`.tasks/tasks.json`) y lo publica `tools/cola.sh`. La evaluación
> de cada tarea (dificultad y delicadeza) la hace MiniMax con
> `tools/minimax/evaluar.sh`. No lo edites a mano: se sobrescribe.

Actualizado: 2026-11-25 15:52 UTC

## Ahora

**T-063 · Aislar el CSS de cada tarjeta**

- Estado: Siguiente en la cola · intentos: 2 · devoluciones del revisor: 2
- Dificultad: 🔴 difícil · Delicadeza: 🔴 alta
- Reto: Aísla el CSS de tarjetas que hoy se inyectan en global y colisionan entre sí (interruptor «Gestionar» que cambia de aspecto), tocando muchas hojas de estilo a la vez; ya lleva 2 intentos y el revisor ha pedido correcciones, así que es más fragilidad de la que aparenta y cualquier error afecta al aspecto de toda la app.

## Resumen

- Abiertas: 31 (0 sin evaluar)
- Dificultad: 🟢 8 fácil · 🟡 17 media · 🔴 6 difícil
- Delicadeza: 🟢 4 baja · 🟡 15 media · 🔴 12 alta

**Dificultad**: cuánto trabajo y riesgo de equivocarse tiene la tarea.
**Delicadeza**: cuánto daño haría un error que se colara (datos del
usuario, seguridad, textos legales, lo que ve todo el mundo).

## Cola

| Tarea | Estado | Dificultad | Delicadeza | Intentos | Título |
|---|---|---|---|---|---|
| T-063 | Pendiente | 🔴 difícil | 🔴 alta | 2 | Aislar el CSS de cada tarjeta |
| T-069 | Pendiente | 🟢 fácil | 🟢 baja | 0 | 08-mcp: «el puerto se cierra» exige que la app diga que paró |
| T-070 | Pendiente | 🟢 fácil | 🟢 baja | 0 | 11-edicion-gratuita: un fetch fallido no prueba que un documento no se distribuye |
| T-071 | Pendiente | 🟡 media | 🟡 media | 0 | 12-legal: el aviso del navegador se comprueba con contraste WCAG real |
| T-072 | Pendiente | 🟡 media | 🟡 media | 0 | theme-boot.js: en tema automático seguir al sistema, no al esquema guardado |
| T-073 | Pendiente | 🟡 media | 🟡 media | 0 | Sacar la matemática de color de preferences.js a back/color.js |
| T-074 | Pendiente | 🟡 media | 🟡 media | 0 | Sacar los temas guardados de preferences.js a ui/settings/savedThemes.js |
| T-075 | Pendiente | 🟡 media | 🟡 media | 0 | Sacar el panel de contraste y la lista de temas guardados de settings-card.js |
| T-076 | Pendiente | 🟡 media | 🟡 media | 0 | Borrar las funciones y la carpeta que nadie usa |
| T-077 | Pendiente | 🟡 media | 🔴 alta | 0 | Borrar el service worker desactivado (sw.js) |
| T-078 | Pendiente | 🟢 fácil | 🟢 baja | 0 | Un solo sitio para el prefijo 'saved:' y para el puerto MCP 41237 |
| T-079 | Pendiente | 🟡 media | 🔴 alta | 0 | MCP en Rust: ningún .lock().unwrap() (mutex envenenado) |
| T-080 | Pendiente | 🔴 difícil | 🔴 alta | 0 | MCP en Rust: una llamada cancelada o caducada no deja entradas en pending |
| T-081 | Pendiente | 🔴 difícil | 🔴 alta | 0 | MCP en Rust: puerto válido y sin dos arranques a la vez |
| T-082 | Pendiente | 🟡 media | 🔴 alta | 0 | MCP en Rust: validar índice, vista y spec antes de llamar al frontend |
| T-083 | Pendiente | 🟢 fácil | 🟡 media | 0 | El servidor MCP se arranca desde un solo sitio del frontend |
| T-084 | Pendiente | 🟡 media | 🔴 alta | 0 | PRIVACY.md y DATA_SAFETY.md: las dos ediciones y los datos locales |
| T-085 | Pendiente | 🟢 fácil | 🟡 media | 0 | THIRD_PARTY_LICENSES.md sin ficheros que no existen, con prueba |
| T-086 | Pendiente | 🟡 media | 🟡 media | 0 | La pantalla de términos atrapa el foco y bloquea la app de detrás |
| T-087 | Pendiente | 🟡 media | 🟡 media | 0 | La pantalla de consentimiento atrapa el foco |
| T-088 | Pendiente | 🟢 fácil | 🟡 media | 0 | El modal legal es un diálogo accesible |
| T-089 | Pendiente | 🟡 media | 🟡 media | 0 | Cada pestaña de términos controla su propio panel |
| T-090 | Pendiente | 🟡 media | 🟡 media | 0 | Emojis decorativos con aria-hidden |
| T-091 | Pendiente | 🟡 media | 🟡 media | 0 | Cada campo con su label for y fuera la nota vieja de ui/week |
| T-092 | Pendiente | 🟢 fácil | 🟢 baja | 0 | Borrar ui/escape.js: un solo escapado de HTML |
| T-093 | Pendiente | 🟡 media | 🟡 media | 0 | El progreso de cada día no es una región role=status |
| T-094 | Pendiente | 🟢 fácil | 🔴 alta | 0 | Prueba: marcar dos veces la misma aparición no la duplica |
| T-095 | Pendiente | 🔴 difícil | 🔴 alta | 0 | Si las tareas guardadas no se pueden leer, no se pierden al editar |
| T-096 | Pendiente | 🟡 media | 🔴 alta | 0 | Deshacer «Borrar todo» no borra las tareas creadas después |
| T-097 | Pendiente | 🔴 difícil | 🔴 alta | 0 | Deshacer varios borrados en otro orden deja cada tarea en su sitio |
| T-098 | Pendiente | 🔴 difícil | 🔴 alta | 0 | La copia de seguridad incluye los temas guardados |

## El reto de cada tarea

### T-063 · Aislar el CSS de cada tarjeta

🔴 difícil · delicadeza 🔴 alta

Aísla el CSS de tarjetas que hoy se inyectan en global y colisionan entre sí (interruptor «Gestionar» que cambia de aspecto), tocando muchas hojas de estilo a la vez; ya lleva 2 intentos y el revisor ha pedido correcciones, así que es más fragilidad de la que aparenta y cualquier error afecta al aspecto de toda la app.

### T-069 · 08-mcp: «el puerto se cierra» exige que la app diga que paró

🟢 fácil · delicadeza 🟢 baja

Solo endurece un `it` de la E2E 08-mcp para que exija que el servidor diga que paró en vez de conformarse con cualquier fetch fallido; es un cambio acotado en un fichero de pruebas y no toca la app.

### T-070 · 11-edicion-gratuita: un fetch fallido no prueba que un documento no se distribuye

🟢 fácil · delicadeza 🟢 baja

Corrige el manejo de errores de un `it` de la E2E 11-edicion-gratuita para que un fetch roto haga fallar la prueba y añada un control positivo; todo cabe en un solo fichero de pruebas.

### T-071 · 12-legal: el aviso del navegador se comprueba con contraste WCAG real

🟡 media · delicadeza 🟡 media

Mueve el cálculo de contraste WCAG a un helper compartido y rehace la aserción del aviso legal en claro y oscuro; toca tres ficheros de pruebas y hay que encajar los temas, aunque no cambia datos ni el comportamiento de la app.

### T-072 · theme-boot.js: en tema automático seguir al sistema, no al esquema guardado

🟡 media · delicadeza 🟡 media

Corrige la resolución del tema en el arranque para que «automático» siga al sistema y añade pruebas unitarias ejecutando el script con dobles; afecta al primer pintado de la app y es fácil que el parpadeo persists o la prueba quede engañosa.

### T-073 · Sacar la matemática de color de preferences.js a back/color.js

🟡 media · delicadeza 🟡 media

Extrae unas 150 líneas de matemática de color de `preferences.js` a un módulo nuevo en `back/` que no puede tocar el DOM; es un traspaso mecánico con riesgo de romper imports de tres ficheros que ya lo consumen.

### T-074 · Sacar los temas guardados de preferences.js a ui/settings/savedThemes.js

🟡 media · delicadeza 🟡 media

Saca los temas guardados a su propio módulo dejando un import circular entre `preferences.js` y el nuevo fichero; el movimiento es mecánico pero el ciclo de imports puede fallar en carga y romper el guardado de temas del usuario.

### T-075 · Sacar el panel de contraste y la lista de temas guardados de settings-card.js

🟡 media · delicadeza 🟡 media

Parte `settings-card.js` (543 líneas) en tres ficheros manteniendo ids, clases y textos idénticos; no cambia el comportamiento, pero cualquier error de escapado o de HTML duplicado se ve en pantalla y rompe las E2E de apariencia y ajustes.

### T-076 · Borrar las funciones y la carpeta que nadie usa

🟡 media · delicadeza 🟡 media

Borra código muerto en varios sitios (carpeta `ui/taskManager/taskItem/`, funciones de calendario y de contexto) y sus pruebas; el riesgo está en borrar algo que sí se usara en una ruta poco transitada, como la carpeta `ui/week/taskItem/`, que se parece mucho.

### T-077 · Borrar el service worker desactivado (sw.js)

🟡 media · delicadeza 🔴 alta

Borra el service worker desactivado y todas sus referencias en `index.js`, `build.rs` y una prueba; tocar el empaquetado de assets puede dejar ficheros fuera de la app compilada o romper el arranque, aunque el service worker esté apagado.

### T-078 · Un solo sitio para el prefijo 'saved:' y para el puerto MCP 41237

🟢 fácil · delicadeza 🟢 baja

Sustituye literales repetidos ('saved:' y el puerto 41237) por las constantes que ya existen, en cuatro ficheros; es un cambio mecánico sin efecto en el comportamiento.

### T-079 · MCP en Rust: ningún .lock().unwrap() (mutex envenenado)

🟡 media · delicadeza 🔴 alta

Cambia 22 `.lock().unwrap()` del servidor MCP por un helper que no aborta la app con `panic = "abort"`; toca código nativo del servidor, y una mutex envenenada mal resuelta puede tumbar la app o dejar el servidor MCP colgado.

### T-080 · MCP en Rust: una llamada cancelada o caducada no deja entradas en pending

🔴 difícil · delicadeza 🔴 alta

Rediseña la gestión de respuestas pendientes del MCP con un guard de limpieza en Rust async, para que una llamada cancelada no deje entradas colgadas; es el punto más delicado (async,Drop, temporizadores) y un fallo deja el servidor MCP bloqueado o sin responder.

### T-081 · MCP en Rust: puerto válido y sin dos arranques a la vez

🔴 difícil · delicadeza 🔴 alta

Valida el puerto y serializa el arranque y la parada del MCP con un mutex asíncrono en Rust; el arranque tiene `await` en medio y es fácil que dos arranques se pisen, dejando el servidor en un estado inconsistente.

### T-082 · MCP en Rust: validar índice, vista y spec antes de llamar al frontend

🟡 media · delicadeza 🔴 alta

Añade validación de índice, vista y spec en el servidor MCP antes de reenviar al frontend, con mensajes en español; es código de puerta de entrada del servidor MCP y los mensajes de error son visibles para el usuario y para el cliente.

### T-083 · El servidor MCP se arranca desde un solo sitio del frontend

🟢 fácil · delicadeza 🟡 media

Centraliza el arranque del servidor MCP en una función compartida entre `index.js` y `mcp-card.js` con su prueba unitaria; el cambio es pequeño pero toca el arranque automático del servidor al abrir la app.

### T-084 · PRIVACY.md y DATA_SAFETY.md: las dos ediciones y los datos locales

🟡 media · delicadeza 🔴 alta

Reescribe PRIVACY.md y DATA_SAFETY.md para describir las dos ediciones (con y sin anuncios) y todos los datos locales, incluidos temas guardados y copias de seguridad; son textos legales que deben ser exactos y no se puede tocar TERMS.md ni EULA.md.

### T-085 · THIRD_PARTY_LICENSES.md sin ficheros que no existen, con prueba

🟢 fácil · delicadeza 🟡 media

Corrige una referencia a un fichero de licencia que no existe y añade una prueba que recorre `legal/*.md` comprobando que cada ruta citada existe; el texto legal es delicado pero el cambio es pequeño y acotado.

### T-086 · La pantalla de términos atrapa el foco y bloquea la app de detrás

🟡 media · delicadeza 🟡 media

La pantalla de términos atrapa el foco y bloquea la app detrás, con una E2E nueva que hay que montar; es un cambio de comportamiento visible en la pantalla de arranque, y la prueba de foco en E2E es propensa a ser intermitente.

### T-087 · La pantalla de consentimiento atrapa el foco

🟡 media · delicadeza 🟡 media

Lo mismo para el gate de consentimiento, pero el panel no sale solo en la build de pruebas y hay que montarlo a mano dentro de la E2E; la prueba es la parte más delicada porque depende de montar el diálogo a mano.

### T-088 · El modal legal es un diálogo accesible

🟢 fácil · delicadeza 🟡 media

Añade `role="dialog"`, `aria-modal` y `aria-labelledby` al modal legal y un `it` nuevo que comprueba los atributos y que el foco no sale; es un cambio de atributos en el HTML más una prueba.

### T-089 · Cada pestaña de términos controla su propio panel

🟡 media · delicadeza 🟡 media

Cada pestaña de términos pasa a controlar su propio panel (tres paneles con id propio, ocultos los demás) y hay que repintar el documento en el visible; toca la pantalla de términos y el CSS, con riesgo de que una pestaña se quede con el texto anterior.

### T-090 · Emojis decorativos con aria-hidden

🟡 media · delicadeza 🟡 media

Marca como decorativos una Celebrity dozen de emojis repartidos por varias tarjetas y crea una prueba que recorra todos los HTML; el riesgo está en los mensajes de estado hechos con `textContent`, donde hay que cambiar a nodos sin meter HTML del usuario.

### T-091 · Cada campo con su label for y fuera la nota vieja de ui/week

🟡 media · delicadeza 🟡 media

Da `for`/`id` a una decena de labels sin `for` en cinco HTML y borra una nota vieja, con una prueba que valida que cada label apunta a un id real; hay que evitar ids repetidos porque el formulario de tarea se monta dos veces, y choca con el trabajo en curso de T-063.

### T-092 · Borrar ui/escape.js: un solo escapado de HTML

🟢 fácil · delicadeza 🟢 baja · sigue a T-061

Borra `ui/escape.js`, que es una copia sin usar de `ui/html.js`, y apunta su prueba al módulo bueno; toca un fichero y una prueba, con el único detalle de que los dos escapados no coinciden exactamente.

### T-093 · El progreso de cada día no es una región role=status

🟡 media · delicadeza 🟡 media · sigue a T-050

Quita `role="status"` de 84.progress elements y anuncia el cambio en la región global `#plannerStatus` al marcar; cambia lo que el lector de pantalla anuncia en la vista semanal, y hay que acertar con el texto para que la E2E lo compruebe.

### T-094 · Prueba: marcar dos veces la misma aparición no la duplica

🟢 fácil · delicadeza 🔴 alta · sigue a T-050

Añade una prueba que detecte marcas de «hecho» duplicadas; la prueba es fácil, pero lo que protege son los datos del usuario (marcas), así que una regresión en esa comprobación dejaría marcas corruptas sin que nadie se entere.

### T-095 · Si las tareas guardadas no se pueden leer, no se pierden al editar

🔴 difícil · delicadeza 🔴 alta · sigue a T-045

Guarda una copia del texto original de las tareas si la lectura falla al arrancar, avisa al usuario y añade una prueba que arranca la app en un proceso hijo; toca el arranque de la app y la persistencia de las tareas del usuario, que es justo lo que se puede perder.

### T-096 · Deshacer «Borrar todo» no borra las tareas creadas después

🟡 media · delicadeza 🔴 alta · sigue a T-053

Corrige el deshacer de «Borrar todo» para que no borre tareas creadas después y evita ids duplicados al restaurar una tarea; toca la lista de tareas del usuario y una prueba nueva, con riesgo de que una tarea desaparezca o aparezca dos veces.

### T-097 · Deshacer varios borrados en otro orden deja cada tarea en su sitio

🔴 difícil · delicadeza 🔴 alta · sigue a T-053

Guarda en la foto de cada tarea sus vecinas para devolverla a su sitio cuando se deshacen varios borrados en cualquier orden; es una mejora de算法 de reordenación con casos límite, y un error deja las tareas del usuario en un orden que no cuadra con lo que el usuario recuerda.

### T-098 · La copia de seguridad incluye los temas guardados

🔴 difícil · delicadeza 🔴 alta · sigue a T-054

La copia de seguridad pasa a incluir los temas guardados, el tema activo y los automáticos, con prueba unitaria y E2E de exportar, borrar datos e importar; toca el formato del archivo de respaldo, que si se rompe deja al usuario sin poder recuperar sus temas.

## Últimas terminadas

- T-060 · Pruebas de context.js, ui/a11y.js y preferences.js (2026-11-25, 4 intentos)
- T-062 · Una base común para las tarjetas: errores visibles y plantillas en caché (2026-11-25, 4 intentos)
- T-061 · Un solo escapado de HTML y el Markdown legal con pruebas (2026-11-25, 1 intento)
- T-059 · Toda navegación de las E2E espera al pintado y sin esperas fijas (2026-11-25, 4 intentos)
- T-057 · Textos y nombres coherentes en la interfaz (2026-11-25, 3 intentos)
