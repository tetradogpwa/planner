---
description: Ejecuta las pruebas (/test [unit|e2e|all] [--spec ruta]; por defecto todas)
agent: planner-worker
---
El usuario quiere pasar las pruebas. Argumentos: `$ARGUMENTS` (vacío = todas).

1. Ejecuta `bash tools/test.sh $ARGUMENTS` con un tiempo límite largo (al menos 20 minutos si incluye `e2e`, porque compila el binario de pruebas). Argumentos válidos: `unit`, `e2e`, `all` y `--spec tests/e2e/specs/<archivo>`.
2. **Nunca lances `wdio` ni `npx wdio` directamente**: sin `tools/test.sh` la ventana se abre en el escritorio del usuario y las pruebas usarían sus datos reales.
3. Copia el bloque "Resumen" del script. Si algo falla, busca en el log que indica (`grep -n`) el nombre de la prueba y el error, y explica qué esperaba y qué obtuvo.
4. No cambies código ni pruebas para que pasen: díselo al usuario, que pedirá a Claude que lo registre como tarea.
