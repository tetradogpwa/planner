# Changelog

Todos los cambios relevantes del Planificador Semanal se anotan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

La app se publica tal cual (`releases/`) y **todavía no hay etiquetas
de versión en Git**: el número de versión que ve el usuario es el de
`src-tauri/Cargo.toml` (0.1.0). Este archivo se mantiene a mano a
partir de `git log`.

## [0.1.0] - 2026-11-22

Primera versión pública de la app: un planificador de tareas y hábitos
100 % local, empaquetado con Tauri 2 para Linux, Windows y Android, y
también disponible como PWA.

### Añadido

- **T-037 — Linter, formato y los ficheros que faltan.** ESLint 10 con
  configuración plana (`eslint.config.js`) sobre el frontend, las
  pruebas y las herramientas; `.editorconfig` y `.gitattributes` con las
  convenciones de formato (2 espacios, LF, UTF-8); `LICENSE`,
  `CHANGELOG.md`, `CONTRIBUTING.md` y `SECURITY.md` en la raíz;
  Dependabot para npm y cargo; y un job `lint` en el CI.
- **T-036 — CI: que las pruebas se lanzan solas.** Tres jobs
  independientes (`unit`, `rust`, `e2e`) que se ejecutan en cada push y
  en cada PR, con los logs siempre subidos como artefacto.
- **T-035 / T-034 — Build arreglado.** `tools/build.sh` vuelve a
  funcionar y un build de release no puede salir sin `.env` ni con el
  App ID de prueba de Android.
- **T-033 — El token del servidor MCP no vive en texto plano.** Lo
  genera y guarda la capa nativa (fichero con permisos `0600`); el
  frontend solo lo pide con `invoke('mcp_token')`.
- **T-032 — Permisos ajustados a lo que la app usa.** Se retiran los
  plugins `fs` y `dialog` (y `withGlobalTauri`) que no se usaban.
- **T-031 — Importar un JSON inválido ya no borra las tareas.** Ahora
  avisa del error en vez de dejar la lista vacía sin decir nada.
- **T-030 — Estabilidad de la E2E de datos.** Corregido un fallo
  intermitente al cancelar el borrado de todo.
- **T-029 / T-028 / T-027 — Textos legales.** Los documentos se abren
  en su URL pública, sin referencias a dominios propios y con el
  correo de contacto relleno.
- **T-026 / T-025 / T-024 — Detalles de uso.** "Gestionar" sigue
  activo al volver a la vista Tareas, la trampa de foco de los diálogos
  no deja salir el Tab y `Alt+N` enfoca el campo de nueva tarea desde
  cualquier vista.
- **T-023 — Edición gratuita sin anuncios.** Se ocultan la
  monetización y los datos de comerciante mientras la build no lleve
  claves de anuncios.
- **T-022 / T-021 / T-019 — Ajustes con pestañas.** El apartado
  Ajustes se reorganiza en pestañas ordenadas por temas, con una vista
  nueva de Accesibilidad y sugerencias de contraste que alcanzan el
  mínimo pedido.
- **T-020 — E2E en un Wayland invisible.** La suite completa contra la
  app real se ejecuta sin abrir una ventana en el escritorio.
- **T-017 — Apariencia y letra al 200 % sin desbordar en móvil.**
- **T-018 / T-016 / T-015 / T-014 — Cobertura E2E.** Uso completo con
  teclado, importar/exportar/borrar datos y exportar PDF, editar y
  borrar tareas con el foco en su sitio, y crear tareas de cada tipo.
- **T-013 / T-012 — Pruebas unitarias.** Cobertura del resto de
  `back/` y de las preferencias de apariencia, y corrección del desfase
  de días tras el cambio de hora.
- **T-010 — Menú contraído en escritorio.** Los botones tienen el
  mismo tamaño expandido que contraído.
- **T-009 / T-008 — Servidor MCP y API interna.** Un servidor MCP
  local en `127.0.0.1` para que un asistente use la app, y la API
  interna del planificador como base.
- **T-007 — Uso completo con teclado.** Atajos, foco y diálogos
  accesibles.
- **T-011 — Atajos de teclado.** Se quita el botón redundante de
  Apariencia.
- **Comando `/build`.** Compila Linux, Windows o Android bajo demanda
  (`bash tools/build.sh`).
- **Build unificado.** `tools/build.sh` genera AppImage, APK y EXE
  (con `--all`).
- **App nativa con Tauri 2.** Apariencia accesible, términos de uso y
  anuncios con consentimiento.
- **Pruebas reales.** Unitarias (`node:test`) y E2E de la app
  compilada (WebdriverIO + `tauri-driver`).
- **Ciclo autónomo del supervisor.** La cola de tareas en `.tasks/`,
  la línea de estado de la terminal y el roadmap de cierre.

### Corregido

- Se corrigió el desfase de días tras el cambio de hora (T-012).
- La E2E de datos ya no falla de forma intermitente al cancelar el
  borrado (T-030).
- Los scripts de build volvieron a funcionar en un clon limpio (T-035).
