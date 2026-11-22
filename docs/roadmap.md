# Roadmap de cierre del Planificador Semanal

Fecha: 22 de noviembre de 2026
Estado: la app está terminada en lo funcional; queda cerrar el trabajo
para poder publicarla.

Este documento es el plan para acabar el proyecto: qué falta, en qué
orden y con qué criterio se da por bueno cada paso. La cola de
tareas (`.tasks/tasks.json`) sigue siendo la fuente de verdad de lo
que se está implementando; aquí está el panorama completo.

> Complemento: la [revisión senior del proyecto](./revision-senior.md) y su
> [plan de mantenimiento](./roadmap-mantenimiento.md) cubren la otra
> mitad del trabajo — calidad interna, cobertura, CI y build. Este
> documento es el de "acabar y publicar"; aquel, el de "que no se pudra".

---

## 1. Dónde estamos

| Dato | Valor |
|------|-------|
| Tareas en la cola | 30 (29 hechas, T-030 en revisión) |
| Pruebas unitarias | 131, todas en verde |
| Specs E2E (app real) | 13, todas en verde |
| Commits locales sin subir | 0 (`main` está sincronizado con `origin/main`) |
| Código del frontend | ~1.600 líneas en la raíz + 20 tarjetas en `ui/` |
| Binarios publicados | 1 AppImage de Linux (octubre); faltan Windows y Android |

### Lo que la app ya hace

- **Tareas y repeticiones**: sin repetición, diaria, cada N días, días
  concretos y ciclos personalizados; con límite de horas y veces por día.
- **Vistas**: Semana, vista completa de 12 semanas, Gestionar (crear,
  editar, borrar) y Ajustes por pestañas (Datos, Imprimir y PDF,
  Apariencia, Legal, Accesibilidad).
- **Datos**: todo en `localStorage`, sin servidor ni cuentas. Importar y
  exportar JSON, exportar PDF (semana actual y rango), borrar todo.
- **Apariencia**: tema claro, oscuro, alto contraste y personalizado,
  con tamaño de letra del 100 % al 200 %, y sugerencias de contraste
  que llegan al mínimo pedido.
- **Accesibilidad**: navegación completa con teclado, atajos (Alt+1…8,
  Alt+N, "?"), trampa de foco en los diálogos, foco devuelto al
  elemento que abrió cada diálogo, `aria-current`, `role="status"`.
- **Nativo**: empaquetada con Tauri 2 para Linux (AppImage), Windows
  (NSIS) y Android (APK).
- **Extras**: API interna y servidor MCP local para asistentes,
  términos y consentimiento previo, edición gratuita sin anuncios.

### Lo único que faltaba

Una tarea abierta, **T-030**: un fallo intermitente en los E2E de
`03-datos`. Ya está medida, corregida y verificada (ver fase 1). Con
ella cerrada, la cola queda vacía.

---

## 2. Fases para acabarla

### Fase 1 — Cerrar T-030 (el fallo intermitente) · *hecha, en revisión*

**Causa medida.** La app activa una vista (le pone la clase `active`)
*antes* de pintarla, porque el pintado es asíncrono (trae el HTML y el
CSS de la tarjeta). Las pruebas navegaban y leían el DOM nada más
volver al menú: a veces leían el contenido del pintado anterior. En
`03-datos` eso era la lista de tareas vacía cuando esperaba 3.

**Arreglo.** Dos mitades, ninguna es rebajar la prueba:

1. *App* (`index.js`): al terminar cada render se emite el evento
   `planner:painted` con la vista pintada. "Visible" deja de
   confundirse con "al día".
2. *Pruebas* (`tests/e2e/helpers.mjs`): el helper `irATareas()` espera
   ese aviso antes de leer la lista. El helper nuevo
   `esperarPintado(accion)` sirve para cualquier navegación.

**Comprobado en rojo**: sin el evento, `00-arranque` y `03-datos` fallan;
sin que la app aplique lo importado, `03-datos` vuelve a fallar con la
lista vacía (el síntoma que reporting el supervisor).

**Criterio de cierre**: diez ejecuciones seguidas de la suite E2E
completa en verde, en weston (Wayland invisible) y en Xvfb. *Hecho:
20 de 20 (10 en weston + 10 en Xvfb), todas en verde.*

### Fase 2 — Commit y subida · *pendiente*

- Un commit por funcionalidad, con el mensaje `T-00X: título`, solo
  con los archivos de esa tarea.
- `main` está 28 commits por delante de `origin/main`: subirlos con
  `git push origin main` (nadie los sube sin que lo pida el usuario).
- Los cambios del ciclo autónomo (statusline, `npx status`, skill
  `avanzar`, `lanzar.sh`, `diff --total`) también están sin commitear.

### Fase 3 — Builds de publicación · *pendiente*

| Plataforma | Estado en esta máquina | Qué falta |
|------------|------------------------|-----------|
| Linux (AppImage) | ✓ compila | nada; hay que regenerarlo con el código final |
| Windows (NSIS) | ✗ | `cargo-xwin`, `makensis` (nsis), `llvm` |
| Android (APK) | ✗ | SDK + NDK, `cargo tauri android init` |

El script `tools/build.sh all` genera los tres y los deja en
`releases/` (ignorada por git). En Linux solo hace falta el AppImage;
Windows y Android requieren instalar las dependencias de la tabla
anterior o hacerlo en otra máquina.

### Fase 4 — Revisión final · *pendiente*

- `cargo check` y `node --check` en todo lo tocado (verde).
- `bash tools/test.sh` completo (unitarias + E2E) en verde.
- Un repaso de accesibilidad con la app abierta: recorrido completo
  solo con teclado, letra al 200 % en un móvil de 390 px, y contraste
  en los cuatro temas.
- Revisar `legal/` (los textos tienen fecha de "Última actualización";
  cambiarlos obliga a volver a pedir los términos) y `docs/publicacion-comercial/`.

### Fase 5 — Publicación · *pendiente*

- Anotar la versión en `src-tauri/tauri.conf.json` y `package.json`.
- Subir los binarios de `releases/` a la página de publicación y a la
  tienda (con los textos de `docs/publicacion-comercial/legal/`).
- Publicar las notas de la versión.

---

## 3. Cuándo se da por terminada

- [ ] T-030 cerrada y aprovada por el supervisor.
- [ ] `bash tools/test.sh` en verde (unitarias + E2E).
- [ ] Diez suites E2E seguidas en verde en weston y en Xvfb.
- [ ] Todo el trabajo está en commits y subido a `origin/main`.
- [ ] `releases/` tiene los binarios de las plataformas que se publican.
- [ ] Los textos legales y de publicación están al día.
- [ ] La app se ha recorrido a mano (teclado, letra grande, temas) y
      no aparece ningún fallo pendiente.

---

## 4. Riesgos y decisiones pendientes

| Riesgo | Por qué importa | Qué se hará |
|--------|-----------------|--------------|
| Los E2E dependen de WebKitGTK en headless | Es la parte más frágil del proyecto: ya dio dos sustos (T-020, T-030) | El helper `esperarPintado()` cubre toda la familia de fallos "leer el DOM antes de tiempo"; no añadir esperas ad hoc en cada spec |
| La app no se puede compilar para Windows ni Android aquí | Falta SDK, NDK y toolchain cruzada | Instalar lo de la fase 3 o publicar esos binarios desde otra máquina |
| 29 commits sin subir | Cualquier otra persona ve un repo con 3 commits | Subir en cuanto el supervisor apruebe T-030 |
| El ciclo automático depende de `opencode.json` | Los permisos del agente (`planner-worker`) son la barrera que impide commits accidentales; hoy el fichero dice "MiniMax nunca hace commits" pero la sesión permite commit y push | Decidir una regla y dejarla escrita en el fichero y en `CLAUDE.md`: o el agente puede commitear bajo petición, o los commits son siempre del supervisor |

---

## 5. Cómo se trabaja aquí

- Una tarea cada vez, en la cola de `.tasks/`, con `tasks.mjs`.
- Un commit por funcionalidad implementada y probada.
- `bash tools/test.sh` antes de entregar cualquier cosa.
- El supervisor (Claude) revisa el diff y los criterios de aceptación;
  MiniMax implementa.
