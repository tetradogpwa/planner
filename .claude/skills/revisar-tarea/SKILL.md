---
name: revisar-tarea
description: Revisa el trabajo que MiniMax ha hecho en una tarea (diff desde la foto, criterios, convenciones de CLAUDE.md, comprobaciones) y la aprueba o la devuelve con correcciones concretas. Úsala cuando una tarea pase a en_revision o el usuario pida revisar lo que ha hecho MiniMax.
---

# Revisar una tarea de MiniMax

Eres el supervisor: el usuario confía en que nada llega a "hecha" sin tu
revisión. Sé exigente con el alcance y la accesibilidad, y concreto en
las correcciones.

## 1. Reunir el material

```bash
node tools/tasks/tasks.mjs show T-00X          # petición, criterios y modificaciones
node tools/tasks/tasks.mjs diff T-00X --stat   # archivos tocados desde la foto
node tools/tasks/tasks.mjs diff T-00X          # diff completo
tail -n 60 "$(ls -t .tasks/logs/T-00X-*.log | head -1)"   # resumen de MiniMax
```

**No te fíes del resumen de MiniMax**: en las pruebas afirmó que un
comando había fallado cuando sí se había ejecutado. La verdad está en el
diff y en las líneas de herramientas del registro (`←` escritura, `$`
comando, `✗` fallo).

El diff compara con la foto tomada justo antes de que MiniMax empezara,
así que solo contiene su trabajo (y cualquier cambio que haya hecho el
usuario mientras tanto: si ves algo ajeno, pregunta antes de culpar a
MiniMax).

## 2. Comprobar

1. **Criterios:** cada criterio de aceptación se cumple. Incluye las
   modificaciones (`+`) añadidas después de crear la tarea.
2. **Alcance:** no hay cambios ajenos a la tarea, como refactors,
   renombrados, archivos de formato o borrados no pedidos.
3. **Convenciones de CLAUDE.md:**
   - Colores solo con tokens.
   - Tamaños con `calc(Xrem * var(--fs-…))`.
   - Márgenes de contenedor con `clamp`.
   - `label for` en los campos y `aria-hidden` en los emojis.
   - Archivos nuevos en la raíz añadidos a `WEB_ASSETS`.
   - Textos en español.
4. **Seguridad:** nada de secretos ni claves en el código; nada que cargue
   scripts externos fuera de `ads/`.
5. **Ejecuta:**
   ```bash
   node --check <cada .js modificado>
   (cd src-tauri && cargo check)   # si cambió Rust, build.rs o tauri.conf.json
   bash tools/test.sh              # unitarias + E2E (en segundo plano: compila)
   ```
   No te fíes del "Resumen" que pegue MiniMax: ejecútalo tú.
6. **Pruebas de la tarea:**
   - Si cambió lógica o un flujo, hay una prueba nueva o ampliada que lo
     cubre (`tests/unit/` o `tests/e2e/specs/`).
   - La prueba ejecuta el código real: rómpelo tú a propósito (con copia
     de seguridad del archivo) y comprueba que se pone en rojo.
   - En el diff de `tests/` no hay pruebas borradas, rebajadas ni con
     `.skip`/`.only`, ni cambios en `tools/test.sh` o `wdio.conf.mjs`
     que la tarea no pidiera.
7. **Interfaz:** si la tarea cambia la UI, ábrela y compruébala en tema
   claro y oscuro y con letra al 200 % en un ancho de móvil. Para medir el
   contraste de un par nuevo, usa `contrastRatio` de
   `ui/settings/preferences.js`.

## 3. Veredicto

**Aprobar** (solo con `bash tools/test.sh` en ✓, ejecutado por ti):
```bash
node tools/tasks/tasks.mjs status T-00X hecha --note "Qué se comprobó"
```

**Y hacer commit en el acto** (regla del proyecto: un commit por
funcionalidad implementada y probada):
- Solo los archivos de esa tarea (los de `tasks.mjs diff T-00X --stat`)
  más `.tasks/tasks.json`. Nunca `git add -A` ni `git add .`: puede
  haber trabajo de otras tareas sin revisar en el árbol.
- Revisa con `git status` lo que va a entrar antes de confirmar.
- Mensaje: `T-00X: título de la tarea`, y en el cuerpo qué cambió, qué
  pruebas lo cubren y el resultado de `bash tools/test.sh`.
- No hagas `git push`: eso lo decide el usuario.

**Devolver:** una corrección por problema, accionable y con su ubicación:
```bash
node tools/tasks/tasks.mjs feedback T-00X --note "ui/x/x-card.css:42 usa #fff; usa var(--on-btn)"
```
Después vuelve a lanzarla con la skill `delegar-minimax`.

- **Arreglos triviales** (un token, una errata): puedes corregirlos tú y
  aprobar, anotándolo en la nota.
- **Tres intentos fallidos** (`attempts` ≥ 3 en `show`): no la devuelvas
  más. Corrígela tú o consulta al usuario.
- **Tarea mal planteada:** si el problema es de la tarea y no del trabajo,
  pregunta al usuario y ajusta la tarea con `amend`.

## 4. Informar al usuario

Breve:
- Qué tarea, veredicto y qué cambió (archivos principales).
- Qué comprobaste y qué no pudiste comprobar.
- Si se aprobó, el hash del commit.
- Si se devolvió, por qué.
