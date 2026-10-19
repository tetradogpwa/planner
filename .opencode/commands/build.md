---
description: Compila la app y deja los binarios en releases/ (/build [linux|windows|android|all] [--debug]; por defecto linux)
agent: planner-worker
---
El usuario quiere compilar la app. Argumentos: `$ARGUMENTS` (si están vacíos, el objetivo es `linux`).

1. Ejecuta `bash tools/build.sh $ARGUMENTS` con un tiempo límite largo (al menos 30 minutos; con `all`, 60), porque una build en release tarda varios minutos. Los argumentos válidos son `linux`, `windows`, `android`, `all` y `--debug`; si te han pasado otro, díselo al usuario y no ejecutes nada.
2. El script carga `.env` por su cuenta. No leas ni muestres `.env`.
3. Al terminar, copia el resumen final del script (✓/✗ por objetivo) y la lista de binarios de `releases/`.
4. Si algo falla:
   - Si faltan requisitos (líneas `✗ Falta …`), muestra al usuario las instrucciones de instalación que imprime el script. No instales nada con `sudo`.
   - Si falla la compilación, resume el primer error con su archivo y su línea.
   - **No modifiques código para arreglarlo**: construir no es una tarea de la cola. Los cambios los pide el usuario a Claude, que los registra como tarea.
