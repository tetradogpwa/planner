---
name: test
description: Ejecuta las pruebas del Planificador con tools/test.sh — unitarias de back/ (node:test) y E2E contra la app real (WebdriverIO + tauri-driver en un Wayland invisible, weston sin pantalla) — y resume el resultado. Úsala cuando el usuario escriba /test [unit|e2e|all] [--spec ruta], pida pasar las pruebas, o al revisar una tarea de MiniMax.
---

# Pruebas del Planificador

Todo pasa por `tools/test.sh`. **Nunca lances `wdio` ni `npx wdio` a
pelo**: el script es el que pone el weston sin pantalla (si no, la ventana sale en el
escritorio del usuario y le roba el foco), la carpeta de datos aislada
(si no, las pruebas borrarían sus tareas reales) y el binario sin
anuncios.

## 1. Argumentos

| El usuario dice | Comando |
|-----------------|---------|
| `/test` o `/test all` | `bash tools/test.sh` |
| `/test unit` | `bash tools/test.sh unit` |
| `/test e2e` | `bash tools/test.sh e2e` |
| `/test e2e <spec>` | `bash tools/test.sh e2e --spec tests/e2e/specs/<spec>` |

## 2. Ejecutar

- `unit` tarda segundos: ejecútalo en primer plano.
- `e2e` (y `all`) compila el binario de pruebas en
  `src-tauri/target-e2e/` antes de lanzar los specs: varios minutos la
  primera vez. Lánzalo en segundo plano (`run_in_background`) y espera
  al aviso de que ha terminado.

## 3. Informar

El script imprime solo el resumen; la salida completa queda en
`logs/test-<objetivo>-<fecha>.log`. Para un fallo, lee el log con
`grep -n` o por rangos alrededor de la línea que indica el resumen; no
lo cargues entero.

- Todo ✓: dilo en una línea con los recuentos.
- Un ✗ por **requisitos** (`✗ Falta …`): pasa la instrucción de
  instalación al usuario; no instales nada con `sudo` sin preguntar.
- Un ✗ en una **prueba**: nombra la prueba, qué esperaba y qué obtuvo,
  y si el fallo está en la app o en la prueba. Un arreglo de la app se
  registra como tarea (`registrar-tarea`), no se hace sobre la marcha.
- Nunca "arregles" una prueba rebajándola, con `.skip`/`.only`, ni
  cambiando `tools/test.sh` o `wdio.conf.mjs` para que pase.

## 4. Escribir pruebas (referencia)

- **Unitarias** (`tests/unit/*.test.mjs`): `node:test` + `node:assert`,
  importando `back/` con rutas relativas. Para lógica sin DOM.
- **E2E** (`tests/e2e/specs/NN-nombre.spec.mjs`): Mocha + `browser`,
  `$`, `expect` de WebdriverIO. Usa `tests/e2e/helpers.mjs` y actúa como
  una persona (clics y teclado). Cada archivo de specs empieza con la
  app recién instalada.
- Una prueba solo vale si ejecuta el código real y **se pone en rojo al
  romperlo**: rómpelo a propósito una vez, comprueba el rojo y deshazlo.
