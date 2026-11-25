# Estado de MiniMax

> Lo genera `tools/tasks/tasks.mjs estado-md` a partir de la cola
> (`.tasks/tasks.json`) y lo publica `tools/cola.sh`. La evaluación
> de cada tarea (dificultad y delicadeza) la hace MiniMax con
> `tools/minimax/evaluar.sh`. No lo edites a mano: se sobrescribe.

Actualizado: 2026-11-25 15:54 UTC

## Ahora

**T-063 · Aislar el CSS de cada tarjeta**

- Estado: MiniMax trabajando · intentos: 3 · devoluciones del revisor: 2
- Dificultad: 🔴 difícil · Delicadeza: 🟡 media
- Reto: Aislar los estilos de cada tarjeta en varios ficheros CSS, con tres devoluciones del revisor por comentarios de cabecera erróneos. Si algo se cuela, el interruptor Gestionar cambia de aspecto, pero la app sigue funcionando.
- ⚠ Va por su intento 3 de 4: si no sale, se quedará para que la mire el supervisor.

## Resumen

- Abiertas: 31 (0 sin evaluar)
- Dificultad: 🟢 5 fácil · 🟡 22 media · 🔴 4 difícil
- Delicadeza: 🟢 4 baja · 🟡 19 media · 🔴 8 alta

**Dificultad**: cuánto trabajo y riesgo de equivocarse tiene la tarea.
**Delicadeza**: cuánto daño haría un error que se colara (datos del
usuario, seguridad, textos legales, lo que ve todo el mundo).

## Cola

| Tarea | Estado | Dificultad | Delicadeza | Intentos | Título |
|---|---|---|---|---|---|
| T-063 | MiniMax trabajando | 🔴 difícil | 🟡 media | 3 | Aislar el CSS de cada tarjeta |
| T-069 | Pendiente | 🟡 media | 🟢 baja | 0 | 08-mcp: «el puerto se cierra» exige que la app diga que paró |
| T-070 | Pendiente | 🟡 media | 🟢 baja | 0 | 11-edicion-gratuita: un fetch fallido no prueba que un documento no se distribuye |
| T-071 | Pendiente | 🟡 media | 🟡 media | 0 | 12-legal: el aviso del navegador se comprueba con contraste WCAG real |
| T-072 | Pendiente | 🟡 media | 🟡 media | 0 | theme-boot.js: en tema automático seguir al sistema, no al esquema guardado |
| T-073 | Pendiente | 🟡 media | 🟡 media | 0 | Sacar la matemática de color de preferences.js a back/color.js |
| T-074 | Pendiente | 🟡 media | 🟡 media | 0 | Sacar los temas guardados de preferences.js a ui/settings/savedThemes.js |
| T-075 | Pendiente | 🟡 media | 🟡 media | 0 | Sacar el panel de contraste y la lista de temas guardados de settings-card.js |
| T-076 | Pendiente | 🟡 media | 🟡 media | 0 | Borrar las funciones y la carpeta que nadie usa |
| T-077 | Pendiente | 🟡 media | 🟡 media | 0 | Borrar el service worker desactivado (sw.js) |
| T-078 | Pendiente | 🟢 fácil | 🟡 media | 0 | Un solo sitio para el prefijo 'saved:' y para el puerto MCP 41237 |
| T-079 | Pendiente | 🟡 media | 🔴 alta | 0 | MCP en Rust: ningún .lock().unwrap() (mutex envenenado) |
| T-080 | Pendiente | 🔴 difícil | 🔴 alta | 0 | MCP en Rust: una llamada cancelada o caducada no deja entradas en pending |
| T-081 | Pendiente | 🔴 difícil | 🔴 alta | 0 | MCP en Rust: puerto válido y sin dos arranques a la vez |
| T-082 | Pendiente | 🟡 media | 🟡 media | 0 | MCP en Rust: validar índice, vista y spec antes de llamar al frontend |
| T-083 | Pendiente | 🟢 fácil | 🟡 media | 0 | El servidor MCP se arranca desde un solo sitio del frontend |
| T-084 | Pendiente | 🟡 media | 🔴 alta | 0 | PRIVACY.md y DATA_SAFETY.md: las dos ediciones y los datos locales |
| T-085 | Pendiente | 🟢 fácil | 🟡 media | 0 | THIRD_PARTY_LICENSES.md sin ficheros que no existen, con prueba |
| T-086 | Pendiente | 🔴 difícil | 🟡 media | 0 | La pantalla de términos atrapa el foco y bloquea la app de detrás |
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

## El reto de cada tarea

### T-063 · Aislar el CSS de cada tarjeta

🔴 difícil · delicadeza 🟡 media

Aislar los estilos de cada tarjeta en varios ficheros CSS, con tres devoluciones del revisor por comentarios de cabecera erróneos. Si algo se cuela, el interruptor Gestionar cambia de aspecto, pero la app sigue funcionando.

### T-069 · 08-mcp: «el puerto se cierra» exige que la app diga que paró

🟡 media · delicadeza 🟢 baja

Solo endurece una prueba de la app para que exija respuesta del servidor de asistentes antes y después de parar. Si la prueba está mal, no cambia la app.

### T-070 · 11-edicion-gratuita: un fetch fallido no prueba que un documento no se distribuye

🟡 media · delicadeza 🟢 baja

Solo corrige una prueba de la app para que un fallo de red no se tome por «no se distribuye». Un error en la prueba no toca los datos del usuario.

### T-071 · 12-legal: el aviso del navegador se comprueba con contraste WCAG real

🟡 media · delicadeza 🟡 media

Mueve el cálculo de contraste a un fichero común y lo usa en dos pruebas de la app. Si se cuela un error, el aviso legal puede quedar ilegible o la comprobación se equivoca.

### T-072 · theme-boot.js: en tema automático seguir al sistema, no al esquema guardado

🟡 media · delicadeza 🟡 media

Cambia cómo se decide el tema al arrancar y añade cinco pruebas unitarias. Si se cuela, la app puede arrancar en el color equivocado y parpadear.

### T-073 · Sacar la matemática de color de preferences.js a back/color.js

🟡 media · delicadeza 🟡 media

Saca la matemática de color a un módulo aparte sin cambiar el resultado, con pruebas nuevas. Un fallo en el traslado cambiaría los contrastes que ve el usuario.

### T-074 · Sacar los temas guardados de preferences.js a ui/settings/savedThemes.js

🟡 media · delicadeza 🟡 media

Saca los temas guardados a su propio módulo, con importación circular entre ficheros. Si se enreda, el usuario puede perder sus temas guardados al abrir Ajustes.

### T-075 · Sacar el panel de contraste y la lista de temas guardados de settings-card.js

🟡 media · delicadeza 🟡 media

Parte un fichero grande de Ajustes en tres sin cambiar textos ni identificadores. Un error en el reparto rompe el editor de apariencia o la lista de temas.

### T-076 · Borrar las funciones y la carpeta que nadie usa

🟡 media · delicadeza 🟡 media

Borra código y una carpeta que nadie usa, comprobando antes con búsquedas. Si se equivoca y borra algo vivo, el usuario pierde funciones de la lista de tareas.

### T-077 · Borrar el service worker desactivado (sw.js)

🟡 media · delicadeza 🟡 media

Borra el fichero de trabajo sin conexión y sus referencias en el empaquetado. Si se queda alguna referencia, la app puede no arrancar o fallar al construirse.

### T-078 · Un solo sitio para el prefijo 'saved:' y para el puerto MCP 41237

🟢 fácil · delicadeza 🟡 media

Sustituye números repetidos por las constantes que ya existen en cuatro ficheros. Si se equivoca con el puerto, el servidor de asistentes no arranca.

### T-079 · MCP en Rust: ningún .lock().unwrap() (mutex envenenado)

🟡 media · delicadeza 🔴 alta

Sustituye 22 bloqueos que abortan la app en Rust por una recuperación segura y añade una prueba. Un fallo aquí puede tumbar la app entera al usar el servidor de asistentes.

### T-080 · MCP en Rust: una llamada cancelada o caducada no deja entradas en pending

🔴 difícil · delicadeza 🔴 alta

Limpiar las respuestas pendientes del servidor de asistentes exige un mecanismo de limpieza al salir y pruebas asíncronas con tiempo límite. Si se cuela, se acumulan entradas y el servidor se atasca o se cae.

### T-081 · MCP en Rust: puerto válido y sin dos arranques a la vez

🔴 difícil · delicadeza 🔴 alta

Valida el puerto del servidor de asistentes y evita que dos arranques a la vez se pisen, lo que exige esperar turnos en código asíncrono. Un error deja el servidor mal arrancado o colgado.

### T-082 · MCP en Rust: validar índice, vista y spec antes de llamar al frontend

🟡 media · delicadeza 🟡 media

Rechaza en Rust índices, vistas y tareas mal formadas con mensajes en español, con seis casos de prueba. Si se cuela, el servidor de asistentes acepta o rechaza de más.

### T-083 · El servidor MCP se arranca desde un solo sitio del frontend

🟢 fácil · delicadeza 🟡 media

Crea una función única para arrancar el servidor de asistentes y la usa en dos sitios, con prueba. Si se cuela, el arranque automático deja de funcionar.

### T-084 · PRIVACY.md y DATA_SAFETY.md: las dos ediciones y los datos locales

🟡 media · delicadeza 🔴 alta

Corrige los textos legales sobre anuncios y datos guardados, sin tocar los términos con fecha. Un texto falso o incompleto engañaría al usuario sobre qué datos se guardan.

### T-085 · THIRD_PARTY_LICENSES.md sin ficheros que no existen, con prueba

🟢 fácil · delicadeza 🟡 media

Corrige una licencia que cita un fichero inexistente y añade una prueba que la comprueba. Si se cuela, la lista de licencias miente sobre lo que se distribuye.

### T-086 · La pantalla de términos atrapa el foco y bloquea la app de detrás

🔴 difícil · delicadeza 🟡 media

Atrapar el foco de la pantalla de términos y bloquear la app de detrás exige una prueba nueva que pulse el tabulador quince veces. Si se cuela, la app puede quedar inutilizable con teclado.

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

## Últimas terminadas

- T-060 · Pruebas de context.js, ui/a11y.js y preferences.js (2026-11-25, 4 intentos)
- T-062 · Una base común para las tarjetas: errores visibles y plantillas en caché (2026-11-25, 4 intentos)
- T-061 · Un solo escapado de HTML y el Markdown legal con pruebas (2026-11-25, 1 intento)
- T-059 · Toda navegación de las E2E espera al pintado y sin esperas fijas (2026-11-25, 4 intentos)
- T-057 · Textos y nombres coherentes en la interfaz (2026-11-25, 3 intentos)
