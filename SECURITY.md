# Seguridad

## Cómo avisar de un fallo de seguridad

Si encuentras un fallo de seguridad, **avisa por correo**:

> **gabriel.cat.developer+planner@gmail.com**

Es el mismo correo que aparece en los textos legales de la app
(`legal/CONTACT.md`).

Por favor, **no abras un issue público** para un fallo de seguridad
mientras no esté corregido: un issue público enseña el problema a
todo el mundo antes de que haya una versión parcheada.

En el correo conviene poner:

- Qué es el fallo y qué permite hacer (qué datos se pueden leer o
  escribir, qué se puede ejecutar…).
- Los pasos para reproducirlo, o el caso de prueba que lo dispara.
- Qué versión de la app y qué sistema usaste (Linux, Windows,
  Android…).

Se responde con acuse de recibo y, cuando el fallo esté corregido y
publicado, con el aviso correspondiente.

---

## Qué cuenta como fallo de seguridad

El Planificador Semanal es una app **100 % local**: no hay cuentas, no
hay servidor propio y los datos del usuario (tareas, hábitos y fecha
de inicio) se quedan en su dispositivo, en el `localStorage` del
WebView. Eso ya elimina la mayor parte de la superficie de ataque
habitual de una aplicación.

Sí son fallos de seguridad:

- **El servidor MCP local** (ver más abajo) acepta una llamada sin
  token, o acepta un token que no es el suyo, o permite acciones que
  el usuario no ha autorizado.
- El token MCP se puede leer desde el WebView por un script que no
  debería (por ejemplo, si se reintrodujera un permiso como
  `withGlobalTauri`, o si se guardara el token en el `localStorage`).
- Se puede ejecutar código en el WebView sin la acción explícita del
  usuario (por ejemplo, a través de un documento importado o de un
  script remoto).
- La importación o la exportación de datos permite leer o escribir
  ficheros fuera del directorio de datos de la app.
- Se puede saltarse el consentimiento de los anuncios, o se cargan
  scripts de terceros sin el consentimiento que exige la normativa.

No son fallos de seguridad (son temas de calidad o de usabilidad):

- Un fallo de la app que no compromete datos ni la ejecución de
  código.
- Que la app no funcione en un sistema muy antiguo.
- Una petición de mejora de la interfaz.

---

## El servidor MCP local

El Planificador Semanal puede exponer un **servidor MCP
(Model Context Protocol)** en `127.0.0.1` para que un asistente
(por ejemplo, Claude) pueda leer y modificar las tareas. Solo existe
en la versión de escritorio y **está apagado por defecto**: el usuario
lo enciende en *Ajustes › Asistente (MCP)*.

Cómo está protegido:

- **Solo escucha en `127.0.0.1`** (localhost). No se abre a la red
  local ni a internet.
- **Exige un token Bearer** en la cabecera `Authorization`. Todas las
  peticiones sin el token correcto se responden con `401`.
- El token lo genera la **capa nativa** (Rust) con entropía
  criptográfica y lo guarda en un fichero del directorio de datos de
  la app con permisos `0600` (solo el usuario). **No** se guarda en el
  `localStorage` del navegador ni en el código.
- El token se puede **regenerar** desde la interfaz; al regenerarlo,
  el anterior deja de servir.

Lo que se puede hacer desde el servidor MCP está limitado a las tareas
del planificador (listar, ver, crear, editar y borrar tareas, ver la
semana, cambiar la fecha de inicio, navegar a una vista y exportar el
JSON). No da acceso a ficheros, a la red ni a otros programas.

Si el usuario ha abierto el servidor MCP, el token es la **única**
frontera de seguridad de ese servicio. Cualquier forma de obtenerlo
—o de llamar al puerto sin él— es un fallo de seguridad que hay que
avisar.

---

## Qué datos tiene la app

- **Los del usuario, solo en su dispositivo**: tareas, hábitos, fecha
  de inicio y preferencias de apariencia y accesibilidad. Se guardan en
  el `localStorage` del WebView y en el directorio de datos de la app.
- **Los de la monetización (solo si la build lleva anuncios)**: el
  consentimiento, en el `localStorage`. Se explica en
  `legal/DATA_SAFETY.md`.
- **No se envía nada a ningún servidor propio.** La app no tiene
  telemetría ni cuentas de usuario.

---

## Versiones con soporte

La versión actual es la **0.1.0** (la de `src-tauri/Cargo.toml`). Se
considera con soporte la última versión publicada en `releases/`.

Como el proyecto es de un solo mantenedor y la app es local, la
política es sencilla: los fallos de seguridad se corrigen en la
siguiente versión publicada y se avisa a quien los ha reportado.

---

## Divulgación responsable

- Se da un plazo razonable antes de publicarlo (salvo que el fallo
  esté siendo explotado activamente).
- Se reconoce el hallazgo en el `CHANGELOG.md` de la versión que lo
  corrige, salvo que quien lo avisa prefiera que no se le nombre.
- No se pide a quien avisa que publique nada: la comunicación es
  directa por correo.
