---
name: build
description: Compila la app con Tauri para Linux (AppImage, por defecto), Windows (.exe NSIS), Android (APK) o todas ("all") y deja los binarios en releases/ (raíz, ignorada por git). Úsala cuando el usuario escriba /build [linux|windows|android|all] [--debug] o pida generar los ejecutables o instaladores.
---

# Build de la app

Todo lo hace `tools/build.sh`, que compila cada objetivo, copia los
binarios a `releases/` y termina con un resumen ✓/✗ por objetivo.
Construir no es una tarea de la cola: no registres tarea ni la delegues.

## 1. Interpretar los argumentos

| El usuario dice | Comando |
|-----------------|---------|
| `/build` o `/build linux` | `bash tools/build.sh linux` |
| `/build windows` | `bash tools/build.sh windows` |
| `/build android` | `bash tools/build.sh android` |
| `/build all` | `bash tools/build.sh all` |
| varios, p. ej. `/build linux android` | `bash tools/build.sh linux android` |
| cualquiera con `debug` | añade `--debug` |

Si el argumento no es ninguno de esos, pregunta en lugar de suponer.

## 2. Ejecutar

Una build en release tarda varios minutos (y `all` bastante más).
Lánzala en segundo plano (`run_in_background`) y espera al aviso de que
ha terminado; no hagas sondeos periódicos.

El script carga `.env` por su cuenta, sin mostrar los valores. **No
leas ni muestres `.env`.**

## 3. Informar

- Copia el resumen final del script: ✓/✗ por objetivo y el listado de
  `releases/`, con las rutas completas de los binarios nuevos.
- Si un objetivo falla por **requisitos** (líneas `✗ Falta …` con
  `→ cómo instalarlo`), pásale al usuario esas instrucciones tal cual.
  No instales nada con `sudo` ni cambies el sistema sin preguntar.
- Si falla la **compilación** (error de Rust, de `build.rs` o de
  Gradle), resume el primer error con su archivo y su línea. Si hace
  falta cambiar código de la app, propón registrarlo como tarea
  (`registrar-tarea`); no lo arregles sobre la marcha.
- Con varios objetivos, un fallo no detiene los demás: informa de todos.

No hagas commits: `releases/` está ignorada por git y no se sube.
