# Revisión senior del Planificador Semanal

Fecha: 22 de noviembre de 2026
Alcance: frontend (`index.js`, `back/`, `ui/`, `context.js`, `api.js`), capa
nativa (`src-tauri/`), pruebas (`tests/`), build (`tools/`) e higiene del repo.
Enfoque: **mantenibilidad y comprensión del código** — que el proyecto se
pueda entender, tocar y ampliar sin miedo.
Plan de aplicación: [`docs/roadmap-mantenimiento.md`](./roadmap-mantenimiento.md)

---

## 1. Veredicto

El proyecto está **muy por encima de la media** en lo que importa. Hay un
dominio con pruebas unitarias reales, 259 pruebas automatizadas (131
unitarias + 128 E2E contra el binario de Tauri de verdad), commits atómicos
por funcionalidad, documentación en español, unas convenciones de
accesibilidad que se cumplen de verdad y **cero `unsafe`** en 1.050 líneas de
Rust. No es un proyecto que necesite un rescate.

Lo que falta es **la capa que convierte un buen proyecto en uno sostenible**:
integración continua, herramientas de calidad automática, y una capa de
persistencia, de diálogos y de permisos que ahora mismo son trampas
silenciosas. Ninguno de los hallazgos de abajo es catastrófico; casi todos
son del tipo "esto va a morderte dentro de seis meses".

### Notas por área

| Área | Nota | Comentario |
|------|------|------------|
| Dominio (`back/`) | **7/10** | Lógica correcta y bien probada, pero es la capa más vieja: otro estilo, otro idioma y los nombres de clase son el formato de datos (con erratas congeladas) |
| API (`api.js`) | **7/10** | Bien escrita y validada; el problema es de rol: hace de API pública *y* de servicio de dominio |
| Estado (`context.js`) | **5/10** | 57 líneas que persisten en O(n²), crean un proxy nuevo por acceso y no tienen ni una prueba |
| Interfaz (`ui/`) | **6/10** | 20 tarjetas con un patrón repetido sin factorizar, colisiones de CSS entre tarjetas y dos "god objects" |
| Pruebas | **6/10** | Cobertura buena donde hay tests, huecos grandes donde no, y cuatro aserciones que pasarían con la app rota |
| Capa nativa (Rust) | **6/10** | Pequeña y bien hecha, pero sin un solo test, con permisos de sobra y con mutex que se envenenan |
| Build e higiene | **4/10** | Sin CI, sin lint, sin toolchain fijado y con tres scripts de build rotos |
| Documentación | **8/10** | `CLAUDE.md`, `AGENTS.md`, `README-TAURI.md`, el roadmap y las skills están al día y son utilizables |

### Los ocho que hay que arreglar ya

1. **Importar un JSON inválido borra las tareas del usuario** y dice
   "✅ 0 tarea(s) importada(s)". Pérdida de datos sin aviso.
2. **La app tiene permisos de escritura en el disco del usuario que no
   usa**, y permite scripts remotos de terceros en el mismo webview.
3. **El token del servidor MCP vive en texto plano** en `localStorage`, en
   el portapapeles y en el historial del shell.
4. **No hay CI**: 259 pruebas dependen de que alguien se acuerde de lanzarlas.
5. **Hay aserciones que pasan con la app rota** (servidor MCP, distribución
   de ficheros legales, modal de atajos).
6. **El arreglo de T-030 quedó a medias**: la señal de "pintado" solo la
   respeta `irATareas()`; hay cinco navegaciones más que leen el DOM antes
   de tiempo → los intermitentes pueden volver.
7. **El aspecto de la app depende del orden de navegación**: dos tarjetas
   definen el interruptor con valores distintos y ambas inyectan su CSS en
   el documento global.
8. **Un `fetch` que falla deja la vista en blanco y sin diagnóstico**, y
   además la tarjeta queda cacheada rota para siempre.

---

## 2. Cómo se ha revisado

No es una lectura de ojo por encima:

- **Cobertura instrumentada** de las unitarias con
  `node --test --experimental-test-coverage` (86,25 % de líneas sobre el
  código que tocan).
- **Micro-mediciones** de comportamiento (importar 1.000 tareas → 2.001
  escrituras a `localStorage` y 1,6 s).
- **Reproducción** de los fallos intermitentes (T-030: 1 fallo en 8
  ejecuciones de una spec aislada) antes de proponer el arreglo.
- **Verificación en rojo** de cada arreglo: se rompe el código a propósito
  y se comprueba que la prueba correspondiente se pone roja.
- Lectura íntegra del dominio, de la capa de API, del estado global, de
  las 20 tarjetas de interfaz, de las 259 pruebas y de la capa nativa, con
  tres revisores en paralelo y después una verificación propia de los
  hallazgos más graves.

---

## 3. Lo que está bien (para no perderlo de vista)

- **El dominio está bien probado**: `back/` con un 89–100 % de cobertura
  unitaria, incluidas las pruebas de cambio de hora que detectan los fallos
  de DST.
- **Las unitarias importan el código real**: `calendar.test.mjs` y
  `tareas.test.mjs` usan helpers que llaman a `thisDayHas` en vez de
  reimplementar la regla.
- **Los E2E manejan el binario de Tauri real** en un Wayland invisible, con
  datos aislados (`XDG_DATA_HOME` propio) y sin tocar los del usuario.
- **Existe la disciplina de "romper el código para ver la prueba en rojo"**
  y se ha aplicado de verdad (T-030).
- **Cero `document.getElementById` en `ui/`**: todo el acceso al DOM es
  `this.root.querySelector(...)`. Excelente.
- **Cero colores literales en los CSS de `ui/`**: se usa el sistema de
  variables del tema, tal y como manda la convención.
- **Cero `unsafe`** en todo el Rust; el servidor MCP compara el token en
  tiempo constante y escucha solo en 127.0.0.1.
- **Commits atómicos** por funcionalidad, con el mensaje `T-00X: título`.
- **La suite E2E es reproducible**: 20 ejecuciones seguidas en verde
  (weston y Xvfb) tras el arreglo de T-030.

---

## 4. Diagnóstico por área

### A. El modelo de dominio (`back/`)

398 líneas de lógica de repetición de tareas, sin dependencias, con un
89–100 % de cobertura y pruebas de DST. Lo mejor del proyecto.

- **Estilo heredado de la PWA original**: `baseTarea.js`, `daysOfWeek.js`,
  `limitedTime.js` y `nDays.js` usan 4 espacios, sin espacio alrededor de
  los operadores y sin JSDoc, mientras `calendar.js` y `serializer.js`
  (escritos después) usan 2 espacios y documentan cada función en español.
  El mismo directorio, dos estilos.
- **Dos idiomas en el mismo directorio**: `baseTarea.js` (español),
  `taskFactory.js` (inglés), `CiclesDaysOfWeekTask` (español mal
  escrito), `DaysOfWeekTask` (inglés).
- **Los nombres de clase son el formato de datos**: `ToJson` graba
  `className: t.constructor.name`. Renombrar `CiclesDaysOfWeekTask` o
  `QuaterlyTask` rompe los datos ya guardados. Las erratas están
  congeladas por el formato (habría que migrar).
- **Clases que no se pueden crear**: `WeeklyTask`, `MonthlyTask` y
  `QuaterlyTask` solo aparecen en el serializador y en sus tests; ni la
  interfaz ni la API pueden crearlas. Es compatibilidad hacia atrás, pero
  no lo dice.
- **`CiclesDaysOfWeekTask.thisDayHas` peta con el ciclo vacío**
  (`back/daysOfWeek.js:59-61`): se puede llegar importando un JSON a mano.
- **La serialización es asimétrica**: `TaskBase.toJson` (estático en la
  entidad base) sabe recursar por `task` pero no por `cicles`; el
  deserializador lo compensa a mano. El primero no ve al segundo.

### B. Estado global y persistencia (`context.js`)

57 líneas con un `Proxy` que persiste en `localStorage` en cada
asignación. Funciona, pero:

- **Persistencia O(n²)**: cada `set` serializa la lista entera. Medido:
  importar 1.000 tareas = **2.001 escrituras y 1,6 s** (152 MB de JSON
  escritos para una lista de 76 KB).
- **Un proxy nuevo en cada acceso** a un objeto anidado
  (`Context.#observe`): `Context.Tasks[0] !== Context.Tasks[0]`. Trampa de
  identidad y basura en los bucles de render.
- **La clave depende de `Context.name`** (`"Context_TASKS"`): si alguien
  minifica el bundle, los datos dejan de encontrarse. Ninguna prueba lo
  vigila.
- **`SetTasksFromJson` es código muerto** (`context.js:17-22`).
- **Ninguna prueba** comprueba que se persista, ni qué claves se usan.

### C. La capa de interfaz (`ui/`)

6.483 líneas en 20 tarjetas. El patrón (clase con `init()`, `fetch` del
HTML y el CSS, inyección en el `root`) es consistente y legible; el
problema es que **se repite 16 veces sin factorizar**:

- **Ni una sola comprobación de error en los `fetch`**: 17 tarjetas × 2
  ficheros = **34 `fetch` sin `.catch()` ni `r.ok`**. Si un asset no llega
  (olvidarlo en `WEB_ASSETS`, un error de red en la PWA), la vista se queda
  **en blanco y sin diagnóstico**. Y como `ajustes-card.js:163` cachea la
  tarjeta *antes* del `await card.init()`, la pestaña queda rota de forma
  permanente.
- **Colisiones de CSS entre tarjetas**: cada tarjeta inyecta su `<style>`
  en el documento global, y `.switch`, `.slider` y `.switch-row` están
  definidos con **valores distintos** en `taskManager-card.css:37-72` y
  `settings-card.css:177-217`. El interruptor "Gestionar" se ve de una
  forma u otra según si el usuario pasó antes por Ajustes. El mismo
  problema latente existe con `.day-cell`, `.task-list`, `.empty-day` y
  `.task-badge` entre las dos carpetas `taskItem/`.
- **Acoplamiento implícito entre alta y edición**: `editTask-card.css`
  declara en un comentario que depende de que `addTask-card.css` ya esté
  inyectado, y por eso acumula **21 `!important`**; en JS hay **≈108
  líneas duplicadas** (81 byte-idénticas de 85).
- **Dos "god objects"**: `ui/settings/preferences.js` (711 líneas, ~40
  exports) mezcla el registro de temas, la matemática de color, el cálculo
  de contraste, el saneado de `localStorage` y los temas guardados;
  `ui/settings/settings-card.js` (509 líneas, una clase con ~20 métodos)
  hace de editor, contraste, auto-mapeo y lista de temas.
- **132 líneas muertas** en `ui/taskManager/taskItem/`: nunca importada,
  hace `fetch` de los ficheros de `week/`, su HTML, CSS y JS no se
  corresponden entre sí y sus clases colisionan con las de la semana.
- **≈140 líneas de CSS muerto o duplicado** en `ui/settings/`, más una
  regla global `[hidden] { display: none !important; }` inyectada desde
  una tarjeta que afecta a toda la app.
- **Estado global disperso**: 6 claves de `localStorage` repartidas,
  `window.__TAURI__` invocado desde 6 tarjetas, la lógica de arranque del
  servidor MCP **duplicada** entre `mcp-card.js:121-144` e `index.js:316-326`.
- **Convenciones incumplidas**: colores literales y `font-size` en px en
  `ui/print/print-card.js` (rompen el tema personalizado y el alto
  contraste); `font-size: 0.85rem` sin `var(--fs-*)` en
  `settings-card.css:484`; el puerto MCP en 5 sitios; `'saved:'` en 7
  literales pese a existir `SAVED_PREFIX`; la lista de nombres de días
  copiada 5 veces; **3 implementaciones distintas de escapado de HTML**,
  una de ellas sin escapar comillas.
- **Falta el `role="status"` en la vista Tareas**: los errores de
  validación se muestran con `alert()` nativo, que no es un mensaje de
  estado accesible ni tematizable.

### D. La API pública (`api.js`)

366 líneas bien documentadas, con validación en español y eventos
`planner:changed` / `planner:navigate`. De lo mejor del frontend.

El problema es de **roles**: `api.js` es a la vez (1) la API pública para
asistentes y automatizaciones, (2) el servicio de dominio que construye y
valida tareas y (3) el emisor de eventos. Por eso
`ui/taskManager/addTask/addTask-card.js:1` importa de `../../../api.js`
para construir una tarea: la interfaz depende de "la API pública" para
tarea interna.

Además, el mapa de herramientas MCP está **duplicado**: la constante
`TOOL_TO_API` (`mcp-bridge.js:20-30`) y el `toolMap` interno
(`mcp-bridge.js:38-48`) son idénticos, y **solo se ejecuta el segundo**.
Quien "arregle" el primero no rompe ninguna prueba.

### E. Las pruebas

259 pruebas. Lo que funciona está en §3. Dónde falla:

- **Huecos grandes**: `context.js` (0 aserciones), `ui/a11y.js` (0
  unitarias pese a tener 4 funciones puras), `renderMarkdown` (0),
  `theme-boot.js` (0, pese a ser su única razón de existir),
  `preferences.js` (12 de ~20 exports sin probar, incluido
  `getPreferences()`, que sanea todo lo que entra de `localStorage`),
  `ads/providers/admob.js` (0), `sw.js` (0). **En Rust no hay ni un
  `#[test]`** en 1.050 líneas.
- **Aserciones que pasarían con la app rota**:
  - `08-mcp.spec.mjs:313-328`: "el puerto está cerrado" se cumple si el
    servidor está colgado, si el puerto está ocupado o si la app está rota.
  - `11-edicion-gratuita.spec.mjs:116-136`: un error de red se traduce en
    `{status: 0}` y la prueba pasa.
  - `05-teclado.spec.mjs:289`: `isDisplayed().catch(() => false)` convierte
    un error del driver en "el modal no está visible" → pasa.
  - `12-legal-url-publica.spec.mjs:250-251`: "cualquier color que no sea
    negro puro" como prueba de accesibilidad.
- **El arreglo de T-030 a medias**: `esperarPintado()` solo se usa dentro
  de `irATareas()`. Siguen con navegación cruda y `waitForDisplayed()`:
  `01-tipos-de-repeticion.spec.mjs:145,172,212,242` y
  `10-ajustes.spec.mjs:82`. Como el encabezado de Tareas y el de Ajustes
  ya están en el DOM de la pintada anterior, la espera resuelve al instante
  y el test puede leer el contenido viejo.
- **Fugas de estado entre pruebas**: `api.test.mjs` vacía las tareas pero
  **no restaura la fecha de inicio**; 8 de los 13 specs encadenan `it`
  sobre el estado que dejó el anterior.
- **Esperas fijas** en 4 specs (`browser.pause(200)`, `setTimeout(400)`
  para comprobar que *no* ocurre algo).
- **Overrides que no se restauran**: `03-datos.spec.mjs:177-206` deja
  parcheados `URL.createObjectURL` y `HTMLAnchorElement.prototype.click`
  hasta el final del spec.
- **El puerto MCP 41237 es fijo** y `tools/test.sh` no lo comprueba (sí
  comprueba el 4446 de WebdriverIO).

### F. Capa nativa, build e higiene

**Permisos y superficie de ataque**

- `tauri.conf.json:13` → `withGlobalTauri: true` expone la API Tauri
  completa al webview; la CSP permite scripts remotos de AdSense en el
  mismo contexto; y `capabilities/default.json:23-34` concede
  `fs:allow-write-text-file` sobre `$DOCUMENT/**`, `$DOWNLOAD/**` y
  `$DESKTOP/**`… **para un plugin `fs` que la app no usa en absoluto**
  (el import/export usa `Blob`/`FileReader`). Un compromiso de la cadena de
  anuncios = lectura/escritura del disco + API Tauri + token MCP.
- El token MCP se guarda **en claro en `localStorage`**, se copia al
  portapapeles y se incrusta en una línea de comandos (`claude mcp add …`),
  con lo que acaba en el historial del shell y en `~/.claude.json`.
- La validación de los argumentos de las herramientas MCP está **solo en el
  frontend** (`api.js`): en Rust, `index: i64` sin rango, `view: String`
  sin lista blanca y `spec: Value` arbitrario.

**Rust**

- `std::sync::Mutex` en contexto async con **20 `.lock().unwrap()`** y
  `panic = "abort"`: un solo panic envenena el mutex y aborta la app.
- La rama de cancelación del mapa `pending` (`mcp.rs:319-324`) **no borra
  la entrada**: fuga un `oneshot::Sender` por cada cancelación.
- `mcp_start` no valida el puerto (`port: 0` se acepta) ni el token; dos
  arranques concurrentes (posible: `index.js:321` y `mcp-card.js:135`) se
  pisan.

**Build**

- `build.rs` **no falla si falta `.env`**: degrada a "sin anuncios" en
  silencio. En Android, el mismo fallo deja el **App ID de test de Google**
  en un APK de release.
- `build.rs` copia el frontend a `dist/` pero no emite ninguna directiva
  cuyo valor cambie con su contenido → **riesgo de publicar un binario con
  el frontend anterior**.
- Toolchain sin fijar: no hay `rust-toolchain.toml`, `cargo install` usa
  rangos (`^2.0`), **ninguna llamada a cargo usa `--locked`**, y
  `.cargo/config.toml` no está versionado.
- **Tres scripts de build rotos o inconsistentes**: `tauri.conf.json:65`
  deja el placeholder `[TU_THUMBPRINT_CERTIFICADO_NSIS]` (Tauri no
  interpola variables en el JSON), `tools/build-msix.ps1` no está
  implementado y además escribe dentro de `dist/` (= `frontendDist`), y
  `tools/build-android.sh --aab` nunca genera el AAB. La versión está
  triplicada (`Cargo.toml`, `tauri.conf.json`, `build-msix.ps1`).
- `Cargo.toml:7` declara `rust-version = "1.77"`, un MSRV que ninguna
  versión real del árbol cumple.

**Higiene**

- **No hay `.github/`** (nunca existió en el historial), ni hook de
  pre-commit, ni ESLint/Prettier, ni `.editorconfig`, ni `.gitattributes`,
  ni `LICENSE` en la raíz, ni `CHANGELOG.md`, ni `CONTRIBUTING.md`, ni
  `SECURITY.md`, ni Dependabot, ni `rust-toolchain.toml`.
- `capabilities/*.json` referencian `gen/schemas/`, que está en
  `.gitignore` → en un clon limpio no hay validación de capabilities.
- `logs/` acumula 867 ficheros sin poda.

---

## 5. Hallazgos priorizados

| ID | Hallazgo | Gravedad | Esfuerzo | Dónde |
|----|----------|----------|----------|-------|
| R-01 | Importar un JSON inválido borra las tareas y muestra "✅ 0 importadas"; la rama de error es inalcanzable | 🔴 crítica | S | `ui/dataManager/dataManager-card.js:34-43`, `back/serializer.js:8-16` |
| R-02 | Permisos de escritura en disco no usados (`fs`) + `withGlobalTauri` + scripts remotos de terceros en el mismo webview | 🔴 crítica | M | `src-tauri/capabilities/default.json:23-34`, `tauri.conf.json:13,31` |
| R-03 | Token MCP en claro en `localStorage`, portapapeles e historial del shell | 🔴 crítica | M | `ui/mcp/mcp-card.js:109-111,151-153` |
| R-04 | No hay CI, ni hooks, ni lint: 259 pruebas dependen de que alguien las lance | 🔴 crítica | M | repo |
| R-05 | Cuatro aserciones pasan con la app rota (falsos verdes) | 🔴 crítica | S | `08-mcp:313`, `11-edicion:116`, `05-teclado:289`, `12-legal:250` |
| R-06 | El arreglo de T-030 solo se aplica a `irATareas()`: 5 navegaciones leen el DOM antes de tiempo | 🔴 alta | S | `helpers.mjs:126`, `01-tipos:145,172,212,242`, `10-ajustes:82` |
| R-07 | Colisión de CSS entre tarjetas: el aspecto depende del orden de navegación | 🔴 alta | L | `taskManager-card.css:37-72` vs `settings-card.css:177-217` |
| R-08 | 34 `fetch` sin manejo de errores + tarjeta cacheada antes del `await` → vista en blanco permanente | 🔴 alta | M | `ui/**`, `ui/ajustes/ajustes-card.js:163` |
| R-09 | `context.js` sin ninguna aserción (persistencia y claves de `localStorage`) | 🔴 alta | M | `context.js` |
| R-10 | `preferences.js` (711 l.) y `settings-card.js` (509 l.) concentran 5 responsabilidades | 🟠 alta | L | `ui/settings/` |
| R-11 | `api.js` es a la vez API pública y servicio de dominio; la UI importa de él | 🟠 alta | M | `api.js`, `ui/taskManager/**` |
| R-12 | Duplicación alta↔edición: ≈108 líneas de JS y 21 `!important` por dependencia implícita de CSS | 🟠 alta | M | `ui/taskManager/{addTask,editTask}/` |
| R-13 | Código muerto: `ui/taskManager/taskItem/` (132 l.), `TOOL_TO_API`, `SetTasksFromJson`, `GetRestoOfMonth`, `GetMonth`, `getStart`, `getActiveTab`, `appearanceOnly`, ≈140 l. de CSS, `sw.js` | 🟠 alta | S | varios |
| R-14 | Accesibilidad: los gates de términos y consentimiento declaran `aria-modal` pero no atrapan el foco; el modal legal no tiene `role="dialog"`; la vista Tareas no tiene `role="status"`; 11 emojis sin `aria-hidden`; 4 labels implícitos; 3 pestañas con un único `aria-controls` | 🟠 alta | M | `ui/terms/`, `ui/consent/`, `ui/legal/`, `ui/taskManager/` |
| R-15 | `renderMarkdown` sin pruebas, con 3 escapados de HTML divergentes (uno sin comillas) y URL sin escapar en el `href` | 🟠 alta | M | `ui/legal/legal-card.js:173-236` |
| R-16 | `build.rs` degrada en silencio sin `.env`; en Android deja el App ID de test de Google en un APK de release | 🟠 alta | S | `src-tauri/build.rs:88-90`, `build.gradle.kts:9-11` |
| R-17 | Toolchain sin fijar: sin `rust-toolchain.toml`, sin `--locked`, `.cargo/config.toml` no versionado, MSRV falso | 🟠 alta | S | `tools/build.sh`, `src-tauri/Cargo.toml` |
| R-18 | Riesgo de publicar un binario con el frontend anterior (`build.rs` no emite hash del contenido) | 🟠 alta | S | `src-tauri/build.rs:53-65` |
| R-19 | Tres scripts de build rotos o inconsistentes (NSIS con placeholder, msix sin implementar y escribiendo en `dist/`, `--aab` roto, versión triplicada) | 🟠 alta | M | `tools/`, `tauri.conf.json` |
| R-20 | Cobertura: `ui/a11y.js`, `theme-boot.js`, 12 exports de `preferences.js`, `admob.js` y **todo el Rust** sin pruebas | 🟠 alta | L | varios |
| R-21 | Estado global disperso: 6 claves de `localStorage`, `window.__TAURI__` desde 6 tarjetas, arranque del MCP duplicado | 🟡 media | M | `ui/**`, `index.js` |
| R-22 | Magics que divergen en silencio: puerto MCP en 5 sitios, `'saved:'` en 7, `DAY_NAMES` en 5, tamaño de icono con dos fuentes de verdad | 🟡 media | S | varios |
| R-23 | `back/` con dos estilos y dos idiomas; erratas congeladas por el formato de datos; `Monthly`/`Quaterly`/`Weekly` no creables | 🟡 media | M | `back/**` |
| R-24 | `theme-boot.js` duplica la resolución del tema de `preferences.js` | 🟡 media | S | `theme-boot.js:12-16` |
| R-25 | Fugas de estado y dependencias de orden entre pruebas | 🟡 media | M | `api.test.mjs:50`, 8 specs |
| R-26 | `tools/test.sh` sin endurecer: versión de Node, `node --check`, `cargo test`, cobertura, capturas en fallo, poda de `logs/`, puerto MCP | 🟡 media | M | `tools/test.sh` |
| R-27 | Siete esperas fijas (`browser.pause`, `setTimeout`) en 4 specs | 🟡 media | S | `05-teclado`, `09-sidebar`, `12-legal` |
| R-28 | ≈140 líneas de CSS muerto/duplicado en `ui/settings/` + regla global `[hidden]` filtrada desde una tarjeta | 🟡 media | M | `ui/settings/` |
| R-29 | Dependencias sin usar (`thiserror`, `tauri-plugin-dialog`, `tauri-plugin-fs`) y SDK de Google Mobile Ads desactualizado (23.6.0) | 🟡 media | S | `Cargo.toml`, `build.gradle.kts` |
| R-30 | Documentación legal incoherente con el código (`PRIVACY.md` dice que no hay ads; falta el `LICENSE.txt` de html2pdf que `THIRD_PARTY_LICENSES.md` da por distribuido) | 🟡 media | S | `legal/` |
| R-31 | Mutex envenenado en cascada con `panic = "abort"` + fuga en el mapa `pending` del MCP | 🟡 media | M | `src-tauri/src/mcp.rs` |
| R-32 | `CiclesDaysOfWeekTask.thisDayHas` peta con el ciclo vacío | 🟡 baja | S | `back/daysOfWeek.js:59` |
| R-33 | `index.html`: `theme-color` fijo, emoji del `h1` sin `aria-hidden`, `aria-labelledby` colgantes hasta que JS inyecta, indentación irregular | 🟡 baja | S | `index.html` |
| R-34 | El `Proxy` crea un proxy nuevo por acceso anidado (identidad falsa y basura) | ⚪ trivial | M | `context.js:28-42` |
| R-35 | `package.json` sin `"type": "module"`: Node reinterpreta los ficheros en cada ejecución | ⚪ trivial | S | `package.json` |
| R-36 | Comentarios obsoletos (`api.js:6-7` habla de T-009, ya está hecho) y nomenclatura inconsistente entre carpetas | ⚪ trivial | S | varios |
| R-37 | Falta `LICENSE` en la raíz, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, Dependabot, `.editorconfig` y `.gitattributes` | ⚪ trivial | S | repo |
| R-38 | `capabilities/*.json` referencian `gen/schemas/`, que está en `.gitignore` | ⚪ trivial | S | `src-tauri/capabilities/` |

---

## 6. Conclusión

El proyecto **no tiene un problema de arquitectura**: el dominio está
separado, la API es una fachada limpia, la interfaz son 20 tarjetas
pequeñas y la capa nativa son 1.050 líneas. Lo que tiene es un **problema
de madurez**: faltan las guardas que convierten "funciona en mi máquina" en
"funciona siempre".

El orden que propone el plan es deliberado: primero **frenar las pérdidas**
(pérdida de datos y permisos de sobra), luego **poner las guardas** (CI,
lint, toolchain) para que el resto no se pudra, y solo después **refactorizar
el código**, que es la parte que se puede hacer sin prisas y en commits
pequeños.
