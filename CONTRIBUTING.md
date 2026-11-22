# Cómo contribuir al Planificador Semanal

Este proyecto se trabaja con un **ciclo de tareas supervisado**: las
peticiones se registran en una cola, un desarrollador las implementa y
otra persona las revisa antes de que se suban. Este documento explica
cómo se trabaja aquí.

Antes de nada, lee [`CLAUDE.md`](./CLAUDE.md): es la referencia de la
estructura del proyecto, de las convenciones y de las comprobaciones
obligatorias.

---

## 1. La cola de tareas

Las peticiones no se/issues: viven en **`.tasks/tasks.json`**, que se
gestiona **solo** con el script de la cola:

```bash
node tools/tasks/tasks.mjs list          # tareas abiertas
node tools/tasks/tasks.mjs show T-000    # detalle de una tarea
```

`node tools/tasks/tasks.mjs` sin argumentos muestra la ayuda. La cola
la lleva el supervisor; **no se edita `.tasks/` a mano**.

El flujo habitual es:

1. El supervisor registra la petición y escribe los criterios de
   aceptación.
2. Se implementa **una sola tarea** por ronda.
3. Se revisa el resultado: o se aprueba y se sube, o se devuelve con
   correcciones concretas.
4. Cada tarea aprobada es **un commit** con el mensaje
   `T-0XX: título`.

---

## 2. Antes de entregar: las pruebas tienen que estar en verde

**Ninguna tarea se entrega sin sus pruebas en verde.** El script del
repo lo lanza todo:

```bash
bash tools/test.sh              # unitarias + E2E
bash tools/test.sh unit         # solo unitarias (segundos)
bash tools/test.sh e2e          # solo E2E (compila la app real)
bash tools/test.sh e2e --spec tests/e2e/specs/00-arranque.spec.mjs
```

Además del script:

```bash
npm run lint                    # ESLint sobre el frontend y las pruebas
node --check ruta/al/archivo.js # sintaxis de cada JS que tocas
(cd src-tauri && cargo check)   # si cambias Rust, build.rs o tauri.conf.json
```

> **Nunca lances `wdio` a pelo**: abriría la ventana de la app en tu
> escritorio y usaría tus datos reales. `tools/test.sh` aísla los datos
> y usa un servidor gráfico invisible.

`npm run lint` necesita las dependencias de la raíz (una sola vez):

```bash
npm ci
```

---

## 3. Qué se escribe y cómo

- Todo el texto de la interfaz, los comentarios y la documentación van
  en **español**.
- La app **no lleva npm ni bundler**: es JavaScript de navegador que se
  carga tal cual. No se añaden dependencias en tiempo de ejecución al
  frontend. Las dependencias de npm que existen (las de las E2E y las
  del linter) son **herramientas de desarrollo**, no de la app.
- Cada tarjeta es una clase con `init()` que hace `fetch` de su
  `.html` y su `.css` y los inyecta. Se sigue ese patrón; no se
  introducen frameworks ni dependencias npm en el frontend.
- Si añades un fichero o carpeta **en la raíz** que use el frontend,
  añádelo a `WEB_ASSETS` en `src-tauri/build.rs`; si no, no llegará a
  la app compilada.
- **Accesibilidad**: colores solo con las variables de `index.css`,
  contraste WCAG AA, tamaños de letra en `rem` multiplicados por su
  variable, `label` para cada campo, foco de teclado visible. Se
  revisa en cada tarea.
- El formato lo marcan [`.editorconfig`](./.editorconfig) y
  [`.gitattributes`](./.gitattributes): 2 espacios, LF, UTF-8. **No se
  reformatea el código existente** (el diff tiene que poder revisarse);
  tampoco se aplica Prettier: su configuración está en
  [`.prettierrc`](./.prettierrc) solo como referencia para el futuro.

---

## 4. Cómo se añade una prueba

Las pruebas están en `tests/unit/` (lógica, con `node:test`, sin
dependencias) y en `tests/e2e/` (la app real, con WebdriverIO).

### Una prueba unitaria (`tests/unit/*.test.mjs`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GetNWeeks } from '../../back/calendar.js';

test('devuelve una semana por cada intervalo', () => {
  const semanas = GetNWeeks(new Date(2026, 0, 5), 4, 0, []);
  assert.equal(semanas.length, 4);
});
```

- El fichero se llama `algo.test.mjs` (el glob de `tools/test.sh` lo
  recoge solo).
- No se imita la lógica: se importa el módulo real y se comprueba lo
  que hace.
- Si la prueba necesita navegador, se prepara un stub mínimo en
  `globalThis` (como `localStorage` y `window`) antes del import
  dinámico del módulo.

### Una prueba E2E (`tests/e2e/specs/*.spec.mjs`)

- Un archivo por recorrido de la interfaz, en orden: `NN-nombre.spec.mjs`.
- Se recorre **como lo haría una persona** (clics y teclado), nunca
  tocando el estado interno de la app.
- Los helpers comunes van en `tests/e2e/helpers.mjs`.
- Los selectores se comprueban con `waitForDisplayed()` /
  `waitForExisting()` antes de interactuar: si no, la prueba falla
  por tiempo de espera y no dice qué pasó.

### Reglas que no se rompen

- **Una prueba solo vale si falla al romper el código que prueba.**
  Antes de darla por buena, rompe el código a propósito y comprueba
  que la prueba se pone en rojo.
- **Ninguna prueba se borra, se rebaja ni se salta** para que pase.
  Si una prueba falla porque el comportamiento cambió a propósito, se
  actualiza con el mismo commit del cambio y se dice por qué en el
  mensaje del commit.
- Las pruebas E2E no dependen del orden: cada spec abre su propia
  sesión y empieza con los datos vacíos.

---

## 5. El CI

Cada push y cada PR a `main` lanzan tres jobs independientes
(`unit`, `rust`, `e2e`) y, desde T-037, también `lint`. Si alguno
falla, los demás siguen: el CI no depende de credenciales ni de
secretos, todo es local.

Para que `main` no acepte un merge con el CI en rojo hay que **activar
una vez a mano** la protección de rama en GitHub. Está explicado paso a
paso (con los nombres exactos de los checks) en
[`README-TAURI.md`](./README-TAURI.md), sección
«Integración continua (CI)».

---

## 6. Los ficheros de la raíz

| Fichero | Para qué |
|----------|----------|
| `CLAUDE.md` | Convenciones del proyecto (léelo primero) |
| `CONTRIBUTING.md` | Este documento |
| `CHANGELOG.md` | Qué cambió en cada versión |
| `SECURITY.md` | A quién avisar de un fallo de seguridad |
| `LICENSE` | Licencia del proyecto (copia de `legal/LICENSE`) |
| `eslint.config.js` | Configuración del linter |
| `.editorconfig` / `.gitattributes` | Convenciones de formato y de fin de línea |
| `.github/dependabot.yml` | Actualizaciones automáticas de npm y cargo |

---

## 7. Si algo no está claro

- `CLAUDE.md` responde a casi todo lo estructural.
- `docs/roadmap-mantenimiento.md` dice qué está planeado y por qué.
- `docs/revision-senior.md` recoge la revisión del proyecto y sus
  hallazgos.
- Si una decisión no está escrita en ningún sitio, se pregunta antes
  de improvisar: el criterio del proyecto es que las pruebas y el
  código expliquen la decisión.
