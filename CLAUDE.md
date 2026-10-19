# Planificador Semanal

Planificador de tareas y hábitos 100 % local (sin servidor ni cuentas).
Frontend en JavaScript sin framework ni bundler; se empaqueta con
**Tauri 2** para Linux, Windows y Android. Todo el texto de la interfaz,
los comentarios y la documentación van en **español**.

## Cómo trabajamos: supervisor y desarrollador

- **Claude (supervisor)** recibe las peticiones del usuario, las registra
  como tareas, las delega a MiniMax, revisa el resultado y lo aprueba o lo
  devuelve con correcciones. Skills: `registrar-tarea`, `delegar-minimax`,
  `revisar-tarea`.
- **MiniMax (desarrollador)** implementa una tarea cada vez con OpenCode
  (`opencode run --agent planner-worker`), lanzado por
  `tools/minimax/run-task.sh`. Sus permisos están en `opencode.json`
  (agente `planner-worker`) y sus reglas extra en
  `tools/minimax/worker-prompt.md`.
- El usuario también puede hablar con MiniMax directamente en OpenCode
  ("haz la siguiente tarea" o `/siguiente [T-00X]`). OpenCode solo lee
  `AGENTS.md`, que le indica usar `tasks.mjs empezar` (foto, estado
  `en_curso` e instrucciones) y `tasks.mjs terminar T-00X` (pasa a
  `en_revision`). Revísalas igual que las lanzadas con `run-task.sh`.
- Cola de tareas: `.tasks/tasks.json`, gestionada solo con
  `node tools/tasks/tasks.mjs` (ejecútalo sin argumentos para ver la ayuda).
  Una petición que modifica una tarea **no terminada** se añade a esa tarea
  (`amend`); una tarea **hecha** no se modifica, se crea otra con
  `--relacionada`.

## Estructura

| Ruta | Contenido |
|------|-----------|
| `index.html`, `index.js`, `index.css` | Arranque, navegación entre vistas y estilos globales con los tokens de tema |
| `context.js` | Estado global (tareas y fecha de inicio) persistido en `localStorage` |
| `back/` | Lógica de tareas recurrentes y calendario (sin DOM) |
| `ui/<vista>/` | Una vista o tarjeta por carpeta: `x-card.js` + `x-card.html` + `x-card.css` |
| `ui/settings/preferences.js` | Tema (claro, oscuro, alto contraste, personalizado) y tamaños de letra |
| `theme-boot.js` | Aplica tema y tamaños antes del primer pintado (script clásico) |
| `ads/`, `monetization.js` | Anuncios: fachada común y un proveedor por plataforma |
| `ui/terms/`, `ui/consent/` | Pantallas previas a la app: términos y consentimiento o pago |
| `legal/` | Textos legales en Markdown que muestra la app |
| `src-tauri/` | Capa nativa Rust; `build.rs` incrusta `.env` y copia el frontend a `dist/` |
| `tools/` | Scripts de build por plataforma, cola de tareas y lanzador de MiniMax |

## Convenciones obligatorias

**Vistas y componentes**
- Cada tarjeta es una clase con `init()` que hace `fetch` de su `.html` y
  su `.css` y los inyecta (`<style>${css}</style>${html}`). Sigue ese
  patrón; no añadas frameworks ni dependencias npm.
- Importa con rutas relativas y extensión `.js` (módulos ES nativos).
- Si añades un archivo o carpeta **en la raíz** que use el frontend,
  añádelo a `WEB_ASSETS` en `src-tauri/build.rs`; si no, no llegará a la
  app compilada.

**Accesibilidad (se revisa en cada tarea)**
- Colores solo con las variables de `index.css` (`--text`, `--surface`,
  `--btn-bg`, `--on-btn`, `--danger`…). Nunca colores fijos en los
  componentes: rompen el tema claro, el oscuro, el alto contraste y el
  personalizado.
- Contraste WCAG AA: 4,5:1 para texto y 3:1 para bordes de controles y
  foco. Si creas un par texto/fondo nuevo, compruébalo en los dos temas.
- Tamaños de letra en `rem` y multiplicados por la variable de su parte:
  `font-size: calc(0.875rem * var(--fs-button))`. Partes: `title`,
  `label`, `nav`, `button`, `input`, `chip`, `task`, `meta`, `body`, `doc`.
- Márgenes de contenedores con `clamp(12px, 3vw, 1.5rem)`, no en `rem`,
  para que la letra grande no se coma el ancho en el móvil.
- Nada debe salirse de la pantalla con letra al 200 % en un móvil de
  390 px: usa `flex-wrap`, `min-width: 0` y `overflow-wrap`.
- Cada campo con su `<label for>`; emojis decorativos con
  `aria-hidden="true"`; mensajes de estado con `role="status"`; foco de
  teclado visible.

**Otros**
- Nunca subas ni muestres secretos: `.env` está en `.gitignore`; las
  plantillas van en `.env.example`.
- Los textos de `legal/` tienen fecha de "Última actualización": si la
  cambias en `TERMS.md` o `EULA.md`, se vuelven a pedir los términos a
  todos los usuarios.
- Los anuncios exigen consentimiento; no muestres anuncios ni cargues
  scripts de Google fuera de `ads/` y `monetization.js`.

## Comprobaciones

```bash
node --check ruta/al/archivo.js            # cada JS modificado
(cd src-tauri && cargo check)              # si cambias Rust, build.rs o tauri.conf.json
node tools/tasks/tasks.mjs list            # tareas abiertas
bash tools/minimax/run-task.sh --check     # configuración de MiniMax
```

No hay tests automáticos todavía. Las vistas se prueban abriendo la app
(`cargo tauri dev` en `src-tauri/`) o sirviendo la raíz con un servidor
estático.
