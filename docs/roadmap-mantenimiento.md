# Roadmap de mantenimiento del Planificador Semanal

Fecha: 22 de noviembre de 2026
Origen: [`docs/revision-senior.md`](./revision-senior.md) (38 hallazgos, R-01…R-38)
Alcance: los 6 meses siguientes, en el ritmo del proyecto (una tarea de la
cola cada vez, un commit por tarea, con `bash tools/test.sh` en verde).

---

## Cómo está pensado este plan

El orden no es caprichoso. Sigue el principio de **primero frena las
pérdidas, luego pon las guardas, y solo después embellece**:

| Fase | Qué hace | Por qué en ese orden |
|------|----------|----------------------|
| **0. Frenar las pérdidas** | Arregla la pérdida de datos y quita los permisos de sobra | Son fallos que molestan al usuario o exponen al usuario |
| **1. Poner las guardas** | CI, lint, toolchain fijado, `test.sh` duro | Sin guardas, el refactor se pudre mientras se hace |
| **2. Arreglar las pruebas** | Que las pruebas digan la verdad y no dependan del orden | Un suite fiable es el suelo del refactor |
| **3. Cubrir lo que no está cubierto** | `context.js`, `a11y.js`, Markdown, preferencias, Rust | Refactorizar sin red es jugar a la ruleta |
| **4. Partir los monsters** | `preferences.js`, `settings-card.js`, alta/edición, CSS | La parte grande, con commits pequeños |
| **5. Robustez y coherencia** | Persistencia, tema, legal, scripts de build | Limpieza de fondo |

Cada tarea es una entrada de la cola (`.tasks/tasks.json`) con su criterio
de aceptación. **Una tarea cada vez**, como manda `CLAUDE.md`.

Estimaciones en "jornada" de trabajo efectivo, no en horas de reloj.

---

## Fase 0 — Frenar las pérdidas (2-3 jornadas)

### T-031 · Importar un JSON inválido no debe borrar las tareas
**Cierra R-01.** Hoy `FromJson` captura el error y devuelve `[]`, así que
importar un fichero corrupto **borra la lista y dice "✅ 0 importada(s)"**.
La rama "❌ JSON inválido" del formulario es código muerto.

- `FromJson` deja de tragarse el error: lanza con un mensaje en español, o
  devuelve un resultado con `ok: false` y el motivo.
- La tarjeta de Datos **valida antes de tocar la lista**: si el JSON no es
  válido o no trae ninguna tarea reconocible, no se borra nada y se avisa.
- La importación **despacha `planner:changed`** como el resto de
  mutaciones, para que las demás vistas se repinten y se anuncie.
- `URL.revokeObjectURL` tras la descarga.

**Criterios**: con un JSON corrupto la lista sigue intacta y el mensaje es
"❌ JSON inválido"; con un JSON válido la lista se sustituye; prueba
unitaria de `FromJson` con JSON roto, JSON vacío y `className` desconocido,
y E2E del flujo completo.

### T-032 · Quitar los permisos que la app no usa
**Cierra R-02.** `capabilities/default.json` concede
`fs:allow-read-text-file`/`allow-write-text-file` sobre `$DOCUMENT/**`,
`$DOWNLOAD/**` y `$DESKTOP/**`, y registra el plugin `fs`, que **la app no
usa en ninguna parte** (el import/export usa `Blob`/`FileReader`). En la
misma app conviven scripts remotos de AdSense y la API Tauri completa
(`withGlobalTauri: true`).

- Se eliminan el plugin `fs` y sus permisos, y el plugin `dialog` (tampoco
  se usa).
- Se revisa la CSP: los hosts de AdSense solo se permiten si la build
  lleva anuncios (hoy la build por defecto no lleva ninguno).
- Se documenta en `CLAUDE.md` por qué `withGlobalTauri` está activo y qué
  implica.

**Criterios**: `cargo check` en verde, la app arranca y exporta/importa
igual, la pestaña Legal y el MCP siguen funcionando, y una comprobación
automática que falle si vuelve a aparecer un permiso sin usar.

### T-033 · El token del servidor MCP no vive en texto plano en el navegador
**Cierra R-03.** Hoy el token se guarda en `localStorage`, se copia al
portapapeles y se incrusta en una línea de comandos (`claude mcp add …`),
con lo que acaba en el historial del shell y en `~/.claude.json`.

- El token lo genera y lo guarda la **capa nativa**; el frontend solo lo
  pide para mostrarlo y copiarlo, y no lo persiste.
- La comparación del token sigue siendo en tiempo constante y el binding
  sigue siendo 127.0.0.1.

**Criterios**: recargar la app no pierde el servidor MCP; el token no
aparece en `localStorage` ni en el `console`; la E2E del MCP sigue en verde
incluida la rotación de token.

### T-034 · Un build de release no puede salir sin `.env` ni con el App ID de test
**Cierra R-16.** `build.rs` degrada en silencio a "sin anuncios" si falta
`.env`, y el plugin de AdSense cae al App ID de test de Google: un APK
publicable con anuncios de prueba y sin ningún aviso.

- `build.rs` **falla** si falta `.env` en un build de release (o exige
  `--allow-no-ads` explícito).
- El plugin de AdSense falla también si se compila en release sin un App ID
  real.
- `build.rs` deja de imprimir los valores de las variables (solo el
  nombre).

**Criterios**: un build sin `.env` falla con un mensaje claro; uno con
`.env` de test solo es posible con el flag explícito.

### T-035 · Arreglar los scripts de build rotos
**Cierra R-19.** El placeholder `[TU_THUMBPRINT_CERTIFICADO_NSIS]` impide
firmar el NSIS; `build-msix.ps1` no está implementado y además escribe
dentro de `dist/` (que `build.rs` borra y Tauri embebe);
`build-android.sh --aab` nunca genera el AAB; la versión está triplicada.

- Una sola fuente de verdad para la versión (`tauri.conf.json`).
- `build-msix.ps1` implementado o eliminado (y su `dist/` corregido).
- `--aab` genera AAB de verdad.
- `tauri.conf.json` coherente con lo que generate `build.sh`.

**Criterios**: `tools/build.sh --help` describe lo que hace; el resumen
coincide con `tauri.conf.json`; una prueba comprueba que la versión de
`Cargo.toml`, `tauri.conf.json` y el `package.json` coinciden.

---

## Fase 1 — Poner las guardas (3-4 jornadas)

### T-036 · CI: que las pruebas se lanzen solas
**Cierra R-04.** No existe `.github/` (nunca existió en el historial).

- Workflow de **push y PR**: unitarias, `node --check` de todo el
  frontend, `cargo check` + `cargo test` + `clippy`, y la suite E2E
  completa en un contenedor con weston/Xvfb.
- Cachés de `cargo` y de `npm`; artefactos de los logs cuando falla.
- El workflow **no puede saltarse**: rama principal protegida.

**Criterios**: un PR con un `.js` roto falla el CI; un PR con un error en
Rust falla el CI; el badge de estado está en el README.

### T-037 · Lint, formato y los ficheros que faltan
**Cierra R-37 y parte de R-29.**

- ESLint (configuración plana, sin dependencias en la app: van en el
  `package.json` de la raíz, que es solo de herramientas) con reglas
  razonables: `no-unused-vars`, `no-undef`, `eqeqeq`, `no-console` con
  excepciones justificadas.
- `.editorconfig` (2 espacios, LF, UTF-8) y `.gitattributes` (los `.sh`
  con LF para que no se rompan en Windows).
- `LICENSE` en la raíz (copia de `legal/LICENSE`), `CHANGELOG.md`,
  `CONTRIBUTING.md` y `SECURITY.md` (la app expone un servidor MCP).
- Dependabot para npm y cargo.

**Criterios**: `npm run lint` pasa en verde; los ficheros de colores
literales y los `!important` sin justificar quedan señalados.

### T-038 · Toolchain fijado y builds reproducibles
**Cierra R-17 y R-29.**

- `rust-toolchain.toml` con la versión que usa el proyecto.
- Versiones **exactas** de `cargo-tauri`, `tauri-driver`, `cargo-xwin` y
  `cargo-msix`; `cargo install --locked` en todas partes.
- Todas las llamadas a `cargo` con `--locked`.
- `.cargo/config.toml` versionado (configuración de cross-compilación).
- Se borran las dependencias sin usar: `thiserror`, `tauri-plugin-dialog`,
  `tauri-plugin-fs`.
- `rust-version` real en `Cargo.toml` (o se elimina la declaración falsa).
- Se sube el SDK de Google Mobile Ads a la versión actual.

**Criterios**: dos clones limpios con el mismo `rust-toolchain.toml`
compilan lo mismo; `cargo build --locked` no modifica `Cargo.lock`.

### T-039 · `tools/test.sh` a la altura del proyecto
**Cierra R-26.**

- Comprueba la versión de Node (el glob entrecomillado exige ≥ 22) y da un
  mensaje accionable.
- Ejecuta `node --check` sobre todos los `.js` del frontend.
- Ejecuta `cargo test` y `clippy`.
- Muestra la **cobertura** de las unitarias.
- Guarda **capturas y trazas** cuando un E2E falla (`outputDir` en
  `wdio.conf.mjs`).
- Poda `logs/` (conserva los N últimos).
- Comprueba también el puerto del MCP (41237), no solo el de WebdriverIO.
- Sale con código ≠ 0 si no se ejecutó ninguna prueba.

**Criterios**: con Node 20 el script avisa antes de fallar; al romper un
`.js` sin importarlo en ningún test, la suite falla.

### T-040 · Que el binario no se publique con el frontend anterior
**Cierra R-18.** `build.rs` copia a `dist/` pero no emite ninguna
directiva cuyo valor cambie con el contenido del frontend: si el
fingerprint del build script no cambia, Cargo no recompila y el binario
conserva los assets viejos.

- `build.rs` emite un `cargo:rustc-env=FRONTEND_HASH=<hash>` con el hash
  del contenido copiado.
- `remove_dir_all` deja de ignorar su error.

**Criterios**: tocar un `.js` del frontend y recompilar produce un binario
con el frontend nuevo (comprobable con la E2E).

---

## Fase 2 · Arreglar las pruebas para que digan la verdad (3 jornadas)

### T-041 · Aserciones que no pasan con la app rota
**Cierra R-05.**

- `08-mcp.spec.mjs:313-328`: "el puerto está cerrado" debe comprobar que
  el servidor **respondió y dijo que no**, no que "pasa algo raro".
- `11-edicion-gratuita.spec.mjs:116-136`: un `fetch` fallido no puede
  confundirse con "el fichero no se distribuye".
- `05-teclado.spec.mjs:289`: el error del driver no puede convertirse en
  "el modal no está visible".
- `12-legal-url-publica.spec.mjs:250-251`: el aviso de accesibilidad se
  comprueba con **contraste WCAG** (como ya hace
  `preferences.test.mjs:289-301`), no con "no es negro".

**Criterios**: cada aserción se pone en rojo al romper la app en el punto
que dice comprobar (probado una vez por aserción, y contado en el resumen).

### T-042 · Toda navegación espera al pintado
**Cierra R-06.** `esperarPintado()` solo se usa dentro de `irATareas()`.
Cinco navegaciones más leen el DOM antes de tiempo
(`01-tipos:145,172,212,242`, `10-ajustes:82`).

- `esperarPintado()` se aplica a `irASemana()`, `irAGestionDatos()` e
  `irAImprimir()`, y a las navegaciones crudas de los specs.
- Se añade el helper que falta: esperar a que la vista **activa** se
  repinte tras `planner:changed` (el caso de `07-api`).
- `esperarPintado` se exporta y se documenta como la forma correcta de
  navegar en las pruebas.

**Criterios**: los cinco puntos dejan de leer el DOM antes de tiempo;
las diez suites E2E seguidas en verde en weston y en Xvfb.

### T-043 · Pruebas aisladas y sin esperas fijas
**Cierra R-25 y R-27.**

- `api.test.mjs` restaura también la fecha de inicio (hoy queda mutada).
- Se mueve el estado compartido entre `it` a un helper explícito
  (`prepararEstado(...)`) para que se vea la dependencia en vez de
  implícita.
- Se eliminan las 7 esperas fijas (`browser.pause`, `setTimeout`) por
  esperas sobre el estado real.
- Se restauran los overrides de página (`URL.createObjectURL`,
  `HTMLAnchorElement.prototype.click`) al terminar cada test.

**Criterios**: cada spec pasa **en isolation** (se ejecuta con
`--spec` y con un subconjunto de tests) y no queda ningún `pause` ni
`setTimeout` de espera fija.

---

## Fase 3 · Cubrir lo que no está cubierto (5-6 jornadas)

### T-044 · Pruebas de `context.js`: la persistencia, de verdad
**Cierra R-09.**

- Que se persiste al mutar, con qué claves (`Context_TASKS`,
  `Context_START_DATE`) y que sobrevive a una recarga.
- Que un `localStorage` corrupto no rompe el arranque.
- Que la fecha de inicio por defecto es hoy a las 00:00.

**Criterios**: `context.js` por encima del 90 % de cobertura y ninguna
aserción tautológica.

### T-045 · Pruebas de `ui/a11y.js`
**Cierra parte de R-20.** Cuatro funciones puras (`isEditable`,
`trapFocus`, `bindRovingTabindex`, `focusHeading`) sin una sola prueba
unitaria, y la orientación `horizontal`/`both` sin ejercitar.

- Se prueban con un DOM mínimo (sin jsdom: un doble propio de `document`
  suficiente, como los que ya hay en `tests/unit/`).

**Criterios**: `ui/a11y.js` por encima del 90 %.

### T-046 · Un solo escapado de HTML y el Markdown con pruebas
**Cierra R-15.** Hay **3 implementaciones** de escapado con semántica
divergente (una sin comillas) y 57 líneas de conversor de Markdown sin
ninguna prueba.

- Un único módulo `ui/html.js` con `escapeHtml` (escapando también `'`) y
  `escapeAttr`; las tres implementaciones lo usan.
- `renderMarkdown` pasa a su propio módulo con pruebas: tablas, listas,
  código, enlaces y el escapado de las URLs.

**Criterios**: `legal-card.js` y `legal-markdown` con >85 % de cobertura; el
escapado único usado por las tres tarjetas.

### T-047 · Pruebas de las preferencias y de los temas guardados
**Cierra parte de R-20.** 12 de ~20 exports de `preferences.js` sin
probar, incluido `getPreferences()`, que sanea todo lo que entra de
`localStorage`.

- Se prueban el saneado (tema desconocido, escala fuera de rango, hex
  inválido, `savedId` huérfano), el guardado y el borrado de temas, y el
  mapeo automático.

**Criterios**: `preferences.js` por encima del 85 %.

### T-048 · `cargo test` para el servidor MCP
**Cierra el resto de R-20.** 1.050 líneas de Rust sin un solo test.

- Token: comparación correcta, token vacío, token distinto.
- Sesiones: alta, respuesta, timeout, cancelación (y que la cancelación
  **no deja entradas colgadas** en el mapa `pending`).
- Puerto ocupado, puerto inválido y arranque doble.

**Criterios**: `cargo test` en verde con al menos 15 casos.

---

## Fase 4 · Partir los monsters (8-10 jornadas)

### T-049 · Una base común para las 20 tarjetas
**Cierra R-08.** 34 `fetch` sin `.catch()` ni `r.ok`.

- `ui/base-card.js` con `cargarFragmento(ruta)` que comprueba `r.ok`,
  captura el error y **muestra un aviso en la vista** en vez de dejar la
  pantalla en blanco.
- Las 17 tarjetas lo usan.
- `ajustes-card.js` deja de cachear la tarjeta antes del `await` (un fallo
  de montaje ya no deja la pestaña rota para siempre).

**Criterios**: con un asset que falta, la vista muestra un mensaje
"no se pudo cargar" en vez de quedar en blanco; ninguna tarjeta hace `fetch`
sin comprobar.

### T-050 · Partir `preferences.js`
**Cierra R-10 (mitad).** 711 líneas con 5 responsabilidades.

- `back/color.js`: hexadecimal, HSL, luminancia, contraste.
- `ui/settings/themes.js`: el registro de temas, las bases y los chequeos
  de contraste.
- `ui/settings/preferences.js`: leer, sanear y guardar preferencias.
- `ui/settings/savedThemes.js`: los temas guardados del usuario.

**Criterios**: ningún fichero supera las 300 líneas; las importaciones
públicas se mantienen (no se rompe la API de `preferences.js` sin
migración).

### T-051 · Partir `settings-card.js`
**Cierra R-10 (otra mitad).** 509 líneas, una clase con ~20 métodos.

- `settings-card.js` (la tarjeta), `themeEditor.js` (el editor de colores y
  el contraste), `savedThemes.js` (la lista de temas guardados).

**Criterios**: la pestaña de Apariencia se ve igual que antes (E2E
`04-apariencia` en verde) y ningún fichero supera las 300 líneas.

### T-052 · Un solo formulario de repetición, compartido
**Cierra R-12.** ≈108 líneas duplicadas entre alta y edición, 21
`!important` en el CSS de edición por depender del CSS de alta, y dos
listas de nombres de días.

- Un módulo `ui/taskManager/repeatOptions.js` con el render de las
  opciones extra (días, ciclo) parametrizado por prefijo de `id`.
- El CSS compartido pasa a un fichero común con clases propias, sin
  `!important`.

**Criterios**: el fichero nuevo se usa desde las dos tarjetas; el CSS de
edición no depende del de alta; la E2E de tipos de repetición y la de
editar/borrar en verde.

### T-053 · Aislar el CSS de cada tarjeta
**Cierra R-07 y R-28.** `.switch`, `.slider` y `.switch-row` están
definidos con valores distintos en dos tarjetas, y ambas inyectan su
`<style>` en el documento global: **el aspecto depende del orden de
navegación**.

- Cada tarjeta inyecta su CSS con un prefijo de ámbito (o en un
  `adoptedStyleSheets` con `scope`), de modo que `.switch` de Tareas no
  choque con el de Ajustes.
- Se eliminan la regla global `[hidden]{display:none!important}` filtrada
  desde una tarjeta y las ≈140 líneas de CSS muerto o duplicado de
  `ui/settings/`.

**Criterios**: una E2E nueva comprueba que el interruptor "Gestionar" se
ve igual después de visitar Ajustes → Apariencia → Tareas.

### T-054 · Matar el código muerto
**Cierra R-13.**

- `ui/taskManager/taskItem/` (132 líneas): se borra (nunca importada, y
  rota por partida triple) o se arregla y se usa — la decisión se toma
  mirando si la vista Semana lo necesita.
- `TOOL_TO_API` (`mcp-bridge.js:20-30`) y el `toolMap` interno: uno solo.
- `Context.SetTasksFromJson`, `TaskBase.getStart`,
  `calendar.GetRestoOfMonth` y `calendar.GetMonth`: o se usan o se borran
  (los dos últimos no los llama nadie).
- `AjustesCard.getActiveTab()`, la opción `appearanceOnly` (que se ignora
  en silencio) y las constantes exportadas sin usar (`SAVED_PREFIX`,
  `NAV_ICON_STEP`).
- `sw.js`: se borra (está desactivado con `&& false` y su lista de assets
  está obsoleta) o se actualiza y se activa con una prueba.
- Las 3 copias de `DAY_NAMES`, los 7 literales `'saved:'`, el puerto MCP
  en 5 sitios y el tamaño del icono con dos fuentes de verdad.

**Criterios**: `grep` sin resultados para cada nombre eliminado; el build
sigue en verde; la E2E sigue en verde.

### T-055 · Que `api.js` sea solo la fachada
**Cierra R-11.** `api.js` es a la vez API pública, servicio de dominio y
emisor de eventos; la UI importa de él para construir tareas.

- `buildTaskFromSpec` y los `parse*` pasan a `back/taskSpec.js`.
- `api.js` queda como fachada pública que usa ese módulo.
- Las tarjetas importan del módulo de dominio.

**Criterios**: `api.js` baja de 366 a menos de 200 líneas; ninguna tarjeta
de `ui/` importa de `api.js` salvo para hablar con la API pública.

---

## Fase 5 — Robustez, coherencia y limpieza de fondo (5-6 jornadas)

### T-056 · Persistencia por lotes y proxy estable
**Cierra R-09 (parte) y R-34.**

- `context.js` agrupa las escrituras a `localStorage` (un `microtask` o un
  `setTimeout` corto) en vez de serializar la lista entera en cada
  asignación.
- El `Proxy` cachea los proxies anidados, para que
  `Context.Tasks[0] === Context.Tasks[0]`.

**Criterios**: importar 1.000 tareas hace **≤10 escrituras** (hoy 2.001) y
la lista importada es idéntica; una prueba unitaria mide el número de
escrituras.

### T-057 · Un único sitio que decide el tema
**Cierra R-24.** `theme-boot.js` reimplementa la resolución del tema de
`preferences.js`; si las dos reglas divergen, la app arranca con un tema y
cambia a otro al cargar.

- La lógica vive en un módulo compartido que ambos usan.

**Criterios**: con `theme: 'auto'` y el sistema en oscuro, el tema se
aplica antes del primer pintado y no cambia después (E2E que compruebe
`data-theme` en el `<html>` antes y después de cargar).

### T-058 · Validar la importación y no petar con un ciclo vacío
**Cierra R-32.**

- `CiclesDaysOfWeekTask.thisDayHas` no peta con el ciclo vacío.
- La importación avisa de cuántas tareas ha reconocido y cuántas ha
  descartado.

**Criterios**: importar un JSON con `cicles: []` no rompe la app; hay
prueba unitaria de ambos.

### T-059 · El MCP en Rust: sin mutex envenenado y sin fugas
**Cierra R-31.**

- `tokio::sync::Mutex` en lugar de `std::sync::Mutex` en el camino async.
- Ningún `.lock().unwrap()` en el servidor: un panic no puede envenenar el
  mutex ni abortar la app.
- La rama de cancelación borra la entrada de `pending`.
- `mcp_start` valida el puerto y el token; dos arranques concurrentes no
  se pisan.

**Criterios**: `cargo test` cubre el caso de cancelación; el arranque
concurrente se rechaza con un mensaje claro.

### T-060 · Validar los argumentos de las herramientas MCP en Rust
**Cierra la parte de R-02 que queda.** Hoy la validación está **solo en el
frontend**: `index: i64` sin rango, `view: String` sin lista blanca y
`spec: Value` arbitrario.

- Rust valida lo que puede (rango del índice, lista blanca de vistas) y
  devuelve errores en español.

**Criterios**: una llamada con `index: 9999` o `view: "loquesea"` se
rechaza en el servidor, no solo en el frontend.

### T-061 · Los textos legales, coherentes con el código
**Cierra R-30.** `legal/PRIVACY.md:32` afirma que la app "no muestra
anuncios ni integra redes publicitarias" y
`legal/THIRD_PARTY_LICENSES.md:38-39` da por distribuido el
`html2pdf.bundle.min.js.LICENSE.txt` que **no existe** en `vendor/`.

- Se corrigen los textos (o se condicionan a la build con anuncios).
- Se añade el fichero de licencia que falta.

**Criterios**: una comprobación automática verifica que todo fichero del
que hablan los textos legales existe de verdad.

### T-062 · Detalles de HTML, accesibilidad y nomenclatura
**Cierra R-13 (resto), R-14, R-22 y R-33.**

- `index.html`: `theme-color` coherente con el tema, `aria-hidden` en el
  emoji del `h1`, `aria-labelledby` que no cuelgue antes de que JS
  inyecte el encabezado, indentación uniforme.
- Accesibilidad: los gates de términos y consentimiento **atrapan el
  foco** (y el de términos bloquea la app con `inert` como el de
  consentimiento), el modal legal declara `role="dialog"`,
  `aria-modal` y `aria-labelledby`, la vista Tareas tiene su región
  `role="status"`, y los emojis decorativos llevan `aria-hidden`.
- `aria-controls` correcto en las 3 pestañas de los términos.
- Nomenclatura: un idioma y un criterio de nombres de archivo en `ui/`.
- Comentarios obsoletos y `ui/week/README.md` (nota de trabajo de 2019).

### T-063 · `package.json` y el ruido de Node
**Cierra R-35.** El `package.json` de la raíz no declara
`"type": "module"`, así que Node reinterpreta cada fichero como ESM en
cada ejecución (aviso en cada test y en cada `node --check`).

**Criterios**: `node --check` y la suite unitaria salen sin avisos.

---

## Cómo se mide el avance

| Indicador | Hoy | Objetivo |
|-----------|-----|----------|
| Hallazgos críticos cerrados | 0/8 | 8/8 |
| Cobertura unitaria del código sin DOM | 86 % | >90 % |
| Ficheros Rust con tests | 0 | 4/5 módulos |
| Pruebas que fallan al romper la app | parcial | 100 % de las nuevas |
| Suites E2E seguidas en verde | 20 (hoy) | 20 (se mantiene) |
| Commits con `T-00X` | 30 | uno por tarea |
| Hallazgos abiertos | 38 | 0 |

Y una regla que no se negocia: **ninguna tarea de este plan se da por
terminada sin su prueba en rojo comprobada**. Es la misma regla que ya
gobierna el proyecto, y es la que ha encontrado los cinco fallos más graves
de esta revisión.
