# Estado de MiniMax

> Lo genera `tools/tasks/tasks.mjs estado-md` a partir de la cola
> (`.tasks/tasks.json`) y lo publica `tools/cola.sh`. La evaluación
> de cada tarea (dificultad y delicadeza) la hace MiniMax con
> `tools/minimax/evaluar.sh`. No lo edites a mano: se sobrescribe.

Actualizado: 2026-11-28 15:42 UTC

## Ahora

**T-082 · MCP en Rust: validar índice, vista y spec antes de llamar al frontend**

- Estado: Siguiente en la cola · intentos en total: 1 · correcciones recibidas: 1
- Dificultad: 🟡 media · Delicadeza: 🟡 media
- Reto: Rechaza en Rust índices, vistas y tareas mal formadas con mensajes en español, con seis casos de prueba. Si se cuela, el servidor de asistentes acepta o rechaza de más.

## Resumen

- Abiertas: 24 (0 sin evaluar)
- Dificultad: 🟢 7 fácil · 🟡 16 media · 🔴 1 difícil
- Delicadeza: 🟢 4 baja · 🟡 14 media · 🔴 6 alta

**Dificultad**: cuánto trabajo y riesgo de equivocarse tiene la tarea.
**Delicadeza**: cuánto daño haría un error que se colara (datos del
usuario, seguridad, textos legales, lo que ve todo el mundo).

## Cola

| Tarea | Estado | Dificultad | Delicadeza | Intentos | Título |
|---|---|---|---|---|---|
| T-082 | Pendiente | 🟡 media | 🟡 media | 1 | MCP en Rust: validar índice, vista y spec antes de llamar al frontend |
| T-083 | Pendiente | 🟢 fácil | 🟡 media | 0 | El servidor MCP se arranca desde un solo sitio del frontend |
| T-085 | Pendiente | 🟢 fácil | 🟡 media | 0 | THIRD_PARTY_LICENSES.md sin ficheros que no existen, con prueba |
| T-087 | Pendiente | 🟡 media | 🟡 media | 0 | La pantalla de consentimiento atrapa el foco |
| T-088 | Pendiente | 🟡 media | 🟡 media | 0 | El modal legal es un diálogo accesible |
| T-089 | Pendiente | 🟡 media | 🟡 media | 0 | Cada pestaña de términos controla su propio panel |
| T-090 | Pendiente | 🟡 media | 🟡 media | 0 | Emojis decorativos con aria-hidden |
| T-091 | Pendiente | 🟡 media | 🟡 media | 0 | Cada campo con su label for y fuera la nota vieja de ui/week |
| T-092 | Pendiente | 🟢 fácil | 🟢 baja | 0 | Borrar ui/escape.js: un solo escapado de HTML |
| T-093 | Pendiente | 🟡 media | 🟡 media | 0 | El progreso de cada día no es una región role=status |
| T-094 | Pendiente | 🟢 fácil | 🟢 baja | 0 | Prueba: marcar dos veces la misma aparición no la duplica |
| T-095 | Pendiente | 🟡 media | 🔴 alta | 0 | Si las tareas guardadas no se pueden leer, no se pierden al editar |
| T-096 | Pendiente | 🟡 media | 🔴 alta | 0 | Deshacer «Borrar todo» no borra las tareas creadas después |
| T-097 | Pendiente | 🟡 media | 🔴 alta | 0 | Deshacer varios borrados en otro orden deja cada tarea en su sitio |
| T-098 | Pendiente | 🟡 media | 🔴 alta | 0 | La copia de seguridad incluye los temas guardados |
| T-099 | Pendiente | 🟡 media | 🟢 baja | 0 | MCP en Rust: una entrada pendiente que se borra sola (EntradaPendiente) |
| T-100 | Pendiente | 🟡 media | 🟡 media | 0 | MCP en Rust: call_frontend usa EntradaPendiente |
| T-101 | Pendiente | 🟢 fácil | 🟢 baja | 0 | MCP en Rust: rechazar puertos por debajo de 1024 |
| T-102 | Pendiente | 🔴 difícil | 🔴 alta | 0 | MCP en Rust: arrancar y parar el servidor por turnos |
| T-103 | Pendiente | 🟢 fácil | 🟡 media | 0 | Una sola función para bloquear la app detrás de una pantalla |
| T-104 | Pendiente | 🟡 media | 🟡 media | 0 | La pantalla de términos atrapa el foco y bloquea la app de detrás |
| T-106 | Pendiente | 🟢 fácil | 🔴 alta | 0 | PRIVACY.md y DATA_SAFETY.md nombran todos los datos que la app guarda en el dispositivo |
| T-107 | Pendiente | 🟡 media | 🟡 media | 0 | Las sugerencias de contraste del editor cambian el color que falla |
| T-108 | Pendiente | 🟡 media | 🟡 media | 0 | Editar un color con un tema predefinido activo parte de ese tema y aplica el cambio |

## El reto de cada tarea

### T-082 · MCP en Rust: validar índice, vista y spec antes de llamar al frontend

🟡 media · delicadeza 🟡 media

Rechaza en Rust índices, vistas y tareas mal formadas con mensajes en español, con seis casos de prueba. Si se cuela, el servidor de asistentes acepta o rechaza de más.

### T-083 · El servidor MCP se arranca desde un solo sitio del frontend

🟢 fácil · delicadeza 🟡 media

Crea una función única para arrancar el servidor de asistentes y la usa en dos sitios, con prueba. Si se cuela, el arranque automático deja de funcionar.

### T-085 · THIRD_PARTY_LICENSES.md sin ficheros que no existen, con prueba

🟢 fácil · delicadeza 🟡 media

Corrige una licencia que cita un fichero inexistente y añade una prueba que la comprueba. Si se cuela, la lista de licencias miente sobre lo que se distribuye.

### T-087 · La pantalla de consentimiento atrapa el foco

🟡 media · delicadeza 🟡 media

Añade la captura de foco a la pantalla de consentimiento y su prueba. Un fallo deja el foco escapando a la app de detrás.

### T-088 · El modal legal es un diálogo accesible

🟡 media · delicadeza 🟡 media

Marca el modal legal como diálogo accesible y comprueba que el foco no sale, en una prueba existente. Un error deja el modal mal anunciado o sin cerrar con teclado.

### T-089 · Cada pestaña de términos controla su propio panel

🟡 media · delicadeza 🟡 media

Crea tres paneles de términos separados y los enlaza con sus pestañas, con prueba. Si se cuela, se ve el documento equivocado o no se lee la casilla.

### T-090 · Emojis decorativos con aria-hidden

🟡 media · delicadeza 🟡 media

Marca los emojis decorativos para que no se lean en voz alta, en varios ficheros, con prueba. Si se cuela, un lector de pantalla anuncia ruidos o se calla texto útil.

### T-091 · Cada campo con su label for y fuera la nota vieja de ui/week

🟡 media · delicadeza 🟡 media

Relaciona cada etiqueta con su campo en varios formularios y añade una prueba que lo comprueba. Un error deja los campos sin nombre para el lector de pantalla.

### T-092 · Borrar ui/escape.js: un solo escapado de HTML

🟢 fácil · delicadeza 🟢 baja · sigue a T-061

Borra un fichero de escapado duplicado que nadie usa y apunta su prueba al bueno. Si se cuela, solo sobra o falta código, sin efecto visible.

### T-093 · El progreso de cada día no es una región role=status

🟡 media · delicadeza 🟡 media · sigue a T-050

Quita las zonas vivas que se anunciaban en tromba y anuncia el cambio en un único sitio, con prueba. Un error hace que no se anuncie el progreso al marcar.

### T-094 · Prueba: marcar dos veces la misma aparición no la duplica

🟢 fácil · delicadeza 🟢 baja · sigue a T-050

Solo añade una prueba que avisa si una marca se duplica; si la prueba estuviera mal, la app no cambia.

### T-095 · Si las tareas guardadas no se pueden leer, no se pierden al editar

🟡 media · delicadeza 🔴 alta · sigue a T-045

Guarda una copia del texto de tareas que no se pudo leer y avisa al usuario al arrancar, con prueba que arranca la app. Si se cuela, el usuario pierde sus tareas sin enterarse.

### T-096 · Deshacer «Borrar todo» no borra las tareas creadas después

🟡 media · delicadeza 🔴 alta · sigue a T-053

Deshacer «Borrar todo» debe reponer las tareas creadas después y evitar identificadores repetidos. Si se equivoca, el usuario ve tareas duplicadas o desaparece trabajo suyo.

### T-097 · Deshacer varios borrados en otro orden deja cada tarea en su sitio

🟡 media · delicadeza 🔴 alta · sigue a T-053

Al deshacer varios borrados, cada tarea vuelve junto a su vecina. Es poco código, pero un fallo desordena la lista de tareas del usuario.

### T-098 · La copia de seguridad incluye los temas guardados

🟡 media · delicadeza 🔴 alta · sigue a T-054

La copia de seguridad debe llevar también los temas guardados y el tema activo, con prueba unitaria y de la app. Si se cuela, el usuario pierde su configuración al importar en otro dispositivo.

### T-099 · MCP en Rust: una entrada pendiente que se borra sola (EntradaPendiente)

🟡 media · delicadeza 🟢 baja

Se añade una pieza nueva en el servidor de asistentes que se borra sola al salir de su ámbito, con tres pruebas. El código viene escrito, pero hay que entender bien la propiedad de los datos en Rust para que el borrado automático funcione.

### T-100 · MCP en Rust: call_frontend usa EntradaPendiente

🟡 media · delicadeza 🟡 media

La respuesta pendiente del servidor de asistentes pasa a borrarse sola, así una llamada cancelada o caducada no deja entradas colgadas. Son tres cambios pequeños, pero un fallo en el nombre de la variable soltaría la entrada antes de tiempo.

### T-101 · MCP en Rust: rechazar puertos por debajo de 1024

🟢 fácil · delicadeza 🟢 baja

Se añade una comprobación que rechaza los puertos reservados del sistema y el cero, con el mensaje en español. El código está dado y las seis pruebas son directas.

### T-102 · MCP en Rust: arrancar y parar el servidor por turnos

🔴 difícil · delicadeza 🔴 alta

Arrancar y parar el servidor de asistentes se turnan con un cerrojo para que dos pulsaciones a la vez no se pisen. Es un reto delicado: si parar se llama desde arrancar, la app se queda colgada para siempre.

### T-103 · Una sola función para bloquear la app detrás de una pantalla

🟢 fácil · delicadeza 🟡 media

La lógica que deja la app de detrás sin poder recibir el ratón ni el teclado se traslada a un archivo común y la usa la pantalla de consentimiento. Es mover código casi literal; si se olvida alguna parte, el fondo queda interactivo pero no se rompe nada.

### T-104 · La pantalla de términos atrapa el foco y bloquea la app de detrás

🟡 media · delicadeza 🟡 media

La pantalla de términos atrapa el teclado y bloquea la app de detrás. Es un añadido pequeño, pero si sale mal el foco se pierde y la app queda inservible con el teclado.

### T-106 · PRIVACY.md y DATA_SAFETY.md nombran todos los datos que la app guarda en el dispositivo

🟢 fácil · delicadeza 🔴 alta · sigue a T-067

Solo reescribe dos documentos de privacidad y añade una prueba que los revisa. El trabajo es fácil, pero si el texto queda falso o incompleto, el usuario creería que la app guarda o envía datos que no es así.

### T-107 · Las sugerencias de contraste del editor cambian el color que falla

🟡 media · delicadeza 🟡 media · sigue a T-075

Los botones de sugerencia de contraste pasarán a cambiar el color correcto. Son dos ficheros y una lógica corta, pero hay que traducir el papel del color a su clave real.

### T-108 · Editar un color con un tema predefinido activo parte de ese tema y aplica el cambio

🟡 media · delicadeza 🟡 media · sigue a T-075

Al editar un color con un tema predefinido, el cambio se guardará y partirá de ese tema. Toca cómo se guardan las preferencias y sus pruebas manejan la app real, que son más lentas.

## Últimas terminadas

- T-079 · MCP en Rust: ningún .lock().unwrap() (mutex envenenado) (2026-11-28, 1 intento)
- T-105 · El CI encuentra el hash del frontend en el binario (2026-11-28, 1 intento)
- T-078 · Un solo sitio para el prefijo 'saved:' y para el puerto MCP 41237 (2026-11-28, 3 intentos)
- T-077 · Borrar el service worker desactivado (sw.js) (2026-11-25, 1 intento)
- T-076 · Borrar las funciones y la carpeta que nadie usa (2026-11-25, 1 intento)
